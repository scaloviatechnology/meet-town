import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff,
  Users, PhoneOff, Smile, Maximize2, X, UserPlus, PhoneCall, Sparkles, Upload, Edit3
} from 'lucide-react';

const SOCKET_URL = 'http://localhost:4000';

const AVATAR_STYLES = [
  { id: 'dev', name: 'Dev Guy', emoji: '🧑‍💻' },
  { id: 'designer', name: 'Designer Pro', emoji: '🎨' },
  { id: 'manager', name: 'Boss', emoji: '👔' },
  { id: 'ninja', name: 'Ninja', emoji: '🥷' },
  { id: 'astronaut', name: 'Astronaut', emoji: '👨‍🚀' }
];

const offlineMembers = [
  { id: 'off-1', name: 'Alice Smith', activity: 'Away / Offline', emoji: '💤' },
  { id: 'off-2', name: 'David Lee', activity: 'In a meeting', emoji: '📅' },
  { id: 'off-3', name: 'Jessica Taylor', activity: 'Offline', emoji: '🌙' }
];

export default function App() {
  const savedProfile = (() => {
    try {
      const stored = localStorage.getItem('meettown_profile');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  })();

  const [joined, setJoined] = useState(false);
  const [userName, setUserName] = useState(savedProfile?.name || '');
  const [activity, setActivity] = useState(savedProfile?.activity || 'Building awesome stuff');
  const [selectedAvatar, setSelectedAvatar] = useState(savedProfile?.avatar || AVATAR_STYLES[0]);
  const [customImage, setCustomImage] = useState(savedProfile?.customImage || null);
  const [showCharacterModal, setShowCharacterModal] = useState(false);

  // States for Editing own profile modal
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState(userName);
  const [editActivity, setEditActivity] = useState(activity);

  const [socket, setSocket] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  // Position on map
  const [myPos, setMyPos] = useState({ x: 300, y: 300 });
  const [otherPositions, setOtherPositions] = useState({});

  // Media states
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [fullscreenStream, setFullscreenStream] = useState(null);

  // Profile Modal & Direct Meeting / Invite features
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [incomingInvite, setIncomingInvite] = useState(null);
  const [activeMeetingRoom, setActiveMeetingRoom] = useState(null);

  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);

  const peersRef = useRef({});
  const [remoteStreams, setRemoteStreams] = useState({});

  const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  // Auto-join if profile was previously saved in localStorage
  useEffect(() => {
    if (savedProfile && savedProfile.name) {
      setJoined(true);
    }
  }, []);

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    if (userName) {
      try {
        localStorage.setItem('meettown_profile', JSON.stringify({
          name: userName,
          activity,
          avatar: selectedAvatar,
          customImage
        }));
      } catch (e) {}
    }
  }, [userName, activity, selectedAvatar, customImage]);

  // Optimized keyboard movement (throttled to 50ms)
  useEffect(() => {
    if (!joined) return;

    let lastMove = 0;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const now = Date.now();
      if (now - lastMove < 50) return;
      lastMove = now;

      const speed = 12;
      setMyPos(prev => {
        let nx = prev.x;
        let ny = prev.y;
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') ny = Math.max(40, prev.y - speed);
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') ny = Math.min(650, prev.y + speed);
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') nx = Math.max(40, prev.x - speed);
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') nx = Math.min(950, prev.x + speed);

        if (nx !== prev.x || ny !== prev.y) {
          const updated = { x: nx, y: ny };
          socket?.emit('move-avatar', updated);
          return updated;
        }
        return prev;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [joined, socket]);

  useEffect(() => {
    if (!joined) return;

    const newSocket = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      timeout: 10000
    });
    setSocket(newSocket);

    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360, frameRate: 24 }, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        newSocket.emit('join-office', {
          userName,
          activity,
          avatar: selectedAvatar.id,
          emoji: selectedAvatar.emoji,
          customImage,
          x: myPos.x,
          y: myPos.y
        });
      })
      .catch(err => {
        console.error("Media error", err);
        newSocket.emit('join-office', {
          userName,
          activity,
          avatar: selectedAvatar.id,
          emoji: selectedAvatar.emoji,
          customImage,
          x: myPos.x,
          y: myPos.y
        });
      });

    newSocket.on('office-state', (users) => {
      setAllUsers(users);
      const map = {};
      users.forEach(u => {
        if (u.id !== newSocket.id) map[u.id] = u;
      });
      setOtherPositions(map);
    });

    newSocket.on('user-joined', async ({ peerId, userInfo }) => {
      const pc = createPeerConnection(peerId, newSocket);
      peersRef.current[peerId] = { pc };
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      newSocket.emit('offer', { target: peerId, offer });
    });

    newSocket.on('offer', async ({ sender, offer }) => {
      const pc = createPeerConnection(sender, newSocket);
      peersRef.current[sender] = { pc };
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      newSocket.emit('answer', { target: sender, answer });
    });

    newSocket.on('answer', async ({ sender, answer }) => {
      const peer = peersRef.current[sender];
      if (peer && peer.pc) await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    newSocket.on('ice-candidate', async ({ sender, candidate }) => {
      const peer = peersRef.current[sender];
      if (peer && peer.pc) await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    newSocket.on('meeting-invite', ({ fromName, roomId }) => {
      setIncomingInvite({ fromName, roomId });
    });

    newSocket.on('user-disconnected', ({ peerId }) => {
      if (peersRef.current[peerId]) {
        peersRef.current[peerId].pc.close();
        delete peersRef.current[peerId];
      }
      setRemoteStreams(prev => {
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
    });

    return () => {
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      Object.values(peersRef.current).forEach(p => p.pc.close());
      newSocket.disconnect();
    };
  }, [joined]);

  useEffect(() => {
    if (isScreenSharing && screenStreamRef.current && screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStreamRef.current;
    }
  }, [isScreenSharing]);

  const updateAvatarSelection = (newAvatar) => {
    setSelectedAvatar(newAvatar);
    setCustomImage(null);
    setShowCharacterModal(false);
    socket?.emit('update-activity', { avatar: newAvatar.id, emoji: newAvatar.emoji, customImage: null });
  };

  const handleCustomImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setCustomImage(base64String);
        setShowCharacterModal(false);
        socket?.emit('update-activity', { customImage: base64String, emoji: '📷' });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditProfileSave = () => {
    if (!editName.trim()) return;
    setUserName(editName);
    setActivity(editActivity);
    setShowEditProfileModal(false);
    socket?.emit('update-activity', { activity: editActivity, userName: editName });
  };

  const createPeerConnection = (peerId, socketInstance) => {
    const pc = new RTCPeerConnection(rtcConfig);
    pc.onicecandidate = (e) => {
      if (e.candidate) socketInstance.emit('ice-candidate', { target: peerId, candidate: e.candidate });
    };
    pc.ontrack = (e) => {
      setRemoteStreams(prev => ({ ...prev, [peerId]: e.streams[0] }));
    };
    return pc;
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const t = localStreamRef.current.getAudioTracks()[0];
      if (t) {
        t.enabled = !micActive;
        setMicActive(!micActive);
      }
    } else {
      setMicActive(!micActive);
    }
  };

  const toggleCam = () => {
    if (localStreamRef.current) {
      const t = localStreamRef.current.getVideoTracks()[0];
      if (t) {
        t.enabled = !camActive;
        setCamActive(!camActive);
      }
    } else {
      setCamActive(!camActive);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
        } catch (e1) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: 'screen'
              }
            }
          });
        }

        screenStreamRef.current = stream;
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }
        const track = stream.getVideoTracks()[0];

        Object.values(peersRef.current).forEach(p => {
          const sender = p.pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(track);
          }
        });

        setIsScreenSharing(true);
        socket?.emit('update-activity', { isScreenSharing: true });

        track.onended = () => {
          stopScreenShare();
        };
      } catch (err) {
        console.error("Screen share error:", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      Object.values(peersRef.current).forEach(p => {
        const sender = p.pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      });
    }
    setIsScreenSharing(false);
    socket?.emit('update-activity', { isScreenSharing: false });
  };

  const inviteUserToMeeting = (targetUserId) => {
    const roomId = `meeting-${socket.id}-${Date.now()}`;
    socket.emit('send-invite', { targetUserId, roomId, fromName: userName });
    setActiveMeetingRoom(roomId);
    setSelectedProfileUser(null);
    alert(`Meeting invitation sent!`);
  };

  const acceptInvite = () => {
    if (incomingInvite) {
      setActiveMeetingRoom(incomingInvite.roomId);
      setIncomingInvite(null);
    }
  };

  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#141824] p-6 text-white font-sans">
        <div className="bg-[#1b2230] border border-slate-700/80 p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-4 bg-indigo-600/20 text-indigo-400 rounded-2xl text-3xl overflow-hidden w-16 h-16 items-center justify-center">
              {customImage ? <img src={customImage} alt="Avatar" className="w-full h-full object-cover rounded-xl" /> : selectedAvatar.emoji}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Meet-Town 👋</h1>
            <p className="text-sm text-slate-400">Lightweight 2D virtual office. Hop in and hang out!</p>
          </div>

          <div className="flex justify-center gap-2">
            <button
              onClick={() => setShowCharacterModal(true)}
              className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-300 font-medium text-sm transition flex items-center gap-2 cursor-pointer"
            >
              <Smile className="w-4 h-4" /> Edit Avatar / Upload Photo
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-slate-300">Your Name</label>
              <input
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                placeholder="e.g. Sam"
                className="mt-1 w-full bg-[#121620] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-slate-300">What are you working on?</label>
              <input
                type="text"
                value={activity}
                onChange={e => setActivity(e.target.value)}
                placeholder="e.g. Coding & sipping coffee"
                className="mt-1 w-full bg-[#121620] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              disabled={!userName.trim()}
              onClick={() => setJoined(true)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              Enter Office 🚀
            </button>
          </div>
        </div>

        {showCharacterModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#1b2230] border border-slate-700 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
              <h3 className="font-bold text-lg text-white">Choose or Upload Avatar</h3>
              <div className="grid grid-cols-2 gap-3">
                {AVATAR_STYLES.map(av => (
                  <button
                    key={av.id}
                    onClick={() => updateAvatarSelection(av)}
                    className={`p-3 rounded-2xl border flex items-center gap-3 transition cursor-pointer ${!customImage && selectedAvatar.id === av.id ? 'bg-indigo-600/30 border-indigo-500' : 'bg-[#121620] border-slate-700 hover:border-slate-500'}`}
                  >
                    <span className="text-2xl">{av.emoji}</span>
                    <span className="text-sm font-medium text-white">{av.name}</span>
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleCustomImageUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-500/50 rounded-xl text-indigo-200 font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" /> Upload Avatar from Computer
                </button>
              </div>

              <button
                onClick={() => setShowCharacterModal(false)}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium text-sm transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Classy Gather Town Room Builder with room-specific tailored furniture
  const renderClassyRoom = (title, type, accentBorder, accentBg) => {
    return (
      <div className={`w-[46%] h-[270px] ${accentBg} border ${accentBorder} rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden backdrop-blur-xl`}>
        {/* Room Header */}
        <div className="flex items-center justify-between z-10">
          <span className="text-xs font-black uppercase tracking-widest text-white/90 bg-slate-900/80 px-3.5 py-1.5 rounded-xl border border-slate-700/60 shadow-md">
            {title}
          </span>
          <span className="text-[10px] text-indigo-300 font-semibold bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
            Interactive Zone
          </span>
        </div>

        {/* Room-specific Tailored Classy Furniture */}
        {type === 'dev' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Bookshelf top */}
            <div className="absolute top-4 right-6 bg-slate-900/90 border border-slate-700/80 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-inner text-xs">
              <span>📚</span><span>💻</span><span>Server Rack</span>
            </div>
            {/* Dual Coding Workstations */}
            <div className="grid grid-cols-2 gap-12 items-center">
              <div className="flex flex-col items-center">
                <div className="w-16 h-8 bg-slate-800 border border-slate-600 rounded-lg flex items-center justify-center shadow-xl">
                  <span className="text-xs">🖥️</span>
                </div>
                <div className="w-20 h-5 bg-slate-700/90 border border-slate-600 rounded-md -mt-0.5 shadow-md"></div>
                <div className="w-7 h-7 rounded-full bg-indigo-600/50 border border-indigo-400/60 -mt-2.5 flex items-center justify-center text-xs shadow">🪑</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-8 bg-slate-800 border border-slate-600 rounded-lg flex items-center justify-center shadow-xl">
                  <span className="text-xs">🖥️</span>
                </div>
                <div className="w-20 h-5 bg-slate-700/90 border border-slate-600 rounded-md -mt-0.5 shadow-md"></div>
                <div className="w-7 h-7 rounded-full bg-indigo-600/50 border border-indigo-400/60 -mt-2.5 flex items-center justify-center text-xs shadow">🪑</div>
              </div>
            </div>
            <div className="absolute bottom-3 left-4 text-xs opacity-75">🪴 Plant</div>
          </div>
        )}

        {type === 'design' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="absolute top-4 right-6 bg-slate-900/90 border border-slate-700/80 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-inner text-xs">
              <span>🎨</span><span>🖌️</span><span>Color Palette</span>
            </div>
            {/* Creative Drawing Tables */}
            <div className="grid grid-cols-2 gap-12 items-center">
              <div className="flex flex-col items-center">
                <div className="w-16 h-8 bg-purple-900/50 border border-purple-500/60 rounded-lg flex items-center justify-center shadow-xl">
                  <span className="text-xs">🖼️</span>
                </div>
                <div className="w-20 h-5 bg-slate-700/90 border border-slate-600 rounded-md -mt-0.5 shadow-md"></div>
                <div className="w-7 h-7 rounded-full bg-purple-600/50 border border-purple-400/60 -mt-2.5 flex items-center justify-center text-xs shadow">🪑</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-8 bg-purple-900/50 border border-purple-500/60 rounded-lg flex items-center justify-center shadow-xl">
                  <span className="text-xs">📐</span>
                </div>
                <div className="w-20 h-5 bg-slate-700/90 border border-slate-600 rounded-md -mt-0.5 shadow-md"></div>
                <div className="w-7 h-7 rounded-full bg-purple-600/50 border border-purple-400/60 -mt-2.5 flex items-center justify-center text-xs shadow">🪑</div>
              </div>
            </div>
            <div className="absolute bottom-3 left-4 text-xs opacity-75">🛋️ Lounge Couch</div>
          </div>
        )}

        {type === 'warroom' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="absolute top-4 right-6 bg-slate-900/90 border border-slate-700/80 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-inner text-xs">
              <span>📊</span><span>📋</span><span>Whiteboard</span>
            </div>
            {/* Large Conference Table */}
            <div className="flex flex-col items-center">
              <div className="w-36 h-12 bg-slate-800 border border-emerald-500/40 rounded-xl flex items-center justify-center shadow-2xl">
                <span className="text-xs font-bold text-emerald-300">Conference Table</span>
              </div>
              <div className="flex gap-8 -mt-1">
                <div className="w-7 h-7 rounded-full bg-emerald-600/50 border border-emerald-400/60 flex items-center justify-center text-xs shadow">🪑</div>
                <div className="w-7 h-7 rounded-full bg-emerald-600/50 border border-emerald-400/60 flex items-center justify-center text-xs shadow">🪑</div>
                <div className="w-7 h-7 rounded-full bg-emerald-600/50 border border-emerald-400/60 flex items-center justify-center text-xs shadow">🪑</div>
              </div>
            </div>
            <div className="absolute bottom-3 left-4 text-xs opacity-75">🌱 Ficus Plant</div>
          </div>
        )}

        {type === 'coffee' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="absolute top-4 right-6 bg-slate-900/90 border border-slate-700/80 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-inner text-xs">
              <span>☕</span><span>🍩</span><span>Coffee Bar</span>
            </div>
            {/* Round Coffee Table & Relaxing Sofas */}
            <div className="flex items-center gap-6">
              <div className="w-7 h-7 rounded-full bg-amber-600/50 border border-amber-400/60 flex items-center justify-center text-xs shadow">🛋️</div>
              <div className="w-16 h-10 bg-amber-950/60 border border-amber-500/40 rounded-full flex items-center justify-center shadow-xl">
                <span className="text-xs">☕ Table</span>
              </div>
              <div className="w-7 h-7 rounded-full bg-amber-600/50 border border-amber-400/60 flex items-center justify-center text-xs shadow">🛋️</div>
            </div>
            <div className="absolute bottom-3 left-4 text-xs opacity-75">🎸 Chill Area</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#121620] overflow-hidden select-none text-white font-sans">
      {/* Incoming Meeting Invite Banner */}
      {incomingInvite && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-indigo-600 border border-indigo-400 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-4 animate-bounce">
          <PhoneCall className="w-6 h-6 animate-pulse" />
          <div>
            <div className="font-bold text-sm">{incomingInvite.fromName} invited you to a meeting!</div>
            <div className="text-xs text-indigo-200">Join now to connect privately.</div>
          </div>
          <button
            onClick={acceptInvite}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Accept & Join
          </button>
          <button
            onClick={() => setIncomingInvite(null)}
            className="p-1.5 hover:bg-indigo-700 rounded-lg text-indigo-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Floating Video Pills - Centered Align */}
      <div className="absolute top-4 left-6 right-80 z-40 flex justify-center gap-3 overflow-x-auto pb-2 pointer-events-auto">
        {/* Local Video Pill */}
        <div className="relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden w-40 h-24 shadow-xl flex items-center justify-center shrink-0">
          <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${!camActive ? 'hidden' : ''}`} />
          {!camActive && (
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-xl shadow overflow-hidden">
              {customImage ? <img src={customImage} alt="Avatar" className="w-full h-full object-cover" /> : selectedAvatar.emoji}
            </div>
          )}
          <div className="absolute bottom-1.5 left-2 bg-slate-900/90 px-2 py-0.5 rounded-full text-[10px] font-medium text-slate-200">
            You {isScreenSharing && '• Sharing'}
          </div>
        </div>

        {/* Screen Share Pill */}
        {isScreenSharing && (
          <div className="relative group bg-slate-950 border border-indigo-500/50 rounded-2xl overflow-hidden w-52 h-24 shadow-xl flex items-center justify-center shrink-0">
            <video ref={screenVideoRef} autoPlay playsInline className="w-full h-full object-contain bg-black" />
            <div className="absolute bottom-1.5 left-2 bg-indigo-600 px-2 py-0.5 rounded-full text-[10px] font-medium text-white">
              Your Screen
            </div>
            <button
              onClick={() => setFullscreenStream({ stream: screenStreamRef.current, name: `${userName}'s Screen` })}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer text-white gap-1 text-xs font-bold"
            >
              <Maximize2 className="w-4 h-4" /> Fullscreen
            </button>
          </div>
        )}

        {/* Remote Streams */}
        {Object.entries(remoteStreams).map(([peerId, stream]) => (
          <RemoteVideoPill
            key={peerId}
            peerId={peerId}
            stream={stream}
            allUsers={allUsers}
            onFullscreen={(s, name) => setFullscreenStream({ stream: s, name })}
          />
        ))}
      </div>

      {/* Fullscreen Modal */}
      {fullscreenStream && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6">
          <div className="absolute top-6 right-6 flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-300 bg-slate-800/80 px-4 py-2 rounded-xl">
              Viewing {fullscreenStream.name}
            </span>
            <button
              onClick={() => setFullscreenStream(null)}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition cursor-pointer flex items-center gap-2 text-sm font-bold"
            >
              <X className="w-5 h-5" /> Close Fullscreen
            </button>
          </div>
          <div className="w-full h-[85vh] flex items-center justify-center">
            <FullScreenVideo stream={fullscreenStream.stream} />
          </div>
        </div>
      )}

      {/* Profile Modal when clicking another member */}
      {selectedProfileUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1b2230] border border-slate-700 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-20 h-20 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-4xl mx-auto shadow-inner overflow-hidden">
              {selectedProfileUser.customImage ? <img src={selectedProfileUser.customImage} alt="Avatar" className="w-full h-full object-cover" /> : (selectedProfileUser.emoji || '🧑‍💻')}
            </div>
            <div>
              <h3 className="font-bold text-xl text-white">{selectedProfileUser.name}</h3>
              <p className="text-xs text-indigo-400 mt-1 flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> {selectedProfileUser.activity || 'Working'}
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => inviteUserToMeeting(selectedProfileUser.id)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                <UserPlus className="w-4 h-4" /> Invite to Meeting / Call
              </button>
              <button
                onClick={() => setSelectedProfileUser(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit My Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1b2230] border border-slate-700 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">Edit Your Profile</h3>
              <button onClick={() => setShowEditProfileModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Avatar Preview & Upload */}
            <div className="flex flex-col items-center space-y-3">
              <div className="w-20 h-20 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-4xl overflow-hidden shadow-inner">
                {customImage ? <img src={customImage} alt="Avatar" className="w-full h-full object-cover" /> : selectedAvatar.emoji}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCharacterModal(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Choose Emoji
                </button>
                <input
                  type="file"
                  accept="image/*"
                  ref={editFileInputRef}
                  onChange={handleCustomImageUpload}
                  className="hidden"
                />
                <button
                  onClick={() => editFileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-200 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload Photo
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="mt-1 w-full bg-[#121620] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Activity / Status</label>
                <input
                  type="text"
                  value={editActivity}
                  onChange={e => setEditActivity(e.target.value)}
                  className="mt-1 w-full bg-[#121620] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              onClick={handleEditProfileSave}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm transition cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              Save Changes ✨
            </button>
          </div>
        </div>
      )}

      {/* Lightweight 2D Pixel Office Floor with Classy Tailored Room Furniture */}
      <div className="flex-1 relative bg-[#171c28] overflow-hidden flex flex-col">
        <div className="flex-1 relative bg-[radial-gradient(#263042_1px,transparent_1px)] [background-size:28px_28px] overflow-hidden p-8 flex flex-col justify-around">

          {/* Row 1: Dev Lounge & Design Studio */}
          <div className="flex justify-around gap-6">
            {renderClassyRoom("💻 Dev Lounge", "dev", "border-indigo-500/30", "bg-indigo-950/25")}
            {renderClassyRoom("🎨 Design Studio", "design", "border-purple-500/30", "bg-purple-950/25")}
          </div>

          {/* Row 2: Standup War Room & Coffee Corner */}
          <div className="flex justify-around gap-6">
            {renderClassyRoom("⚡ Standup & War Room", "warroom", "border-emerald-500/30", "bg-emerald-950/25")}
            {renderClassyRoom("☕ Coffee & Chill Corner", "coffee", "border-amber-500/30", "bg-amber-950/25")}
          </div>

          {/* My Avatar */}
          <div
            className="absolute transition-transform duration-100 ease-linear flex flex-col items-center z-30 pointer-events-none"
            style={{ left: `${myPos.x}px`, top: `${myPos.y}px`, transform: 'translate(-50%, -50%)' }}
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 border-2 border-white shadow-lg flex items-center justify-center text-xl overflow-hidden">
                {customImage ? <img src={customImage} alt="Avatar" className="w-full h-full object-cover" /> : selectedAvatar.emoji}
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
            </div>
            <div className="mt-1 bg-slate-900/90 border border-slate-700 text-white text-[11px] px-2 py-0.5 rounded-full shadow whitespace-nowrap font-medium">
              {userName} (You)
            </div>
          </div>

          {/* Other Users' Avatars */}
          {Object.entries(otherPositions).map(([id, u]) => (
            <div
              key={id}
              onClick={() => setSelectedProfileUser(u)}
              className="absolute transition-transform duration-200 ease-linear flex flex-col items-center z-20 cursor-pointer group"
              style={{ left: `${u.x}px`, top: `${u.y}px`, transform: 'translate(-50%, -50%)' }}
            >
              <div className="relative group-hover:scale-110 transition">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 border-2 border-slate-600 shadow-lg flex items-center justify-center text-xl overflow-hidden">
                  {u.customImage ? <img src={u.customImage} alt="Avatar" className="w-full h-full object-cover" /> : (u.emoji || '🧑‍💻')}
                </div>
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
              </div>
              <div className="mt-1 bg-slate-900/90 border border-slate-700 text-slate-200 text-[11px] px-2 py-0.5 rounded-full shadow whitespace-nowrap text-center">
                {u.name}
                <div className="text-[9px] text-indigo-400 truncate max-w-[100px]">{u.activity}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Sidebar: Active & Inactive Member List */}
      <aside className="w-72 border-l border-slate-800 bg-[#171c28]/95 backdrop-blur flex flex-col h-full z-30">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-bold text-sm text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" /> Team Members
          </h2>
          <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-medium">
            {allUsers.length} Active
          </span>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-5">
          {/* Active Members Section */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Active Online ({allUsers.length})
            </h3>
            <div className="space-y-2">
              {allUsers.map((u) => (
                <div
                  key={u.id}
                  onClick={() => {
                    if (u.id === socket?.id) {
                      setEditName(userName);
                      setEditActivity(activity);
                      setShowEditProfileModal(true);
                    } else {
                      setSelectedProfileUser(u);
                    }
                  }}
                  className="bg-[#1b2230] border border-slate-800 hover:border-slate-600 p-2.5 rounded-xl flex items-center justify-between transition cursor-pointer"
                  title={u.id === socket?.id ? "Click to edit your profile" : "Click to view profile"}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                      {u.customImage ? <img src={u.customImage} alt="Avatar" className="w-full h-full object-cover" /> : (u.emoji || '🧑‍💻')}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-white truncate">
                        {u.name} {u.id === socket?.id && '(You)'}
                      </div>
                      <div className="text-[10px] text-indigo-300 truncate">{u.activity || 'Working'}</div>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                </div>
              ))}
            </div>
          </div>

          {/* Inactive / Offline Members Section */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-600"></span> Offline ({offlineMembers.length})
            </h3>
            <div className="space-y-2">
              {offlineMembers.map((m) => (
                <div
                  key={m.id}
                  onClick={() => alert(`${m.name} is currently offline.`)}
                  className="bg-[#151922] border border-slate-800/60 p-2.5 rounded-xl flex items-center justify-between opacity-60 hover:opacity-100 transition cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <span className="text-xl shrink-0">{m.emoji}</span>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-slate-300 truncate">{m.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{m.activity}</div>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0"></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Bottom Gather Town Control Bar */}
      <div className="absolute bottom-4 left-[calc(50%-9rem)] -translate-x-1/2 bg-[#1b2230]/95 border border-slate-700 px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-4 z-50 backdrop-blur">
        <div
          onClick={() => {
            setEditName(userName);
            setEditActivity(activity);
            setShowEditProfileModal(true);
          }}
          className="flex items-center space-x-3 pr-4 border-r border-slate-700 cursor-pointer group hover:opacity-90 transition"
          title="Click to edit your name and avatar"
        >
          <div className="relative w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xl overflow-hidden">
            {customImage ? <img src={customImage} alt="Avatar" className="w-full h-full object-cover" /> : selectedAvatar.emoji}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
              <Edit3 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1">
              {userName} <Edit3 className="w-3 h-3 text-indigo-400 opacity-0 group-hover:opacity-100 transition" />
            </div>
            <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
            </div>
          </div>
        </div>

        <button
          onClick={toggleMic}
          className={`p-3 rounded-xl transition cursor-pointer ${micActive ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-600 text-white'}`}
          title="Microphone"
        >
          {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleCam}
          className={`p-3 rounded-xl transition cursor-pointer ${camActive ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-600 text-white'}`}
          title="Camera"
        >
          {camActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleScreenShare}
          className={`p-3 rounded-xl transition cursor-pointer ${isScreenSharing ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
          title="Share Screen"
        >
          {isScreenSharing ? <Monitor className="w-5 h-5 animate-pulse" /> : <MonitorOff className="w-5 h-5" />}
        </button>

        <button
          onClick={() => {
            setEditName(userName);
            setEditActivity(activity);
            setShowEditProfileModal(true);
          }}
          className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition cursor-pointer"
          title="Edit Profile"
        >
          <Edit3 className="w-5 h-5" />
        </button>

        <button
          onClick={() => setJoined(false)}
          className="p-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition cursor-pointer"
          title="Leave Office"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* Character Editor Modal */}
      {showCharacterModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1b2230] border border-slate-700 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Choose or Upload Avatar</h3>
            <div className="grid grid-cols-2 gap-3">
              {AVATAR_STYLES.map(av => (
                <button
                  key={av.id}
                  onClick={() => updateAvatarSelection(av)}
                  className={`p-3 rounded-2xl border flex items-center gap-3 transition cursor-pointer ${!customImage && selectedAvatar.id === av.id ? 'bg-indigo-600/30 border-indigo-500' : 'bg-[#121620] border-slate-700 hover:border-slate-500'}`}
                >
                  <span className="text-2xl">{av.emoji}</span>
                  <span className="text-sm font-medium text-white">{av.name}</span>
                </button>
              ))}
            </div>

            <div className="pt-2">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleCustomImageUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-500/50 rounded-xl text-indigo-200 font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" /> Upload Avatar from Computer
              </button>
            </div>

            <button
              onClick={() => setShowCharacterModal(false)}
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium text-sm transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RemoteVideoPill({ peerId, stream, allUsers, onFullscreen }) {
  const videoRef = useRef(null);
  const user = allUsers.find(u => u.id === peerId);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative group bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden w-40 h-24 shadow-xl flex items-center justify-center shrink-0">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-1.5 left-2 bg-slate-900/90 px-2 py-0.5 rounded-full text-[10px] font-medium text-slate-200">
        {user?.name || 'Peer'} {user?.isScreenSharing && '• Sharing'}
      </div>
      <button
        onClick={() => onFullscreen(stream, user?.name || 'Peer')}
        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer text-white gap-1 text-xs font-bold"
      >
        <Maximize2 className="w-4 h-4" /> Fullscreen
      </button>
    </div>
  );
}

function FullScreenVideo({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain rounded-2xl shadow-2xl bg-black" />
  );
}

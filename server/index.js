const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: ["http://localhost:3000", "app://."],
  methods: ["GET", "POST"]
}));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "app://."],
    methods: ["GET", "POST"]
  }
});

const users = new Map(); // socket.id -> { id, name, activity, avatar, emoji, x, y, isScreenSharing }

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-office', ({ userName, activity, avatar, emoji, customImage, x, y }) => {
    // Basic input sanitization / truncation
    const sanitizedName = String(userName || 'Anonymous').trim().slice(0, 30);
    const sanitizedActivity = String(activity || 'Working').trim().slice(0, 60);

    const userInfo = {
      id: socket.id,
      name: sanitizedName,
      activity: sanitizedActivity,
      avatar: avatar || 'dev',
      emoji: emoji || '🧑‍💻',
      customImage: customImage || null,
      x: typeof x === 'number' ? x : 300,
      y: typeof y === 'number' ? y : 300,
      isScreenSharing: false
    };

    users.set(socket.id, userInfo);

    io.emit('office-state', Array.from(users.values()));
    socket.broadcast.emit('user-joined', { peerId: socket.id, userInfo });
  });

  socket.on('move-avatar', ({ x, y }) => {
    const user = users.get(socket.id);
    if (user && typeof x === 'number' && typeof y === 'number') {
      user.x = Math.max(0, Math.min(1200, x));
      user.y = Math.max(0, Math.min(800, y));
      users.set(socket.id, user);
      io.emit('office-state', Array.from(users.values()));
    }
  });

  socket.on('update-activity', ({ activity, isScreenSharing, avatar, emoji, customImage }) => {
    const user = users.get(socket.id);
    if (user) {
      if (activity !== undefined) user.activity = String(activity).trim().slice(0, 60);
      if (isScreenSharing !== undefined) user.isScreenSharing = Boolean(isScreenSharing);
      if (avatar !== undefined) user.avatar = avatar;
      if (emoji !== undefined) user.emoji = emoji;
      if (customImage !== undefined) user.customImage = customImage;
      users.set(socket.id, user);
      io.emit('office-state', Array.from(users.values()));
    }
  });

  socket.on('send-invite', ({ targetUserId, roomId, fromName }) => {
    if (users.has(targetUserId)) {
      io.to(targetUserId).emit('meeting-invite', { fromName: String(fromName || '').slice(0, 30), roomId });
    }
  });

  // Validated WebRTC Signaling relay
  socket.on('offer', ({ target, offer }) => {
    if (users.has(target)) {
      io.to(target).emit('offer', { sender: socket.id, offer });
    }
  });

  socket.on('answer', ({ target, answer }) => {
    if (users.has(target)) {
      io.to(target).emit('answer', { sender: socket.id, answer });
    }
  });

  socket.on('ice-candidate', ({ target, candidate }) => {
    if (users.has(target)) {
      io.to(target).emit('ice-candidate', { sender: socket.id, candidate });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    users.delete(socket.id);
    io.emit('office-state', Array.from(users.values()));
    socket.broadcast.emit('user-disconnected', { peerId: socket.id });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Meet-Town Secured Signaling Server running on port ${PORT}`);
});

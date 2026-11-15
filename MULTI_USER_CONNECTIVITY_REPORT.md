# Meet-Town Multi-User Connectivity & Architecture Audit Report

**Date:** November 15, 2026  
**Project:** Meet-Town (Virtual Office & Live Meeting Electron Desktop App)  
**Target:** Verify whether multiple users can install the Electron desktop application on separate computers and join the same virtual office in real time over the internet.

---

## Executive Summary

Meet-Town is a lightweight 2D virtual office and WebRTC meeting application built with React, Vite, Tailwind CSS, Express, Socket.IO, and packaged as an Electron desktop application. 

Currently, **local-network (LAN) and internet-based connections are supported**, but **out-of-the-box cross-computer connectivity over the public internet is NOT fully ready** because the client code hardcodes `SOCKET_URL = 'http://localhost:4000'` [client/src/App.jsx:8](client/src/App.jsx#L8). If two users on separate computers install the Electron app, each user's app attempts to connect to `localhost:4000` on their own local machine rather than the shared cloud signaling server.

Furthermore, the WebRTC implementation relies entirely on a single public Google STUN server (`stun:stun.l.google.com:19302`) [client/src/App.jsx:74](client/src/App.jsx#L74) without a TURN relay server. For users behind symmetric NATs or restrictive corporate/hotel firewalls, direct peer-to-peer WebRTC connections will fail to establish audio, video, or screen sharing.

---

## Verification Checklist Results

| Check | Status | Detailed Finding |
| :--- | :--- | :--- |
| **1. Backend Public Deployment Configuration** | ⚠️ Partial | Express/Socket.IO backend (`server/index.js`) is correctly structured to accept incoming connections and CORS from `app://.` and other origins, but it is not deployed to a public cloud host (Heroku, Render, AWS, Fly.io, etc.). It currently runs locally on port 4000. |
| **2. Desktop Client Connection URL** | ❌ Missing / Hardcoded | `client/src/App.jsx` hardcodes `SOCKET_URL = 'http://localhost:4000'` [client/src/App.jsx:8](client/src/App.jsx#L8). Separate computers cannot connect to a shared backend unless this is replaced with a dynamic environment variable (`import.meta.env.VITE_SERVER_URL`) or configuration prompt. |
| **3. Socket.IO Synchronization** | ✅ Working (LAN) / ⚠️ Needs Public URL | Socket.IO correctly synchronizes user join events, 2D avatar movement (`move-avatar`), activity updates, presence state (`office-state`), meeting room invites, and disconnects when connected to the same signaling server. |
| **4. WebRTC Audio, Video & Screen Sharing** | ✅ Implemented | WebRTC peer connections, SDP offer/answer exchange, ICE candidate relay, local/remote video streams, and screen sharing (`navigator.mediaDevices.getDisplayMedia`) are fully implemented in `client/src/App.jsx`. |
| **5. STUN/TURN Configuration for NAT/Firewalls** | ⚠️ Partial (STUN Only) | Configured with `stun:stun.l.google.com:19302` [client/src/App.jsx:74](client/src/App.jsx#L74). Lacks a TURN server (e.g., Coturn, Twilio, Metered), meaning users behind strict symmetric NATs or firewalls will experience WebRTC connection failures. |
| **6. Authentication & Team Isolation** | ⚠️ Lightweight / Client-side | Meet-Town uses lightweight client-side username / avatar profiles stored in `localStorage` without database authentication, JWT tokens, or multi-tenant workspace isolation. Any user who joins can see all other users connected to that Socket.IO namespace. |
| **7. Reconnecting, Disconnecting & Offline Status** | ✅ Working | Socket.IO client has built-in auto-reconnection (`reconnectionAttempts: 5`, `timeout: 10000`) [client/src/App.jsx:133-136](client/src/App.jsx#L133-L136). Graceful cleanup on window close and socket disconnect updates room state immediately. |

---

## Detailed Analysis & Findings

### 1. Backend Public Deployment & Network Reachability
- **Current State:** The backend (`server/index.js`) listens on `process.env.PORT || 4000` [server/index.js:105](server/index.js#L105). CORS is configured to accept `http://localhost:3000` and `app://.` [server/index.js:8](server/index.js#L8).
- **Limitation:** To enable internet-based connections between separate computers, `server/index.js` must be deployed to a public cloud provider (e.g., Render, Railway, Fly.io, or an AWS EC2 instance with an Elastic IP or domain name).

### 2. Desktop Client Connection URL (`SOCKET_URL`)
- **Current State:** In `client/src/App.jsx`:
  ```javascript
  const SOCKET_URL = 'http://localhost:4000';
  ```
- **Limitation:** When built into an Electron `.exe` or `.dmg` and installed on two separate computers, both clients will connect to `http://localhost:4000` locally, failing to see each other.
- **Required Change:** Transition to using Vite environment variables:
  ```javascript
  const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'https://your-production-signaling-server.com';
  ```

### 3. Real-Time Socket.IO Synchronization
- When connected to a shared signaling server, Socket.IO correctly handles:
  - `join-office`: Registers user position, name, activity, and avatar.
  - `office-state`: Broadcasts updated array of all connected users.
  - `move-avatar`: Low-latency 2D coordinate updates.
  - `update-activity`: Syncs status messages and screen-sharing flags.
  - `send-invite` / `meeting-invite`: Direct room invitations.

### 4. WebRTC Audio, Video & Screen Sharing
- The application implements a full mesh WebRTC peer-to-peer topology:
  - When `user-joined` or `offer` / `answer` / `ice-candidate` events are received via Socket.IO, `RTCPeerConnection` is established.
  - Local media tracks (`getUserMedia`) and screen sharing tracks (`getDisplayMedia`) are dynamically added and negotiated.
- **Limitation:** In a full-mesh topology, bandwidth scales as $O(N^2)$. For >4 concurrent video streams in a virtual office, SFU (Selective Forwarding Unit) architecture like Mediasoup or LiveKit would be required, though peer-to-peer suffices for 1-on-1 or small huddles.

### 5. NAT traversal (STUN/TURN)
- **Current configuration:**
  ```javascript
  const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  ```
- **Risk:** Google STUN handles ~80% of consumer NATs. However, corporate firewalls, university networks, and symmetric NATs block direct UDP hole punching. Without a TURN server (Relay), users behind restrictive networks will experience black video feeds or failed WebRTC handshakes.

---

## Required Production Deployment Configuration

To make Meet-Town fully operational across the public internet:

1. **Deploy Backend Signaling Server:**
   - Deploy `server/` to a PaaS (Render, Fly.io, Railway) or VPS.
   - Ensure the server URL uses HTTPS / WSS (Secure WebSockets), as Electron and modern browsers enforce secure contexts for WebRTC and media devices (`navigator.mediaDevices`).
2. **Configure Frontend Environment Variable:**
   - Create `client/.env.production`:
     ```env
     VITE_SERVER_URL=https://meet-town-backend.onrender.com
     ```
3. **Add TURN Server for Firewalls:**
   - Supplement `rtcConfig` with a paid or self-hosted TURN server (e.g., Coturn):
     ```javascript
     const rtcConfig = {
       iceServers: [
         { urls: 'stun:stun.l.google.com:19302' },
         {
           urls: 'turn:your-turn-server.com:3478',
           username: 'meet-town',
           credential: 'secure-password'
         }
       ]
     };
     ```

---

## Exact Files and Code Locations Requiring Changes

1. **[client/src/App.jsx:8](client/src/App.jsx#L8)**
   - *Current:* `const SOCKET_URL = 'http://localhost:4000';`
   - *Change to:* `const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';`
2. **[client/vite.config.js](client/vite.config.js)**
   - Add build output configuration and environment variable loading if necessary.
3. **[server/index.js:7-10](server/index.js#L7-L10)**
   - Update CORS origins to include production domains and wildcard/secure patterns as needed.
4. **[client/src/App.jsx:74](client/src/App.jsx#L74)**
   - Update `rtcConfig` to include production TURN servers for bulletproof cross-network connectivity.

---

## Practical Test Plan (Two Separate Computers & Internet Connections)

### Prerequisites
- Two separate computers (e.g., Laptop A on Wi-Fi, Laptop B on mobile hotspot / different network).
- Publicly accessible deployment of the backend server at `https://your-signaling-server.com`.
- Production build of the Electron app pointing to `https://your-signaling-server.com`.

### Test Steps
1. **Deployment Verification:**
   - Verify backend health by visiting `https://your-signaling-server.com` in a browser.
2. **App Installation & Launch:**
   - Install Meet-Town desktop app on Laptop A and Laptop B.
3. **Connection & Presence Test:**
   - Launch app on Laptop A, enter Name "Alice", and enter office.
   - Launch app on Laptop B, enter Name "Bob", and enter office.
   - **Expected Result:** Both Alice and Bob see each other's avatars on the 2D office map and in the Active Team Members sidebar.
4. **Movement Synchronization Test:**
   - Use W/A/S/D or Arrow keys on Laptop A to move Alice's avatar across rooms.
   - **Expected Result:** Bob's screen updates in real time (<100ms latency) showing Alice's new 2D coordinates.
5. **Activity & Status Test:**
   - Update status/activity message or upload a custom avatar on Laptop A.
   - **Expected Result:** Bob's sidebar and avatar tooltip reflect Alice's updated status instantly.
6. **WebRTC Audio/Video & Meeting Invite Test:**
   - Click on Bob's avatar from Laptop A and click "Invite to Meeting / Call".
   - Accept the incoming meeting invite modal on Laptop B.
   - Enable Camera and Microphone on both laptops.
   - **Expected Result:** Video pills appear at the top of the screen; bidirectional audio and video stream successfully.
7. **Screen Sharing Test:**
   - Click "Share Screen" on Laptop A.
   - **Expected Result:** Screen stream is captured and displayed in real time to Laptop B.
8. **Disconnection & Reconnection Test:**
   - Close Laptop B's app or disconnect network.
   - **Expected Result:** Laptop A sees Laptop B instantly removed from the active users list. Re-enabling connection successfully auto-reconnects via Socket.IO.

# Meet-Town — Free Self-Hosted Virtual Office & Desktop Team Meeting App

**Meet-Town** is a 100% free, open-source Gather Town style virtual office, video meeting, and team presence desktop application designed for remote teams.

---

## 🚀 One-Line Installation Command for Team Members

Team members can install and run Meet-Town instantly on their PC (Linux, macOS, or Windows WSL) using the GitHub installer script:

```bash
git clone https://github.com/scaloviatechnology/meet-town.git ~/.meettown && cd ~/.meettown && bash install.sh
```

Or if hosted, via curl/bash:
```bash
bash <(curl -s https://raw.githubusercontent.com/scaloviatechnology/meet-town/main/install.sh)
```

---

## ▶️ Starting the Desktop App

Once installed, teammates can start the virtual office and desktop client with a single command:

```bash
bash ~/.meettown/start-meettown.sh
```

---

## Features
- **Gather Town 2D Pixel Office Map**: Interactive office floor where avatars move smoothly using W A S D or Arrow Keys across zones (Dev Lounge, Design Studio).
- **Cartoon Avatars & Custom Photo Upload**: Choose pre-set cartoon avatars or upload any custom photo from your computer. Your profile and avatar persist automatically (`localStorage`).
- **P2P Video Meetings & Screen Sharing**: High-quality peer-to-peer video/audio streams and desktop screen sharing with Fullscreen view support.
- **Team Members Sidebar**: Real-time list tracking active online and offline team members.
- **Direct Meeting Invites & Profile Modals**: Click any member's avatar to view their profile and invite them to a private meeting or call with instant in-app alerts.

---

## Security Documentation
- Security Audit Report: [`docs/SECURITY_AUDIT_REPORT.md`](docs/SECURITY_AUDIT_REPORT.md)
- Security Remediation Report: [`docs/SECURITY_REMEDIATION_REPORT.md`](docs/SECURITY_REMEDIATION_REPORT.md)

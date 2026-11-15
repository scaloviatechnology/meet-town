#!/usr/bin/env bash
set -e

REPO_URL="https://github.com/scaloviatechnology/meet-town.git"
INSTALL_DIR="${HOME}/.meettown"

echo "=== Installing Meet-Town from GitHub ==="

if ! command -v node &> /dev/null; then
    echo "Error: Node.js (v18+) is required. Please install Node.js and try again."
    exit 1
fi

if [ -d "$INSTALL_DIR" ]; then
    echo "-> Updating existing installation at ${INSTALL_DIR}..."
    cd "$INSTALL_DIR"
    git pull origin main || true
else
    echo "-> Cloning repository into ${INSTALL_DIR}..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo "-> Installing Server Dependencies..."
cd server
npm install --production

echo "-> Installing Client & Electron Dependencies..."
cd ../client
npm install
npm run build

# Create global launcher script
cat << 'EOF' > "${INSTALL_DIR}/start-meettown.sh"
#!/usr/bin/env bash
INSTALL_DIR="${HOME}/.meettown"
echo "Starting Meet-Town Signaling Server..."
cd "${INSTALL_DIR}/server"
PORT=4000 node index.js &
SERVER_PID=$!

sleep 1

echo "Starting Meet-Town Desktop App..."
cd "${INSTALL_DIR}/client"
npx electron . &
ELECTRON_PID=$!

trap "kill $SERVER_PID $ELECTRON_PID; exit" INT TERM
wait
EOF

chmod +x "${INSTALL_DIR}/start-meettown.sh"

# Create symlink or add to bin if possible
echo "=================================================="
echo "✅ Meet-Town successfully installed!"
echo "To start Meet-Town anytime, run:"
echo "  bash ~/.meettown/start-meettown.sh"
echo "=================================================="

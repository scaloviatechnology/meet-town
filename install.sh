#!/usr/bin/env bash
set -e

REPO_URL="https://github.com/scaloviatechnology/meet-town.git"

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
    INSTALL_DIR="${USERPROFILE}/.meettown"
else
    INSTALL_DIR="${HOME}/.meettown"
fi

echo "=== Checking System Prerequisites for Meet-Town ==="

# Check if Node.js is installed and version >= 18
has_node=false
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo "✅ Node.js v$(node -v) detected."
        has_node=true
    else
        echo "⚠️ Node.js version is older than v18 (detected v$(node -v)). Upgrading required..."
    fi
else
    echo "❌ Node.js is not installed."
fi

# Auto-install Node.js if missing or outdated
if [ "$has_node" = false ]; then
    echo "-> Automatically installing Node.js (LTS)..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install node
        else
            echo "Error: Homebrew not found. Please install Node.js manually from https://nodejs.org/"
            exit 1
        fi
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
        echo "Error: Please install Node.js manually on Windows from https://nodejs.org/"
        exit 1
    else
        # Linux auto-install via NodeSource or nvm
        if command -v apt-get &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y nodejs npm
        else
            echo "Error: Could not auto-install Node.js. Please install Node.js (v18+) manually."
            exit 1
        fi
    fi
fi

echo "-> Setting up installation directory at ${INSTALL_DIR}..."
if [ -d "$INSTALL_DIR" ]; then
    cd "$INSTALL_DIR"
    git pull origin main || true
else
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

cat << 'EOF' > "${INSTALL_DIR}/start-meettown.sh"
#!/usr/bin/env bash
INSTALL_DIR="${HOME}/.meettown"
[[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]] && INSTALL_DIR="${USERPROFILE}/.meettown"

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

echo "=================================================="
echo "✅ Meet-Town successfully installed and ready!"
echo "To start Meet-Town anytime, run:"
echo "  bash ${INSTALL_DIR}/start-meettown.sh"
echo "=================================================="

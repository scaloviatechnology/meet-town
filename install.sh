#!/usr/bin/env bash
set -e

REPO_URL="https://github.com/scaloviatechnology/meet-town.git"

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
    INSTALL_DIR="${USERPROFILE}/.meettown"
    DESKTOP_DIR="${USERPROFILE}/Desktop"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    INSTALL_DIR="${HOME}/.meettown"
    DESKTOP_DIR="${HOME}/Desktop"
else
    INSTALL_DIR="${HOME}/.meettown"
    DESKTOP_DIR="${HOME}/Desktop"
fi

echo "=== Installing Meet-Town & App Icon Across Platforms ==="

# Check Node.js v18+
has_node=false
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo "✅ Node.js v$(node -v) detected."
        has_node=true
    fi
fi

if [ "$has_node" = false ]; then
    echo "-> Installing Node.js (LTS)..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install node || { echo "Please install Node.js manually from https://nodejs.org/"; exit 1; }
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
        echo "Error: Please install Node.js manually on Windows from https://nodejs.org/"
        exit 1
    else
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs || sudo dnf install -y nodejs npm || true
    fi
fi

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

echo "-> Installing Client Dependencies & Building..."
cd ../client
npm install
npm run build

# Create unified startup script
cat << 'EOF' > "${INSTALL_DIR}/start-meettown.sh"
#!/usr/bin/env bash
INSTALL_DIR="${HOME}/.meettown"
[[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]] && INSTALL_DIR="${USERPROFILE}/.meettown"

if ! lsof -i:4000 >/dev/null 2>&1; then
    cd "${INSTALL_DIR}/server"
    PORT=4000 node index.js &
    sleep 1
fi

cd "${INSTALL_DIR}/client"
npx electron .
EOF

chmod +x "${INSTALL_DIR}/start-meettown.sh"

# Cross-platform Desktop Shortcut & App Icon Generator
echo "-> Configuring Desktop App Icon & Shortcuts..."
ICON_SRC="${INSTALL_DIR}/client/assets/icon.svg"
PNG_ICON="${INSTALL_DIR}/client/assets/icon.png"

if command -v rsvg-convert &> /dev/null; then
    rsvg-convert -w 256 -h 256 "$ICON_SRC" -o "$PNG_ICON" 2>/dev/null || cp "$ICON_SRC" "$PNG_ICON"
elif command -v convert &> /dev/null; then
    convert -background none -resize 256x256 "$ICON_SRC" "$PNG_ICON" 2>/dev/null || cp "$ICON_SRC" "$PNG_ICON"
else
    cp "$ICON_SRC" "$PNG_ICON"
fi

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    mkdir -p "${HOME}/.local/share/applications"
    cat << EOF > "${HOME}/.local/share/applications/meettown.desktop"
[Desktop Entry]
Name=Meet-Town
Comment=Gather Town Style Virtual Office
Exec=bash ${INSTALL_DIR}/start-meettown.sh
Icon=${PNG_ICON}
Terminal=false
Type=Application
Categories=Network;Chat;Office;
StartupNotify=true
StartupWMClass=meet-town
EOF
    chmod +x "${HOME}/.local/share/applications/meettown.desktop"
    if [ -d "$DESKTOP_DIR" ]; then
        cp "${HOME}/.local/share/applications/meettown.desktop" "${DESKTOP_DIR}/Meet-Town.desktop"
        chmod +x "${DESKTOP_DIR}/Meet-Town.desktop"
        gio set "${DESKTOP_DIR}/Meet-Town.desktop" metadata::trusted true 2>/dev/null || true
    fi
    update-desktop-database "${HOME}/.local/share/applications" 2>/dev/null || true
    echo "-> Linux application menu and desktop icon created!"

elif [[ "$OSTYPE" == "darwin"* ]]; then
    cat << EOF > "${INSTALL_DIR}/Meet-Town.command"
#!/usr/bin/env bash
bash ${INSTALL_DIR}/start-meettown.sh
EOF
    chmod +x "${INSTALL_DIR}/Meet-Town.command"
    if [ -d "$DESKTOP_DIR" ]; then
        ln -sf "${INSTALL_DIR}/Meet-Town.command" "${DESKTOP_DIR}/Meet-Town"
    fi
    echo "-> macOS desktop launcher created!"

elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
    powershell.exe -Command "\$WshShell = New-Object -ComObject WScript.Shell; \$Shortcut = \$WshShell.CreateShortcut('${DESKTOP_DIR}\\Meet-Town.lnk'); \$Shortcut.TargetPath = 'bash.exe'; \$Shortcut.Arguments = '${INSTALL_DIR}/start-meettown.sh'; \$Shortcut.IconLocation = '${INSTALL_DIR}\\client\\assets\\icon.png'; \$Shortcut.Save()" 2>/dev/null || true
    echo "-> Windows desktop shortcut with icon created!"
fi

echo "=================================================="
echo "✅ Meet-Town successfully installed with App Icon!"
echo "You can now find Meet-Town in your system app menu & desktop!"
echo "=================================================="

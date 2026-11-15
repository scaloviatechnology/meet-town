#!/usr/bin/env bash
INSTALL_DIR="${HOME}/.meettown"
DESKTOP_DIR="${HOME}/Desktop"

echo "=== Creating Meet-Town Desktop & App Menu Shortcut ==="

mkdir -p "${HOME}/.local/share/applications"

cat << EOF > "${HOME}/.local/share/applications/meettown.desktop"
[Desktop Entry]
Name=Meet-Town
Comment=Gather Town Style Virtual Office
Exec=bash ${INSTALL_DIR}/start-meettown.sh
Terminal=false
Type=Application
Categories=Network;Chat;Office;
StartupNotify=true
EOF

chmod +x "${HOME}/.local/share/applications/meettown.desktop"

if [ -d "$DESKTOP_DIR" ]; then
    cp "${HOME}/.local/share/applications/meettown.desktop" "${DESKTOP_DIR}/Meet-Town.desktop"
    chmod +x "${DESKTOP_DIR}/Meet-Town.desktop"
    gio set "${DESKTOP_DIR}/Meet-Town.desktop" metadata::trusted true 2>/dev/null || true
    echo "-> Desktop icon created successfully!"
fi

update-desktop-database "${HOME}/.local/share/applications" 2>/dev/null || true

echo "✅ Shortcut installed successfully!"

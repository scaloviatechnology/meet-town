#!/usr/bin/env bash
INSTALL_DIR="${HOME}/.meettown"
DESKTOP_DIR="${HOME}/Desktop"

echo "=== Fixing Linux App Icon for Zorin OS / GNOME ==="

# Convert SVG to PNG if possible, or use standard icon path correctly recognized by Linux desktop environments
ICON_SRC="${INSTALL_DIR}/client/assets/icon.svg"
PNG_ICON="${INSTALL_DIR}/client/assets/icon.png"

# Check if ImageMagick (convert) or rsvg-convert exists to make a 256x256 PNG icon
if command -v rsvg-convert &> /dev/null; then
    rsvg-convert -w 256 -h 256 "$ICON_SRC" -o "$PNG_ICON"
elif command -v convert &> /dev/null; then
    convert -background none -resize 256x256 "$ICON_SRC" "$PNG_ICON"
else
    # Fallback copy svg
    cp "$ICON_SRC" "${INSTALL_DIR}/client/assets/icon.png"
fi

mkdir -p "${HOME}/.local/share/applications"
cat << EOF > "${HOME}/.local/share/applications/meettown.desktop"
[Desktop Entry]
Name=Meet-Town
Comment=Gather Town Style Virtual Office
Exec=bash ${INSTALL_DIR}/start-meettown.sh
Icon=${INSTALL_DIR}/client/assets/icon.png
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

echo "✅ App icon fixed and registered successfully!"

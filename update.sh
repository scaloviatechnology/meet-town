#!/usr/bin/env bash
INSTALL_DIR="${HOME}/.meettown"

echo "=== Updating Meet-Town to Latest Version ==="

if [ -d "$INSTALL_DIR" ]; then
    cd "$INSTALL_DIR"
    echo "-> Pulling latest code from GitHub..."
    git pull origin main

    echo "-> Rebuilding client and updating dependencies..."
    cd server
    npm install --production

    cd ../client
    npm install
    npm run build

    echo "✅ Meet-Town successfully updated!"
    echo "You can now restart the app from your Desktop icon."
else
    echo "Meet-Town is not installed in ${INSTALL_DIR}. Running full installer..."
    git clone https://github.com/scaloviatechnology/meet-town.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    bash install.sh
fi

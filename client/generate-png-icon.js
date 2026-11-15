#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Create icons directory for PNGs
const iconsDir = path.join(process.cwd(), 'assets', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirNames?.(iconsDir, { recursive: true }) || fs.mkdirSync(iconsDir, { recursive: true });
}

console.log("Preparing app icon assets...");

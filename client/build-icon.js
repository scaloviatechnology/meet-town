import fs from 'fs';
import path from 'path';

// Create assets dir if not exists
const assetsDir = path.join(process.cwd(), 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Simple SVG icon content
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="110" fill="#4f46e5"/>
  <path d="M140 200h232c22.1 0 40 17.9 40 40v132c0 22.1-17.9 40-40 40H140c-22.1 0-40-17.9-40-40V240c0-22.1 17.9-40 40-40z" fill="#1e1b4b"/>
  <circle cx="256" cy="286" r="45" fill="#38bdf8"/>
  <path d="M220 370l36-50 36 50z" fill="#38bdf8"/>
  <circle cx="200" cy="130" r="45" fill="#f43f5e"/>
  <circle cx="312" cy="130" r="45" fill="#10b981"/>
</svg>`;

fs.writeFileSync(path.join(assetsDir, 'icon.svg'), svgContent);
console.log("Icon SVG created successfully.");

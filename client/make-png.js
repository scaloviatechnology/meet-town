import fs from 'fs';
import path from 'path';

const assetsDir = path.join(process.cwd(), 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const buffer = Buffer.from(PNG_BASE64, 'base64');
fs.writeFileSync(path.join(assetsDir, 'icon.png'), buffer);
console.log("PNG icon generated successfully.");

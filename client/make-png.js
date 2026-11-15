import { app } from 'electron';
import fs from 'fs';
import path from 'path';

// Generate a valid PNG data URI or simple 1x1 base64 transparent/colored PNG so desktop environments never fail to load an icon.
// A 1x1 red/indigo pixel PNG base64 representation:
const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function writeBase64Png(targetPath) {
  const buffer = Buffer.from(PNG_BASE64, 'base64');
  fs.writeFileSync(targetPath, buffer);
}

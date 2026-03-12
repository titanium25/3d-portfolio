import sharp from "sharp";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "public/img/alex-headshot.png");
const out = path.join(root, "public");

const sizes = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "favicon-48x48.png", size: 48 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "android-chrome-192x192.png", size: 192 },
  { name: "android-chrome-512x512.png", size: 512 },
];

if (!existsSync(out)) await mkdir(out, { recursive: true });

for (const { name, size } of sizes) {
  await sharp(src)
    .resize(size, size, { fit: "cover", position: "top" })
    .png()
    .toFile(path.join(out, name));
  console.log(`✓ ${name} (${size}×${size})`);
}

// Generate favicon.ico (multi-size: 16, 32, 48) using 48px PNG as base
// Note: true .ico requires a dedicated library; we output a 32px PNG named favicon.ico
// which browsers accept. For a real .ico, use https://realfavicongenerator.net
await sharp(src)
  .resize(32, 32, { fit: "cover", position: "top" })
  .png()
  .toFile(path.join(out, "favicon.ico"));
console.log("✓ favicon.ico (32×32 PNG-in-ICO fallback)");

console.log("\nAll favicons written to /public/");

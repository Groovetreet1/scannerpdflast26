import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(__dirname, '../assets');

const SIZES = {
  'icon.png': 1024,
  'favicon.png': 48,
  'splash-icon.png': 1284,
  'android-icon-foreground.png': 1024,
  'android-icon-background.png': 1024,
  'android-icon-monochrome.png': 1024,
};

// SVG template for scanner logo
function svgLogo(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a73e8"/>
      <stop offset="100%" stop-color="#0d47a1"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="200" fill="url(#bg)"/>
  <!-- Document -->
  <rect x="260" y="180" width="504" height="664" rx="40" fill="white" opacity="0.95"/>
  <rect x="340" y="320" width="344" height="20" rx="10" fill="#ccc"/>
  <rect x="340" y="380" width="280" height="16" rx="8" fill="#ddd"/>
  <rect x="340" y="430" width="300" height="16" rx="8" fill="#ddd"/>
  <rect x="340" y="480" width="160" height="16" rx="8" fill="#ddd"/>
  <!-- Scanner line -->
  <rect x="300" y="620" width="420" height="8" rx="4" fill="#1a73e8" opacity="0.6"/>
  <!-- Checkmark -->
  <circle cx="720" cy="740" r="80" fill="#4caf50"/>
  <polyline points="680,740 710,770 760,710" stroke="white" stroke-width="14" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

// Monochrome SVG
function svgMonochrome(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect x="260" y="180" width="504" height="664" rx="40" fill="white"/>
  <rect x="340" y="320" width="344" height="20" rx="10" fill="white" opacity="0.4"/>
  <rect x="340" y="380" width="280" height="16" rx="8" fill="white" opacity="0.3"/>
  <rect x="340" y="430" width="300" height="16" rx="8" fill="white" opacity="0.3"/>
  <rect x="340" y="480" width="160" height="16" rx="8" fill="white" opacity="0.3"/>
  <rect x="300" y="620" width="420" height="8" rx="4" fill="white" opacity="0.5"/>
</svg>`;
}

async function generate() {
  for (const [file, size] of Object.entries(SIZES)) {
    const outPath = path.join(assetsDir, file);
    const isBg = file === 'android-icon-background.png';

    if (isBg) {
      // Plain background
      await sharp({
        create: { width: size, height: size, channels: 4, background: { r: 0x1a, g: 0x73, b: 0xe8, alpha: 1 } }
      }).png().toFile(outPath);
      console.log(`  ${file} (${size}x${size})`);
      continue;
    }

    const isMonochrome = file === 'android-icon-monochrome.png';
    const svg = isMonochrome ? svgMonochrome(size) : svgLogo(size);

    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
    console.log(`  ${file} (${size}x${size})`);
  }
}

generate().catch(console.error);

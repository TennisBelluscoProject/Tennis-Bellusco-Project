// Script to generate PWA icons as PNG files
// Run: node scripts/generate-icons.js
//
// OPTION 1 (recommended): Use an online tool
//   Go to https://realfavicongenerator.net/
//   Upload the SVG from public/icons/icon.svg
//   Download the generated icons
//   Place icon-192x192.png and icon-512x512.png in public/icons/
//
// OPTION 2: Use this script (requires: npm install canvas --save-dev)
//
// OPTION 3: Use sharp (requires: npm install sharp --save-dev)
//   Uncomment the sharp section below

const fs = require('fs');
const path = require('path');

// ─── Try with 'canvas' package ───
try {
  const { createCanvas } = require('canvas');

  function generateIcon(size, outputPath) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const s = size / 192;

    // Red rounded background
    const r = 40 * s;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = '#C41E3A';
    ctx.fill();

    // Tennis ball
    const cx = size / 2;
    const cy = size / 2;
    const br = 52 * s;

    ctx.beginPath();
    ctx.arc(cx, cy, br, 0, Math.PI * 2);
    ctx.fillStyle = '#AACC44';
    ctx.fill();
    ctx.strokeStyle = '#7A9A2E';
    ctx.lineWidth = 3 * s;
    ctx.stroke();

    // Ball seams
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 4 * s;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(44 * s, cy);
    ctx.bezierCurveTo(60 * s, 72 * s, 132 * s, 72 * s, 148 * s, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(44 * s, cy);
    ctx.bezierCurveTo(60 * s, 120 * s, 132 * s, 120 * s, 148 * s, cy);
    ctx.stroke();

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Generated ${outputPath} (${size}x${size})`);
  }

  const iconsDir = path.join(__dirname, '..', 'public', 'icons');
  generateIcon(192, path.join(iconsDir, 'icon-192x192.png'));
  generateIcon(512, path.join(iconsDir, 'icon-512x512.png'));
  console.log('\nDone! PNG icons generated successfully.');
  process.exit(0);

} catch (e) {
  console.log('canvas package not found. Trying sharp...\n');
}

// ─── Try with 'sharp' package ───
try {
  const sharp = require('sharp');
  const svgPath = path.join(__dirname, '..', 'public', 'icons', 'icon.svg');
  const svg = fs.readFileSync(svgPath);
  const iconsDir = path.join(__dirname, '..', 'public', 'icons');

  Promise.all([
    sharp(svg).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192x192.png')),
    sharp(svg).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512x512.png')),
  ]).then(() => {
    console.log('✅ PNG icons generated with sharp.');
  });

} catch (e) {
  console.log('─────────────────────────────────────');
  console.log('Neither canvas nor sharp is installed.');
  console.log('');
  console.log('Quick fix — pick ONE:');
  console.log('  npm install canvas --save-dev');
  console.log('  npm install sharp --save-dev');
  console.log('');
  console.log('Then re-run: node scripts/generate-icons.js');
  console.log('');
  console.log('OR use https://realfavicongenerator.net/ with');
  console.log('the SVG at public/icons/icon.svg');
  console.log('─────────────────────────────────────');
}

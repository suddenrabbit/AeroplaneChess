// Developer-only exporter. Install sharp locally to regenerate; production has no build step.
const sharp = require('sharp');
const path = require('node:path');
const dir = path.join(__dirname, '../public/icons');
async function main() {
  for (const [name, size] of [
    ['icon-32.png', 32], ['icon-192.png', 192], ['icon-512.png', 512],
    ['apple-touch-icon.png', 180], ['icon-maskable-512.png', 512]
  ]) {
    await sharp(path.join(dir, 'icon.svg')).resize(size, size)
      .flatten({ background: '#101a36' }).png().toFile(path.join(dir, name));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

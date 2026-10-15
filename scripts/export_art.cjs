const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../art/v2');
const pubV2 = path.resolve(__dirname, '../public/assets/v2');
(async () => {
  await fs.mkdir(pubV2, { recursive: true });
  for (const file of (await fs.readdir(path.join(root, 'svg'))).filter(f => f.endsWith('.svg'))) {
    const pngName = file.replace('.svg', '.png');
    const outPng = path.join(root, 'png', pngName);
    await sharp(path.join(root, 'svg', file)).png().toFile(outPng);
    await fs.copyFile(outPng, path.join(pubV2, pngName));
  }
  const sheet2x = path.join(root, 'png/chaua-flight-sheet@2x.png');
  await sharp(path.join(root, 'svg/chaua-flight-sheet.svg'), { density: 144 }).png().toFile(sheet2x);
  await fs.copyFile(sheet2x, path.join(pubV2, 'chaua-flight-sheet@2x.png'));
  await sharp(path.join(root, 'review/overview.svg')).png().toFile(path.join(root, 'review/Chaua-Educa-Prancha.png'));
  for (const atlas of ['chaua-flight-atlas.json', 'chaua-flight-atlas@2x.json']) {
    try {
      await fs.copyFile(path.join(root, atlas), path.join(pubV2, atlas));
    } catch {}
  }
  console.log('Exported 29 PNG assets, overview, and synced to public/assets/v2.');
})();


// Set NODE_PATH to the installed sharp dependency, or run `npm install --no-save sharp`.
const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../art/v2');
(async () => {
  for (const file of (await fs.readdir(path.join(root, 'svg'))).filter(f => f.endsWith('.svg'))) {
    await sharp(path.join(root, 'svg', file)).png().toFile(path.join(root, 'png', file.replace('.svg', '.png')));
  }
  await sharp(path.join(root, 'svg/chaua-flight-sheet.svg'),{density:144}).png().toFile(path.join(root, 'png/chaua-flight-sheet@2x.png'));
  await sharp(path.join(root, 'review/overview.svg')).png().toFile(path.join(root, 'review/Chaua-Educa-Prancha.png'));
  console.log('Exported 29 PNG assets and overview.');
})();

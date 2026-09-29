const sharp = require('../../artifact_node_modules/sharp');
const fs = require('node:fs');
const root = 'c4f/public/images/';
Promise.all(fs.readdirSync(root).map(async (f, i) => ({
  input: await sharp(root + f).resize(260, 180, { fit: 'contain', background: '#eeeeee' }).extend({ bottom: 25, background: '#ffffff' }).png().toBuffer(),
  left: (i % 4) * 260, top: Math.floor(i / 4) * 205,
}))).then(images => sharp({ create: { width: 1040, height: 820, channels: 3, background: '#fff' } }).composite(images).png().toFile('c4f/.import/contact-sheet.png'));

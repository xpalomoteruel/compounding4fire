import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../artifact_node_modules/package.json', import.meta.url));
const sharp = require('./sharp');
const root = resolve(import.meta.dirname, '..');
const images = JSON.parse(await readFile(resolve(root, '.import/images.json'), 'utf8'));
for (const image of images) {
  const response = await fetch(image.url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Post ${image.post}: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const output = resolve(root, 'public', image.path);
  await mkdir(dirname(output), { recursive: true });
  await sharp(buffer).rotate().webp({ quality: 90 }).toFile(output);
  console.log(`Imported ${image.path}`);
}

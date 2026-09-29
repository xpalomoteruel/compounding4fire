import { defineConfig } from 'vite';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { editorialPlugin } from './server/plugin.mjs';

export default defineConfig({
  base: './',
  server: { fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.private/**', '**/.import/**'] }, watch: { ignored: ['**/.private/**'] } },
  esbuild: { jsx: 'automatic' },
  css: { postcss: { plugins: [] } },
  plugins: [editorialPlugin(), {
    name: 'c4f-offline',
    generateBundle(_, bundle) {
      const files = ['index.html', 'manifest.webmanifest', 'logo.svg', 'brand-mark.svg', 'icon-192.png', 'icon-512.png',
        ...readdirSync(resolve(import.meta.dirname, 'public/images')).map(f => `images/${f}`),
        ...Object.keys(bundle)];
      const hash = createHash('sha256').update(Object.keys(bundle).join('|'));
      for (const file of files.filter(file => file !== 'index.html' && !file.startsWith('assets/'))) {
        hash.update(readFileSync(resolve(import.meta.dirname, 'public', file)));
      }
      const version = hash.digest('hex').slice(0, 16);
      const worker = readFileSync(resolve(import.meta.dirname, 'service-worker.js'), 'utf8')
        .replace('__PRECACHE__', JSON.stringify(files)).replace('__VERSION__', JSON.stringify(version));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: worker });
    },
  }],
});

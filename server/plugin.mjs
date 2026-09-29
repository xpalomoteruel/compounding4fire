import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { ContentStore } from './store.mjs';
import { createApi } from './api.mjs';
import { buildCatalog } from '../src/content.mjs';

export function editorialPlugin() {
  return {
    name: 'c4f-local-editorial',
    configureServer(server) {
      const root = resolve(import.meta.dirname, '..');
      const published = JSON.parse(readFileSync(resolve(root, 'src/data/published.json'), 'utf8'));
      const seed = published || buildCatalog(JSON.parse(readFileSync(resolve(root, 'src/data/posts.json'), 'utf8')));
      // Explicitly deny serving the SQLite DB, drafts, uploads and backups via Vite.
      const store = new ContentStore({ directory: resolve(root, '.private'), snapshot: resolve(root, 'src/data/published.json'), publicDirectory: resolve(root, 'public'), seed });
      server.middlewares.use(createApi(store));
      server.httpServer?.once('close', () => store.close());
    },
  };
}

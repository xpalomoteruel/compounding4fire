// Isolated UI fixture: never opens the real editorial database or publishes to it.
import { createServer } from 'vite';
import { mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { scryptSync } from 'node:crypto';
import { ContentStore } from '../server/store.mjs';
import { createApi } from '../server/api.mjs';
import { posts } from '../src/catalog.mjs';
const root = resolve(import.meta.dirname, '..');
const directory = mkdtempSync(join(tmpdir(), 'c4f-editorial-ui-'));
cpSync(join(root, 'public'), join(directory, 'public'), { recursive: true });
const store = new ContentStore({ directory: join(directory, 'private'), publicDirectory: join(directory, 'public'), snapshot: join(directory, 'published.json'), seed: posts });
const salt = 'local-ui-fixture-only';
store.db.prepare("INSERT INTO settings(key,value) VALUES('password',?)").run(JSON.stringify({ salt, hash: scryptSync('c4f-editorial-ui-test', salt, 64).toString('hex') }));
const server = await createServer({ configFile: false, root, cacheDir: join(directory, 'vite-cache'), publicDir: join(directory, 'public'), esbuild: { jsx: 'automatic' }, css: { postcss: { plugins: [] } }, server: { host: '127.0.0.1', port: 5185, strictPort: true, fs: { allow: [root, resolve(root, '..'), directory], deny: ['**/.private/**', '**/private/**'] } }, plugins: [{ name: 'isolated-editorial-fixture', configureServer(server) { server.middlewares.use(createApi(store)); } }] });
await server.listen();
console.log('Isolated editorial fixture: http://127.0.0.1:5185/#/admin');
async function close() { await server.close(); store.close(); process.exit(0); }
process.on('SIGINT', close); process.on('SIGTERM', close);

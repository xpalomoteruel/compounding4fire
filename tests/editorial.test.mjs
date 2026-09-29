import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { createServer } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { ContentStore } from '../server/store.mjs';
import { createApi } from '../server/api.mjs';
import { buildCatalog } from '../src/content.mjs';
import { restoreBackup } from '../server/restore.mjs';

const original = { id: 1, title: 'Artículo original', slug: 'articulo-original', tags: ['FIRE'], blocks: [{ type: 'paragraph', spans: [{ text: 'Texto original que debe permanecer publicado hasta que se decida publicar los cambios.', bold: true }] }] };
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'c4f-editorial-test-'));
  const options = { directory: join(root, 'private'), snapshot: join(root, 'published.json'), publicDirectory: join(root, 'public'), seed: [original] };
  const store = new ContentStore(options);
  t.after(() => { try { store.close(); } catch {} if (resolve(root).startsWith(resolve(tmpdir()) + '\\') || resolve(root).startsWith(resolve(tmpdir()) + '/')) { assert.ok(basename(root).startsWith('c4f-editorial-test-')); rmSync(root, { recursive: true }); } });
  return { root, options, store };
}
test('draft changes survive restart, stay private, publish only explicitly, and can be restored', t => {
  const { store, options } = fixture(t);
  const first = store.get(1);
  const edited = store.save(1, first.version, { ...first.draft, title: 'Título nuevo' });
  assert.equal(store.exportPublished()[0].title, original.title);
  assert.equal(JSON.parse(readFileSync(options.snapshot))[0].title, original.title);
  assert.throws(() => store.save(1, first.version, edited.draft), error => error.status === 409);
  store.close();
  const reopened = new ContentStore(options);
  try {
    assert.equal(reopened.get(1).draft.title, 'Título nuevo');
    const published = reopened.publish(1, edited.version);
    assert.equal(JSON.parse(readFileSync(options.snapshot))[0].title, 'Título nuevo');
    assert.equal(readdirSync(join(options.directory, 'backups')).filter(name => name.endsWith('.c4f.gz')).length, 1);
    const revision = reopened.revisions(1)[0];
    const restored = reopened.restore(1, published.version, revision.id);
    assert.equal(restored.draft.title, original.title);
    assert.equal(restored.published.title, 'Título nuevo');
    assert.equal(restored.draft.blocks[0].spans[0].bold, true);
    assert.throws(() => reopened.save(1, restored.version, { ...restored.draft, slug: 'changed' }));
  } finally { reopened.close(); }
});
test('unpublished drafts do not enter snapshot; non-contiguous IDs and custom tags work', t => {
  const { store } = fixture(t);
  store.create();
  const third = store.create();
  const saved = store.save(third.id, third.version, { ...third.draft, tags: ['Inmobiliario'], title: 'Tercer artículo', blocks: original.blocks });
  assert.equal(store.exportPublished().length, 1);
  store.publish(third.id, saved.version);
  const catalog = buildCatalog(store.exportPublished());
  assert.deepEqual(catalog.map(post => post.id), [1, 3]);
  assert.deepEqual(catalog[1].tags, ['Inmobiliario']);
  assert.ok(catalog[1].excerpt.startsWith('Texto original'));
  assert.equal(store.get(2).published, null);
});
test('publishing checks body, tags, unique URLs, links and image paths', t => {
  const { store } = fixture(t);
  const draft = store.create();
  assert.throws(() => store.publish(draft.id, draft.version));
  const saved = store.save(draft.id, draft.version, { ...draft.draft, slug: original.slug, tags: ['FIRE'], blocks: original.blocks });
  assert.throws(() => store.publish(saved.id, saved.version), error => error.status === 409);
  assert.throws(() => store.save(saved.id, saved.version, { ...saved.draft, cover: '../private/content.sqlite' }));
  assert.throws(() => store.save(saved.id, saved.version, { ...saved.draft, blocks: [{ type: 'paragraph', spans: [{ text: 'link', href: 'javascript:alert(1)' }] }] }));
});
test('draft uploads stay private until the article is published', t => {
  const { store, options } = fixture(t);
  const filename = 'upload-demo.png';
  writeFileSync(join(options.directory, 'media', filename), Buffer.from([137,80,78,71,13,10,26,10]));
  const draft = store.get(1);
  const saved = store.save(1, draft.version, { ...draft.draft, cover: `images/${filename}`, blocks: [...draft.draft.blocks, { type: 'image', src: `images/${filename}`, alt: 'Imagen de prueba' }] });
  assert.equal(existsSync(join(options.publicDirectory, 'images', filename)), false);
  store.publish(1, saved.version);
  assert.equal(existsSync(join(options.publicDirectory, 'images', filename)), true);
});
test('complete backup restores database and both image libraries without publishing drafts', t => {
  const { store, options, root } = fixture(t);
  writeFileSync(join(options.directory, 'media', 'draft.png'), Buffer.from('private image fixture'));
  const draft = store.create();
  store.save(draft.id, draft.version, { ...draft.draft, title: 'Borrador privado recuperable' });
  const archive = store.backup();
  const destination = { directory: join(root, 'restored-private'), snapshot: join(root, 'restored-published.json'), publicDirectory: join(root, 'restored-public') };
  const result = restoreBackup(archive.path, destination);
  assert.equal(result.articles, 2);
  assert.equal(readFileSync(join(destination.directory, 'media', 'draft.png'), 'utf8'), 'private image fixture');
  assert.equal(existsSync(join(destination.publicDirectory, 'images', 'draft.png')), false);
  assert.equal(JSON.parse(readFileSync(destination.snapshot)).length, 1);
  const recovered = new ContentStore(destination);
  try { assert.equal(recovered.get(draft.id).draft.title, 'Borrador privado recuperable'); } finally { recovered.close(); }
  const second = restoreBackup(archive.path, destination);
  assert.ok(existsSync(second.safetyCopy));
});
test('API protects drafts, enforces same-origin writes, sets secure session properties and logs out', async t => {
  const { store } = fixture(t);
  const handler = createApi(store);
  const server = createServer((req, res) => handler(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, method = 'GET', data, cookie, origin = base) => fetch(`${base}/api/c4f${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(data ? { 'Content-Type': 'application/json', Origin: origin } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  assert.equal((await call('/posts')).status, 401);
  assert.equal((await call('/setup', 'POST', { password: 'temporary-test-password' }, null, 'http://untrusted.test')).status, 403);
  const setup = await call('/setup', 'POST', { password: 'temporary-test-password' });
  assert.equal(setup.status, 200);
  const cookie = setup.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
  const auth = cookie.split(';')[0];
  assert.equal((await call('/posts', 'GET', undefined, auth)).status, 200);
  assert.equal((await call('/setup', 'POST', { password: 'another-test-password' })).status, 409);
  const saved = await call('/posts/1', 'PUT', { version: 1, draft: { ...original, title: 'API draft' } }, auth);
  assert.equal(saved.status, 200);
  assert.equal(store.exportPublished()[0].title, original.title);
  assert.equal((await call('/posts/1', 'PUT', { version: 1, draft: original }, auth)).status, 409);
  const backup = await call('/backup', 'POST', {}, auth);
  assert.equal(backup.status, 200);
  const archive = JSON.parse(gunzipSync(Buffer.from(await backup.arrayBuffer())));
  assert.equal(archive.format, 'c4f-backup');
  assert.equal(Buffer.from(archive.database, 'base64').toString('ascii', 0, 15), 'SQLite format 3');
  assert.equal((await call('/logout', 'POST', {}, auth)).status, 200);
  assert.equal((await call('/posts', 'GET', undefined, auth)).status, 401);
  const login = await call('/login', 'POST', { password: 'temporary-test-password' });
  assert.equal(login.status, 200);
});

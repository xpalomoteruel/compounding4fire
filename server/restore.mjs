import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ContentStore, validatePost } from './store.mjs';

// Call only after stopping the editorial server. Existing content is backed up first.
export function restoreBackup(archivePath, options) {
  const archive = JSON.parse(gunzipSync(readFileSync(archivePath), { maxOutputLength: 512 * 1024 * 1024 }));
  if (archive.format !== 'c4f-backup' || archive.version !== 1 || typeof archive.database !== 'string') throw new Error('Copia de seguridad no compatible.');
  for (const library of [archive.publicImages, archive.privateImages]) {
    if (!Array.isArray(library) || library.some(image => !/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(image.name) || typeof image.data !== 'string')) throw new Error('La biblioteca de imágenes de la copia no es válida.');
  }
  mkdirSync(options.directory, { recursive: true });
  const staging = join(options.directory, `restore-${randomUUID()}.sqlite`);
  writeFileSync(staging, Buffer.from(archive.database, 'base64'));
  const check = new DatabaseSync(staging, { readOnly: true });
  try {
    if (check.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('La base de datos de la copia está dañada.');
    if (!check.prepare('SELECT version FROM migrations WHERE version=1').get()) throw new Error('Versión de base de datos no compatible.');
    for (const row of check.prepare('SELECT draft,published FROM posts').all()) { validatePost(JSON.parse(row.draft)); if (row.published) validatePost(JSON.parse(row.published)); }
    check.prepare('SELECT key,value FROM settings').all(); check.prepare('SELECT id FROM revisions LIMIT 1').all();
  } finally { check.close(); }
  let safetyCopy = null;
  if (existsSync(join(options.directory, 'content.sqlite'))) {
    const current = new ContentStore(options);
    try { safetyCopy = current.backup().path; current.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } finally { current.close(); }
  }
  for (const [library, folder] of [[archive.publicImages, join(options.publicDirectory, 'images')], [archive.privateImages, join(options.directory, 'media')]]) {
    mkdirSync(folder, { recursive: true });
    for (const image of library) writeFileSync(join(folder, image.name), Buffer.from(image.data, 'base64'));
  }
  renameSync(staging, join(options.directory, 'content.sqlite'));
  const restored = new ContentStore(options);
  try { return { safetyCopy, articles: restored.list().length }; } finally { restored.close(); }
}

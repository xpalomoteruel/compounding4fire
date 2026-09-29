import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync, renameSync, existsSync, copyFileSync, readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export class ContentError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const imagePattern = /^images\/[a-zA-Z0-9_-]+\.(webp|png|jpe?g)$/;
export function validatePost(post) {
  if (!post || typeof post !== 'object') throw new ContentError('Artículo no válido.');
  if (typeof post.title !== 'string' || !post.title.trim() || post.title.length > 200) throw new ContentError('Escribe un título de hasta 200 caracteres.');
  if (typeof post.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug) || post.slug.length > 150) throw new ContentError('El enlace debe contener letras minúsculas, números y guiones.');
  if (!Array.isArray(post.tags) || post.tags.length > 12 || post.tags.some(t => typeof t !== 'string' || !t.trim() || t.length > 60)) throw new ContentError('Revisa las etiquetas del artículo.');
  if (post.cover && !imagePattern.test(post.cover)) throw new ContentError('La portada debe ser una imagen de la biblioteca.');
  let count = 0;
  function blocks(items, depth = 0) {
    if (!Array.isArray(items) || depth > 3) throw new ContentError('Estructura del artículo no válida.');
    return items.map(b => {
      if (++count > 1500 || !b) throw new ContentError('El artículo tiene demasiados bloques.');
      if (b.type === 'image') {
        if (!imagePattern.test(b.src) || typeof (b.alt || '') !== 'string') throw new ContentError('Imagen no válida.');
        return { type: 'image', src: b.src, alt: (b.alt || '').slice(0, 500) };
      }
      if (b.type === 'table') {
        if (!Array.isArray(b.rows) || b.rows.some(row => !Array.isArray(row))) throw new ContentError('Tabla no válida.');
        return { type: 'table', rows: b.rows.map(row => row.map(cell => blocks(cell, depth + 1))) };
      }
      if (!['paragraph', 'heading', 'list-item'].includes(b.type) || !Array.isArray(b.spans)) throw new ContentError('Tipo de bloque no válido.');
      const spans = b.spans.map(s => {
        if (typeof s?.text !== 'string' || s.text.length > 100000) throw new ContentError('Texto no válido.');
        if (s.href && (typeof s.href !== 'string' || !/^https?:\/\//i.test(s.href))) throw new ContentError('Los enlaces deben empezar por http o https.');
        return { text: s.text, ...(s.bold ? { bold: true } : {}), ...(s.italic ? { italic: true } : {}), ...(s.href ? { href: s.href } : {}) };
      });
      return { type: b.type, spans, ...(b.type === 'list-item' ? { level: Math.max(0, Math.min(4, Number(b.level) || 0)) } : {}) };
    });
  }
  return { title: post.title.trim(), slug: post.slug, tags: [...new Set(post.tags.map(t => t.trim()))], cover: post.cover || '', blocks: blocks(post.blocks), description: '' };
}

export class ContentStore {
  constructor({ directory, snapshot, publicDirectory, seed = [] }) {
    this.directory = directory; this.snapshot = snapshot; this.publicDirectory = publicDirectory;
    mkdirSync(directory, { recursive: true });
    mkdirSync(join(directory, 'backups'), { recursive: true });
    mkdirSync(join(directory, 'media'), { recursive: true });
    this.db = new DatabaseSync(join(directory, 'content.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, draft TEXT NOT NULL, published TEXT, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, published_at TEXT);
      CREATE TABLE IF NOT EXISTS revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES posts(id), content TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY);`);
    if (!this.db.prepare('SELECT version FROM migrations WHERE version=1').get()) {
      this.db.exec('BEGIN');
      try {
        const insert = this.db.prepare('INSERT INTO posts (id,draft,published,updated_at,published_at) VALUES (?,?,?,?,?)');
        for (const post of seed) {
          const content = JSON.stringify(validatePost(post)); const now = new Date().toISOString();
          insert.run(post.id, content, content, now, now);
        }
        this.db.prepare('INSERT INTO migrations(version) VALUES(1)').run(); this.db.exec('COMMIT');
      } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    }
    this.exportPublished();
  }
  list() {
    return this.db.prepare('SELECT * FROM posts ORDER BY id').all().map(row => ({ id: row.id, title: JSON.parse(row.draft).title, version: row.version, published: !!row.published, hasChanges: row.draft !== row.published, updatedAt: row.updated_at }));
  }
  get(id) {
    const row = this.db.prepare('SELECT * FROM posts WHERE id=?').get(id);
    if (!row) throw new ContentError('No se encuentra el artículo.', 404);
    return { id: row.id, draft: JSON.parse(row.draft), published: row.published ? JSON.parse(row.published) : null, version: row.version, updatedAt: row.updated_at, publishedAt: row.published_at };
  }
  create() {
    const draft = { title: 'Nuevo artículo', slug: `nuevo-articulo-${randomUUID().slice(0, 8)}`, tags: [], cover: '', blocks: [{ type: 'paragraph', spans: [{ text: '' }] }] };
    const row = this.db.prepare('INSERT INTO posts(draft,updated_at) VALUES(?,?)').run(JSON.stringify(validatePost(draft)), new Date().toISOString());
    return this.get(Number(row.lastInsertRowid));
  }
  checkVersion(id, version) {
    const current = this.get(id);
    if (current.version !== version) throw new ContentError('Este artículo ha cambiado en otra pestaña. Vuelve a abrirlo antes de guardar.', 409);
    return current;
  }
  save(id, version, draft) {
    const current = this.checkVersion(id, version);
    const content = validatePost(draft);
    if (current.published && content.slug !== current.published.slug) throw new ContentError('El enlace de un artículo publicado no se puede cambiar.');
    const now = new Date().toISOString();
    this.db.exec('BEGIN');
    try {
      this.db.prepare('INSERT INTO revisions(post_id,content,created_at) VALUES(?,?,?)').run(id, JSON.stringify(current.draft), now);
      this.db.prepare('UPDATE posts SET draft=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(content), now, id);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.get(id);
  }
  revisions(id) {
    this.get(id);
    return this.db.prepare('SELECT id,created_at,content FROM revisions WHERE post_id=? ORDER BY id DESC LIMIT 30').all(id).map(row => ({ id: row.id, createdAt: row.created_at, title: JSON.parse(row.content).title }));
  }
  restore(id, version, revisionId) {
    const revision = this.db.prepare('SELECT content FROM revisions WHERE post_id=? AND id=?').get(id, revisionId);
    if (!revision) throw new ContentError('Versión no encontrada.', 404);
    return this.save(id, version, JSON.parse(revision.content));
  }
  backup() {
    const stem = `c4f-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 6)}`;
    const databasePath = join(this.directory, 'backups', `${stem}.sqlite`);
    this.db.prepare('VACUUM INTO ?').run(databasePath);
    const library = folder => existsSync(folder) ? readdirSync(folder).filter(name => imagePattern.test(`images/${name}`)).map(name => ({ name, data: readFileSync(join(folder, name)).toString('base64') })) : [];
    const archive = { format: 'c4f-backup', version: 1, createdAt: new Date().toISOString(), database: readFileSync(databasePath).toString('base64'), publicImages: library(join(this.publicDirectory, 'images')), privateImages: library(join(this.directory, 'media')) };
    const filename = `${stem}.c4f.gz`; const path = join(this.directory, 'backups', filename);
    writeFileSync(path, gzipSync(JSON.stringify(archive)));
    return { filename, path };
  }
  publish(id, version) {
    const current = this.checkVersion(id, version);
    const content = validatePost(current.draft);
    const hasText = blocks => blocks.some(b => b.spans?.some(s => s.text.trim()) || (b.rows && b.rows.some(row => row.some(hasText))));
    if (!hasText(content.blocks)) throw new ContentError('Añade texto antes de publicar.');
    if (!content.tags.length) throw new ContentError('Selecciona al menos un tema antes de publicar.');
    const duplicate = this.db.prepare('SELECT id,published FROM posts WHERE published IS NOT NULL AND id<>?').all(id).some(row => JSON.parse(row.published).slug === content.slug);
    if (duplicate) throw new ContentError('Ya existe otro artículo con ese enlace.', 409);
    this.backup();
    const images = [];
    function collect(blocks) { for (const b of blocks) { if (b.type === 'image') images.push(b.src); if (b.rows) b.rows.forEach(row => row.forEach(collect)); } }
    collect(content.blocks); if (content.cover) images.push(content.cover);
    for (const src of new Set(images)) {
      const target = join(this.publicDirectory, src);
      if (!existsSync(target)) {
        const source = join(this.directory, 'media', src.slice('images/'.length));
        if (!existsSync(source)) throw new ContentError(`No se encuentra la imagen ${src}.`);
        mkdirSync(dirname(target), { recursive: true }); copyFileSync(source, target);
      }
    }
    this.db.prepare('UPDATE posts SET published=draft,published_at=?,version=version+1 WHERE id=?').run(new Date().toISOString(), id);
    this.exportPublished();
    return this.get(id);
  }
  exportPublished() {
    const posts = this.db.prepare('SELECT id,published FROM posts WHERE published IS NOT NULL ORDER BY id').all().map(row => ({ id: row.id, ...JSON.parse(row.published) }));
    if (this.snapshot) {
      mkdirSync(dirname(this.snapshot), { recursive: true });
      const temp = `${this.snapshot}.tmp`; writeFileSync(temp, `${JSON.stringify(posts, null, 2)}\n`); renameSync(temp, this.snapshot);
    }
    return posts;
  }
  close() { this.db.close(); }
}

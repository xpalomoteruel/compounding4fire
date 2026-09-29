import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ContentError } from './store.mjs';

const prefix = '/api/c4f';
const localAddresses = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
function credentials(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}
async function body(req, limit = 12000000) {
  let length = 0; const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > limit) throw new ContentError('El archivo o artículo es demasiado grande.', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ContentError('La petición no contiene datos válidos.'); }
}
export function createApi(store) {
  const sessions = new Map(); let failures = [];
  const configured = () => store.db.prepare("SELECT value FROM settings WHERE key='password'").get();
  function session(req) {
    const cookie = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('c4f_session='))?.slice(12);
    const expires = cookie && sessions.get(cookie);
    if (!expires || expires < Date.now()) { if (cookie) sessions.delete(cookie); return null; }
    return cookie;
  }
  function login(res) {
    const token = randomBytes(32).toString('hex');
    for (const [key, expires] of sessions) if (expires < Date.now()) sessions.delete(key);
    sessions.set(token, Date.now() + 8 * 3600000);
    res.setHeader('Set-Cookie', `c4f_session=${token}; HttpOnly; SameSite=Strict; Path=${prefix}; Max-Age=28800`);
  }
  return async function middleware(req, res, next) {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!pathname.startsWith(`${prefix}/`)) return next();
    const send = (data, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)); };
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      // This editorial service is deliberately restricted to this computer.
      const host = req.headers.host || '';
      if (!localAddresses.has(req.socket.remoteAddress) || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) throw new ContentError('El panel solo está disponible en este ordenador.', 403);
      if (req.headers.origin && req.headers.origin !== `http://${host}`) throw new ContentError('Origen no permitido.', 403);
      if (!['GET', 'HEAD'].includes(req.method) && (req.headers.origin !== `http://${host}` || !req.headers['content-type']?.startsWith('application/json'))) throw new ContentError('Petición no permitida.', 403);
      const route = pathname.slice(prefix.length);
      if (route === '/session' && req.method === 'GET') return send({ configured: !!configured(), authenticated: !!session(req) });
      if ((route === '/setup' || route === '/login') && req.method === 'POST') {
        failures = failures.filter(time => time > Date.now() - 15 * 60000);
        if (failures.length >= 5) throw new ContentError('Demasiados intentos. Vuelve a intentarlo en 15 minutos.', 429);
        const { password } = await body(req, 4096);
        if (typeof password !== 'string' || password.length < 10 || password.length > 256) throw new ContentError('Utiliza una contraseña de entre 10 y 256 caracteres.');
        const saved = configured();
        if (route === '/setup') {
          if (saved) throw new ContentError('El acceso ya está configurado.', 409);
          store.db.prepare("INSERT INTO settings(key,value) VALUES('password',?)").run(JSON.stringify(credentials(password)));
        } else {
          if (!saved) throw new ContentError('Configura primero tu contraseña.', 409);
          const expected = JSON.parse(saved.value);
          const actual = credentials(password, expected.salt);
          if (!timingSafeEqual(Buffer.from(expected.hash, 'hex'), Buffer.from(actual.hash, 'hex'))) { failures.push(Date.now()); throw new ContentError('Contraseña incorrecta.', 401); }
        }
        failures = []; login(res); return send({ authenticated: true });
      }
      const token = session(req);
      if (!token) throw new ContentError('Inicia sesión para abrir el panel.', 401);
      if (route === '/logout' && req.method === 'POST') { sessions.delete(token); res.setHeader('Set-Cookie', `c4f_session=; HttpOnly; SameSite=Strict; Path=${prefix}; Max-Age=0`); return send({ ok: true }); }
      if (route === '/posts' && req.method === 'GET') return send(store.list());
      if (route === '/posts' && req.method === 'POST') return send(store.create(), 201);
      if (route === '/backup' && req.method === 'POST') {
        const backup = store.backup(); res.setHeader('Content-Type', 'application/gzip'); res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`); return res.end(readFileSync(backup.path));
      }
      if (route === '/media' && req.method === 'POST') {
        const { data } = await body(req);
        if (typeof data !== 'string') throw new ContentError('Selecciona una imagen PNG, JPEG o WebP.');
        const bytes = Buffer.from(data, 'base64');
        if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new ContentError('La imagen debe pesar menos de 8 MB.');
        let extension;
        if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) extension = 'png';
        else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) extension = 'jpg';
        else if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') extension = 'webp';
        else throw new ContentError('Formato no admitido. Utiliza PNG, JPEG o WebP.');
        const name = `upload-${createHash('sha256').update(bytes).digest('hex').slice(0, 24)}.${extension}`;
        const target = join(store.directory, 'media', name);
        if (!existsSync(target)) writeFileSync(target, bytes);
        return send({ src: `images/${name}` }, 201);
      }
      const media = route.match(/^\/media\/([a-zA-Z0-9_-]+\.(?:png|jpe?g|webp))$/);
      if (media && req.method === 'GET') {
        const privatePath = join(store.directory, 'media', media[1]);
        const path = existsSync(privatePath) ? privatePath : join(store.publicDirectory, 'images', media[1]);
        if (!existsSync(path)) throw new ContentError('Imagen no encontrada.', 404);
        res.setHeader('Content-Type', media[1].endsWith('.webp') ? 'image/webp' : media[1].endsWith('.png') ? 'image/png' : 'image/jpeg'); return res.end(readFileSync(path));
      }
      const match = route.match(/^\/posts\/(\d+)(?:\/(publish|revisions|restore))?$/);
      if (match) {
        const id = Number(match[1]); const action = match[2];
        if (req.method === 'GET' && !action) return send(store.get(id));
        if (req.method === 'GET' && action === 'revisions') return send(store.revisions(id));
        if (req.method === 'PUT' && !action) { const data = await body(req); return send(store.save(id, data.version, data.draft)); }
        if (req.method === 'POST' && action === 'publish') { const data = await body(req, 4096); return send(store.publish(id, data.version)); }
        if (req.method === 'POST' && action === 'restore') { const data = await body(req, 4096); return send(store.restore(id, data.version, data.revisionId)); }
      }
      throw new ContentError('Operación no disponible.', 404);
    } catch (error) {
      if (!error.status) console.error('C4F editorial:', error);
      if (!res.headersSent) send({ error: error.status ? error.message : 'No se ha podido completar la operación. El borrador guardado sigue disponible.' }, error.status || 500);
      else res.end();
    }
  };
}

import { useEffect, useRef, useState } from 'react';
import { topics } from './catalog.mjs';
import './admin.css';

const endpoint = '/api/c4f';
async function api(path, options = {}) {
  const response = await fetch(`${endpoint}${path}`, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({ error: 'El panel necesita el servidor local de edición.' }));
  if (!response.ok || data.error) throw new Error(data.error || 'No se ha podido completar la operación.');
  return data;
}
const payload = (method, data = {}) => ({ method, body: JSON.stringify(data) });
const date = value => new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
const mediaUrl = src => `${endpoint}/media/${src.split('/').pop()}`;
function previewBlocks(blocks) { return blocks.map(b => b.type === 'image' ? { ...b, src: `api/c4f/media/${b.src.split('/').pop()}` } : b.type === 'table' ? { ...b, rows: b.rows.map(row => row.map(previewBlocks)) } : b); }

export default function Admin({ renderPreview }) {
  const [session, setSession] = useState(null);
  const [password, setPassword] = useState('');
  const [list, setList] = useState([]);
  const [record, setRecord] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [revisions, setRevisions] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [newTag, setNewTag] = useState('');
  const uploadInput = useRef(null);
  const dirty = !!record && JSON.stringify(record.draft) !== JSON.stringify(draft);
  useEffect(() => { api('/session').then(setSession).catch(e => setError(e.message)); }, []);
  useEffect(() => { if (session?.authenticated) api('/posts').then(setList).catch(e => setError(e.message)); }, [session]);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    const guard = event => { if (!window.confirm('Hay cambios sin guardar. ¿Quieres salir sin guardarlos?')) event.preventDefault(); };
    window.addEventListener('beforeunload', warn); window.addEventListener('c4f:before-navigation', guard);
    return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener('c4f:before-navigation', guard); };
  }, [dirty]);
  async function run(action) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function accept(next) { setRecord(next); setDraft(next.draft); setRevisions(null); }
  const refresh = async () => setList(await api('/posts'));
  async function open(id) {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos y abrir otro artículo?')) return;
    await run(async () => { accept(await api(`/posts/${id}`)); setPreview(false); });
  }
  async function save() {
    const saved = await api(`/posts/${record.id}`, payload('PUT', { version: record.version, draft }));
    accept(saved); await refresh(); return saved;
  }
  async function upload(file) {
    if (!file) return;
    await run(async () => {
      if (file.size > 8 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 8 MB.');
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(new Error('No se pudo leer la imagen.')); reader.readAsDataURL(file); });
      const image = await api('/media', payload('POST', { data }));
      setDraft(current => ({ ...current, cover: current.cover || image.src, blocks: [...current.blocks, { type: 'image', src: image.src, alt: '' }] }));
      setMessage('Imagen añadida al borrador. Guarda para conservar el cambio.');
    });
    if (uploadInput.current) uploadInput.current.value = '';
  }
  function block(index, change) { setDraft(current => ({ ...current, blocks: current.blocks.map((b, i) => i === index ? { ...b, ...change } : b) })); }
  function span(index, n, change) { block(index, { spans: draft.blocks[index].spans.map((s, i) => i === n ? { ...s, ...change } : s) }); }
  const allTags = [...new Set([...topics, ...(draft?.tags || [])])];
  const visible = list.filter(p => p.title.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')) && (status === 'all' || (status === 'draft' ? p.hasChanges : p.published)));
  return <section className="admin-page container">
    <header className="admin-heading"><div><span className="eyebrow">ESPACIO PRIVADO</span><h1>Panel editorial</h1></div>{session?.authenticated && <div className="admin-top-actions"><button disabled={busy} onClick={() => run(async () => {
      const response = await fetch(`${endpoint}/backup`, payload('POST'));
      if (!response.ok) throw new Error((await response.json()).error || 'No se pudo crear la copia.');
      const url = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href = url; a.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'c4f-backup.c4f.gz'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage('Copia completa creada: artículos, borradores, historial e imágenes.');
    })}>Copia de seguridad</button><button disabled={busy} onClick={() => { if (dirty && !window.confirm('Hay cambios sin guardar. ¿Quieres cerrar sesión?')) return; run(async () => { await api('/logout', payload('POST')); setSession({ configured: true, authenticated: false }); setRecord(null); setDraft(null); setList([]); }); }}>Cerrar sesión</button></div>}</header>
    {error && <div className="admin-error" role="alert">{error}</div>}{message && <div className="admin-message" role="status">{message}</div>}
    {!session ? <p>Cargando el panel…</p> : !session.authenticated ? <form className="admin-login" onSubmit={event => { event.preventDefault(); run(async () => { await api(session.configured ? '/login' : '/setup', payload('POST', { password })); setPassword(''); setSession({ configured: true, authenticated: true }); }); }}><h2>{session.configured ? 'Bienvenido de nuevo' : 'Configura tu acceso'}</h2><p>{session.configured ? 'Introduce tu contraseña para gestionar los artículos.' : 'Crea una contraseña para proteger tus borradores y publicaciones en este ordenador.'}</p><label>Contraseña<input type="password" minLength={10} maxLength={256} autoComplete={session.configured ? 'current-password' : 'new-password'} required value={password} onChange={e => setPassword(e.target.value)} /></label><small>Mínimo 10 caracteres.</small><button className="button button-primary" disabled={busy}>{busy ? 'Entrando…' : session.configured ? 'Entrar' : 'Crear acceso'}</button></form> : <div className="admin-layout">
      <aside className="admin-library"><div className="admin-library-heading"><h2>Artículos <span>{list.length}</span></h2><button className="button button-primary" disabled={busy} onClick={() => { if (dirty && !window.confirm('Hay cambios sin guardar. ¿Quieres crear otro borrador?')) return; run(async () => { accept(await api('/posts', payload('POST'))); setPreview(false); await refresh(); }); }}>+ Nuevo</button></div><input type="search" aria-label="Buscar en el panel" placeholder="Buscar un artículo" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Estado del artículo" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos los artículos</option><option value="draft">Borradores y cambios pendientes</option><option value="published">Publicados</option></select><div className="admin-post-list">{visible.map(p => <button key={p.id} className={record?.id === p.id ? 'active' : ''} disabled={busy} onClick={() => open(p.id)}><strong>{p.title}</strong><span>{p.published ? p.hasChanges ? 'Publicado · cambios pendientes' : 'Publicado' : 'Borrador'}</span></button>)}{!visible.length && <p>No hay artículos con este filtro.</p>}</div></aside>
      {!draft ? <div className="admin-welcome"><h2>Tu espacio para escribir</h2><p>Selecciona un artículo o crea un borrador nuevo.</p><p>Los borradores son privados. Solo «Publicar» cambia lo que ven los lectores.</p></div> : <div className="admin-editor"><div className="editor-toolbar"><div><strong>{dirty ? 'Cambios sin guardar' : 'Borrador guardado'}</strong><small>{record.published ? `Publicado · ${date(record.publishedAt)}` : 'Todavía no publicado'}</small></div><div><button disabled={busy} onClick={() => setPreview(!preview)}>{preview ? 'Editar' : 'Vista previa'}</button><button disabled={busy || !dirty} onClick={() => run(async () => { await save(); setMessage('Borrador guardado. La versión publicada no ha cambiado.'); })}>Guardar borrador</button><button className="button button-primary" disabled={busy} onClick={() => run(async () => { const saved = dirty ? await save() : record; accept(await api(`/posts/${saved.id}/publish`, payload('POST', { version: saved.version }))); await refresh(); setMessage('Publicado en la web local. Para actualizar una web compartida, hay que compilar y subir la nueva versión.'); })}>Publicar</button></div></div>
      {preview ? <article className="admin-preview"><div className="post-tags">{draft.tags.map(t => <span key={t}>{t}</span>)}</div><h1>{draft.title}</h1>{draft.cover && <img className="admin-cover" src={mediaUrl(draft.cover)} alt="Portada del borrador" />}<div className="article-prose">{renderPreview(previewBlocks(draft.blocks))}</div></article> : <fieldset disabled={busy} className="editor-fields"><label>Título<input value={draft.title} maxLength={200} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label><label>Enlace del artículo<input value={draft.slug} disabled={!!record.published} onChange={e => setDraft({ ...draft, slug: e.target.value })} /><small>{record.published ? 'Se conserva el enlace para que siga funcionando al compartirlo.' : 'Letras minúsculas, números y guiones.'}</small></label><div className="admin-tags"><span>Temas</span><div>{allTags.map(t => <button type="button" key={t} aria-pressed={draft.tags.includes(t)} onClick={() => setDraft({ ...draft, tags: draft.tags.includes(t) ? draft.tags.filter(tag => tag !== t) : [...draft.tags, t] })}>{t}</button>)}</div><div className="new-tag"><input aria-label="Nuevo tema" placeholder="Añadir tema" maxLength={60} value={newTag} onChange={e => setNewTag(e.target.value)} /><button type="button" disabled={!newTag.trim()} onClick={() => { setDraft({ ...draft, tags: [...new Set([...draft.tags, newTag.trim()])] }); setNewTag(''); }}>Añadir</button></div></div>
      {draft.cover && <div className="admin-cover-picker"><img src={mediaUrl(draft.cover)} alt="Portada seleccionada" /><span>Portada</span><button onClick={() => setDraft({ ...draft, cover: '' })}>Quitar portada</button></div>}
      <h2>Contenido</h2><div className="editor-blocks">{draft.blocks.map((b, index) => <div className="editor-block" key={index}><div className="block-toolbar"><span>{index + 1} · {b.type === 'image' ? 'Imagen' : b.type === 'table' ? 'Tabla' : b.type === 'heading' ? 'Subtítulo' : b.type === 'list-item' ? 'Lista' : 'Párrafo'}</span><div><button aria-label={`Subir bloque ${index + 1}`} disabled={!index} onClick={() => { const blocks = [...draft.blocks]; [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]]; setDraft({ ...draft, blocks }); }}>↑</button><button aria-label={`Bajar bloque ${index + 1}`} disabled={index === draft.blocks.length - 1} onClick={() => { const blocks = [...draft.blocks]; [blocks[index + 1], blocks[index]] = [blocks[index], blocks[index + 1]]; setDraft({ ...draft, blocks }); }}>↓</button><button aria-label={`Quitar bloque ${index + 1}`} onClick={() => { if (window.confirm('¿Quitar este bloque del borrador?')) setDraft({ ...draft, blocks: draft.blocks.filter((_, i) => i !== index) }); }}>Quitar</button></div></div>{b.type === 'image' ? <><img className="editor-image" src={mediaUrl(b.src)} alt={b.alt} /><label>Descripción de la imagen<input value={b.alt || ''} onChange={e => block(index, { alt: e.target.value })} /></label><button onClick={() => setDraft({ ...draft, cover: b.src })}>Usar como portada</button></> : b.type === 'table' ? <><p>Tabla original conservada.</p><div className="article-prose">{renderPreview([b])}</div></> : <><select aria-label={`Tipo del bloque ${index + 1}`} value={b.type} onChange={e => block(index, { type: e.target.value })}><option value="paragraph">Párrafo</option><option value="heading">Subtítulo</option><option value="list-item">Elemento de lista</option></select>{b.spans.map((s, n) => <div className="span-editor" key={n}><div className="span-format"><button aria-label={`Negrita bloque ${index + 1} fragmento ${n + 1}`} aria-pressed={!!s.bold} onClick={() => span(index, n, { bold: !s.bold })}><b>B</b></button><button aria-label={`Cursiva bloque ${index + 1} fragmento ${n + 1}`} aria-pressed={!!s.italic} onClick={() => span(index, n, { italic: !s.italic })}><i>I</i></button></div><textarea aria-label={`Texto bloque ${index + 1} fragmento ${n + 1}`} rows={Math.max(2, Math.min(12, Math.ceil(s.text.length / 75)))} value={s.text} style={{ fontWeight: s.bold ? 600 : 400, fontStyle: s.italic ? 'italic' : 'normal' }} onChange={e => span(index, n, { text: e.target.value })} /><details><summary>Enlace</summary><input aria-label={`Enlace bloque ${index + 1} fragmento ${n + 1}`} type="url" placeholder="https://…" value={s.href || ''} onChange={e => span(index, n, { href: e.target.value })} /></details></div>)}</>}</div>)}</div>
      <div className="add-block"><button onClick={() => setDraft({ ...draft, blocks: [...draft.blocks, { type: 'paragraph', spans: [{ text: '' }] }] })}>+ Párrafo</button><button onClick={() => setDraft({ ...draft, blocks: [...draft.blocks, { type: 'heading', spans: [{ text: '' }] }] })}>+ Subtítulo</button><button onClick={() => uploadInput.current?.click()}>+ Imagen</button><input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => upload(e.target.files[0])} /></div>
      </fieldset>}
      <div className="admin-history"><button disabled={busy} onClick={() => run(async () => setRevisions(await api(`/posts/${record.id}/revisions`)))}>Historial de versiones</button>{revisions && <div>{!revisions.length && <p>Aún no hay versiones anteriores.</p>}{revisions.map(revision => <div className="revision-row" key={revision.id}><span>{date(revision.createdAt)} · {revision.title}</span><button disabled={busy} onClick={() => { if (!window.confirm('¿Recuperar esta versión como borrador? La publicación actual se mantiene.')) return; run(async () => { accept(await api(`/posts/${record.id}/restore`, payload('POST', { version: record.version, revisionId: revision.id }))); await refresh(); setMessage('Versión recuperada como borrador.'); }); }}>Recuperar</button></div>)}</div>}</div>
      </div>}
    </div>}
  </section>;
}

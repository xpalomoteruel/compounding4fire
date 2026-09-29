import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { posts, topics, plain, articleUrl, filterPosts, localLink } from './catalog.mjs';
import { CoursesPage, SocialPage } from './Explore.jsx';
const Admin = import.meta.env.DEV ? lazy(() => import('./Admin.jsx')) : null;
const bookmarkEvent = 'c4f:bookmarks';
function readBookmarks() {
  try { const value = JSON.parse(localStorage.getItem('c4f.bookmarks.v1') || '[]'); return Array.isArray(value) ? value.filter(Number.isInteger) : []; } catch { return []; }
}
function useBookmarks() {
  const [saved, setSaved] = useState(readBookmarks);
  useEffect(() => { const sync = () => setSaved(readBookmarks()); window.addEventListener(bookmarkEvent, sync); window.addEventListener('storage', sync); return () => { window.removeEventListener(bookmarkEvent, sync); window.removeEventListener('storage', sync); }; }, []);
  function toggle(id) {
    const latest = readBookmarks(); const next = latest.includes(id) ? latest.filter(value => value !== id) : [...latest, id];
    try { localStorage.setItem('c4f.bookmarks.v1', JSON.stringify(next)); setSaved(next); window.dispatchEvent(new Event(bookmarkEvent)); }
    catch { window.alert('El navegador no permite guardar favoritos en este dispositivo.'); }
  }
  return [saved, toggle];
}
function Bookmark({ post }) {
  const [saved, toggle] = useBookmarks(); const active = saved.includes(post.id);
  return <button className={`bookmark-button ${active ? 'is-saved' : ''}`} onClick={() => toggle(post.id)} aria-pressed={active} aria-label={`${active ? 'Quitar de favoritos' : 'Guardar en favoritos'}: ${post.title}`} title={active ? 'Quitar de favoritos' : 'Guardar en favoritos'}><svg width="18" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4V3Z" /></svg></button>;
}

const asset = path => `${import.meta.env.BASE_URL}${path}`;
function Icon({ name = 'arrow', size = 20, ...props }) {
  const paths = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    northeast: <><path d="M6 18 18 6M6 6h12v12" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    book: <><path d="M12 5v15M12 6C8 3 3 4 3 4v14s5-1 9 2c4-3 9-2 9-2V4s-5-1-9 2Z" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    share: <><path d="M12 15V3m-4 4 4-4 4 4M7 11H4v10h16V11h-3" /></>,
    leaf: <><path d="M20 3c-12-1-19 5-14 12 7 5 15-1 14-12ZM4 21 15 9" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
function Battery({ className = '' }) {
  return <img className={`battery-mark ${className}`} src={asset('brand-mark.svg')} width="54" height="38" alt="" aria-hidden="true" />;
}
function Brand() {
  return <a className="brand" href="#/" aria-label="Compounding4FIRE, inicio"><span>Compounding</span><Battery /><strong>FIRE</strong></a>;
}
function Art({ post, className = '', eager = false }) {
  if (post.cover && post.id !== 15) return <img className={`post-image ${className}`} src={asset(post.cover)} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" />;
  return <div className={`cover-art ${post.tags.includes('Libros') ? 'cover-book' : ''} ${className}`} aria-hidden="true"><span><Icon name={post.tags.includes('Libros') ? 'book' : 'leaf'} size={40} /></span></div>;
}
function Meta({ post }) {
  return <div className="post-meta"><span>POST {String(post.id).padStart(2, '0')}</span><span className="meta-separator">·</span><span><Icon name="clock" size={14} /> {post.minutes} min de lectura</span></div>;
}
function Tags({ post, onSelect, small = false }) {
  return <div className={`post-tags ${small ? 'small-tags' : ''}`}>{post.tags.map(tag => <button key={tag} onClick={() => onSelect(tag)}>{tag}</button>)}</div>;
}
function Card({ post, onTag }) {
  return <article className="post-card">
    <a href={articleUrl(post)} className="card-image-link" aria-label={`Leer ${post.title}`}><Art post={post} /><span className="card-image-arrow"><Icon name="northeast" size={21} /></span></a>
    <div className="card-body"><Tags post={post} onSelect={onTag} small /><h3><a href={articleUrl(post)}>{post.title}</a></h3><p>{post.excerpt}</p><div className="card-bottom"><Meta post={post} /><div className="card-actions"><Bookmark post={post} /><a href={articleUrl(post)} aria-label={`Leer ${post.title}`}><Icon size={19} /></a></div></div></div>
  </article>;
}
function Home({ query, setQuery, selected, setSelected, sort, setSort, onTag }) {
  const [saved] = useBookmarks();
  const [savedOnly, setSavedOnly] = useState(false);
  const results = filterPosts({ query, selected, sort }).filter(post => !savedOnly || saved.includes(post.id));
  const active = Boolean(query || selected.length || savedOnly);
  const searchRef = useRef(null);
  const reset = () => { setQuery(''); setSelected([]); setSavedOnly(false); };
  return <>
    <section className="container journal" id="articulos" aria-labelledby="journal-title">
      <div className="section-heading journal-heading"><h1 id="journal-title">Artículos</h1><button className={`favorites-filter ${savedOnly ? 'active' : ''}`} aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}>Favoritos <span>{saved.length}</span></button></div>
      <div className="library-tools"><div className="search-field"><Icon name="search" size={20} /><input ref={searchRef} type="search" aria-label="Buscar artículos" placeholder="¿Qué te gustaría aprender?" value={query} onChange={e => setQuery(e.target.value)} />{query && <button onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label="Borrar búsqueda"><Icon name="close" size={17} /></button>}</div><div className="sort-field"><label htmlFor="sort">Ordenar por</label><select id="sort" value={sort} onChange={e => setSort(e.target.value)}><option value="original">Orden de lectura</option><option value="latest">Últimos primero</option><option value="short">Lecturas más cortas</option></select></div></div>
      <div className="topic-filters" aria-label="Filtrar por tema"><button className={!selected.length ? 'selected' : ''} aria-pressed={!selected.length} onClick={() => setSelected([])}>Todos <span>{posts.length}</span></button>{topics.map(topic => <button key={topic} className={selected.includes(topic) ? 'selected' : ''} aria-pressed={selected.includes(topic)} onClick={() => setSelected(current => current.includes(topic) ? current.filter(t => t !== topic) : [...current, topic])}>{topic}{selected.includes(topic) && <Icon name="check" size={14} />}</button>)}</div>
      <div className="results-status"><span role="status" aria-live="polite">{results.length} {results.length === 1 ? 'artículo' : 'artículos'}{active ? ' encontrados' : ''}{selected.length > 1 && ' · Cualquiera de los temas seleccionados'}</span>{active && <button className="text-button" onClick={reset}>Limpiar filtros <Icon name="close" size={14} /></button>}</div>
      {results.length ? <div className="posts-grid">{results.map(post => <Card key={post.id} post={post} onTag={onTag} />)}</div> : <div className="empty-state"><Icon name="search" size={35} /><h3>Aún no hay una lectura por aquí.</h3><p>Prueba con otra palabra o cambia los temas seleccionados.</p><button className="button button-primary" onClick={reset}>Ver todos los artículos <Icon /></button></div>}
    </section>
  </>;
}

function InlineText({ span }) {
  let content = span.text;
  if (span.bold) content = <strong>{content}</strong>;
  if (span.italic) content = <em>{content}</em>;
  const href = span.href ? localLink(span.href) : /^https?:\/\/\S+\s*$/.test(span.text) ? localLink(span.text.trim()) : undefined;
  if (href) return <a href={href} {...(!href.startsWith('#') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{content}</a>;
  // The old blog included a URL as plain text inside this paragraph.
  if (typeof content === 'string' && content.includes('https://www.compounding4fire.com/y-si-a-mi-me-gusta-mi-trabajo/')) {
    const [before, after] = content.split('https://www.compounding4fire.com/y-si-a-mi-me-gusta-mi-trabajo/');
    return <>{before}<a href={articleUrl(posts[2])}>¿Y si a mí me gusta mi trabajo?</a>{after}</>;
  }
  return content;
}
function Blocks({ blocks, postId }) {
  return blocks.map((block, i) => {
    if (block.type === 'image') return <figure key={i}><img src={asset(block.src)} alt={block.alt} loading="lazy" decoding="async" /></figure>;
    if (block.type === 'table') return <div key={i} className="article-table"><table><tbody>{block.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}><Blocks blocks={cell} postId={postId} /></td>)}</tr>)}</tbody></table></div>;
    const text = plain(block).trim();
    if (/^\*{10,}$/.test(text)) return <hr key={i} />;
    if (/^\[table id=\d+\s*\/\]$/.test(text)) return <aside key={i} className="source-note">En este punto falta la tabla citada en el artículo.</aside>;
    const content = block.spans?.map((span, s) => <InlineText key={s} span={span} />);
    if (block.type === 'list-item') return <ul className="source-list" style={{ marginLeft: `${Math.min(block.level, 4) * 16}px` }} key={i}><li>{content}</li></ul>;
    if (block.type === 'heading' || (text.length < 105 && block.spans?.every(s => s.bold || !s.text.trim()))) return <h2 key={i}>{content}</h2>;
    if (/^[-–]?\s*(\(?Tiquismiquis\)?)/i.test(text)) return <blockquote key={i}>{content}</blockquote>;
    return <p key={i}>{content}</p>;
  });
}
function Article({ post, onTag, announce }) {
  const position = posts.findIndex(item => item.id === post.id);
  const previousPost = posts[position - 1];
  const nextPost = posts[position + 1];
  const [progress, setProgress] = useState(0);
  const bodyRef = useRef(null);
  const titleRef = useRef(null);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    const update = () => { const el = bodyRef.current; if (!el) return; const start = el.getBoundingClientRect().top + window.scrollY; setProgress(Math.max(0, Math.min(100, (window.scrollY - start + 150) / Math.max(1, el.offsetHeight - window.innerHeight + 150) * 100))); };
    update(); window.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [post.id]);
  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); announce('Enlace copiado. Comparte esta lectura.'); }
    catch { announce('Copia el enlace desde la barra de direcciones del navegador.'); }
  }
  return <>
    <div className="reading-progress" style={{ width: `${progress}%` }} />
    <article className="reader container">
      <div className="reader-nav"><a href="#/articulos"><Icon name="back" size={18} /> Todos los artículos</a><div className="reader-actions"><Bookmark post={post} /><button onClick={share}><Icon name="share" size={17} /> Compartir</button></div></div>
      <header className="article-header"><Tags post={post} onSelect={onTag} /><h1 tabIndex="-1" ref={titleRef}>{post.title}</h1><div className="byline"><div className="author-monogram"><Battery /></div><span>Compounding4FIRE</span><Meta post={post} /></div></header>
      {post.cover && <div className="article-cover"><Art post={post} eager /></div>}
      <div className="article-layout"><aside className="reading-aside"><span className="eyebrow">TEMAS</span><Tags post={post} onSelect={onTag} /><a href="#/articulos" className="aside-back"><Icon name="back" size={16} /> Volver al blog</a></aside><div ref={bodyRef} className="article-prose"><Blocks blocks={post.blocks} postId={post.id} /></div></div>
      <nav className="article-pagination" aria-label="Siguiente y anterior artículo">{previousPost ? <a href={articleUrl(previousPost)}><small><Icon name="back" size={14} /> LECTURA ANTERIOR</small><span>{previousPost.title}</span></a> : <div />}{nextPost ? <a href={articleUrl(nextPost)}><small>SIGUIENTE LECTURA <Icon size={14} /></small><span>{nextPost.title}</span></a> : <a href="#/articulos"><small>HAS LLEGADO AL ÚLTIMO POST <Icon size={14} /></small><span>Volver a explorar el blog</span></a>}</nav>
    </article>
  </>;
}
const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const initialFIREInputs = { phase: 'accumulating', withdrawalRate: 4, invested: 50000, annualExpenses: 30000, monthlyContribution: 1000, annualReturn: 5, inflation: 2, age: 35 };
function readFireInputs() {
  try { return { ...initialFIREInputs, ...JSON.parse(localStorage.getItem('c4f.calculator.fire.v1') || '{}') }; }
  catch { return initialFIREInputs; }
}
function projectFire({ invested, annualExpenses, monthlyContribution, annualReturn, inflation, withdrawalRate, phase, age }) {
  const principal = Math.max(0, Number(invested) || 0);
  const spending = Math.max(0, Number(annualExpenses) || 0);
  const fireNumber = spending / (Number(withdrawalRate) / 100);
  const years = Array.from({ length: 61 }, (_, year) => ({ year, age: Number(age) + year, capital: 0, target: fireNumber * (1 + Number(inflation) / 100) ** year }));
  let capital = principal;
  let yearsToFire = capital >= fireNumber ? 0 : null;
  let depletionYear = null;
  years[0].capital = capital;
  const monthlyReturn = (1 + Number(annualReturn) / 100) ** (1 / 12) - 1;
  for (let year = 1; year <= 60; year++) {
    const monthlySpend = spending * (1 + Number(inflation) / 100) ** year / 12;
    for (let month = 0; month < 12; month++) {
      capital = capital * (1 + monthlyReturn) + (phase === 'accumulating' ? Number(monthlyContribution) || 0 : -monthlySpend);
      if (capital <= 0 && phase === 'retired') { capital = 0; depletionYear ??= year - 1 + (month + 1) / 12; break; }
    }
    years[year] = { year, age: Number(age) + year, capital: Math.round(Math.max(0, capital)), target: fireNumber * (1 + Number(inflation) / 100) ** year };
    if (phase === 'accumulating' && yearsToFire === null && capital >= years[year].target) yearsToFire = year;
  }
  return { fireNumber, years, yearsToFire, depletionYear, currentProgress: fireNumber > 0 ? principal / fireNumber * 100 : 0 };
}
function NumberInput({ label, value, onChange, suffix, min = 0, max, step = 1 }) {
  return <label className="fire-field"><span>{label}</span><span className="fire-input-wrap"><input type="number" inputMode="decimal" min={min} max={max} step={step} value={value} onChange={event => onChange(event.target.value === '' ? '' : Number(event.target.value))} /><i>{suffix}</i></span></label>;
}
function ProjectionChart({ data, target }) {
  const width = 720, height = 228, pad = { x: 48, y: 18, right: 14, bottom: 33 };
  const max = Math.max(target * 1.08, ...data.map(d => Math.max(d.capital, d.target)), 1);
  const x = i => pad.x + i / (data.length - 1) * (width - pad.x - pad.right);
  const y = amount => height - pad.bottom - Math.min(amount / max, 1) * (height - pad.y - pad.bottom);
  const line = key => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  const labels = [0, 15, 30, 45, 60];
  return <div className="projection-wrap"><svg className="projection-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Proyección a 60 años. Patrimonio actual ${euro.format(data[0].capital)}. Número FIRE actual ${euro.format(target)}.`}>
    {[0, .25, .5, .75, 1].map((n, i) => <g key={i}><line x1={pad.x} x2={width - pad.right} y1={y(max * n)} y2={y(max * n)} stroke="#e7ebe4" strokeDasharray={i === 0 ? undefined : '3 5'} /><text x={pad.x - 8} y={y(max * n) + 3} textAnchor="end" className="chart-axis">{euro.format(max * n).replace(',00', '')}</text></g>)}
    <path d={line('target')} fill="none" stroke="#9aa994" strokeWidth="2" strokeDasharray="6 6" />
    <path d={line('capital')} fill="none" stroke="#2d7452" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    {labels.map(n => <text key={n} x={x(n)} y={height - 8} textAnchor="middle" className="chart-axis">{n === 0 ? 'Ahora' : `+${n} años`}</text>)}
  </svg><div className="chart-legend"><span><i className="legend-capital" /> Patrimonio proyectado</span><span><i className="legend-target" /> Objetivo FIRE</span></div></div>;
}
function FIRECalculator() {
  const [values, setValues] = useState(readFireInputs);
  useEffect(() => { try { localStorage.setItem('c4f.calculator.fire.v1', JSON.stringify(values)); } catch { /* Calculadora usable si el almacenamiento está desactivado. */ } }, [values]);
  const update = (key, value) => setValues(current => ({ ...current, [key]: value }));
  const result = projectFire(values);
  const chart = result.years;
  const completed = Number(values.annualExpenses) > 0;
  return <section className="calculator-page container">
    <div className="calculator-heading"><span className="eyebrow">COMPOUNDING4FIRE</span><h1>Calculadora FIRE</h1><p>Calcula cuánto patrimonio necesitas para cubrir tus gastos con la regla de retirada que elijas.</p></div>
    <div className="fire-calculator">
      <div className="fire-form-panel">
        <div className="fire-phase" role="group" aria-label="Fase financiera"><button className={values.phase === 'accumulating' ? 'active' : ''} aria-pressed={values.phase === 'accumulating'} onClick={() => update('phase', 'accumulating')}>En acumulación</button><button className={values.phase === 'retired' ? 'active' : ''} aria-pressed={values.phase === 'retired'} onClick={() => update('phase', 'retired')}>Ya me he retirado</button></div>
        <div className="fire-rate"><span className="fire-label">Regla de retirada</span><div className="fire-rate-controls"><div className="rate-presets"><button className={Number(values.withdrawalRate) === 3 ? 'chosen' : ''} onClick={() => update('withdrawalRate', 3)}>3 %</button><button className={Number(values.withdrawalRate) === 4 ? 'chosen' : ''} onClick={() => update('withdrawalRate', 4)}>4 %</button></div><label className="custom-rate"><input aria-label="Tasa de retirada personalizada" type="number" min="1" max="10" step="0.1" value={values.withdrawalRate} onChange={event => update('withdrawalRate', event.target.value === '' ? 4 : Math.min(10, Math.max(1, Number(event.target.value))))} /><span>%</span></label></div></div>
        <div className="fire-fields"><NumberInput label="Patrimonio invertido" suffix="€" step={1000} value={values.invested} onChange={v => update('invested', v)} /><NumberInput label="Gastos anuales" suffix="€/año" step={500} value={values.annualExpenses} onChange={v => update('annualExpenses', v)} />{values.phase === 'accumulating' && <NumberInput label="Aportación mensual" suffix="€/mes" step={50} value={values.monthlyContribution} onChange={v => update('monthlyContribution', v)} />}<NumberInput label="Rentabilidad anual estimada" suffix="%" min={-20} max={30} step={0.5} value={values.annualReturn} onChange={v => update('annualReturn', v)} /><NumberInput label="Inflación anual estimada" suffix="%" max={15} step={0.1} value={values.inflation} onChange={v => update('inflation', v)} /><NumberInput label="Edad actual" suffix="años" min={18} max={100} value={values.age} onChange={v => update('age', v)} /></div>
        <p className="fire-input-note">La calculadora guarda tus datos en este dispositivo.</p>
      </div>
      <div className="fire-results">
        <div className="target-card"><span>NÚMERO FIRE · REGLA DEL {values.withdrawalRate} %</span><strong>{completed ? euro.format(result.fireNumber) : 'Introduce tus gastos'}</strong><p>{completed ? `${euro.format(Number(values.annualExpenses))} de gastos al año ÷ ${values.withdrawalRate} %` : 'El objetivo se calcula a partir de tus gastos anuales.'}</p></div>
        <div className="fire-progress"><div className="progress-heading"><span>Patrimonio actual</span><strong>{completed ? `${Math.max(0, result.currentProgress).toFixed(1)} % del objetivo` : '—'}</strong></div><div className="progress-track"><span style={{ width: `${Math.max(0, Math.min(result.currentProgress, 100))}%` }} /></div><p>{completed ? `${euro.format(Number(values.invested) || 0)} de ${euro.format(result.fireNumber)}` : 'Completa los gastos para ver el progreso.'}</p></div>
        <div className={`fire-outcome ${values.phase === 'retired' && result.depletionYear !== null ? 'outcome-caution' : ''}`} aria-live="polite"><span>{values.phase === 'accumulating' ? 'PROYECCIÓN DE ACUMULACIÓN' : 'PROYECCIÓN EN RETIRADA'}</span><p>{!completed ? 'Añade tus gastos anuales para calcular tu objetivo.' : values.phase === 'accumulating' ? result.yearsToFire === 0 ? 'Tu patrimonio actual alcanza el número FIRE con estos supuestos.' : result.yearsToFire === null ? 'Con estos supuestos, no alcanzas tu número FIRE en los próximos 60 años.' : `Alcanzarías tu número FIRE en ${result.yearsToFire} ${result.yearsToFire === 1 ? 'año' : 'años'}${values.age ? `, alrededor de los ${Number(values.age) + result.yearsToFire}` : ''}.` : result.depletionYear !== null ? `Con estos supuestos, el patrimonio se agotaría en aproximadamente ${result.depletionYear.toFixed(1)} años.` : 'Con estos supuestos, el patrimonio no se agota en los próximos 60 años.'}</p></div>
        <ProjectionChart data={chart} target={result.fireNumber} />
        <p className="fire-assumption">Proyección orientativa con rentabilidad e inflación constantes. No modela la volatilidad de los mercados ni los impuestos.</p>
      </div>
    </div>
  </section>;
}
function InstallDialog({ onClose, deferredPrompt, onInstalled }) {
  const dialog = useRef(null);
  useEffect(() => { const node = dialog.current; node.showModal(); return () => node.close(); }, []);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  async function install() { await deferredPrompt.prompt(); const result = await deferredPrompt.userChoice; onInstalled(); if (result.outcome === 'accepted') onClose(); }
  return <dialog ref={dialog} className="install-dialog" onCancel={onClose} onClick={e => { if (e.target === dialog.current) onClose(); }}><div className="dialog-inner"><button className="dialog-close" aria-label="Cerrar" onClick={onClose}><Icon name="close" /></button><div className="install-logo"><Battery /></div><span className="eyebrow">C4F, SIEMPRE A MANO</span><h2>{installed ? 'Ya estás en casa.' : 'Un pequeño icono.\nUn gran comienzo.'}</h2><p>{installed ? 'Compounding4FIRE ya está abierta como aplicación en este dispositivo.' : 'Guarda Compounding4FIRE en tu pantalla de inicio y vuelve a tus lecturas cuando quieras.'}</p>{deferredPrompt ? <button className="button button-primary" onClick={install}>Instalar aplicación <Icon name="download" size={18} /></button> : !installed && <div className="install-steps"><span>EN TU {ios ? 'IPHONE O IPAD' : 'NAVEGADOR'}</span><p>{ios ? 'Abre esta página en Safari, toca Compartir y elige «Añadir a pantalla de inicio».' : 'Abre el menú del navegador y busca «Instalar aplicación» o «Añadir a pantalla de inicio». En el ordenador también puede aparecer un icono de instalación junto a la dirección.'}</p><small>La opción depende del navegador y requiere acceder por HTTPS o desde localhost.</small></div>}<button className="text-button dialog-dismiss" onClick={onClose}>Seguir leyendo <Icon size={16} /></button></div></dialog>;
}
export default function App() {
  const [hash, setHash] = useState(window.location.hash || '#/');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [sort, setSort] = useState('original');
  const [installOpen, setInstallOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [toast, setToast] = useState('');
  const post = hash.startsWith('#/post/') ? posts.find(p => articleUrl(p) === hash) : null;
  const calculator = hash === '#/calculadora';
  const courses = hash === '#/cursos';
  const social = hash === '#/redes';
  const admin = hash === '#/admin';
  const missing = hash.startsWith('#/post/') && !post;
  useEffect(() => {
    let current = window.location.hash || '#/';
    const handler = () => {
      const next = window.location.hash || '#/';
      if (next === current) return;
      if (!window.dispatchEvent(new Event('c4f:before-navigation', { cancelable: true }))) { window.history.replaceState(null, '', current); return; }
      current = next; setHash(next);
    };
    window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    document.title = post ? `${post.title} · Compounding4FIRE` : admin ? 'Panel editorial · Compounding4FIRE' : calculator ? 'Calculadora FIRE · Compounding4FIRE' : courses ? 'Cursos · Compounding4FIRE' : social ? 'Redes · Compounding4FIRE' : 'Compounding4FIRE';
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = post?.excerpt || 'Artículos de Compounding4FIRE sobre ahorro, inversión y libertad financiera.';
    const section = hash === '#/articulos' ? 'articulos' : null;
    requestAnimationFrame(() => section ? document.getElementById(section)?.scrollIntoView() : window.scrollTo(0, 0));
  }, [hash, post]);
  useEffect(() => { const handler = e => { e.preventDefault(); setDeferredPrompt(e); }; window.addEventListener('beforeinstallprompt', handler); return () => window.removeEventListener('beforeinstallprompt', handler); }, []);
  useEffect(() => { if (toast) { const timeout = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timeout); } }, [toast]);
  function onTag(tag) { setSelected([tag]); setQuery(''); window.location.hash = '/articulos'; requestAnimationFrame(() => document.getElementById('articulos')?.scrollIntoView()); }
  return <>
    <a href="#main-content" className="skip-link" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Saltar al contenido</a>
    <div className="top-line" />
    <header className="site-header"><div className="container header-inner"><Brand /><nav aria-label="Navegación principal"><a href="#/articulos" className={!post && !calculator && !courses && !social && !admin ? 'nav-active' : ''}>Artículos</a><a href="#/calculadora" className={calculator ? 'nav-active' : ''}>Calculadora FIRE</a><a href="#/cursos" className={courses ? 'nav-active' : ''}>Cursos</a><a href="#/redes" className={social ? 'nav-active' : ''}>Redes</a><a href={articleUrl(posts[0])}>Sobre C4F</a></nav><button className="install-button" aria-label="Instalar app" onClick={() => setInstallOpen(true)}><Icon name="download" size={17} /><span>Instalar app</span></button></div></header>
    <main id="main-content" tabIndex="-1">{admin ? Admin ? <Suspense fallback={<p className="container">Cargando el panel…</p>}><Admin renderPreview={blocks => <Blocks blocks={blocks} />} /></Suspense> : <section className="container placeholder-page"><h1>Panel editorial</h1><p>Abre el servidor local de edición en tu ordenador para gestionar los artículos.</p></section> : post ? <Article key={post.id} post={post} onTag={onTag} announce={setToast} /> : calculator ? <FIRECalculator /> : courses ? <CoursesPage /> : social ? <SocialPage /> : missing ? <div className="empty-state container"><h1>No encontramos esta lectura.</h1><p>Explora los artículos de Compounding4FIRE.</p><a className="button button-primary" href="#/articulos">Volver al blog <Icon /></a></div> : <Home {...{ query, setQuery, selected, setSelected, sort, setSort, onTag }} />}</main>
    <footer className="site-footer"><div className="container footer-bottom"><span>© {new Date().getFullYear()} Compounding4FIRE</span>{import.meta.env.DEV && <a href="#/admin">Panel editorial</a>}</div></footer>
    {installOpen && <InstallDialog onClose={() => setInstallOpen(false)} deferredPrompt={deferredPrompt} onInstalled={() => setDeferredPrompt(null)} />}
    <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">{toast && <><Icon name="check" size={18} /> {toast}</>}</div>
  </>;
}

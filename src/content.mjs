const metadata = [
  ['¿Quién está al mando de esto?', ['FIRE', 'Libertad financiera'], '', 'quien-esta-al-mando-de-esto'],
  ['¿Qué es la libertad financiera?', ['FIRE', 'Libertad financiera'], '', 'que-es-la-libertad-financiera'],
  ['¿Y si a mí me gusta mi trabajo?', ['Libertad financiera'], '', 'y-si-a-mi-me-gusta-mi-trabajo'],
  ['Si fuera tan fácil lo haría todo el mundo', ['FIRE', 'Libertad financiera'], '', 'si-fuera-tan-facil'],
  ['La regla del 4 %', ['FIRE', 'Libertad financiera'], '', 'la-regla-del-4-por-ciento'],
  ['¿Qué haré con tanto tiempo?', ['Libertad financiera'], '', 'que-hare-con-tanto-tiempo'],
  ['Preahorro', ['Ahorro', 'FIRE'], '', 'preahorro'],
  ['¿Qué es una acción?', ['Acciones'], '', 'que-es-una-accion'],
  ['Padre rico, padre pobre', ['Libros', 'Libertad financiera', 'Ahorro'], '', 'padre-rico-padre-pobre'],
  ['¿Qué es un bono?', ['Renta fija'], '', 'que-es-un-bono'],
  ['¿Es inmoral ser libre financieramente?', ['FIRE', 'Libertad financiera'], '', 'es-inmoral-ser-libre-financieramente'],
  ['El valor temporal del dinero', ['Ahorro', 'Acciones'], '', 'el-valor-temporal-del-dinero'],
  ['¿Qué es un índice bursátil?', ['Acciones', 'Fondos y ETF'], '', 'que-es-un-indice-bursatil'],
  ['El millonario de la puerta de al lado', ['Libros', 'Ahorro', 'Libertad financiera'], '', 'el-millonario-de-la-puerta-de-al-lado'],
  ['¿Qué es un fondo de inversión?', ['Fondos y ETF'], '', 'que-es-un-fondo'],
  ['¿Y si me muero antes de retirarme y no he disfrutado?', ['FIRE', 'Libertad financiera', 'Ahorro'], '', 'y-si-me-muero-antes-de-retirarme'],
];
export const plain = block => block.spans?.map(span => span.text).join('') || (block.rows ? block.rows.flat(2).map(plain).join(' ') : '');
export const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function buildCatalog(raw) { return raw.map(post => {
  const [title, tags, description, slug] = post.slug ? [post.title, post.tags, post.description || '', post.slug] : metadata[post.id - 1];
  let split = -1;
  if (post.id === 1) split = post.blocks.findIndex(b => plain(b).includes('What do you mean you retired'));
  if (post.id === 2) split = post.blocks.findIndex(b => /^\*{10}/.test(plain(b).trim()));
  const blocks = split < 0 ? post.blocks : post.blocks.slice(0, split);
  const notes = [];
  const words = blocks.map(plain).join(' ').trim().split(/\s+/).length;
  const excerptSource = blocks.find(block => {
    if (!['paragraph', 'heading', 'list-item'].includes(block.type)) return false;
    const text = plain(block).trim();
    if (text.length < 38) return false;
    if (/^https?:\/\/\S+$/.test(text)) return false;
    const normalized = normalize(text);
    const titleStart = normalize(title).slice(0, 22);
    return !normalized.startsWith(titleStart);
  });
  const excerptText = plain(excerptSource || blocks.find(block => ['paragraph', 'list-item'].includes(block.type)) || {}).replace(/\s+/g, ' ').trim();
  const excerpt = excerptText.length > 205 ? `${excerptText.slice(0, 205).replace(/\s+\S*$/, '').replace(/[\s,;:.!?—-]+$/, '')}…` : excerptText;
  const covers = { 10: 'images/post-10-2.webp', 12: 'images/post-12-2.webp' };
  return { ...post, title, tags, description, excerpt, slug, blocks, notes,
    cover: post.slug ? post.cover : Object.hasOwn(covers, post.id) ? covers[post.id] : post.blocks.find(b => b.type === 'image')?.src,
    minutes: Math.max(1, Math.ceil(words / 220)),
    searchText: normalize([title, description, ...tags, ...blocks.map(plain)].join(' ')),
  };
}); }

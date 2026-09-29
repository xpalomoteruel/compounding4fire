import published from './data/published.json' with { type: 'json' };
import { buildCatalog, normalize } from './content.mjs';
export { plain, normalize } from './content.mjs';
export const posts = buildCatalog(published || []);
export const topics = [...new Set(['FIRE', 'Libertad financiera', 'Ahorro', 'Acciones', 'Fondos y ETF', 'Renta fija', 'Libros', ...posts.flatMap(post => post.tags)])];
export const articleUrl = post => `#/post/${post.slug}`;
export function filterPosts({ query = '', selected = [], sort = 'original' } = {}, catalog = posts) {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const result = catalog.filter(post => words.every(word => post.searchText.includes(word)) && (!selected.length || selected.some(tag => post.tags.includes(tag))));
  if (sort === 'latest') result.sort((a, b) => b.id - a.id);
  if (sort === 'short') result.sort((a, b) => a.minutes - b.minutes || a.id - b.id);
  return result;
}
export function localLink(url) {
  if (!/^https?:\/\//i.test(url)) return undefined;
  const parsed = new URL(url);
  if (/^(www\.)?compounding4fire\.com$/.test(parsed.hostname)) {
    const original = parsed.pathname.replace(/^\/|\/$/g, '');
    const aliases = { 'regla-4': 5, 'regla-del-4': 5, 'que-es-la-libertad-financiera': 2, 'preahorro': 7 };
    const match = posts.find(p => p.slug === original || p.id === aliases[original]);
    if (match) return articleUrl(match);
  }
  return url;
}

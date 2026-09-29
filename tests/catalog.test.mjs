import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { topics, filterPosts as filterCatalog, localLink, articleUrl } from '../src/catalog.mjs';
import original from '../src/data/posts.json' with { type: 'json' };
import { buildCatalog } from '../src/content.mjs';
// Check the original import without assuming the live catalogue will stay at 16 posts.
const posts = buildCatalog(original);
const filterPosts = options => filterCatalog(options, posts);

test('the 16 original posts have unique routes, content and known tags', () => {
  assert.deepEqual(posts.map(p => p.id), Array.from({ length: 16 }, (_, i) => i + 1));
  assert.equal(new Set(posts.map(articleUrl)).size, 16);
  for (const post of posts) {
    assert.ok(post.blocks.length > 0);
    assert.ok(post.tags.length && post.tags.every(t => topics.includes(t)));
  }
});
test('all original figures are local and available', () => {
  const images = posts.flatMap(p => [...p.blocks, ...p.notes]).filter(b => b.type === 'image');
  assert.equal(images.length, 14);
  for (const image of images) assert.ok(existsSync(resolve(import.meta.dirname, '../public', image.src)), image.src);
});
test('books filter excludes other categories; filters combine with OR', () => {
  assert.deepEqual(filterPosts({ selected: ['Libros'] }).map(p => p.id), [9, 14]);
  assert.deepEqual(filterPosts({ selected: ['Libros', 'Renta fija'] }).map(p => p.id), [9, 10, 14]);
});
test('search is accent insensitive, searches body text, and intersects filters', () => {
  assert.ok(filterPosts({ query: 'indice bursatil' }).some(p => p.id === 13));
  assert.ok(filterPosts({ query: 'panaderia' }).some(p => p.id === 8));
  assert.deepEqual(filterPosts({ query: 'kiyosaki', selected: ['Libros'] }).map(p => p.id), [9]);
  assert.equal(filterPosts({ query: 'zzzznothinghere' }).length, 0);
});
test('sorting does not mutate the original reading order', () => {
  assert.equal(filterPosts({ sort: 'latest' })[0].id, 16);
  assert.equal(filterPosts()[0].id, 1);
  const sorted = filterPosts({ sort: 'short' });
  assert.ok(sorted.every((p, i) => !i || p.minutes >= sorted[i - 1].minutes));
});
test('old internal article link routes to C4F; unsafe protocols are rejected', () => {
  assert.equal(localLink('https://www.compounding4fire.com/y-si-a-mi-me-gusta-mi-trabajo/'), articleUrl(posts[2]));
  assert.equal(localLink('javascript:alert(1)'), undefined);
});
test('unpublished draft appendices are excluded; the missing table is disclosed', () => {
  assert.equal(posts[0].notes.length, 0);
  assert.equal(posts[1].notes.length, 0);
  assert.ok(!posts[1].blocks.some(b => b.spans?.some(s => /ChatGPT|documento original/i.test(s.text))));
  assert.ok(!topics.includes('Mentalidad'));
  assert.ok(posts[14].blocks.some(b => b.spans?.some(s => s.text.includes('[table id=2 /]'))));
});

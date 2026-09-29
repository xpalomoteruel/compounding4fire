import { readFile, writeFile } from 'node:fs/promises';

// Keep the published body of posts 1 and 2, excluding translated/source drafts
// and editorial notes appended to the original Drive exports.
const file = new URL('../src/data/posts.json', import.meta.url);
const posts = JSON.parse(await readFile(file, 'utf8'));
for (const post of posts) {
  if (post.id === 1) {
    const split = post.blocks.findIndex(block => block.spans?.some(span => span.text.includes('What do you mean you retired')));
    if (split >= 0) post.blocks = post.blocks.slice(0, split);
  }
  if (post.id === 2) {
    const split = post.blocks.findIndex(block => /^\*{10}/.test(block.spans?.map(span => span.text).join('').trim() || ''));
    if (split >= 0) post.blocks = post.blocks.slice(0, split);
  }
  if (post.notes) post.notes = [];
}
await writeFile(file, `${JSON.stringify(posts, null, 2)}\n`);

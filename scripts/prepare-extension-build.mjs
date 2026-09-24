import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'dist', 'client');
const source = await readFile(resolve(root, 'index.html'), 'utf8');
const extensionBase = source.replace(' data-demo="true"', '');

for (const [name, title] of [
  ['options', 'Reroute — Manage rule'],
  ['popup', 'Reroute'],
  ['intervention', 'Reroute — A helpful detour'],
]) {
  const html = extensionBase
    .replace('data-view="options"', `data-view="${name}"`)
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
  await writeFile(resolve(root, `${name}.html`), html);
}

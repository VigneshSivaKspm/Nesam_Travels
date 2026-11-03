// Saves this site's sitemap as public/sitemap.xml:  npm run seo:sitemap
// It reads the same route and service lists as the site, so it never drifts from the real pages.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundled = path.join(root, 'node_modules', '.cache', 'sitemap-build.mjs');

await build({ entryPoints: [path.join(root, 'scripts', 'sitemap.ts')], bundle: true, platform: 'node', format: 'esm', outfile: bundled, logLevel: 'silent' });
const { buildSitemap, sitemapEntries } = await import(`${pathToFileURL(bundled).href}?t=${Date.now()}`);

const entries = sitemapEntries();
fs.writeFileSync(path.join(root, 'public', 'sitemap.xml'), buildSitemap(entries));
console.log(`public/sitemap.xml written: ${entries.length} pages`);

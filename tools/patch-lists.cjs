// One-off codemod: screens import ScrollView / FlatList from the responsive layer
// (components/layout) instead of react-native. Run: node tools/patch-lists.cjs
const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

for (const app of ['user', 'driver', 'vendor']) {
  const root = `${app}/src`;
  const files = [...walk(root), `${app}/App.tsx`];
  for (const f of files) {
    if (/components[\\/](ui|layout)\.tsx$/.test(f)) continue;
    let s = fs.readFileSync(f, 'utf8');
    const m = /import \{([^}]*)\} from 'react-native';/.exec(s);
    if (!m) continue;
    const names = m[1].split(',').map((x) => x.trim()).filter(Boolean);
    const moved = names.filter((n) => n === 'ScrollView' || n === 'FlatList');
    if (!moved.length) continue;
    const kept = names.filter((n) => !moved.includes(n));
    const rel = path.relative(path.dirname(f), `${root}/components/layout`).replace(/\\/g, '/');
    const spec = rel.startsWith('.') ? rel : `./${rel}`;
    const rnImport = kept.length ? `import { ${kept.join(', ')} } from 'react-native';` : '';
    const layoutImport = `import { ${moved.join(', ')} } from '${spec}';`;
    s = s.replace(m[0], [rnImport, layoutImport].filter(Boolean).join('\n'));
    fs.writeFileSync(f, s);
    console.log('patched', f, moved.join(','));
  }
}

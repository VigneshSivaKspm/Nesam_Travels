// One-off codemod: browser tab title (React Navigation otherwise sets it to "undefined" on auth screens).
const fs = require('fs');
const names = { user: 'NESAM Tours & Travels', driver: 'NESAM Driver', vendor: 'NESAM Fleet Partner' };
for (const app of Object.keys(names)) {
  const f = `${app}/App.tsx`;
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('documentTitle')) continue;
  s = s.replace("const navTheme = {", `const APP_TITLE = '${names[app]}';

// Browser tab title: "Screen title · App name" (on Android / iOS this is ignored).
const documentTitle = {
  formatter: (options: { title?: string } | undefined) => (options?.title ? \`\${options.title} · \${APP_TITLE}\` : APP_TITLE),
};

const navTheme = {`);
  s = s.replace('<NavigationContainer ref={navigationRef} theme={navTheme}>', '<NavigationContainer ref={navigationRef} theme={navTheme} documentTitle={documentTitle}>');
  fs.writeFileSync(f, s);
  console.log('patched', f, s.includes('documentTitle={documentTitle}'));
}

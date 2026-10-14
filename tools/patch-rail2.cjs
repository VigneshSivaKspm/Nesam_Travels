const fs = require('fs');
let f = 'user/src/theme/responsive.ts';
let s = fs.readFileSync(f, 'utf8');
s = s.replace('{ medium: 88, expanded: 232 }', '{ medium: 96, expanded: 232 }');
fs.writeFileSync(f, s);
for (const a of ['driver', 'vendor']) fs.copyFileSync(f, `${a}/src/theme/responsive.ts`);
for (const a of ['user', 'driver', 'vendor']) {
  f = `${a}/src/navigation/MainNavigator.tsx`;
  s = fs.readFileSync(f, 'utf8');
  s = s.split('{ width: navWidth, borderRightColor: colors.border }').join('{ width: navWidth, minWidth: navWidth, maxWidth: navWidth, borderRightColor: colors.border }');
  s = s.replace(/tabBarLabelStyle: \{ fontSize: (\d+), fontWeight: '700' \},/, "tabBarLabelStyle: { fontSize: isCompact ? $1 : navWidth > 100 ? 14 : 11, fontWeight: '700' },");
  fs.writeFileSync(f, s);
}

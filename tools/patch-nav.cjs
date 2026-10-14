// One-off codemod: tab bar becomes a side rail on medium / expanded windows.
const fs = require('fs');
for (const app of ['user', 'driver', 'vendor']) {
  const f = `${app}/src/navigation/MainNavigator.tsx`;
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('useResponsive')) continue;
  s = s.replace("import { colors } from '../theme';\n", "import { colors } from '../theme';\nimport { useResponsive } from '../theme/responsive';\n");
  // Tabs() gets the window class.
  s = s.replace(/function Tabs\(\) \{\n/, 'function Tabs() {\n  const { isCompact } = useResponsive();\n');
  // Position + variant on every screen of the navigator.
  s = s.replace('        headerShown: false,\n        tabBarActiveTintColor: colors.primary,', "        headerShown: false,\n        // Phones: bottom tabs. Tablets / desktop: a side rail, so the content keeps its height.\n        tabBarPosition: isCompact ? 'bottom' : 'left',\n        tabBarVariant: isCompact ? 'uikit' : 'material',\n        tabBarActiveTintColor: colors.primary,");
  s = s.replace("tabBarStyle: { minHeight: 64, paddingTop: 6, borderTopColor: colors.border },", "tabBarStyle: isCompact ? { minHeight: 64, paddingTop: 6, borderTopColor: colors.border } : { borderRightColor: colors.border },");
  fs.writeFileSync(f, s);
  console.log('patched', f, s.includes("tabBarPosition"));
}

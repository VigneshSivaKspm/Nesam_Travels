const fs = require('fs');
let f = 'user/src/theme/responsive.ts';
let s = fs.readFileSync(f, 'utf8');
s = s.replace(`/** Width taken by the side navigation rail when the tab bar moves to the left. */
export const NAV_RAIL_WIDTH = 88;
`, `/** Side navigation width when the tab bar moves to the left: icon rail (medium) / labelled sidebar (expanded). */
export const NAV_WIDTH = { medium: 88, expanded: 232 } as const;
`);
s = s.replace("  /** Width left for screen content after the navigation rail (if shown). */\n  available: number;", "  /** Width left for screen content after the side navigation (if shown). */\n  available: number;\n  /** Width of the side navigation (0 on compact, where tabs are at the bottom). */\n  navWidth: number;");
s = s.replace("    const available = isCompact ? width : width - NAV_RAIL_WIDTH;", "    const navWidth = isCompact ? 0 : sizeClass === 'medium' ? NAV_WIDTH.medium : NAV_WIDTH.expanded;\n    const available = width - navWidth;");
s = s.replace("      available,\n", "      available,\n      navWidth,\n");
fs.writeFileSync(f, s);
for (const a of ['driver', 'vendor']) fs.copyFileSync(f, `${a}/src/theme/responsive.ts`);
for (const a of ['user', 'driver', 'vendor']) {
  f = `${a}/src/navigation/MainNavigator.tsx`;
  s = fs.readFileSync(f, 'utf8');
  s = s.replace("const { isCompact } = useResponsive();", "const { isCompact, navWidth } = useResponsive();");
  s = s.replace("        tabBarVariant: isCompact ? 'uikit' : 'material',\n", "        tabBarVariant: isCompact ? 'uikit' : 'material',\n        tabBarLabelPosition: navWidth > 100 ? 'beside-icon' : 'below-icon',\n");
  if (a === 'user') s = s.replace("{ borderRightColor: colors.border },", "{ width: navWidth, borderRightColor: colors.border },");
  else s = s.replace("        tabBarIcon: ({ color, size })", "        tabBarStyle: isCompact ? undefined : { width: navWidth, borderRightColor: colors.border },\n        tabBarIcon: ({ color, size })");
  fs.writeFileSync(f, s);
}

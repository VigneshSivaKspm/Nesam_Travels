// One-off codemod: makes the shared ui.tsx of each app responsive (Screen, Button, Sheet).
// Run from the repo root: node tools/patch-ui.cjs
const fs = require('fs');

function must(s, from, to, label) {
  if (!s.includes(from)) throw new Error(`pattern not found: ${label}`);
  return s.replace(from, to);
}

for (const app of ['user', 'driver', 'vendor']) {
  const f = `${app}/src/components/ui.tsx`;
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes("from './layout'")) {
    console.log('skip', f);
    continue;
  }

  // Imports: ScrollView now comes from the responsive layer.
  s = must(s, '  Pressable,\n  ScrollView,\n  StyleProp,', '  Pressable,\n  StyleProp,', 'rn import');
  s = must(
    s,
    "import { colors, radius, space, type } from '../theme';\n",
    "import { colors, radius, space, type } from '../theme';\nimport { useResponsive, type ContentKind } from '../theme/responsive';\nimport { ScrollView, useContentStyle } from './layout';\n",
    'theme import',
  );

  // Screen: centred, width-capped content; full-bleed background and footer bar.
  s = must(s, '  refreshControl,\n', '  refreshControl,\n  kind = \'narrow\',\n', 'screen destructure');
  s = must(
    s,
    "  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];\n}) {\n  const body = scroll ? (\n    <ScrollView\n      contentContainerStyle={[padded && styles.padded, { paddingBottom: space.xxl }]}",
    "  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];\n  /** 'narrow' (forms, details) or 'wide' (dashboards, card grids) content column on large windows. */\n  kind?: ContentKind;\n}) {\n  const content = useContentStyle(kind);\n  const body = scroll ? (\n    <ScrollView\n      kind={kind}\n      contentContainerStyle={[padded && styles.padded, { paddingBottom: space.xxl }]}",
    'screen body',
  );
  s = must(
    s,
    "    <View style={[{ flex: 1 }, padded && styles.padded]}>{children}</View>\n  );",
    "    <View style={[{ flex: 1 }, content, padded && styles.padded]}>{children}</View>\n  );",
    'screen unscrolled',
  );
  s = must(
    s,
    '        {footer ? <View style={styles.footer}>{footer}</View> : null}',
    '        {footer ? (\n          <View style={styles.footer}>\n            <View style={content}>{footer}</View>\n          </View>\n        ) : null}',
    'screen footer',
  );

  // Button label: wrap to a second line instead of clipping on 320 dp screens.
  s = must(
    s,
    "<Text style={[styles.btnText, small && styles.btnTextSmall, { color: v.fg }]} numberOfLines={1}>",
    "<Text style={[styles.btnText, small && styles.btnTextSmall, { color: v.fg }]} numberOfLines={2} maxFontSizeMultiplier={1.4}>",
    'button text',
  );
  s = must(s, "  btnText: { fontSize: 15, fontWeight: '700' },", "  btnText: { fontSize: 15, fontWeight: '700', textAlign: 'center', flexShrink: 1 },", 'btnText style');

  // Sheet: bottom sheet on phones, centred dialog on tablets / desktop.
  s = must(
    s,
    "  return (\n    <Modal visible={visible} transparent animationType=\"slide\" onRequestClose={dismissible ? onClose : () => undefined}>\n      <View style={styles.sheetBackdrop}>\n        <Pressable style={{ flex: 1 }} onPress={dismissible ? onClose : undefined} accessibilityLabel=\"Close\" />\n        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>\n          <SafeAreaView edges={['bottom']} style={styles.sheet}>\n            <View style={styles.sheetHandle} />",
    "  const wide = !useResponsive().isCompact;\n  return (\n    <Modal visible={visible} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={dismissible ? onClose : () => undefined}>\n      <View style={[styles.sheetBackdrop, wide && styles.sheetBackdropWide]}>\n        <Pressable style={wide ? StyleSheet.absoluteFill : { flex: 1 }} onPress={dismissible ? onClose : undefined} accessibilityLabel=\"Close\" />\n        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={wide ? styles.sheetWideWrap : undefined}>\n          <SafeAreaView edges={wide ? [] : ['bottom']} style={[styles.sheet, wide && styles.sheetWide]}>\n            {wide ? null : <View style={styles.sheetHandle} />}",
    'sheet',
  );
  s = must(
    s,
    "  sheetBackdrop: { flex: 1, backgroundColor: colors.overlay },\n",
    "  sheetBackdrop: { flex: 1, backgroundColor: colors.overlay },\n  sheetBackdropWide: { justifyContent: 'center', alignItems: 'center', padding: space.xl },\n  sheetWideWrap: { width: '100%', maxWidth: 560, maxHeight: '100%' },\n  sheetWide: { borderRadius: radius.xl, paddingTop: space.sm },\n",
    'sheet styles',
  );
  fs.writeFileSync(f, s);
  console.log('patched', f);
}

// Privacy & terms: the customer documents NESAM has published, the version in
// force and whether this account has accepted it (acceptance itself happens in
// LegalGate when a new version is published).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from '../components/layout';
import { useNavigation } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { callFunction } from '../services/callables';
import { Notice } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { colors, radius, space } from '../theme';
import { useResponsive } from '../theme/responsive';

interface DocRow {
  key: string;
  title: string;
  version: number;
  body: string;
  accepted: boolean;
}

export function LegalDocumentsScreen() {
  const { isDesktop } = useResponsive();
  const navigation = useNavigation();
  const [rows, setRows] = useState<DocRow[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await callFunction<unknown, { missing: { key: string }[]; required: { key: string; title: string; version: number }[] }>('getLegalStatus', { role: 'customer' });
        const missing = new Set(s.missing.map((m) => m.key));
        const bodies = await Promise.all(s.required.map(async (r) => String((await getDoc(doc(db, 'legal_documents', r.key))).data()?.body ?? '')));
        if (!alive) return;
        setRows(s.required.map((r, i) => ({ key: r.key, title: r.title || r.key, version: r.version, body: bodies[i] ?? '', accepted: !missing.has(r.key) })));
      } catch {
        if (alive) setError('We couldn’t load the documents. Check your connection and try again.');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={styles.root}>
      <DesktopHeader
        title="Privacy & Legal Terms"
        subtitle="Official rider agreements, privacy guidelines, and service conditions"
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={{ backgroundColor: colors.page }} contentContainerStyle={[styles.pad, isDesktop && styles.desktopPad]}>
        <Notice message={error} />
        {rows === null && !error ? <ActivityIndicator color={colors.primary} style={{ marginTop: space.xl }} /> : null}
        {rows && rows.length === 0 ? <Text style={styles.muted}>NESAM has not published customer terms or a privacy policy in the app yet. Contact support for a copy.</Text> : null}
        {rows?.map((r) => (
          <View key={r.key} style={styles.doc}>
            <Pressable onPress={() => setOpen(open === r.key ? '' : r.key)} style={styles.head} accessibilityRole="button" accessibilityState={{ expanded: open === r.key }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{r.title}</Text>
                <Text style={[styles.status, { color: r.accepted ? colors.success : colors.warning }]}>
                  Version {r.version} · {r.accepted ? 'Accepted' : 'Not yet accepted'}
                </Text>
              </View>
              <Text style={styles.toggle}>{open === r.key ? 'Hide document' : 'Read document'}</Text>
            </Pressable>
            {open === r.key ? (
              <View style={styles.bodyWrapper}>
                <Text style={styles.body}>{r.body || 'This document has no text yet.'}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  pad: { padding: space.lg, paddingBottom: space.xxl },
  desktopPad: { maxWidth: 920, width: '100%', alignSelf: 'center' },
  muted: { fontSize: 15, color: colors.slate, textAlign: 'center', marginTop: space.xl },
  doc: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: space.xl,
    marginBottom: space.md,
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)' as any,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  status: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  toggle: { fontSize: 14, fontWeight: '800', color: colors.primary },
  bodyWrapper: { marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  body: { fontSize: 15, lineHeight: 24, color: colors.ink },
});

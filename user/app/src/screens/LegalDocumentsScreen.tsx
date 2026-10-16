// Privacy & terms: the customer documents NESAM has published, the version in
// force and whether this account has accepted it (acceptance itself happens in
// LegalGate when a new version is published).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { callFunction } from '../services/callables';
import { Notice } from '../components/ui';
import { SubHeader } from '../components/brand';
import { colors, fonts, radius, space } from '../theme';

interface DocRow {
  key: string;
  title: string;
  version: number;
  body: string;
  accepted: boolean;
}

export function LegalDocumentsScreen() {
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
    <SafeAreaView style={styles.root} edges={['top']}>
      <SubHeader title="Legal & Privacy" subtitle="Official rider agreements & conditions" onBack={() => navigation.goBack()} />

      <ScrollView style={{ backgroundColor: '#F8FAFC' }} contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  pad: { padding: space.md, paddingBottom: space.xxl },
  muted: { fontFamily: fonts.medium, fontSize: 13, color: colors.slate, textAlign: 'center', marginTop: space.xl },
  doc: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
    padding: space.md,
    marginBottom: space.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  status: { fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
  toggle: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
  bodyWrapper: { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  body: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.ink },
});

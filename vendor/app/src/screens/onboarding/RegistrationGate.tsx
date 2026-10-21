// Self-registration entry screen (replaces the old invitation-gate).
// Shown to a signed-in phone number that has no vendors/{uid} document yet.
// The user reads a brief explainer and taps "Start application"; we create the
// vendors/{uid} draft with status INCOMPLETE and the real-time listener in
// App.tsx immediately routes them to the OnboardingWizard.
import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createVendorApplication } from '../../services/onboardingService';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../../config/constants';
import { describeDataError } from '../../utils/retry';
import { Button, Card, Notice } from '../../components/ui';
import { colors, radius, space, type } from '../../theme';

const STEPS = [
  { icon: 'business-outline' as const, title: 'Business details', desc: 'Owner name, agency name, operating city and bank account for settlements.' },
  { icon: 'document-text-outline' as const, title: 'Identity & documents', desc: 'GST / trade license and a government-issued identity proof.' },
  { icon: 'car-outline' as const, title: 'Fleet documentation', desc: 'Each vehicle\'s RC, insurance, FC, permit and a front photo.' },
  { icon: 'checkmark-circle-outline' as const, title: 'Submit for review', desc: 'NESAM reviews your application and activates your account once approved.' },
];

export function RegistrationGate({ phone, onSignOut }: { phone: string; onSignOut: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      await createVendorApplication(phone);
      // vendors/{uid} listener in App.tsx fires and routes to OnboardingWizard.
    } catch (e) {
      setError(describeDataError(e));
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="business" size={40} color={colors.white} />
          </View>
          <Text style={[type.h1, styles.heroTitle]}>Become a NESAM{'\n'}fleet partner</Text>
          <Text style={[type.body, styles.heroSub]}>
            Register your travel agency or fleet and start accepting bookings from thousands of NESAM customers.
          </Text>
        </View>

        {/* What you'll need */}
        <Card style={styles.stepsCard}>
          <Text style={[type.label, { color: colors.muted, marginBottom: space.sm }]}>WHAT YOU'LL FILL IN</Text>
          {STEPS.map((s, i) => (
            <View key={s.title} style={[styles.stepRow, i < STEPS.length - 1 && styles.stepRowBorder]}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Ionicons name={s.icon} size={20} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{s.title}</Text>
                <Text style={[type.small, { color: colors.muted }]}>{s.desc}</Text>
              </View>
            </View>
          ))}
        </Card>

        <View style={styles.noteBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={[type.small, { flex: 1, color: colors.ink }]}>
            Your application is reviewed by the NESAM team. You'll get full access — bookings, drivers, vehicles and wallet — once approved.
          </Text>
        </View>

        {/* Signed-in as */}
        <View style={styles.phoneRow}>
          <Ionicons name="phone-portrait-outline" size={14} color={colors.muted} />
          <Text style={[type.tiny, { color: colors.muted }]}>Registering as <Text style={{ fontWeight: '700', color: colors.ink }}>{phone}</Text></Text>
        </View>

        {error ? <Notice message={error} style={{ marginBottom: space.md }} onRetry={() => void start()} /> : null}

        <Button
          title={busy ? 'Starting your application…' : 'Start application'}
          loading={busy}
          onPress={() => void start()}
          style={styles.cta}
        />

        <View style={styles.footer}>
          <Button
            title={`Need help? Call ${SUPPORT_PHONE_DISPLAY}`}
            variant="secondary"
            onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)}
          />
          <Button title="Sign out" variant="ghost" onPress={onSignOut} style={{ marginTop: space.sm }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  hero: { alignItems: 'center', marginVertical: space.lg },
  heroIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: space.md,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  heroTitle: { textAlign: 'center', marginBottom: space.xs },
  heroSub: { textAlign: 'center', color: colors.muted, paddingHorizontal: space.md },
  stepsCard: { padding: space.md, marginBottom: space.md },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.sm },
  stepRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primarySoft, borderWidth: 1.5, borderColor: colors.primaryBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  noteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.sm,
    backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder,
    borderRadius: radius.md, padding: space.md, marginBottom: space.md,
  },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    justifyContent: 'center', marginBottom: space.md,
  },
  cta: { marginBottom: space.sm },
  footer: { marginTop: space.md },
});

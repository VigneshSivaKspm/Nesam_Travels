// Pending / rejected / suspended (native port of vendor/web AccountStatusScreen.tsx).
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { VendorRecord } from '../../types/vendor';
import { SECTION_LABELS } from '../../config/onboarding';
import { Button, Card, Notice, Screen } from '../../components/ui';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../../config/constants';
import { colors, radius, space, type } from '../../theme';
import { useResponsive } from '../../theme/responsive';

const LOCKED = ['Add & manage fleet vehicles', 'Onboard and assign drivers', 'Accept trips & bid in the marketplace', 'Earnings, wallet & payouts'];

function Hero({ icon, color, title, body }: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; body: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[styles.icon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={36} color={color} />
      </View>
      <Text style={[type.h1, { textAlign: 'center', marginTop: space.sm }]}>{title}</Text>
      <Text style={[type.small, { textAlign: 'center', marginTop: space.sm, lineHeight: 20 }]}>{body}</Text>
    </View>
  );
}

function Footer({ onSignOut }: { onSignOut: () => void }) {
  return (
    <View style={styles.footer}>
      <Button title={`Call Partner Support (${SUPPORT_PHONE_DISPLAY})`} variant="secondary" onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
      <Button title="Sign Out" variant="ghost" onPress={onSignOut} style={{ marginTop: space.sm }} />
    </View>
  );
}

export function AccountStatusScreen({ record, onSignOut, onReapply }: { record: VendorRecord; onSignOut: () => void; onReapply?: () => void }) {
  const { isDesktop } = useResponsive();
  const businessName = record.business?.businessName || 'your business';

  if (record.status === 'SUSPENDED') {
    return (
      <Screen bg={colors.page}>
        <View style={[styles.container, isDesktop && styles.desktopContainer]}>
          <Card style={styles.card}>
            <Hero icon="ban" color={colors.danger} title="Account Suspended" body={`Operations for ${businessName} are currently paused by the NESAM team. Please contact partner support for compliance review.`} />
            {record.review?.note ? <Notice tone="warning" message={record.review.note} style={{ marginTop: space.lg }} /> : null}
            <Footer onSignOut={onSignOut} />
          </Card>
        </View>
      </Screen>
    );
  }

  if (record.status === 'REJECTED') {
    return (
      <Screen bg={colors.page}>
        <View style={[styles.container, isDesktop && styles.desktopContainer]}>
          <Card style={styles.card}>
            <Hero icon="close-circle" color={colors.danger} title="Application Not Approved" body={`We couldn’t approve ${businessName} with the submitted documentation.`} />
            {record.review?.note ? <Notice message={`Reason from verification team: ${record.review.note}`} style={{ marginTop: space.lg }} /> : null}
            {record.review?.flaggedSections.length ? (
              <Text style={[type.small, { marginTop: space.sm }]}>Sections requiring correction: {record.review.flaggedSections.map((s) => SECTION_LABELS[s]).join(', ')}</Text>
            ) : null}
            {onReapply ? <Button title="Correct Details & Reapply" onPress={onReapply} style={{ marginTop: space.lg }} /> : null}
            <Footer onSignOut={onSignOut} />
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen bg={colors.page}>
      <View style={[styles.container, isDesktop && styles.desktopContainer]}>
        <Card style={styles.card}>
          <Hero icon="time" color={colors.primary} title="Application Under Review" body={`Thank you for registering ${businessName}. The NESAM compliance team is verifying your business documents, bank account, and fleet registration.`} />
          <View style={styles.lockedBox}>
            <Text style={styles.lockedTitle}>What unlocks once approved:</Text>
            {LOCKED.map((item) => (
              <View key={item} style={styles.lockedItem}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.lockedText}>{item}</Text>
              </View>
            ))}
          </View>
          <Footer onSignOut={onSignOut} />
        </Card>
      </View>
    </Screen>
  );
}

export function LoadErrorScreen({ message, onRetry, onSignOut }: { message: string; onRetry: () => void; onSignOut: () => void }) {
  return (
    <Screen bg={colors.page}>
      <View style={[styles.container, { maxWidth: 540, alignSelf: 'center', marginTop: space.xl }]}>
        <Card style={styles.card}>
          <Text style={type.h2}>Couldn’t load your account</Text>
          <Notice message={message} style={{ marginTop: space.md }} />
          <Button title="Try again" onPress={onRetry} style={{ marginTop: space.md }} />
          <Button title="Sign out" variant="secondary" onPress={onSignOut} style={{ marginTop: space.sm }} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  desktopContainer: { maxWidth: 540, width: '100%', alignSelf: 'center', marginTop: space.xl },
  card: {
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)' as any,
  },
  icon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  lockedBox: { backgroundColor: '#F8FAFC', borderRadius: radius.md, padding: space.md, marginVertical: space.lg, gap: 8, borderWidth: 1, borderColor: colors.border },
  lockedTitle: { fontSize: 14, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  lockedItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  lockedText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  footer: { marginTop: space.lg },
});


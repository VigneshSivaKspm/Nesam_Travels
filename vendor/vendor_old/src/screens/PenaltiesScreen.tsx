import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FlatList } from '../components/layout';
import { useInbox } from '../context/Inbox';
import { Badge, EmptyState } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { PenaltyAckModal } from '../components/PenaltyAckModal';
import { formatDateTime12 } from '../utils/time';
import type { PartnerPenalty } from '../types/notifications';
import { colors, radius, space, type } from '../theme';
import { useResponsive } from '../theme/responsive';

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const TONE: Record<PartnerPenalty['status'], 'warning' | 'info' | 'success' | 'neutral' | 'danger'> = {
  Pending: 'danger',
  Acknowledged: 'warning',
  Disputed: 'info',
  Paid: 'success',
  Deducted: 'success',
  Waived: 'neutral',
};

export function PenaltiesScreen() {
  const { isDesktop } = useResponsive();
  const navigation = useNavigation();
  const { penalties } = useInbox();
  const [open, setOpen] = useState<PartnerPenalty | null>(null);

  return (
    <View style={styles.root}>
      <DesktopHeader
        title="Penalties & Compliance Actions"
        subtitle="Operational penalty notices, driver discipline records, and formal dispute resolutions"
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={penalties}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.list, isDesktop && styles.desktopList]}
        ListEmptyComponent={<EmptyState title="No penalties" message="Penalties issued by NESAM operations appear here with full dispute resolution options." />}
        renderItem={({ item: p }) => (
          <Pressable
            style={({ pressed, hovered }: any) => [
              styles.item,
              hovered && { borderColor: colors.primary },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => !p.acknowledged && p.status === 'Pending' && setOpen(p)}
            accessibilityRole="button"
          >
            <View style={styles.head}>
              <Text style={styles.amount}>{rupees(p.amount)}</Text>
              <Badge label={p.status} tone={TONE[p.status]} />
            </View>
            <Text style={styles.categoryTitle}>{p.category}</Text>
            <Text style={styles.reasonText}>{p.reason}</Text>
            <View style={styles.metaRow}>
              {p.bookingCode ? <Text style={styles.bookingTag}>Booking ID: {p.bookingCode}</Text> : null}
              <Text style={styles.dateTag}>{p.issuedAt ? `Issued on ${formatDateTime12(p.issuedAt)}` : ''}</Text>
            </View>
            {p.acknowledged && p.acknowledgedAt ? <Text style={styles.ackTag}>✓ Acknowledged on {formatDateTime12(p.acknowledgedAt)}</Text> : null}
            {p.status === 'Disputed' && p.disputeNote ? (
              <View style={styles.disputeBox}>
                <Text style={styles.disputeTitle}>Your Submitted Dispute:</Text>
                <Text style={styles.disputeNote}>{p.disputeNote}</Text>
              </View>
            ) : null}
          </Pressable>
        )}
      />
      {open ? <PenaltyAckModal penalty={open} onDone={() => setOpen(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  list: { padding: space.lg, paddingBottom: space.xxl },
  desktopList: { maxWidth: 880, width: '100%', alignSelf: 'center' },
  item: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.md,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)' as any,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xs },
  amount: { fontSize: 24, fontWeight: '900', color: colors.danger },
  categoryTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, marginTop: 4 },
  reasonText: { fontSize: 14, color: colors.text, marginTop: 4, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  bookingTag: { fontSize: 12, fontWeight: '700', color: colors.slate },
  dateTag: { fontSize: 12, color: colors.muted },
  ackTag: { fontSize: 12, color: colors.success, fontWeight: '700', marginTop: 4 },
  disputeBox: { backgroundColor: '#F8FAFC', borderRadius: radius.md, padding: space.sm, marginTop: space.sm, borderWidth: 1, borderColor: colors.border },
  disputeTitle: { fontSize: 12, fontWeight: '800', color: colors.slate },
  disputeNote: { fontSize: 13, color: colors.ink, marginTop: 2 },
});

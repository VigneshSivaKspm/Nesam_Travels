// Payment history: what each booking cost, what has been paid and refunds,
// from the server-derived payment summary on the customer's own bookings.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlatList } from '../components/layout';
import { useNavigation } from '@react-navigation/native';
import { useCustomerData } from '../context/CustomerData';
import { EmptyState } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { formatDate, formatINR } from '../utils/format';
import { paymentRows } from '../utils/tripView';
import { colors, radius, space } from '../theme';
import { useResponsive } from '../theme/responsive';

export function PaymentHistoryScreen() {
  const { isDesktop } = useResponsive();
  const navigation = useNavigation();
  const { trips, profile } = useCustomerData();
  const rows = paymentRows(trips);
  const refunds = trips.filter((t) => t.refund && t.refund.amount > 0);

  return (
    <View style={styles.root}>
      <DesktopHeader
        title="Payment & Refund History"
        subtitle="Complete transaction receipts, refund balances and booking payments"
        onBack={() => navigation.goBack()}
      />

      <FlatList
        style={{ backgroundColor: colors.page }}
        contentContainerStyle={[styles.list, isDesktop && styles.desktopList]}
        data={rows}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sumLabel}>Refund Wallet Balance</Text>
                <Text style={styles.sumValue}>{formatINR(profile.walletBalance)}</Text>
              </View>
              <View style={styles.summaryBadge}>
                <Text style={styles.summaryBadgeText}>{refunds.length} Refund{refunds.length === 1 ? '' : 's'}</Text>
              </View>
            </View>
            <Text style={styles.sumNote}>
              {refunds.length ? `${refunds.length} refund processed on cancelled bookings. Credits are automatically available for future bookings.` : 'Refunds for cancelled bookings and excess toll adjustments appear here.'}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyState title="No payments yet" message="Completed trips and any refunds will be listed here." />}
        renderItem={({ item: t }) => {
          const when = t.completedAt ?? t.cancelledAt ?? t.createdAt;
          const total = t.status === 'Completed' ? t.fare + t.tollCharges : t.cancellationFee;
          return (
            <Pressable
              style={({ pressed, hovered }: any) => [
                styles.row,
                hovered && { borderColor: colors.primary },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => navigation.navigate('ActiveRide', { bookingId: t.id })}
              accessibilityRole="button"
              accessibilityLabel={`Booking ${t.bookingId}`}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.rowHead}>
                  <Text style={styles.route} numberOfLines={1}>
                    {t.pickup.name} → {t.drop.name}
                  </Text>
                  <View style={[styles.statusChip, { backgroundColor: t.status === 'Completed' ? colors.successSoft : colors.primarySoft }]}>
                    <Text style={[styles.statusText, { color: t.status === 'Completed' ? colors.success : colors.primaryDark }]}>
                      {t.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.meta}>
                  {when ? formatDate(when) : t.date} · Booking ID: {t.bookingId}
                </Text>
                <Text style={styles.meta}>
                  {t.status === 'Completed' ? `${t.paymentMethod} · ${t.paid ? `Paid ${formatINR(t.paid.totalPaid)}${t.paid.balanceDue > 0 ? `, balance ${formatINR(t.paid.balanceDue)}` : ''}` : t.paymentStatus}` : 'Cancelled'}
                </Text>
                {t.refund && t.refund.amount > 0 ? (
                  <Text style={styles.refund}>
                    ✓ Refunded {formatINR(t.refund.amount)} · {t.refund.status}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                <Text style={styles.amount}>{formatINR(total)}</Text>
                <Text style={styles.viewLink}>View Receipt →</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  list: { padding: space.lg, paddingBottom: space.xxl },
  desktopList: { maxWidth: 960, width: '100%', alignSelf: 'center' },
  summaryCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: space.xl,
    marginBottom: space.lg,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)' as any,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  sumLabel: { fontSize: 14, color: colors.slate, fontWeight: '600' },
  sumValue: { fontSize: 32, fontWeight: '900', color: colors.success, marginTop: 4 },
  summaryBadge: { backgroundColor: colors.successSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  summaryBadgeText: { fontSize: 12, fontWeight: '800', color: colors.success },
  sumNote: { fontSize: 14, color: colors.slate, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: space.lg,
    marginBottom: space.md,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)' as any,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 2 },
  route: { fontSize: 16, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  statusText: { fontSize: 11, fontWeight: '800' },
  meta: { fontSize: 14, color: colors.slate, marginTop: 2 },
  refund: { fontSize: 13, color: colors.success, fontWeight: '700', marginTop: 4 },
  amount: { fontSize: 20, fontWeight: '900', color: colors.ink },
  viewLink: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 4 },
});

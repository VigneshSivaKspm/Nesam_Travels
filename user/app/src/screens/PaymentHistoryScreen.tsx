// Payment history: what each booking cost, what has been paid and refunds,
// from the server-derived payment summary on the customer's own bookings.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlatList } from '../components/layout';
import { useNavigation } from '@react-navigation/native';
import { useCustomerData } from '../context/CustomerData';
import { EmptyState } from '../components/ui';
import { SubHeader } from '../components/brand';
import { formatDate, formatINR } from '../utils/format';
import { paymentRows } from '../utils/tripView';
import { colors, fonts, radius, space } from '../theme';
import { ILLUSTRATIONS } from '../assets/images';

export function PaymentHistoryScreen() {
  const navigation = useNavigation();
  const { trips, profile } = useCustomerData();
  const rows = paymentRows(trips);
  const refunds = trips.filter((t) => t.refund && t.refund.amount > 0);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SubHeader title="Payment History" subtitle="Receipts, refund balances & invoices" onBack={() => navigation.goBack()} />

      <FlatList
        style={{ backgroundColor: '#F8FAFC' }}
        contentContainerStyle={styles.list}
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
        ListEmptyComponent={
          <EmptyState
            image={ILLUSTRATIONS.noPayments}
            title="No payments yet"
            message="Completed trips and any refunds will be listed here."
          />
        }
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
                  {when ? formatDate(when) : t.date} · ID: #{t.bookingId}
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
                <Text style={styles.viewLink}>Receipt →</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  list: { padding: space.md, paddingBottom: space.xxl },
  summaryCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
    padding: space.md,
    marginBottom: space.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs },
  sumLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.slate },
  sumValue: { fontFamily: fonts.bold, fontSize: 28, color: colors.success, marginTop: 2 },
  summaryBadge: { backgroundColor: colors.successSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  summaryBadgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.success },
  sumNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.slate, lineHeight: 18, marginTop: 4 },
  row: {
    flexDirection: 'row',
    gap: space.md,
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
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 2 },
  route: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, flexShrink: 1 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  statusText: { fontFamily: fonts.bold, fontSize: 10 },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.slate, marginTop: 2 },
  refund: { fontFamily: fonts.medium, fontSize: 12, color: colors.success, marginTop: 3 },
  amount: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  viewLink: { fontFamily: fonts.bold, fontSize: 11, color: colors.primary, marginTop: 4 },
});

// Fleet wallet, payouts and ledger (native port of vendor/web WalletPayoutScreen.tsx).
// Every number here is the server's (wallets/vendor_{uid}, wallet_ledger); the
// app never computes a balance or commission.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useVendorData } from '../context/VendorData';
import { Badge, Button, Card, EmptyState, Notice, Row, Screen, Segmented, Sheet, TextField } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { DesktopRow } from '../components/layout';
import { MIN_PAYOUT, requestVendorPayout, validateVendorPayout, VendorActionError } from '../services/vendorService';
import { formatINR } from '../utils/format';
import { formatDateTime12 } from '../utils/time';
import { describeDataError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';
import { useResponsive } from '../theme/responsive';

const ENTRY_LABEL: Record<string, string> = {
  trip_earning: 'Trip earning',
  toll_reimbursement: 'Toll reimbursement',
  cash_collected: 'Cash fare collected by your fleet',
  payout: 'Payout',
};
const ENTRY_STATUS: Record<string, string> = {
  pending: 'Awaiting customer payment',
  available: 'Available',
  reserved: 'Held for payout',
  completed: 'Completed',
  cancelled: 'Released',
};

export function WalletScreen() {
  const { isDesktop } = useResponsive();
  const { wallet, ledger, payouts, profile, monthEarnings, errors } = useVendorData();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const withdrawable = Math.max(0, Math.floor(wallet.available));

  return (
    <Screen edges={[]}>
      <DesktopHeader
        title="Fleet Wallet & Payouts"
        subtitle="Live earnings balance, banking settlement account, payout requests and transaction ledger"
        badge={formatINR(wallet.available)}
        actions={
          withdrawable >= MIN_PAYOUT ? (
            <Button
              small
              title="Request Payout"
              onPress={() => setOpen(true)}
            />
          ) : undefined
        }
      />

      {open ? (
        <PayoutSheet
          withdrawable={withdrawable}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            setDone(true);
          }}
        />
      ) : null}

      <Notice message={errors.wallet} />
      {done ? <Notice tone="success" message="Payout request submitted. The amount is held from your balance until NESAM finance processes the transfer and issues the UTR." /> : null}

      <DesktopRow gap={24} style={styles.contentRow}>
        {/* Left Column: Balances, Earnings & Bank Account */}
        <View style={[styles.mainCol, isDesktop && { flex: 1 }]}>
          <Card style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>AVAILABLE TO WITHDRAW</Text>
            <Text style={[styles.balanceValue, wallet.available < 0 && { color: colors.danger }]}>{formatINR(wallet.available)}</Text>
            {wallet.available < 0 ? (
              <Text style={styles.negWarning}>Cash fares your fleet collected exceed your earnings; upcoming earnings settle this first.</Text>
            ) : null}
            <View style={styles.metaBalances}>
              <Text style={styles.metaBalanceItem}>
                {formatINR(wallet.pending)} awaiting customer payment
              </Text>
              <Text style={styles.metaBalanceItem}>
                {formatINR(wallet.reserved)} held for requests · {formatINR(wallet.paidOut)} paid out
              </Text>
            </View>
            <Button
              title={withdrawable < MIN_PAYOUT ? `Min Payout ${formatINR(MIN_PAYOUT)}` : 'Request Payout'}
              disabled={withdrawable < MIN_PAYOUT}
              onPress={() => setOpen(true)}
              style={{ marginTop: space.md }}
            />
          </Card>

          <Card style={styles.summaryCard}>
            <Text style={styles.cardTitle}>Earnings Breakdown</Text>
            <View style={styles.rowsBox}>
              <Row label="Trip earnings credited" value={formatINR(wallet.tripEarnings)} />
              <Row label="Toll reimbursements" value={formatINR(wallet.tollReimbursements)} />
              <Row label="Cash collected by fleet" value={`− ${formatINR(wallet.cashCollected)}`} />
              <Row label="Earned this month" value={formatINR(monthEarnings)} bold />
            </View>
            <Text style={styles.cardNote}>Figures are recorded by NESAM on each completed trip; the payout per trip is the rate you accepted.</Text>
          </Card>

          <Card style={styles.bankCard}>
            <Text style={styles.cardTitle}>Settlement Bank Account</Text>
            <Text style={styles.bankName}>{profile.bankAccountName || 'Account Holder: Not on file'}</Text>
            <Text style={styles.bankDetails}>
              A/C: {profile.bankAccountNumber} {profile.ifscCode ? `· IFSC: ${profile.ifscCode}` : ''}
            </Text>
            {profile.upiId ? <Text style={styles.bankDetails}>UPI VPA: {profile.upiId}</Text> : null}
            <Text style={styles.cardNote}>NESAM transfers funds only to this verified business account. Contact support to update banking details.</Text>
          </Card>
        </View>

        {/* Right Column: Payout Requests & Transaction Ledger */}
        <View style={[styles.sidebarCol, isDesktop && { flex: 1.2 }]}>
          <Text style={styles.sectionTitle}>Payout Requests ({payouts.length})</Text>
          {payouts.length === 0 ? (
            <EmptyState title="No payout requests yet" message="When you request payouts, transfer progress and bank UTR numbers will be displayed here." />
          ) : (
            payouts.map((p) => (
              <View key={p.id} style={styles.txn}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnTitle}>Payout · {p.method}</Text>
                  {p.utr ? <Text style={styles.txnUtr}>Bank UTR: {p.utr}</Text> : null}
                  {p.createdMs ? <Text style={styles.txnTime}>Requested {formatDateTime12(new Date(p.createdMs))}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.amount}>{formatINR(p.amount)}</Text>
                  <Badge label={p.status} tone={p.status === 'Paid' ? 'success' : p.status === 'Pending' ? 'warning' : 'neutral'} />
                </View>
              </View>
            ))
          )}

          <Text style={[styles.sectionTitle, { marginTop: space.lg }]}>Recent Financial Ledger ({ledger.length})</Text>
          {ledger.length === 0 ? (
            <EmptyState title="No transactions yet" message="Completed trip earnings and payouts will appear here." />
          ) : (
            ledger.slice(0, 15).map((e) => (
              <View key={e.id} style={styles.txn}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnTitle}>{ENTRY_LABEL[e.type] ?? e.type}</Text>
                  {e.bookingCode ? <Text style={styles.txnUtr}>Booking: {e.bookingCode}</Text> : null}
                  {e.createdAt ? <Text style={styles.txnTime}>{formatDateTime12(e.createdAt)}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.amount, e.amount < 0 && { color: colors.danger }]}>
                    {e.amount > 0 ? `+${formatINR(e.amount)}` : formatINR(e.amount)}
                  </Text>
                  <Badge label={ENTRY_STATUS[e.status] ?? e.status} tone={e.status === 'completed' || e.status === 'available' ? 'success' : 'neutral'} />
                </View>
              </View>
            ))
          )}
        </View>
      </DesktopRow>
    </Screen>
  );
}

function PayoutSheet({ withdrawable, onClose, onDone }: { withdrawable: number; onClose: () => void; onDone: () => void }) {
  const { profile } = useVendorData();
  const [amount, setAmount] = useState(String(withdrawable));
  const [method, setMethod] = useState<'bank' | 'upi'>('bank');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const value = Number(amount);
    const invalid = validateVendorPayout(value, withdrawable);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError('');
    try {
      const payoutMethod: 'Bank Transfer' | 'UPI' = method === 'bank' ? 'Bank Transfer' : 'UPI';
      await requestVendorPayout(value, withdrawable, payoutMethod);
      onDone();
    } catch (e) {
      setError(e instanceof VendorActionError ? e.message : describeDataError(e));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Sheet visible onClose={onClose} title="Request Payout" dismissible={!busy}>
      <Text style={[type.small, { marginBottom: space.md }]}>
        Withdrawable balance: <Text style={{ fontWeight: '800' }}>{formatINR(withdrawable)}</Text>
      </Text>
      <TextField label="Payout Amount (₹)" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ''))} keyboardType="number-pad" />
      <Text style={[type.label, { marginBottom: 6 }]}>Payout Transfer Method</Text>
      <Segmented
        options={[
          { value: 'bank', label: `Bank (${profile.bankAccountNumber ? `…${profile.bankAccountNumber.slice(-4)}` : 'Bank'})` },
          { value: 'upi', label: profile.upiId ? `UPI (${profile.upiId})` : 'UPI' },
        ]}
        value={method}
        onChange={setMethod}
      />
      <Notice message={error} style={{ marginTop: space.md }} />
      <Button title={busy ? 'Submitting Request…' : 'Submit Payout Request'} loading={busy} onPress={() => void submit()} style={{ marginTop: space.md }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  contentRow: { alignItems: 'flex-start' },
  mainCol: { width: '100%' },
  sidebarCol: { width: '100%' },
  balanceCard: {
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: space.md,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)' as any,
  },
  balanceLabel: { fontSize: 11, fontWeight: '800', color: colors.slate, letterSpacing: 0.5 },
  balanceValue: { fontSize: 32, fontWeight: '900', color: colors.success, marginVertical: 6 },
  negWarning: { fontSize: 13, color: colors.danger, marginBottom: space.xs },
  metaBalances: { marginVertical: space.xs, gap: 2 },
  metaBalanceItem: { fontSize: 13, color: colors.slate },
  summaryCard: {
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: space.md,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)' as any,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, marginBottom: space.sm },
  rowsBox: { gap: 6, marginVertical: space.xs },
  cardNote: { fontSize: 12, color: colors.muted, marginTop: space.sm, lineHeight: 16 },
  bankCard: {
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: space.md,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)' as any,
  },
  bankName: { fontSize: 16, fontWeight: '800', color: colors.ink },
  bankDetails: { fontSize: 14, color: colors.slate, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: space.sm },
  txn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.md,
    marginBottom: space.sm,
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)' as any,
  },
  txnTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  txnUtr: { fontSize: 12, color: colors.slate, marginTop: 1 },
  txnTime: { fontSize: 12, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 18, fontWeight: '900', color: colors.ink },
});

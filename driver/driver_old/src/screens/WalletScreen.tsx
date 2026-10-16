// Wallet, payout requests and ledger (port of driver/web WalletPayoutScreen.tsx).
// Every number here is the server's (wallets/driver_{uid}, wallet_ledger); the
// app never computes a balance.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DesktopCol, DesktopRow, ScrollView } from '../components/layout';
import { DesktopHeader } from '../components/DesktopHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDriverData } from '../context/DriverData';
import { Badge, Button, Card, EmptyState, Notice, Segmented, Sheet, TextField } from '../components/ui';
import { DriverActionError, MIN_PAYOUT, requestPayout, validatePayoutAmount } from '../services/driverService';
import { formatINR } from '../utils/format';
import { formatDateTime12 } from '../utils/time';
import { describeError } from '../utils/retry';
import { colors, space, type } from '../theme';

const ENTRY_LABEL: Record<string, string> = {
  trip_earning: 'Trip earning',
  toll_reimbursement: 'Toll reimbursement',
  cash_collected: 'Cash fare you collected',
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
  const { account, wallet, walletError, payouts, ledger } = useDriverData();
  const { driver, bank } = account;
  const [open, setOpen] = useState(false);
  const withdrawable = Math.max(0, Math.floor(wallet.available));
  const fleet = !!driver.vendorId;

  if (fleet && ledger.length === 0 && payouts.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={type.h1}>Wallet</Text>
          <Card>
            <Text style={type.h3}>Settled by your fleet</Text>
            <Text style={[type.body, { marginTop: 4 }]}>
              You drive for {driver.vendorName || 'a fleet operator'}. They receive the payout for your trips and pay you directly, so NESAM does not keep a
              wallet balance for you.
            </Text>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {open ? <PayoutSheet key="payout" withdrawable={withdrawable} onClose={() => setOpen(false)} /> : null}
      <DesktopHeader
        title="Driver Wallet & Ledger"
        subtitle="Available funds, bank payout destinations, and transaction history"
        actions={
          <Button
            small
            title="Request Payout"
            disabled={withdrawable < MIN_PAYOUT}
            onPress={() => setOpen(true)}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Notice message={walletError} />
        <DesktopRow spacing={space.lg}>
          {/* Balance & Payout Overview (Left) */}
          <DesktopCol flex={1}>
            <Card>
              <Text style={type.tiny}>AVAILABLE TO WITHDRAW</Text>
              <Text style={[styles.balance, wallet.available < 0 && { color: colors.danger }]}>{formatINR(wallet.available)}</Text>
              {wallet.available < 0 ? (
                <Text style={[type.small, { color: colors.danger }]}>Cash fares you collected exceed your earnings; upcoming earnings settle this first.</Text>
              ) : null}
              <View style={{ gap: 4, marginVertical: space.sm }}>
                <Text style={type.small}>• {formatINR(wallet.pending)} awaiting customer payment</Text>
                <Text style={type.small}>• {formatINR(wallet.reserved)} held for payout processing</Text>
                <Text style={type.small}>• {formatINR(wallet.paidOut)} total paid out to date</Text>
              </View>
              <Button title="Request payout" disabled={withdrawable < MIN_PAYOUT} onPress={() => setOpen(true)} style={{ marginTop: space.sm }} />
              {withdrawable < MIN_PAYOUT ? (
                <Text style={[type.small, { marginTop: space.sm, color: colors.muted }]}>
                  Minimum withdrawal threshold is {formatINR(MIN_PAYOUT)}.
                </Text>
              ) : null}
            </Card>

            <Card>
              <Text style={type.h3}>Verified Payout Account</Text>
              <Text style={[type.bodyMedium, { marginTop: 4, fontWeight: '700' }]}>{bank.accountHolder || 'No account on file'}</Text>
              {bank.accountNumber ? (
                <Text style={type.small}>
                  A/c: ••••{bank.accountNumber.slice(-4)} • IFSC: {bank.ifsc}
                  {bank.bankName ? ` • ${bank.bankName}` : ''}
                </Text>
              ) : null}
              {bank.upiId ? <Text style={type.small}>UPI ID: {bank.upiId}</Text> : null}
              <Text style={[type.tiny, { marginTop: 8, color: colors.muted }]}>NESAM disburses only to this registered bank account.</Text>
            </Card>

            <Card>
              <Text style={[type.h3, { marginBottom: space.sm }]}>Payout Requests</Text>
              {payouts.length === 0 ? (
                <EmptyState title="No payout requests yet" message="Completed withdrawals will appear here." />
              ) : (
                payouts.map((po) => (
                  <View key={po.id} style={[styles.row, { paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={type.bodyMedium}>{po.method}</Text>
                      {po.details ? (
                        <Text style={type.tiny} numberOfLines={1}>
                          {po.details}
                        </Text>
                      ) : null}
                      <Text style={type.tiny}>Requested: {po.requestedAt}</Text>
                      {po.utr ? <Text style={type.tiny}>UTR: {po.utr}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={[type.bodyMedium, { fontWeight: '800' }]}>{formatINR(po.amount)}</Text>
                      <Badge label={po.status} tone={po.status === 'Paid' ? 'success' : po.status === 'Pending' ? 'warning' : 'neutral'} />
                    </View>
                  </View>
                ))
              )}
            </Card>
          </DesktopCol>

          {/* Ledger History (Right) */}
          <DesktopCol flex={1.35}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
                <Text style={type.h2}>Transaction Ledger</Text>
                <Text style={type.tiny}>Partner ID: {driver.id.slice(0, 8).toUpperCase()}</Text>
              </View>
              {ledger.length === 0 ? (
                <EmptyState title="No entries yet" message="Earnings, cash collected and payouts recorded by NESAM appear here." />
              ) : (
                ledger.slice(0, 50).map((e) => (
                  <View key={e.id} style={styles.credit}>
                    <View style={{ flex: 1 }}>
                      <Text style={[type.bodyMedium, { fontWeight: '600' }]}>
                        {ENTRY_LABEL[e.type] ?? e.type}
                        {e.bookingCode ? ` · ${e.bookingCode}` : ''}
                      </Text>
                      <Text style={type.tiny}>
                        {e.createdAt ? formatDateTime12(e.createdAt) : ''}
                        {ENTRY_STATUS[e.status] ? ` · ${ENTRY_STATUS[e.status]}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.creditAmt, e.direction === 'debit' && { color: colors.danger }]}>
                      {e.direction === 'debit' ? '− ' : '+ '}
                      {formatINR(e.amount)}
                    </Text>
                  </View>
                ))
              )}
            </Card>
          </DesktopCol>
        </DesktopRow>
      </ScrollView>
    </SafeAreaView>
  );
}

function PayoutSheet({ withdrawable, onClose }: { withdrawable: number; onClose: () => void }) {
  const { account } = useDriverData();
  const { bank } = account;
  const [amount, setAmount] = useState(String(withdrawable));
  const [method, setMethod] = useState<'UPI' | 'Bank Transfer'>(bank.accountNumber || !bank.upiId ? 'Bank Transfer' : 'UPI');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const value = Number(amount);
    const invalid = validatePayoutAmount(value, withdrawable);
    if (invalid) return setError(invalid);
    // The server pays only to the account saved in the profile.
    if (method === 'UPI' && !bank.upiId) return setError('No UPI ID in your profile. Add one from Profile first.');
    if (method === 'Bank Transfer' && !bank.accountNumber) return setError('No bank account in your profile. Add one from Profile first.');
    setSubmitting(true);
    setError('');
    try {
      await requestPayout(value, withdrawable, method);
      setDone(true);
    } catch (e) {
      setError(e instanceof DriverActionError ? e.message : describeError(e, 'Could not submit the payout request.'));
    } finally {
      setSubmitting(false);
    }
    return undefined;
  };

  return (
    <Sheet visible onClose={onClose} title="Request payout" dismissible={!submitting}>
      {done ? (
        <>
          <Notice tone="success" message="Payout request submitted. The amount is held from your balance until NESAM finance pays it." />
          <Button title="Done" onPress={onClose} />
        </>
      ) : (
        <>
          <Text style={[type.small, { marginBottom: space.md }]}>
            Available {formatINR(withdrawable)} · minimum {formatINR(MIN_PAYOUT)}
          </Text>
          <TextField label="Amount (₹)" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, '').slice(0, 7))} keyboardType="number-pad" />
          <Segmented
            options={[
              { value: 'Bank Transfer', label: 'Bank (NEFT/IMPS)' },
              { value: 'UPI', label: 'UPI' },
            ]}
            value={method}
            onChange={setMethod}
          />
          <Card style={{ marginTop: space.md }}>
            <Text style={type.tiny}>PAID TO</Text>
            {method === 'UPI' ? (
              <Text style={type.body}>{bank.upiId || 'No UPI ID in your profile'}</Text>
            ) : (
              <>
                <Text style={type.body}>{bank.accountHolder || 'No account on file'}</Text>
                {bank.accountNumber ? (
                  <Text style={type.small}>
                    A/c ••••{bank.accountNumber.slice(-4)} • {bank.ifsc}
                  </Text>
                ) : null}
              </>
            )}
          </Card>
          <Notice message={error} />
          <Button title={submitting ? 'Submitting…' : 'Confirm request'} loading={submitting} onPress={() => void submit()} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  balance: { fontSize: 32, fontWeight: '900', color: colors.ink, marginVertical: 4 },
  section: { marginTop: space.md, marginBottom: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  credit: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  creditAmt: { fontWeight: '900', color: colors.success },
});

// Open-trip feed, instant accept and counter-bidding (native port of
// vendor/web MarketplaceBiddingScreen.tsx, wired to the real rules).
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlatList, Content } from '../components/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVendorData } from '../context/VendorData';
import { Badge, Button, Card, EmptyState, Notice, Row, Segmented, Sheet, TextField } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { acceptOfferedRate, submitCounterBid, validateCounterRate, VendorActionError, withdrawBid } from '../services/vendorService';
import type { MarketTrip, VendorBid } from '../types/operations';
import { formatINR } from '../utils/format';
import { describeDataError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';
import { useResponsive } from '../theme/responsive';

type Tab = 'feed' | 'bids';

export function MarketplaceScreen() {
  const { isDesktop, isCompact } = useResponsive();
  const { identity, marketTrips, bids, errors } = useVendorData();
  const [tab, setTab] = useState<Tab>('feed');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [bidTrip, setBidTrip] = useState<MarketTrip | null>(null);

  const pendingByTrip = useMemo(() => {
    const m = new Map<string, VendorBid>();
    for (const b of bids) if (b.status === 'Pending Review' && !m.has(b.tripId)) m.set(b.tripId, b);
    return m;
  }, [bids]);

  const accept = (trip: MarketTrip) =>
    Alert.alert('Accept this trip?', `${trip.route}\nYour payout: ${formatINR(trip.offeredPayout)}\n\nYou will need to dispatch a driver from your fleet.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept trip',
        onPress: () => {
          setBusyId(trip.id);
          setMessage(null);
          acceptOfferedRate(identity, trip)
            .then(() => setMessage({ tone: 'success', text: `Trip ${trip.bookingId} is yours. Dispatch a driver from the Trips tab.` }))
            .catch((e: unknown) => setMessage({ tone: 'error', text: e instanceof VendorActionError ? e.message : describeDataError(e) }))
            .finally(() => setBusyId(null));
        },
      },
    ]);

  const withdraw = (bid: VendorBid) =>
    Alert.alert('Withdraw bid?', `Your counter bid of ${formatINR(bid.vendorCounterRate)} will be removed.`, [
      { text: 'Keep bid', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: () => {
          withdrawBid(bid)
            .then(() => setMessage({ tone: 'success', text: 'Bid withdrawn.' }))
            .catch((e: unknown) => setMessage({ tone: 'error', text: e instanceof VendorActionError ? e.message : describeDataError(e) }));
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <DesktopHeader
        title="Trip Marketplace"
        subtitle="Live open pool: accept pre-priced partner payouts instantly or submit counter-rates"
        badge={`${marketTrips.length} Open Trips`}
      />

      {bidTrip ? (
        <BidSheet
          key={bidTrip.id}
          trip={bidTrip}
          onClose={() => setBidTrip(null)}
          onDone={() => {
            setBidTrip(null);
            setMessage({ tone: 'success', text: 'Counter bid submitted. NESAM operations will review it.' });
          }}
        />
      ) : null}

      <View style={styles.headerArea}>
        {isCompact ? (
          <Content kind="wide" style={styles.header}>
            <Text style={type.h1}>Marketplace</Text>
            <Text style={[type.small, { marginBottom: space.md }]}>Accept the offered rate instantly or submit a counter bid for NESAM review.</Text>
          </Content>
        ) : null}

        <View style={styles.tabsContainer}>
          <Segmented
            options={[
              { value: 'feed', label: `Open Marketplace Trips (${marketTrips.length})` },
              { value: 'bids', label: `My Active Bids (${bids.length})` },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>
        {message ? <Notice tone={message.tone} message={message.text} style={{ marginHorizontal: space.lg, marginTop: space.sm }} /> : null}
      </View>

      {tab === 'feed' ? (
        <FlatList
          multiColumn
          data={marketTrips}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Notice message={errors.market} />}
          ListEmptyComponent={<EmptyState title="No open trips" message="New passenger booking requests appear here the moment customers place them." />}
          renderItem={({ item: t }) => {
            const myBid = pendingByTrip.get(t.id);
            return (
              <Card style={styles.tripCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.bookingIdText}>ID: {t.bookingId}</Text>
                  <Badge label={t.vehicleCategory || 'Any Vehicle'} tone="warning" />
                </View>
                <Text style={styles.routeTitle}>{t.route}</Text>
                
                <View style={styles.addressesBox}>
                  <View style={styles.addressRow}>
                    <View style={[styles.dot, { backgroundColor: colors.success }]} />
                    <Text style={styles.addressText} numberOfLines={2}>
                      Pickup: {t.pickup.address}
                    </Text>
                  </View>
                  <View style={styles.addressRow}>
                    <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                    <Text style={styles.addressText} numberOfLines={2}>
                      Drop: {t.drop.address}
                    </Text>
                  </View>
                </View>

                <View style={styles.tripParams}>
                  <Ionicons name="calendar-outline" size={16} color={colors.slate} />
                  <Text style={styles.paramsText}>
                    {t.travelDate || 'Date TBC'}
                    {t.pickup.time ? ` at ${t.pickup.time}` : ''}
                    {t.distanceKm ? ` · ${t.distanceKm} km` : ''}
                    {t.service ? ` · ${t.service}` : ''}
                    {t.tripType ? ` · ${t.tripType}` : ''}
                  </Text>
                </View>

                <View style={styles.payRow}>
                  <View>
                    <Text style={styles.payLabel}>OFFERED PAYOUT</Text>
                    <Text style={styles.payout}>{formatINR(t.offeredPayout)}</Text>
                  </View>
                  {t.bidCount ? <Badge label={`${t.bidCount} bid${t.bidCount > 1 ? 's' : ''}`} tone="info" /> : null}
                </View>

                {myBid ? (
                  <View style={styles.myBid}>
                    <Text style={[styles.myBidText, { flex: 1 }]}>Your counter-bid of {formatINR(myBid.vendorCounterRate)} is pending review.</Text>
                    <Button small variant="ghost" title="Withdraw" onPress={() => withdraw(myBid)} />
                  </View>
                ) : null}

                {/* One explicit mode per duty: accept the current offer, or bid for NESAM's review. */}
                <View style={styles.actions}>
                  {t.mode !== 'accept_offer' ? (
                    <Button small variant="dark" title={myBid ? 'Bid sent' : 'Counter Bid'} disabled={!!myBid || busyId !== null} onPress={() => setBidTrip(t)} style={{ flex: 1 }} />
                  ) : null}
                  {t.mode !== 'bid_review' ? (
                    <Button small title={busyId === t.id ? 'Accepting…' : 'Accept Rate'} loading={busyId === t.id} disabled={busyId !== null} onPress={() => accept(t)} style={{ flex: 1 }} />
                  ) : null}
                </View>
                {t.mode === 'bid_review' ? <Text style={styles.paramsText}>NESAM reviews bids and assigns the duty; sending a bid does not assign it to you.</Text> : null}
              </Card>
            );
          }}
        />
      ) : (
        <FlatList
          multiColumn
          data={bids}
          keyExtractor={(b) => `${b.tripId}/${b.id}`}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Notice message={errors.bids} />}
          ListEmptyComponent={<EmptyState title="No bids yet" message="Counter bids you submit appear here with real-time review status from NESAM operations." />}
          renderItem={({ item: b }) => (
            <Card style={styles.tripCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.bookingIdText}>BID ON: {b.bookingId}</Text>
                <Badge label={b.status} tone={b.status === 'Accepted' ? 'success' : b.status === 'Pending Review' ? 'warning' : 'neutral'} />
              </View>
              <View style={styles.bidAmounts}>
                <Row label="Offered Payout" value={formatINR(b.offeredPayout)} />
                <Row label="Your Counter Rate" value={formatINR(b.vendorCounterRate)} bold />
              </View>
              {b.biddingNote ? <Text style={styles.bidNote}>Note: {b.biddingNote}</Text> : null}
              <Text style={styles.bidDate}>{b.submittedAt ? `Submitted on ${b.submittedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Sending…'}</Text>
              {b.status === 'Pending Review' ? (
                <Button small variant="ghost" title="Withdraw Bid" onPress={() => withdraw(b)} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />
              ) : null}
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function BidSheet({ trip, onClose, onDone }: { trip: MarketTrip; onClose: () => void; onDone: () => void }) {
  const { identity } = useVendorData();
  const [rate, setRate] = useState(String(Math.round(trip.offeredPayout * 1.1) || ''));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const value = Number(rate);
    const invalid = validateCounterRate(value, trip.offeredPayout);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError('');
    try {
      await submitCounterBid(identity, trip, value, note);
      onDone();
    } catch (e) {
      setError(e instanceof VendorActionError ? e.message : describeDataError(e));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Sheet visible onClose={onClose} title={`Counter Bid · ${trip.bookingId}`} dismissible={!busy}>
      <Text style={[type.small, { marginBottom: space.md }]}>
        {trip.route} · Offered Payout: {formatINR(trip.offeredPayout)}
      </Text>
      <TextField label="Your Proposed Counter Rate (₹)" value={rate} onChangeText={(t) => setRate(t.replace(/\D/g, '').slice(0, 7))} keyboardType="number-pad" />
      <Text style={[type.label, { marginBottom: 6 }]}>Justification Note for NESAM (optional)</Text>
      <TextInput
        value={note}
        onChangeText={(t) => setNote(t.slice(0, 300))}
        placeholder="Vehicle model, experienced driver, toll/fuel specifics…"
        placeholderTextColor={colors.faint}
        multiline
        style={styles.note}
      />
      <Notice message={error} />
      <Button title={busy ? 'Submitting Counter Bid…' : 'Submit Counter Bid'} loading={busy} onPress={() => void submit()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  headerArea: { paddingHorizontal: space.lg, paddingTop: space.sm },
  header: { paddingBottom: space.sm },
  tabsContainer: { maxWidth: 640 },
  list: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
  tripCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.md,
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)' as any,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  bookingIdText: { fontSize: 13, fontWeight: '800', color: colors.slate },
  routeTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 4, marginBottom: 8 },
  addressesBox: { backgroundColor: '#F8FAFC', borderRadius: radius.md, padding: space.md, gap: 6, marginVertical: 4 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  addressText: { fontSize: 13, color: colors.ink, flex: 1, lineHeight: 18 },
  tripParams: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm },
  paramsText: { fontSize: 13, color: colors.slate },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  payLabel: { fontSize: 11, fontWeight: '800', color: colors.slate, letterSpacing: 0.5 },
  payout: { fontSize: 24, fontWeight: '900', color: colors.primary, marginTop: 2 },
  myBid: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warningSoft, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.xs, marginTop: space.sm },
  myBidText: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  bidAmounts: { marginVertical: space.sm, gap: 4 },
  bidNote: { fontSize: 13, color: colors.slate, fontStyle: 'italic', marginVertical: 4 },
  bidDate: { fontSize: 12, color: colors.muted, marginTop: 4 },
  note: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: space.md, minHeight: 80, textAlignVertical: 'top', color: colors.ink, marginBottom: space.md, backgroundColor: '#F8FAFC' },
});

// Duties: new offers from the marketplace, trips waiting for dispatch, trips on the road, and finished trips — one place,
// four tabs. Accepting and bidding run on the server (claimMarketplaceDuty / submitMarketplaceBid); dispatch is
// vendorAssignDriver. The app writes nothing to a booking or an offer itself.
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useVendorData } from '../context/VendorData';
import { Badge, Button, Card, EmptyState, Notice, PillTabs, RouteStack, Stat } from '../components/ui';
import { BidSheet } from '../components/duty/BidSheet';
import { DispatchSheet } from '../components/duty/DispatchSheet';
import { acceptOfferedRate, canDispatch, tripStageLabel, VendorActionError, withdrawBid } from '../services/vendorService';
import type { MarketTrip, VendorBid, VendorBooking } from '../types/operations';
import { EXPIRY_WARNING_DAYS } from '../config/constants';
import { formatINR, localMobile } from '../utils/format';
import { daysUntil, payoutText } from '../utils/wallet';
import { describeDataError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';

type Tab = 'new' | 'upcoming' | 'live' | 'completed';

const LIVE_STAGES = ['En Route Pickup', 'Reached Pickup', 'In Progress', 'Arrived Destination'];
export const isLiveBooking = (b: VendorBooking) => b.status === 'Ongoing' || LIVE_STAGES.includes(b.tripStage);
export const isUpcomingBooking = (b: VendorBooking) => (b.status === 'Confirmed' || b.status === 'Assigned') && !isLiveBooking(b);

type Row = { kind: 'offer'; trip: MarketTrip } | { kind: 'bid'; bid: VendorBid } | { kind: 'trip'; booking: VendorBooking } | { kind: 'bids-title' };

export function DutiesScreen() {
  const navigation = useNavigation();
  const { identity, marketTrips, bids, bookings, vehicles, wallet, openLinks, errors } = useVendorData();
  const [tab, setTab] = useState<Tab>('new');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [bidTrip, setBidTrip] = useState<MarketTrip | null>(null);
  const [dispatchFor, setDispatchFor] = useState<VendorBooking | null>(null);

  const upcoming = useMemo(() => bookings.filter(isUpcomingBooking), [bookings]);
  const live = useMemo(() => bookings.filter(isLiveBooking), [bookings]);
  const completed = useMemo(() => bookings.filter((b) => b.status === 'Completed').sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)), [bookings]);
  const needDriver = upcoming.filter((b) => !b.driverId).length;
  const pendingByTrip = useMemo(() => {
    const m = new Map<string, VendorBid>();
    for (const b of bids) if (b.status === 'Pending Review' && !m.has(b.tripId)) m.set(b.tripId, b);
    return m;
  }, [bids]);
  const expiring = useMemo(
    () =>
      vehicles.flatMap((v) => [v.insuranceExpiry, v.permitExpiry, v.fitnessExpiry].map((d) => daysUntil(d)).filter((d): d is number => d != null && d <= EXPIRY_WARNING_DAYS)),
    [vehicles],
  );

  const rows: Row[] = useMemo(() => {
    if (tab === 'new') return [...marketTrips.map((trip): Row => ({ kind: 'offer', trip })), ...(bids.length ? ([{ kind: 'bids-title' }, ...bids.map((bid): Row => ({ kind: 'bid', bid }))] as Row[]) : [])];
    const list = tab === 'upcoming' ? upcoming : tab === 'live' ? live : completed;
    return list.map((booking): Row => ({ kind: 'trip', booking }));
  }, [tab, marketTrips, bids, upcoming, live, completed]);

  const accept = (trip: MarketTrip) =>
    Alert.alert('Accept this trip?', `${trip.route}\nYour payout: ${formatINR(trip.offeredPayout)}\n\nYou will then choose a driver and vehicle for it.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept trip',
        onPress: () => {
          setBusyId(trip.id);
          setMessage(null);
          acceptOfferedRate(identity, trip)
            .then(() => {
              setTab('upcoming');
              setMessage({ tone: 'success', text: `Trip ${trip.bookingId} is yours. Now choose a driver and vehicle for it.` });
            })
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

  const header = (
    <View>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={type.h1}>Duties</Text>
          <Text style={type.small}>New offers, dispatch and live trips.</Text>
        </View>
      </View>
      <View style={styles.stats}>
        <Stat value={String(marketTrips.length)} label="New offers" tone={marketTrips.length ? 'accent' : undefined} onPress={() => setTab('new')} />
        <Stat value={String(needDriver)} label="Need a driver" tone={needDriver ? 'accent' : undefined} onPress={() => setTab('upcoming')} />
        <Stat value={String(live.length)} label="On the road" onPress={() => setTab('live')} />
        <Stat value={formatINR(wallet.available)} label="Available to withdraw" tone="good" onPress={() => navigation.navigate('Tabs', { screen: 'Payouts' })} />
      </View>
      {openLinks.length ? (
        <Notice tone="warning" message={`${openLinks.length} request${openLinks.length === 1 ? ' needs' : 's need'} your attention — a code to enter, or waiting for the NESAM office.`} onRetry={() => navigation.navigate('Requests')} />
      ) : null}
      {expiring.length ? (
        <Notice tone="warning" message={`${expiring.length} vehicle document${expiring.length === 1 ? ' is' : 's are'} expired or expiring within ${EXPIRY_WARNING_DAYS} days.`} onRetry={() => navigation.navigate('Tabs', { screen: 'Vehicles' })} />
      ) : null}
      <Notice message={errors.bookings || errors.market} />
      {message ? <Notice tone={message.tone} message={message.text} /> : null}
      <View style={styles.quick}>
        <Button small variant="secondary" title="+ Add driver" onPress={() => navigation.navigate('Tabs', { screen: 'Drivers', params: { add: Date.now() } })} style={{ flex: 1 }} />
        <Button small variant="secondary" title="+ Add vehicle" onPress={() => navigation.navigate('Tabs', { screen: 'Vehicles', params: { add: Date.now() } })} style={{ flex: 1 }} />
      </View>
      <View style={{ marginHorizontal: -space.lg }}>
        <PillTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'new', label: 'New', count: marketTrips.length, hot: true },
            { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { id: 'live', label: 'Live', count: live.length },
            { id: 'completed', label: 'Completed' },
          ]}
        />
      </View>
    </View>
  );

  const empty =
    tab === 'new' ? (
      <EmptyState title="No new offers right now" message="Offers from NESAM appear here the moment they are published. You will also get a notification." />
    ) : tab === 'upcoming' ? (
      <EmptyState title="Nothing waiting for dispatch" message="Trips you accept or win are listed here until they start." />
    ) : tab === 'live' ? (
      <EmptyState title="No trip is running" message="Trips show here once the driver is on the way to the pickup." />
    ) : (
      <EmptyState title="No completed trips yet" message="Finished trips and their payouts are kept here." />
    );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {bidTrip ? (
        <BidSheet
          key={bidTrip.id}
          trip={bidTrip}
          onClose={() => setBidTrip(null)}
          onDone={() => {
            setBidTrip(null);
            setMessage({ tone: 'success', text: 'Counter bid submitted. NESAM will review it.' });
          }}
        />
      ) : null}
      {dispatchFor ? (
        <DispatchSheet
          key={dispatchFor.id}
          booking={dispatchFor}
          onAddDriver={() => navigation.navigate('Tabs', { screen: 'Drivers', params: { add: Date.now() } })}
          onClose={() => setDispatchFor(null)}
          onDone={(name) => {
            setDispatchFor(null);
            setMessage({ tone: 'success', text: `${name} has been dispatched. The trip now appears in their driver app.` });
          }}
        />
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(r, i) => (r.kind === 'offer' ? `o${r.trip.id}` : r.kind === 'bid' ? `b${r.bid.tripId}/${r.bid.id}` : r.kind === 'trip' ? `t${r.booking.id}` : `h${i}`)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item: r }) => {
          if (r.kind === 'bids-title') return <Text style={styles.section}>Your bids</Text>;
          if (r.kind === 'bid') return <BidCard bid={r.bid} onWithdraw={() => withdraw(r.bid)} />;
          if (r.kind === 'offer') return <OfferCard trip={r.trip} myBid={pendingByTrip.get(r.trip.id)} busy={busyId === r.trip.id} anyBusy={busyId !== null} onAccept={() => accept(r.trip)} onBid={() => setBidTrip(r.trip)} onWithdraw={withdraw} />;
          return <TripCard booking={r.booking} onDispatch={canDispatch(r.booking) ? () => setDispatchFor(r.booking) : undefined} />;
        }}
      />
    </SafeAreaView>
  );
}

function OfferCard({ trip: t, myBid, busy, anyBusy, onAccept, onBid, onWithdraw }: { trip: MarketTrip; myBid?: VendorBid; busy: boolean; anyBusy: boolean; onAccept: () => void; onBid: () => void; onWithdraw: (b: VendorBid) => void }) {
  return (
    <Card>
      <View style={styles.between}>
        <Text style={type.tiny}>{t.bookingId}</Text>
        <Badge label={t.status === 'Bidding' ? 'Bids open' : 'New'} tone={t.status === 'Bidding' ? 'warning' : 'info'} />
      </View>
      <Text style={[type.small, { marginTop: 6 }]}>
        {t.travelDate || 'Date to be confirmed'}
        {t.pickup.time ? ` · ${t.pickup.time}` : ''}
      </Text>
      <RouteStack pickup={t.pickup.address} drop={t.drop.address} />
      <Text style={type.small}>
        {[t.vehicleCategory, t.distanceKm ? `${t.distanceKm} km` : '', t.service, t.tripType].filter(Boolean).join(' · ')}
      </Text>
      <View style={styles.payRow}>
        <View>
          <Text style={type.tiny}>OFFERED PAYOUT</Text>
          <Text style={styles.payout}>{formatINR(t.offeredPayout)}</Text>
        </View>
        {t.bidCount ? <Badge label={`${t.bidCount} bid${t.bidCount > 1 ? 's' : ''}`} tone="info" /> : null}
      </View>
      {myBid ? (
        <View style={styles.myBid}>
          <Text style={[type.small, { flex: 1 }]}>Your bid {formatINR(myBid.vendorCounterRate)} is under review.</Text>
          <Button small variant="ghost" title="Withdraw" onPress={() => onWithdraw(myBid)} />
        </View>
      ) : null}
      <View style={styles.actions}>
        {t.mode !== 'bid_review' ? <Button small title={busy ? 'Accepting…' : `Accept ${formatINR(t.offeredPayout)}`} loading={busy} disabled={anyBusy} onPress={onAccept} style={{ flex: 1 }} /> : null}
        {t.mode !== 'accept_offer' ? <Button small variant={t.mode === 'bid_review' ? 'primary' : 'secondary'} title="Counter bid" disabled={!!myBid || anyBusy} onPress={onBid} style={{ flex: 1 }} /> : null}
      </View>
      {t.mode === 'bid_review' ? <Text style={[type.tiny, { marginTop: space.xs }]}>NESAM reviews bids and assigns the duty; sending a bid does not assign it to you.</Text> : null}
    </Card>
  );
}

function BidCard({ bid: b, onWithdraw }: { bid: VendorBid; onWithdraw: () => void }) {
  return (
    <Card>
      <View style={styles.between}>
        <Text style={type.h3}>
          {b.bookingId} · {formatINR(b.vendorCounterRate)}
        </Text>
        <Badge label={b.status} tone={b.status === 'Accepted' ? 'success' : b.status === 'Pending Review' ? 'warning' : 'neutral'} />
      </View>
      <Text style={type.small}>Offered {formatINR(b.offeredPayout)}</Text>
      {b.biddingNote ? <Text style={type.small}>“{b.biddingNote}”</Text> : null}
      <Text style={type.tiny}>{b.submittedAt ? `Submitted ${b.submittedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Sending…'}</Text>
      {b.status === 'Pending Review' ? <Button small variant="ghost" title="Withdraw bid" onPress={onWithdraw} style={{ alignSelf: 'flex-start' }} /> : null}
    </Card>
  );
}

function TripCard({ booking: b, onDispatch }: { booking: VendorBooking; onDispatch?: () => void }) {
  const needsDriver = b.status === 'Confirmed' || (b.status === 'Assigned' && !b.driverId);
  const driverPhone = localMobile(b.driverPhone);
  return (
    <Card style={needsDriver && b.status !== 'Completed' ? { borderColor: colors.warningBorder } : undefined}>
      <View style={styles.between}>
        <Text style={type.tiny}>{b.bookingId}</Text>
        <Badge label={needsDriver && b.status !== 'Completed' ? 'Needs a driver' : tripStageLabel(b)} tone={b.status === 'Completed' ? 'success' : needsDriver ? 'warning' : 'info'} />
      </View>
      <Text style={[type.small, { marginTop: 6 }]}>
        {[b.date, b.time].filter(Boolean).join(' · ') || '—'}
        {b.vehicleCategory ? ` · ${b.vehicleCategory}` : ''}
      </Text>
      <RouteStack pickup={b.pickupAddress} drop={b.dropAddress} />
      <View style={styles.money}>
        <View style={{ flex: 1 }}>
          <Text style={type.tiny}>YOUR PAYOUT</Text>
          <Text style={styles.payoutSm}>{payoutText(b)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.tiny}>CUSTOMER FARE</Text>
          <Text style={styles.fareSm}>{formatINR(b.fare)}</Text>
        </View>
      </View>
      {b.driverId ? (
        <View style={styles.driverRow}>
          <Ionicons name="person-circle-outline" size={22} color={colors.ink} />
          <View style={{ flex: 1 }}>
            <Text style={type.h3} numberOfLines={1}>
              {b.driverName}
            </Text>
            <Text style={type.small} numberOfLines={1}>
              {b.vehicleNumber}
            </Text>
          </View>
          {driverPhone ? (
            <Pressable onPress={() => void Linking.openURL(`tel:+91${driverPhone}`)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Call driver">
              <Ionicons name="call-outline" size={22} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Notice tone="warning" message="No driver assigned yet." style={{ marginBottom: 0 }} />
      )}
      {onDispatch ? <Button small variant={b.driverId ? 'secondary' : 'primary'} title={b.driverId ? 'Change driver / vehicle' : 'Assign driver & vehicle'} onPress={onDispatch} style={{ marginTop: space.md }} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, paddingBottom: space.xxl },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  quick: { flexDirection: 'row', gap: space.sm, marginBottom: space.xs },
  section: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: space.md, marginBottom: space.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md },
  payout: { fontSize: 22, fontWeight: '700', color: colors.success },
  payoutSm: { fontSize: 17, fontWeight: '700', color: colors.success },
  fareSm: { fontSize: 17, fontWeight: '700', color: colors.ink },
  money: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm, marginBottom: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  myBid: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warningSoft, borderRadius: radius.sm, paddingLeft: space.md, marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.bg, borderRadius: radius.sm, padding: space.sm },
});

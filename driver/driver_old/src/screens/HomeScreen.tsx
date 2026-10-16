// Dashboard + marketplace (native port of driver/web DashboardScreen.tsx and
// the accept/presence handlers of DriverWorkspace.tsx).
import React, { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DesktopCol, DesktopRow, ScrollView } from '../components/layout';
import { DesktopHeader } from '../components/DesktopHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverData } from '../context/DriverData';
import { Avatar, Badge, Button, Card, EmptyState, Notice, Sheet, TextField } from '../components/ui';
import { acceptMarketplaceTrip, DriverActionError, setDriverPresence, submitDutyBid } from '../services/driverService';
import type { DriverStatus, MarketplaceOffer } from '../types/driver';
import { categoryMatches, payoutText } from '../utils/earnings';
import { formatINR } from '../utils/format';
import { describeError } from '../utils/retry';
import { EMERGENCY_NUMBER, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { colors, radius, space, type } from '../theme';

export function HomeScreen() {
  const navigation = useNavigation();
  const { account, activeTrip, runningTrip, completedTrips, offers, offersError, earnings, unreadCount, bookingsError, deviceWarning } = useDriverData();
  const { driver, vehicle } = account;
  const status: DriverStatus = driver.presenceStatus;
  const isOnline = status === 'Online' || status === 'On Trip';
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [bidFor, setBidFor] = useState<MarketplaceOffer | null>(null);
  const [bidRate, setBidRate] = useState('');
  const [bidBusy, setBidBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [sos, setSos] = useState(false);

  const matching = useMemo(() => offers.filter((o) => categoryMatches(o.vehicleCategory, vehicle.vehicleType)), [offers, vehicle.vehicleType]);
  const visible = showAll ? offers : matching;

  const changePresence = async (next: DriverStatus) => {
    if (runningTrip) {
      setMessage({ tone: 'error', text: 'Finish your current trip before changing your duty status.' });
      return;
    }
    setPresenceBusy(true);
    setMessage(null);
    try {
      await setDriverPresence(driver.id, next);
    } catch (e) {
      setMessage({ tone: 'error', text: describeError(e, 'Could not update your status.') });
    } finally {
      setPresenceBusy(false);
    }
  };

  const sendBid = async () => {
    if (!bidFor || bidBusy) return;
    const rate = Number(bidRate);
    if (!(rate > 0) || !Number.isFinite(rate)) {
      setMessage({ tone: 'error', text: 'Enter your counter amount in rupees.' });
      return;
    }
    setBidBusy(true);
    try {
      await submitDutyBid(bidFor, rate, '');
      setMessage({ tone: 'success', text: `Bid of ${formatINR(rate)} sent. NESAM reviews bids and will tell you if it is accepted.` });
      setBidFor(null);
      setBidRate('');
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof DriverActionError ? e.message : describeError(e, 'Your bid could not be sent.') });
    } finally {
      setBidBusy(false);
    }
  };

  const accept = (offer: MarketplaceOffer) => {
    if (runningTrip) {
      setMessage({ tone: 'error', text: 'You have a trip in progress. Finish it before taking another duty.' });
      return;
    }
    const mismatch = !categoryMatches(offer.vehicleCategory, vehicle.vehicleType);
    Alert.alert(
      'Accept this trip?',
      `${offer.pickup.address} → ${offer.drop.address}\nYour payout: ${formatINR(offer.offeredPayout)}${
        mismatch ? `\n\nBooked as ${offer.vehicleCategory}. Accept only if your ${vehicle.vehicleType} qualifies.` : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept trip',
          onPress: () => {
            setAcceptingId(offer.id);
            setMessage(null);
            acceptMarketplaceTrip(driver, vehicle.vehicleNumber, offer)
              .then(() => {
                setMessage({ tone: 'success', text: 'Trip accepted! Complete the pre-trip check before heading to pickup.' });
                navigation.navigate('PreTrip', { bookingId: offer.id });
              })
              .catch((e: unknown) =>
                setMessage({ tone: 'error', text: e instanceof DriverActionError ? e.message : describeError(e, 'This trip is no longer available.') }),
              )
              .finally(() => setAcceptingId(null));
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Sheet visible={sos} onClose={() => setSos(false)} title="Emergency SOS">
        <Text style={[type.small, { marginBottom: space.md }]}>24×7 driver control and police help.</Text>
        <Button title={`Call police emergency (${EMERGENCY_NUMBER})`} variant="danger" onPress={() => void Linking.openURL(`tel:${EMERGENCY_NUMBER}`)} />
        <Button title={`Call NESAM control room (${SUPPORT_PHONE_DISPLAY})`} variant="secondary" onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} style={{ marginTop: space.sm }} />
      </Sheet>
      <Sheet visible={!!bidFor} onClose={() => setBidFor(null)} title="Send your bid">
        <Text style={[type.small, { marginBottom: space.md }]}>
          {bidFor ? `${bidFor.pickup.address} → ${bidFor.drop.address}. NESAM reviews bids; sending one does not assign you the trip.` : ''}
        </Text>
        <TextField label="Your amount (₹)" value={bidRate} onChangeText={(t) => setBidRate(t.replace(/[^\d.]/g, '').slice(0, 8))} keyboardType="decimal-pad" required />
        <Button title={bidBusy ? 'Sending…' : 'Send bid'} loading={bidBusy} onPress={() => void sendBid()} />
      </Sheet>
      <DesktopHeader
        title="Operations Dashboard"
        subtitle={`${driver.name || 'Driver Partner'} • ${vehicle.vehicleNumber || 'Vehicle'} (${vehicle.vehicleType})`}
        actions={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Button small variant="danger" title="Emergency SOS" onPress={() => setSos(true)} />
            <Button
              small
              variant="secondary"
              title={unreadCount > 0 ? `Alerts (${unreadCount})` : 'Alerts'}
              onPress={() => (navigation as any).navigate('Notifications')}
            />
          </View>
        }
      />
      <ScrollView kind="wide" contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={() => setMessage(null)} colors={[colors.primary]} />}>
        <View style={styles.topBar}>
          <Text style={type.h1}>Dashboard</Text>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Pressable onPress={() => setSos(true)} accessibilityRole="button" accessibilityLabel="Emergency SOS" hitSlop={8}>
              <Ionicons name="warning" size={24} color={colors.danger} />
            </Pressable>
            <Pressable onPress={() => (navigation as any).navigate('Notifications')} accessibilityRole="button" accessibilityLabel={`Notifications, ${unreadCount} unread`} hitSlop={8}>
              <Ionicons name="notifications-outline" size={24} color={colors.ink} />
              {unreadCount > 0 ? <View style={styles.dot} /> : null}
            </Pressable>
          </View>
        </View>

        <DesktopRow spacing={space.lg}>
          {/* Main Dispatch Feed (Left) */}
          <DesktopCol flex={1.35}>
            {message ? <Notice tone={message.tone} message={message.text} /> : null}
            {deviceWarning ? <Notice tone="warning" message={deviceWarning} /> : null}
            <Notice message={bookingsError} />
            {driver.docStatus === 'Rejected' ? (
              <Notice
                message={`Document update required: ${driver.rejectionReason || 'Some updated documents were not accepted. Please upload them again.'}`}
                onRetry={() => (navigation as any).navigate('UpdateDocuments')}
              />
            ) : null}

            {activeTrip ? (
              <Card style={styles.activeCard}>
                <View style={styles.activeHead}>
                  <View>
                    <Text style={type.h2}>{runningTrip ? 'Trip in Progress' : 'Next Assigned Trip'}</Text>
                    <Text style={type.small}>Booking ID: {activeTrip.bookingId}</Text>
                  </View>
                  <Badge label={activeTrip.subStatus === 'Not Started' ? 'Go to pickup' : activeTrip.subStatus === 'Reached Pickup' ? 'At pickup' : 'Trip started'} tone="brand" />
                </View>
                <View style={{ marginVertical: space.md, gap: space.xs }}>
                  <View style={styles.place}>
                    <View style={[styles.pdot, { backgroundColor: colors.success }]} />
                    <Text style={[type.bodyMedium, { flex: 1, fontWeight: '700' }]}>{activeTrip.pickup.address}</Text>
                  </View>
                  <View style={styles.place}>
                    <View style={[styles.pdot, { backgroundColor: colors.primary }]} />
                    <Text style={[type.bodyMedium, { flex: 1, fontWeight: '700' }]}>{activeTrip.drop.address}</Text>
                  </View>
                </View>
                <Text style={styles.payout}>Your payout: {payoutText(activeTrip)}</Text>
                {!activeTrip.verificationSubmitted && activeTrip.subStatus !== 'Trip Started' ? (
                  <Text style={[type.small, { marginBottom: space.sm, color: colors.warning }]}>
                    Vehicle inspection photos are needed before Trip Started — take them now or at pickup.
                  </Text>
                ) : null}
                <Button title="Open Trip Execution" variant="dark" onPress={() => (navigation as any).navigate('Tabs', { screen: 'Trip' })} />
              </Card>
            ) : null}

            <View style={styles.marketHead}>
              <View style={{ flex: 1 }}>
                <Text style={type.h2}>Available Trips</Text>
                <Text style={type.small}>{showAll ? 'All open market trips' : `Trips matching ${vehicle.vehicleType} vehicles`}</Text>
              </View>
              {isOnline && !runningTrip ? (
                <Button small variant="ghost" title={showAll ? 'My category only' : `Show all (${offers.length})`} onPress={() => setShowAll((s) => !s)} />
              ) : null}
            </View>
            <Notice message={offersError} />

            {driver.vendorId ? (
              <EmptyState title="Trips come from your fleet" message={`${driver.vendorName || 'Your vendor'} assigns your trips. They appear on this screen as soon as they are assigned.`} />
            ) : !isOnline ? (
              <EmptyState title="You are offline" message="Turn your duty switch to Online to see and accept trips." action={<Button title="Go online now" variant="success" loading={presenceBusy} onPress={() => void changePresence('Online')} />} />
            ) : runningTrip ? (
              <EmptyState title="Finish your current trip" message="New trips appear here once you complete your current booking." />
            ) : visible.length === 0 ? (
              <EmptyState title="No open trips right now" message="New customer bookings appear here instantly. Keep your status online." />
            ) : (
              visible.map((offer) => {
                const mismatch = !categoryMatches(offer.vehicleCategory, vehicle.vehicleType);
                return (
                  <Card key={offer.id}>
                    <View style={styles.offerHead}>
                      <Text style={[type.tiny, { fontWeight: '700' }]}>{offer.bookingId}</Text>
                      <Badge label={offer.vehicleCategory || 'Any vehicle'} tone={mismatch ? 'warning' : 'success'} />
                    </View>
                    <View style={styles.place}>
                      <View style={[styles.pdot, { backgroundColor: colors.success }]} />
                      <Text style={[type.bodyMedium, { flex: 1 }]}>{offer.pickup.address}</Text>
                    </View>
                    <View style={styles.place}>
                      <View style={[styles.pdot, { backgroundColor: colors.primary }]} />
                      <Text style={[type.bodyMedium, { flex: 1 }]}>{offer.drop.address}</Text>
                    </View>
                    <Text style={[type.small, { color: colors.muted, marginTop: 4 }]}>
                      {offer.travelDate || 'Date TBC'}
                      {offer.pickupTime ? ` • ${offer.pickupTime}` : ''}
                      {offer.distanceKm > 0 ? ` • ${offer.distanceKm} km` : ''}
                    </Text>
                    <View style={styles.offerFoot}>
                      <View>
                        <Text style={type.tiny}>{offer.mode === 'bid_review' ? 'CURRENT OFFER (BIDS REVIEWED)' : 'PAYOUT IF YOU ACCEPT'}</Text>
                        <Text style={styles.offerPayout}>{formatINR(offer.offeredPayout)}</Text>
                      </View>
                      {offer.mode === 'bid_review' ? (
                        <Button small variant="dark" title="Send bid" disabled={acceptingId !== null} onPress={() => { setBidFor(offer); setBidRate(''); }} />
                      ) : (
                        <Button small title={acceptingId === offer.id ? 'Accepting…' : 'Accept trip'} loading={acceptingId === offer.id} disabled={acceptingId !== null} onPress={() => accept(offer)} />
                      )}
                    </View>
                  </Card>
                );
              })
            )}
          </DesktopCol>

          {/* Operational Control Center (Right) */}
          <DesktopCol flex={0.9}>
            <Card>
              <View style={styles.profileRow}>
                <Avatar name={driver.name} photoUrl={driver.photoUrl} size={56} />
                <View style={{ flex: 1 }}>
                  <Text style={type.h2} numberOfLines={1}>
                    {driver.name}
                  </Text>
                  <Text style={type.small} numberOfLines={1}>
                    {vehicle.make} {vehicle.model} • {vehicle.vehicleNumber}
                  </Text>
                  <Text style={type.small}>
                    {driver.rating != null ? `★ ${driver.rating.toFixed(1)} rating` : 'No ratings yet'} · {completedTrips.length} trips
                  </Text>
                </View>
              </View>
              <View style={styles.dutyRow}>
                <Text style={type.label}>Duty Status</Text>
                <Badge label={status} tone={status === 'Online' ? 'success' : status === 'On Trip' ? 'brand' : 'neutral'} />
              </View>
              <View style={styles.toggle}>
                {(['Offline', 'Online'] as DriverStatus[]).map((st) => {
                  const active = status === st || (st === 'Online' && status === 'On Trip');
                  return (
                    <Pressable
                      key={st}
                      disabled={presenceBusy || active || !!runningTrip}
                      onPress={() => void changePresence(st)}
                      style={[styles.toggleBtn, active && (st === 'Online' ? styles.online : styles.offline)]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active, disabled: presenceBusy || !!runningTrip }}
                    >
                      <Text style={[styles.toggleText, active && { color: colors.white }]}>{st === 'Online' ? 'Go Online' : 'Go Offline'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <View style={styles.stats}>
              <Stat label="Today" value={formatINR(earnings.todayEarnings)} accent />
              <Stat label="Last 7 days" value={formatINR(earnings.thisWeekEarnings)} />
              <Stat label="Trips" value={String(completedTrips.length)} />
              <Stat label="Rating" value={driver.rating != null ? `★ ${driver.rating.toFixed(1)}` : '—'} />
            </View>

            <Card>
              <Text style={[type.h3, { marginBottom: space.sm }]}>Operations Shortcuts</Text>
              <View style={{ gap: space.sm }}>
                <Button
                  small
                  variant="secondary"
                  title="Pre-Trip Vehicle Inspection"
                  onPress={() => (navigation as any).navigate('PreTrip', { bookingId: activeTrip?.bookingId || '' })}
                />
                <Button
                  small
                  variant="secondary"
                  title="Update Vehicle Documents"
                  onPress={() => (navigation as any).navigate('UpdateDocuments')}
                />
                <Button
                  small
                  variant="secondary"
                  title="Earnings & Payout Ledger"
                  onPress={() => (navigation as any).navigate('Tabs', { screen: 'Earnings' })}
                />
              </View>
            </Card>
          </DesktopCol>
        </DesktopRow>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={type.tiny}>{label.toUpperCase()}</Text>
      <Text style={[styles.statValue, accent && { color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  dot: { position: 'absolute', top: 0, right: 0, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dutyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.lg, marginBottom: space.sm },
  toggle: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.md, padding: 4, gap: 4 },
  toggleBtn: { flex: 1, minHeight: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  online: { backgroundColor: colors.success },
  offline: { backgroundColor: '#4B5563' },
  toggleText: { fontWeight: '800', color: colors.muted },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  stat: { flexGrow: 1, flexBasis: 130, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md },
  statValue: { fontSize: 20, fontWeight: '900', color: colors.ink, marginTop: 4 },
  activeCard: { borderColor: colors.primary, borderWidth: 2 },
  activeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payout: { fontSize: 18, fontWeight: '900', color: colors.primary, marginVertical: space.sm },
  marketHead: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm, marginBottom: space.sm },
  offerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  place: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: 4 },
  pdot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  offerFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  offerPayout: { fontSize: 20, fontWeight: '900', color: colors.primary },
});

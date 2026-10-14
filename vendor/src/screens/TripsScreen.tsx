// Awarded trips and driver dispatch (native port of vendor/web
// TripAssignmentScreen.tsx, using vendorDispatchOk instead of the Web's
// rule-violating write).
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlatList, Content } from '../components/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVendorData } from '../context/VendorData';
import { Badge, Button, Card, Chip, EmptyState, Notice, Row, Segmented, Sheet } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { canDispatch, dispatchBlocker, dispatchDriver, tripStageLabel, VendorActionError } from '../services/vendorService';
import type { FleetDriver, VendorBooking } from '../types/operations';
import { formatINR, formatPhone, localMobile } from '../utils/format';
import { payoutText } from '../utils/wallet';
import { describeDataError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';
import { useResponsive } from '../theme/responsive';

type Tab = 'active' | 'completed';

export function TripsScreen() {
  const { isDesktop, isCompact } = useResponsive();
  const { bookings, activeBookings, errors } = useVendorData();
  const [tab, setTab] = useState<Tab>('active');
  const [dispatchFor, setDispatchFor] = useState<VendorBooking | null>(null);
  const [message, setMessage] = useState('');
  const completed = useMemo(
    () => bookings.filter((b) => b.status === 'Completed').sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)),
    [bookings],
  );
  const data = tab === 'active' ? activeBookings : completed;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <DesktopHeader
        title="Trip Dispatch & Operations"
        subtitle="Manage assigned passenger journeys, vehicle dispatches, and driver allocations"
        badge={`${activeBookings.length} Active`}
      />

      {dispatchFor ? (
        <DispatchSheet
          key={dispatchFor.id}
          booking={dispatchFor}
          onClose={() => setDispatchFor(null)}
          onDone={(name) => {
            setDispatchFor(null);
            setMessage(`${name} has been dispatched. The trip now appears in their driver app.`);
          }}
        />
      ) : null}

      <View style={styles.headerArea}>
        {isCompact ? (
          <Content kind="wide" style={styles.header}>
            <Text style={type.h1}>Trips</Text>
          </Content>
        ) : null}

        <View style={styles.tabsWrap}>
          <Segmented
            options={[
              { value: 'active', label: `Active Trips (${activeBookings.length})` },
              { value: 'completed', label: `Completed Trips (${completed.length})` },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>
        {message ? <Notice tone="success" message={message} style={{ marginHorizontal: space.lg, marginTop: space.sm }} /> : null}
      </View>

      <FlatList
        multiColumn
        data={data}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Notice message={errors.bookings} />}
        ListEmptyComponent={
          <EmptyState title={tab === 'active' ? 'No active trips' : 'No completed trips yet'} message={tab === 'active' ? 'Accept trips from the marketplace to see them here.' : undefined} />
        }
        renderItem={({ item: b }) => {
          const needsDriver = b.status === 'Confirmed' || (b.status === 'Assigned' && !b.driverId);
          const customerPhone = localMobile(b.customerPhone);
          const driverPhone = localMobile(b.driverPhone);
          return (
            <Card style={[styles.card, needsDriver && styles.cardNeedsDriver]}>
              <View style={styles.rowBetween}>
                <Text style={styles.bookingIdText}>ID: {b.bookingId}</Text>
                <Badge
                  label={needsDriver && b.status !== 'Completed' ? 'Needs Driver' : tripStageLabel(b)}
                  tone={b.status === 'Completed' ? 'success' : needsDriver ? 'warning' : 'brand'}
                />
              </View>

              <View style={styles.passengerBox}>
                <Ionicons name="person-outline" size={18} color={colors.ink} />
                <Text style={styles.passengerName}>{b.customerName}</Text>
                {customerPhone && b.status !== 'Completed' ? (
                  <Pressable
                    onPress={() => void Linking.openURL(`tel:+91${customerPhone}`)}
                    style={styles.callBadge}
                    accessibilityRole="button"
                    accessibilityLabel="Call passenger"
                  >
                    <Ionicons name="call" size={14} color={colors.white} />
                    <Text style={styles.callBadgeText}>Call Rider</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.routeBox}>
                <View style={styles.routeRow}>
                  <View style={[styles.dot, { backgroundColor: colors.success }]} />
                  <Text style={styles.routeText} numberOfLines={2}>
                    {b.pickupAddress}
                  </Text>
                </View>
                <View style={styles.routeRow}>
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.routeText} numberOfLines={2}>
                    {b.dropAddress}
                  </Text>
                </View>
              </View>

              <View style={styles.scheduleRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.slate} />
                <Text style={styles.scheduleText}>
                  {b.date} at {b.time} {b.vehicleCategory ? `· ${b.vehicleCategory}` : ''} {b.paymentMethod ? `· ${b.paymentMethod}` : ''}
                </Text>
              </View>

              {b.driverId ? (
                <View style={styles.driverBox}>
                  <Ionicons name="car-sport-outline" size={20} color={colors.ink} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverAssignedText}>{b.driverName}</Text>
                    <Text style={styles.driverVehicleText}>Vehicle: {b.vehicleNumber}</Text>
                  </View>
                  {driverPhone ? (
                    <Pressable onPress={() => void Linking.openURL(`tel:+91${driverPhone}`)} style={styles.iconCircle} accessibilityRole="button" accessibilityLabel="Call driver">
                      <Ionicons name="call-outline" size={18} color={colors.primary} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.payoutBox}>
                <Row label="Customer Fare" value={formatINR(b.fare)} />
                <Row label="Your Net Payout" value={payoutText(b)} bold />
              </View>

              {canDispatch(b) ? (
                <Button
                  small
                  variant={b.driverId ? 'secondary' : 'primary'}
                  title={b.driverId ? 'Reassign Driver' : 'Dispatch Driver Now'}
                  onPress={() => setDispatchFor(b)}
                  style={{ marginTop: space.sm }}
                />
              ) : null}
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

function DispatchSheet({ booking, onClose, onDone }: { booking: VendorBooking; onClose: () => void; onDone: (driverName: string) => void }) {
  const { drivers, vehicles, bookings } = useVendorData();
  const [driverId, setDriverId] = useState(booking.driverId);
  const driver = drivers.find((d) => d.id === driverId) ?? null;
  const defaultVehicle = (d: FleetDriver | null) => d?.assignedVehicleNumber || d?.ownVehicleNumber || '';
  const [vehicleNumber, setVehicleNumber] = useState(booking.vehicleNumber || defaultVehicle(driver));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const usableVehicles = vehicles.filter((v) => v.status === 'Active' && v.docStatus === 'Approved');

  const pickDriver = (d: FleetDriver) => {
    setDriverId(d.id);
    setVehicleNumber(defaultVehicle(d));
    setError('');
  };

  const submit = async () => {
    if (!driver) return setError('Choose a driver.');
    setBusy(true);
    setError('');
    try {
      await dispatchDriver(booking, driver, vehicleNumber, bookings);
      onDone(driver.name);
    } catch (e) {
      setError(e instanceof VendorActionError ? e.message : describeDataError(e));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Sheet visible onClose={onClose} title={`Dispatch Trip · ${booking.bookingId}`} dismissible={!busy}>
      <Text style={[type.small, { marginBottom: space.md }]}>
        {booking.pickupAddress} → {booking.dropAddress} · {booking.date} at {booking.time}
      </Text>
      <Text style={[type.label, { marginBottom: space.sm }]}>Choose Driver</Text>
      {drivers.length === 0 ? <Notice tone="info" message="No drivers are linked to your fleet yet. Invite drivers from More › Drivers." /> : null}
      {drivers.map((d) => {
        const blocker = dispatchBlocker(d, bookings, booking.id);
        const on = d.id === driverId;
        return (
          <Pressable
            key={d.id}
            onPress={() => !blocker && pickDriver(d)}
            disabled={!!blocker}
            style={[styles.option, on && styles.optionOn, !!blocker && { opacity: 0.5 }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: !!blocker }}
          >
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>{d.name}</Text>
              <Text style={type.small}>{blocker || `${d.presenceStatus} · ★ ${d.rating.toFixed(1)}${d.assignedVehicleNumber ? ` · ${d.assignedVehicleNumber}` : ''}`}</Text>
            </View>
            {on ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
          </Pressable>
        );
      })}
      {driver ? (
        <>
          <Text style={[type.label, { marginVertical: space.sm }]}>Select Vehicle for This Trip</Text>
          <View style={styles.chips}>
            {[...new Set([defaultVehicle(driver), ...usableVehicles.map((v) => v.vehicleNumber)].filter(Boolean))].map((num) => (
              <Chip key={num} label={num} active={vehicleNumber === num} onPress={() => setVehicleNumber(num)} />
            ))}
          </View>
          {!vehicleNumber ? <Text style={type.small}>Add an approved vehicle in Fleet, or assign one to this driver.</Text> : null}
        </>
      ) : null}
      <Notice message={error} />
      <Button title={busy ? 'Dispatching Trip…' : 'Confirm Dispatch'} loading={busy} disabled={!driver || !vehicleNumber} onPress={() => void submit()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  headerArea: { paddingHorizontal: space.lg, paddingTop: space.sm },
  header: { paddingBottom: space.xs },
  tabsWrap: { maxWidth: 520 },
  list: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.md,
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)' as any,
  },
  cardNeedsDriver: { borderColor: colors.warningBorder, backgroundColor: '#FFFDF5' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  bookingIdText: { fontSize: 13, fontWeight: '800', color: colors.slate },
  passengerBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: 6 },
  passengerName: { fontSize: 17, fontWeight: '800', color: colors.ink, flex: 1 },
  callBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.success, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  callBadgeText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  routeBox: { backgroundColor: '#F8FAFC', borderRadius: radius.md, padding: space.md, gap: 6, marginVertical: 6 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  routeText: { fontSize: 13, color: colors.ink, flex: 1, lineHeight: 18 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 },
  scheduleText: { fontSize: 13, color: colors.slate },
  driverBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: '#F1F5F9', borderRadius: radius.md, padding: space.sm, marginVertical: space.xs },
  driverAssignedText: { fontSize: 14, fontWeight: '800', color: colors.ink },
  driverVehicleText: { fontSize: 12, color: colors.slate },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  payoutBox: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm, marginTop: space.sm, gap: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.sm },
});

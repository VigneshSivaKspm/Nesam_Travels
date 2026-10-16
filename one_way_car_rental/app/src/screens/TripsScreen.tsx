import React, { useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlatList } from '../components/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCustomerData } from '../context/CustomerData';
import { Button, EmptyState, Notice } from '../components/ui';
import { CancelRideSheet } from '../components/CancelRideSheet';
import type { TripRecord } from '../types';
import { formatDate, formatINR, formatTime } from '../utils/format';
import { paymentLabel, tabOfTrip, tripStatusChip, type TripTab } from '../utils/tripView';
import { colors, fonts, radius, space } from '../theme';
import { ILLUSTRATIONS, getVehicleImage } from '../assets/images';

const TABS: TripTab[] = ['Upcoming', 'Completed', 'Cancelled'];

export function TripsScreen() {
  const navigation = useNavigation();
  const { trips, tripsLoading, tripsError, retryTrips, profile } = useCustomerData();
  const [tab, setTab] = useState<TripTab>('Upcoming');
  const [cancelTrip, setCancelTrip] = useState<TripRecord | null>(null);

  const shown = useMemo(() => {
    const list = trips.filter((t) => tabOfTrip(t) === tab);
    const pickupAt = (t: TripRecord) => (t.scheduledAt ?? t.createdAt)?.getTime() ?? 0;
    const closedAt = (t: TripRecord) => (t.completedAt ?? t.cancelledAt ?? t.createdAt)?.getTime() ?? 0;
    return tab === 'Upcoming' ? list.sort((a, b) => pickupAt(a) - pickupAt(b)) : list.sort((a, b) => closedAt(b) - closedAt(a));
  }, [trips, tab]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <CancelRideSheet key={cancelTrip?.id ?? 'none'} trip={cancelTrip} onClose={() => setCancelTrip(null)} />

      {/* Mobile Top Header */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My Bookings</Text>
          <Text style={styles.subtitle}>Track schedules, drivers & invoices</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('Tabs', { screen: 'Book' })}
          style={styles.newBookingBtn}
          accessibilityRole="button"
          accessibilityLabel="Book a new cab"
        >
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.newBookingText}>New Cab</Text>
        </Pressable>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={retryTrips} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={styles.headerArea}>
            {/* Filter Tabs */}
            <View style={styles.tabs} accessibilityRole="tablist">
              {TABS.map((t) => {
                const on = t === tab;
                const count = trips.filter((x) => tabOfTrip(x) === t).length;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setTab(t)}
                    style={[styles.tab, on && styles.tabOn]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${t}, ${count} bookings`}
                  >
                    <Text style={[styles.tabText, on && styles.tabTextOn]}>
                      {t} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {tripsError ? <Notice message={tripsError} onRetry={retryTrips} style={{ marginTop: space.sm }} /> : null}
          </View>
        }
        ListEmptyComponent={
          tripsLoading ? (
            <Text style={styles.loading}>Loading your bookings…</Text>
          ) : (
            <EmptyState
              image={ILLUSTRATIONS.noTrips}
              title={tab === 'Upcoming' ? 'No Upcoming Bookings' : tab === 'Completed' ? 'No Completed Journeys' : 'No Cancelled Trips'}
              message={tab === 'Upcoming' ? 'Book your outstation or intercity journey in advance.' : undefined}
              action={tab === 'Upcoming' ? <Button title="Book a Cab Now" onPress={() => navigation.navigate('Tabs', { screen: 'Book' })} /> : undefined}
            />
          )
        }
        renderItem={({ item: t }) => (
          <TripCard
            trip={t}
            onOpen={() => navigation.navigate('ActiveRide', { bookingId: t.id })}
            onCancel={() => setCancelTrip(t)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function TripCard({ trip: t, onOpen, onCancel }: { trip: TripRecord; onOpen: () => void; onCancel: () => void }) {
  const tab = tabOfTrip(t);
  const chip = tripStatusChip(t);
  const pay = paymentLabel(t);
  const when = t.scheduledAt ?? t.createdAt;
  const cancellable = ['Pending', 'Approved', 'Confirmed'].includes(t.status);
  const total = t.status === 'Completed' ? t.fare + t.tollCharges : t.fare;
  const vehicleImage = getVehicleImage(t.categoryName);

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Image
          source={vehicleImage}
          style={styles.cardVehicleThumb}
          resizeMode="contain"
          accessible={false}
          importantForAccessibility="no"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardCategory}>{t.categoryName || 'Outstation Cab'}</Text>
          <Text style={styles.code}>REF: #{t.bookingId || t.id.slice(0, 8).toUpperCase()}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: chip.bg }]}>
          <Text style={[styles.chipText, { color: chip.fg }]}>{chip.label}</Text>
        </View>
      </View>

      <View style={styles.routeBox}>
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.place} numberOfLines={1}>
            {t.pickup.name}
          </Text>
        </View>
        <View style={styles.connector} />
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <Text style={styles.place} numberOfLines={1}>
            {t.drop.name}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={15} color={colors.slate} />
        <Text style={styles.meta}>{when ? `${formatDate(when)} · ${formatTime(when)}` : t.date}</Text>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="car-outline" size={15} color={colors.slate} />
        <Text style={styles.meta} numberOfLines={1}>
          {t.tripType} · {t.driver ? `Chauffeur: ${t.driver.name}` : 'Awaiting chauffeur assignment'}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fare}>{formatINR(total)}</Text>
          <Text style={[styles.payText, pay.tone === 'success' && { color: '#059669', fontFamily: fonts.bold, fontWeight: '700' }]}>{pay.text}</Text>
        </View>
        <Pressable onPress={onOpen} style={styles.viewBtn} accessibilityRole="button">
          <Text style={styles.viewBtnText}>{tab === 'Completed' ? 'Receipt' : 'Trip Details'}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>

      {cancellable ? (
        <Text style={styles.cancel} onPress={onCancel} accessibilityRole="button">
          Cancel Booking
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 12, color: colors.slate, marginTop: 1 },
  newBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  newBookingText: {
    fontFamily: fonts.bold,
    color: colors.white,
    fontSize: 12,
  },
  list: { padding: space.md, paddingBottom: space.xxl },
  headerArea: { marginBottom: space.sm },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: radius.full,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  tabOn: {
    backgroundColor: colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  tabText: { fontFamily: fonts.medium, fontSize: 12, color: colors.slate },
  tabTextOn: { fontFamily: fonts.bold, color: colors.primary },
  loading: { fontFamily: fonts.medium, textAlign: 'center', color: colors.slate, marginTop: space.xl, fontSize: 14 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: space.md,
    marginBottom: space.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardVehicleThumb: {
    width: 48,
    height: 32,
    marginRight: 10,
  },
  cardCategory: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  code: { fontFamily: fonts.medium, fontSize: 11, color: colors.slate, marginTop: 1 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  chipText: { fontFamily: fonts.bold, fontSize: 10 },
  routeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: space.sm,
    marginVertical: 6,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  connector: { width: 2, height: 12, backgroundColor: '#CBD5E1', marginLeft: 3, marginVertical: 1 },
  place: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.ink, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  meta: { fontFamily: fonts.medium, fontSize: 12, color: colors.slate, flex: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  fare: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  payText: { fontFamily: fonts.regular, fontSize: 11, color: colors.slate },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  viewBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
  },
  cancel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.slate,
    textAlign: 'center',
    marginTop: 8,
    paddingTop: 4,
  },
});

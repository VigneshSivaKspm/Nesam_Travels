// My Trips: Upcoming / Completed / Cancelled, one card per booking.
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlatList, DesktopRow } from '../components/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCustomerData } from '../context/CustomerData';
import { Button, EmptyState, Notice } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { CancelRideSheet } from '../components/CancelRideSheet';
import type { TripRecord } from '../types';
import { formatDate, formatINR, formatTime } from '../utils/format';
import { paymentLabel, tabOfTrip, tripStatusChip, type TripTab } from '../utils/tripView';
import { colors, radius, space } from '../theme';
import { useResponsive } from '../theme/responsive';

const TABS: TripTab[] = ['Upcoming', 'Completed', 'Cancelled'];

export function TripsScreen() {
  const { isDesktop, isCompact } = useResponsive();
  const navigation = useNavigation();
  const { trips, tripsLoading, tripsError, retryTrips, profile } = useCustomerData();
  const [tab, setTab] = useState<TripTab>('Upcoming');
  const [cancelTrip, setCancelTrip] = useState<TripRecord | null>(null);

  const shown = useMemo(() => {
    const list = trips.filter((t) => tabOfTrip(t) === tab);
    // Upcoming: soonest pickup first. History: newest first.
    const pickupAt = (t: TripRecord) => (t.scheduledAt ?? t.createdAt)?.getTime() ?? 0;
    const closedAt = (t: TripRecord) => (t.completedAt ?? t.cancelledAt ?? t.createdAt)?.getTime() ?? 0;
    return tab === 'Upcoming' ? list.sort((a, b) => pickupAt(a) - pickupAt(b)) : list.sort((a, b) => closedAt(b) - closedAt(a));
  }, [trips, tab]);

  const stats = useMemo(() => {
    const upcoming = trips.filter((t) => tabOfTrip(t) === 'Upcoming').length;
    const completed = trips.filter((t) => t.status === 'Completed').length;
    const totalSpent = trips
      .filter((t) => t.status === 'Completed')
      .reduce((sum, t) => sum + (t.fare + t.tollCharges), 0);
    return { upcoming, completed, totalSpent };
  }, [trips]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <CancelRideSheet key={cancelTrip?.id ?? 'none'} trip={cancelTrip} onClose={() => setCancelTrip(null)} />
      
      <DesktopHeader
        title="My Trips"
        subtitle="Manage upcoming schedules, past receipts, and completed travel logs"
        badge={`${trips.length} Total`}
        actions={
          <Button
            small
            title="+ Book a Ride"
            onPress={() => navigation.navigate('Tabs', { screen: 'Book' })}
          />
        }
      />

      <FlatList
        multiColumn
        data={shown}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={retryTrips} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={styles.headerArea}>
            {/* Mobile Title */}
            {isCompact ? (
              <>
                <Text style={styles.title} accessibilityRole="header">
                  My Trips
                </Text>
                <Text style={styles.subtitle}>Your journeys, organised</Text>
              </>
            ) : null}

            {/* Desktop Metrics KPI Banner */}
            {isDesktop ? (
              <View style={styles.metricsRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Upcoming Journeys</Text>
                  <Text style={styles.metricValue}>{stats.upcoming}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Completed Trips</Text>
                  <Text style={styles.metricValue}>{stats.completed}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Total Spent</Text>
                  <Text style={styles.metricValue}>{formatINR(stats.totalSpent)}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Refund Wallet</Text>
                  <Text style={[styles.metricValue, { color: colors.success }]}>{formatINR(profile.walletBalance)}</Text>
                </View>
              </View>
            ) : null}

            {/* Filter Tabs */}
            <View style={styles.tabs} accessibilityRole="tablist">
              {TABS.map((t) => {
                const on = t === tab;
                const count = trips.filter((x) => tabOfTrip(x) === t).length;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setTab(t)}
                    style={({ pressed, hovered }: any) => [
                      styles.tab,
                      on && styles.tabOn,
                      hovered && !on && styles.tabHovered,
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${t}, ${count} trips`}
                  >
                    <Text style={[styles.tabText, on && styles.tabTextOn]}>
                      {t} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {tripsError ? <Notice message={tripsError} onRetry={retryTrips} /> : null}
          </View>
        }
        ListEmptyComponent={
          tripsLoading ? (
            <Text style={styles.loading}>Loading your trips…</Text>
          ) : (
            <EmptyState
              title={tab === 'Upcoming' ? 'No upcoming trips' : tab === 'Completed' ? 'No completed trips yet' : 'No cancelled trips'}
              message={tab === 'Upcoming' ? 'Book a ride and it will appear here.' : undefined}
              action={tab === 'Upcoming' ? <Button title="Book a ride" onPress={() => navigation.navigate('Tabs', { screen: 'Book' })} /> : undefined}
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
  const needsRating = t.status === 'Completed' && t.rating == null;
  const cancellable = ['Pending', 'Approved', 'Confirmed'].includes(t.status);
  const total = t.status === 'Completed' ? t.fare + t.tollCharges : t.fare;

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{tab === 'Upcoming' ? 'Upcoming Journey' : tab === 'Completed' ? 'Completed Journey' : 'Cancelled Trip'}</Text>
          <Text style={styles.code} numberOfLines={1}>
            ID: {t.bookingId}
          </Text>
        </View>
        <View style={[styles.chip, { backgroundColor: chip.bg }]}>
          <Text style={[styles.chipText, { color: chip.fg }]}>{chip.label}</Text>
        </View>
      </View>

      <View style={styles.route}>
        <View style={styles.routeRow}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
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
        <Ionicons name="calendar-outline" size={18} color={colors.slate} />
        <Text style={styles.meta}>{when ? `${formatDate(when)} · ${formatTime(when)}` : t.date}</Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="car-outline" size={18} color={colors.slate} />
        <Text style={styles.meta} numberOfLines={1}>
          {t.categoryName} · {t.tripType}
          {t.driver ? ` · Driver: ${t.driver.name}` : ''}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fare}>{formatINR(total)}</Text>
          <Text style={[styles.payText, pay.tone === 'success' && { color: colors.success, fontWeight: '700' }, pay.tone === 'danger' && { color: colors.primaryDark, fontWeight: '700' }]}>{pay.text}</Text>
        </View>
        <Pressable
          onPress={onOpen}
          style={({ pressed, hovered }: any) => [
            styles.outline,
            hovered && { backgroundColor: colors.primarySoft },
            pressed && { opacity: 0.8 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${tab === 'Completed' ? 'View receipt' : 'View details'} for ${t.bookingId}`}
        >
          <Text style={styles.outlineText}>{tab === 'Completed' ? (needsRating ? 'Receipt & Rate' : 'View Receipt') : 'View Details'}</Text>
        </Pressable>
      </View>
      {cancellable ? (
        <Text style={styles.cancel} onPress={onCancel} accessibilityRole="button">
          Cancel Ride
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  list: { padding: space.lg, paddingBottom: space.xxl },
  headerArea: { marginBottom: space.md },
  title: { fontSize: 32, fontWeight: '900', color: colors.ink },
  subtitle: { fontSize: 18, color: colors.slate, marginTop: 2, marginBottom: space.lg },
  metricsRow: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.lg,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.md,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)' as any,
  },
  metricLabel: { fontSize: 13, color: colors.slate, fontWeight: '600', marginBottom: 4 },
  metricValue: { fontSize: 24, fontWeight: '900', color: colors.ink },
  tabs: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  tab: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabHovered: { backgroundColor: '#F1F5F9', borderColor: colors.slate },
  tabText: { fontSize: 15, fontWeight: '700', color: colors.slate },
  tabTextOn: { color: colors.white, fontWeight: '800' },
  loading: { textAlign: 'center', marginTop: space.xl, fontSize: 15, color: colors.slate },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: space.lg,
    marginBottom: space.md,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)' as any,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  code: { fontSize: 13, color: colors.slate, marginTop: 2 },
  chip: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 4 },
  chipText: { fontSize: 13, fontWeight: '700' },
  route: { marginTop: space.md },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 12, height: 12, borderRadius: 6 },
  connector: { width: 0, height: 14, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: colors.faint, marginLeft: 5 },
  place: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  meta: { flex: 1, fontSize: 14, color: colors.slate },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  fare: { fontSize: 22, fontWeight: '900', color: colors.ink },
  payText: { fontSize: 13, color: colors.slate, marginTop: 2 },
  outline: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  cancel: { color: colors.slate, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline', alignSelf: 'flex-start', marginTop: space.sm, paddingVertical: 4 },
});

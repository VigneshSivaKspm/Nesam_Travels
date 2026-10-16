// Fleet overview (native port of vendor/web DashboardScreen.tsx, driven by
// live data instead of the Web's static counters).
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView, DesktopRow } from '../components/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useVendorData } from '../context/VendorData';
import { Badge, Card, EmptyState, Notice, Button } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { daysUntil } from '../utils/wallet';
import { tripStageLabel } from '../services/vendorService';
import { EXPIRY_WARNING_DAYS } from '../config/constants';
import { formatINR } from '../utils/format';
import { colors, radius, space, type } from '../theme';
import { useResponsive } from '../theme/responsive';

export function DashboardScreen() {
  const { isDesktop, isCompact } = useResponsive();
  const navigation = useNavigation();
  const { profile, vehicles, drivers, activeBookings, awaitingDispatch, marketTrips, wallet, monthEarnings, errors } = useVendorData();

  const expiring = useMemo(
    () =>
      vehicles.flatMap((v) =>
        (
          [
            ['Insurance', v.insuranceExpiry],
            ['Permit', v.permitExpiry],
            ['Fitness', v.fitnessExpiry],
          ] as const
        )
          .map(([label, date]) => ({ label, date, days: daysUntil(date) }))
          .filter((x) => x.days != null && x.days <= EXPIRY_WARNING_DAYS)
          .map((x) => ({ ...x, vehicle: v.vehicleNumber })),
      ),
    [vehicles],
  );
  const approvedDrivers = drivers.filter((d) => d.approvalStatus === 'Approved').length;
  const onlineDrivers = drivers.filter((d) => d.presenceStatus === 'Online').length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <DesktopHeader
        title="Fleet Command Center"
        subtitle={profile.companyName ? `${profile.companyName} · Live Operations & Dispatch` : 'Live Operations & Dispatch'}
        badge="Fleet Partner"
        actions={
          <Button
            small
            title="Browse Marketplace"
            onPress={() => navigation.navigate('Tabs', { screen: 'Market' })}
          />
        }
      />

      <ScrollView kind="wide" contentContainerStyle={styles.content}>
        {isCompact ? (
          <>
            <Text style={type.tiny}>NESAM FLEET PARTNER</Text>
            <Text style={type.h1} numberOfLines={1}>
              {profile.companyName}
            </Text>
            <Text style={[type.small, { marginBottom: space.md }]}>{profile.contactPerson ? `Hello, ${profile.contactPerson.split(' ')[0]}` : 'Welcome back'}</Text>
          </>
        ) : null}

        <Notice message={errors.bookings} />
        {awaitingDispatch.length ? (
          <Notice
            tone="warning"
            message={`${awaitingDispatch.length} trip(s) waiting for driver assignment. Dispatch now to ensure passenger pick-up.`}
            onRetry={() => navigation.navigate('Tabs', { screen: 'Trips' })}
          />
        ) : null}
        {expiring.length ? (
          <Notice
            tone="warning"
            message={`${expiring.length} vehicle document(s) expired or expiring within ${EXPIRY_WARNING_DAYS} days.`}
            onRetry={() => navigation.navigate('Documents')}
          />
        ) : null}

        {/* 6-Metric High-Density KPI Grid */}
        <View style={styles.grid}>
          <Stat label="Available Balance" value={formatINR(wallet.available)} accent onPress={() => navigation.navigate('Wallet')} />
          <Stat label="Earned this Month" value={formatINR(monthEarnings)} />
          <Stat label="Active Trips" value={String(activeBookings.length)} onPress={() => navigation.navigate('Tabs', { screen: 'Trips' })} />
          <Stat label="Marketplace Pool" value={`${marketTrips.length} open`} onPress={() => navigation.navigate('Tabs', { screen: 'Market' })} />
          <Stat label="Vehicles Active" value={`${vehicles.filter((v) => v.status === 'Active').length} / ${vehicles.length}`} onPress={() => navigation.navigate('Tabs', { screen: 'Fleet' })} />
          <Stat label="Drivers Online" value={`${onlineDrivers} / ${approvedDrivers}`} onPress={() => navigation.navigate('Drivers')} />
        </View>

        <DesktopRow gap={24} style={styles.dashboardRow}>
          {/* Left Column: Active Trips Dispatch Queue */}
          <View style={[styles.mainCol, isDesktop && { flex: 1.4 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Trips & Dispatch Queue</Text>
              {activeBookings.length > 0 ? (
                <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Trips' })}>
                  <Text style={styles.viewAllText}>View All ({activeBookings.length}) →</Text>
                </Pressable>
              ) : null}
            </View>

            {activeBookings.length === 0 ? (
              <EmptyState
                title="No active trips in queue"
                message="Trips you accept from the open marketplace or direct passenger bookings appear here for assignment."
                action={
                  <Button
                    small
                    title="Explore Open Trips"
                    onPress={() => navigation.navigate('Tabs', { screen: 'Market' })}
                  />
                }
              />
            ) : (
              activeBookings.slice(0, 6).map((b) => (
                <Card key={b.id} style={styles.tripCard}>
                  <View style={styles.tripHead}>
                    <Text style={styles.tripIdText}>BOOKING ID: {b.bookingId}</Text>
                    <Badge
                      label={b.status === 'Confirmed' || !b.driverId ? 'Needs Driver' : tripStageLabel(b)}
                      tone={b.status === 'Confirmed' || !b.driverId ? 'warning' : 'brand'}
                    />
                  </View>
                  <Text style={styles.tripRouteText} numberOfLines={1}>
                    {b.pickupAddress} → {b.dropAddress}
                  </Text>
                  <View style={styles.tripMetaRow}>
                    <Ionicons name="time-outline" size={16} color={colors.slate} />
                    <Text style={styles.tripMetaText}>
                      {b.date} at {b.time} {b.driverName ? `· Driver: ${b.driverName}` : '· Driver: Unassigned'}
                    </Text>
                  </View>
                  {!b.driverId ? (
                    <Button
                      small
                      variant="dark"
                      title="Assign Driver Now"
                      onPress={() => navigation.navigate('Tabs', { screen: 'Trips' })}
                      style={{ marginTop: space.sm }}
                    />
                  ) : null}
                </Card>
              ))
            )}
          </View>

          {/* Right Column: Operational Quick Actions & Compliance */}
          <View style={[styles.sidebarCol, isDesktop && { flex: 1 }]}>
            <Text style={styles.sectionTitle}>Operations Console</Text>
            <View style={styles.actions}>
              <Action icon="pricetags-outline" label="Open Market" hint="Bid & accept" onPress={() => navigation.navigate('Tabs', { screen: 'Market' })} />
              <Action icon="navigate-outline" label="Trip Dispatch" hint="Assign fleet" onPress={() => navigation.navigate('Tabs', { screen: 'Trips' })} />
              <Action icon="car-outline" label="Add Vehicle" hint="Registration & RC" onPress={() => navigation.navigate('Tabs', { screen: 'Fleet' })} />
              <Action icon="person-add-outline" label="Invite Driver" hint="Onboard crew" onPress={() => navigation.navigate('Drivers')} />
              <Action icon="wallet-outline" label="Payouts" hint="Settlement" onPress={() => navigation.navigate('Wallet')} />
              <Action icon="document-text-outline" label="Compliance" hint="Certificates" onPress={() => navigation.navigate('Documents')} />
            </View>

            {/* Document Compliance Monitor */}
            <Card style={styles.complianceCard}>
              <View style={styles.complianceHead}>
                <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
                <Text style={styles.complianceTitle}>Fleet Health & Compliance</Text>
              </View>
              {expiring.length === 0 ? (
                <Text style={styles.complianceGood}>All vehicle permits, fitness and insurance certificates are up to date.</Text>
              ) : (
                <View style={{ gap: 6, marginTop: space.xs }}>
                  {expiring.slice(0, 3).map((item, idx) => (
                    <Text key={idx} style={styles.complianceWarn}>
                      ⚠️ {item.vehicle}: {item.label} expires in {item.days} days
                    </Text>
                  ))}
                  <Button
                    small
                    variant="ghost"
                    title="Review Documents →"
                    onPress={() => navigation.navigate('Documents')}
                    style={{ alignSelf: 'flex-start', marginTop: 4 }}
                  />
                </View>
              )}
            </Card>
          </View>
        </DesktopRow>
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ icon, label, hint, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed, hovered }: any) => [
        styles.action,
        hovered && { borderColor: colors.primary, backgroundColor: '#F8FAFC' },
        pressed && { opacity: 0.8 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={24} color={colors.primary} />
      <Text style={styles.actionText}>{label}</Text>
      {hint ? <Text style={styles.actionHint}>{hint}</Text> : null}
    </Pressable>
  );
}

function Stat({ label, value, accent, onPress }: { label: string; value: string; accent?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      style={({ pressed, hovered }: any) => [
        styles.stat,
        hovered && onPress && { borderColor: colors.primary },
        pressed && onPress && { opacity: 0.85 },
      ]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.statValue, accent && { color: colors.success }]} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, paddingBottom: space.xxl },
  dashboardRow: { alignItems: 'flex-start', marginTop: space.lg },
  mainCol: { width: '100%' },
  sidebarCol: { width: '100%' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: space.sm },
  viewAllText: { fontSize: 14, fontWeight: '800', color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  stat: {
    flexGrow: 1,
    flexBasis: 160,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.lg,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)' as any,
  },
  statLabel: { fontSize: 11, fontWeight: '800', color: colors.slate, letterSpacing: 0.5 },
  statValue: { fontSize: 24, fontWeight: '900', color: colors.ink, marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  action: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)' as any,
  },
  actionText: { fontSize: 14, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  actionHint: { fontSize: 11, color: colors.slate, textAlign: 'center' },
  tripCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.sm,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)' as any,
  },
  tripHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  tripIdText: { fontSize: 12, fontWeight: '800', color: colors.slate },
  tripRouteText: { fontSize: 16, fontWeight: '800', color: colors.ink, marginVertical: 4 },
  tripMetaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 2 },
  tripMetaText: { fontSize: 13, color: colors.slate },
  complianceCard: {
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)' as any,
  },
  complianceHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  complianceTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  complianceGood: { fontSize: 13, color: colors.slate, lineHeight: 18 },
  complianceWarn: { fontSize: 13, color: colors.warning, fontWeight: '600', lineHeight: 18 },
});

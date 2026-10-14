// Choose your ride — step 2 of 3: every bookable category priced for this
// route (same engine and adjustment as the booking server), with what the
// package includes and what is billed separately.
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView, Content, DesktopRow } from '../components/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Notice } from '../components/ui';
import { StepHeader } from '../components/brand';
import { DesktopHeader } from '../components/DesktopHeader';
import { FareLines } from '../components/FareLines';
import { useBookingDraft } from '../context/BookingDraft';
import { getRoute } from '../services/geoService';
import { calculateFare, isOutstation } from '../services/pricingService';
import { buildFareBreakup } from '../utils/fareBreakup';
import { inclusionLine } from '../utils/bookingRules';
import { SUPPORT_PHONE_DISPLAY } from '../config/constants';
import type { FareBreakdown } from '../types';
import { formatDate, formatDistance, formatDuration, formatINR, formatTime } from '../utils/format';
import { colors, radius, space } from '../theme';
import { useResponsive } from '../theme/responsive';

export function ChooseRideScreen() {
  const { isDesktop, isCompact, width } = useResponsive();
  const narrow = width < 360;
  const navigation = useNavigation();
  const { draft, update, route, setRoute, routeKey, categories, categoryStatus, adjustment } = useBookingDraft();
  const { pickup, drop, tripType, scheduledAt, categoryId } = draft;
  const [showFare, setShowFare] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!pickup || !drop || route) return undefined;
    const controller = new AbortController();
    getRoute(pickup, drop, controller.signal)
      .then((r) => !controller.signal.aborted && setRoute(routeKey, r))
      .catch(() => !controller.signal.aborted && setRouteError('We couldn’t calculate the route. Check your connection and try again.'));
    return () => controller.abort();
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps -- routeKey encodes both endpoints

  if (!pickup || !drop) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.pad}>
          <StepHeader title="Choose your ride" step={2} onBack={() => navigation.goBack()} />
          <Notice message="Set your pickup and destination first." />
        </View>
      </SafeAreaView>
    );
  }

  const pickupTime = scheduledAt ?? new Date(now);
  const quotes = new Map<string, FareBreakdown>();
  if (route) for (const c of categories) quotes.set(c.id, calculateFare({ category: c, route, tripType, pickupTime, adjustment }));
  const category = categories.find((c) => c.id === categoryId) ?? null;
  const quote = category ? (quotes.get(category.id) ?? null) : null;
  const outstation = route ? isOutstation(route.distanceKm) : false;
  const tooFar = route ? route.distanceKm > 1500 : false;
  const categoryNotice =
    categoryStatus === 'unavailable'
      ? `Online booking isn’t available right now. Please call ${SUPPORT_PHONE_DISPLAY} to book.`
      : categoryStatus === 'error'
        ? 'We couldn’t load ride types. Check your connection and try again.'
        : '';
  const canContinue = !!route && !!quote && !tooFar && !categoryNotice;

  const fareBreakdown = category && quote ? buildFareBreakup(category, quote, outstation) : null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <DesktopHeader
        title="Choose Your Ride"
        subtitle="Select the best vehicle class for your journey"
        badge="Step 2 of 3"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.pad}>
        {isCompact ? <StepHeader title="Choose your ride" step={2} onBack={() => navigation.goBack()} /> : null}

        <DesktopRow gap={24} style={styles.contentRow}>
          {/* Left Column: Route Summary & Vehicle Choices */}
          <View style={[styles.mainCol, isDesktop && { flex: 1.4 }]}>
            <View style={styles.summary}>
              <View style={styles.summaryRoute}>
                <Ionicons name="location-outline" size={24} color={colors.primary} />
                <Text style={styles.summaryPlace} numberOfLines={2}>
                  {pickup.name}
                </Text>
                <Ionicons name="arrow-forward" size={20} color={colors.ink} />
                <Text style={styles.summaryPlace} numberOfLines={2}>
                  {drop.name}
                </Text>
              </View>
              <Text style={styles.summaryMeta}>
                {scheduledAt ? `${formatDate(scheduledAt)} · ${formatTime(scheduledAt)}` : 'Today · Now'} · {tripType}
              </Text>
              {route ? (
                <Text style={styles.summaryMeta}>
                  {formatDistance(route.distanceKm)} · about {formatDuration(route.durationMin)}
                  {route.estimated ? ' · straight-line estimate' : ''}
                  {outstation ? ' · Outstation' : ''}
                </Text>
              ) : null}
            </View>

            {routeError ? <Notice message={routeError} /> : null}
            {!route && !routeError ? <Text style={styles.muted}>Calculating route and fares…</Text> : null}
            {tooFar ? <Notice message={`That trip is too long to book online — please call ${SUPPORT_PHONE_DISPLAY}.`} /> : null}
            {categoryNotice ? <Notice tone={categoryStatus === 'error' ? 'error' : 'warning'} message={categoryNotice} /> : null}
            {categoryStatus === 'loading' ? <Text style={styles.muted}>Loading ride types…</Text> : null}
            {adjustment ? (
              <Text style={styles.muted}>
                {adjustment.name}: fares include a {adjustment.percent}% {adjustment.direction === 'increase' ? 'increase' : 'reduction'}.
              </Text>
            ) : null}

            <Text style={styles.sectionTitle}>Available Vehicle Classes</Text>
            <View accessibilityRole="radiogroup">
              {categories.map((c) => {
                const q = quotes.get(c.id);
                const selected = c.id === categoryId;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => update({ categoryId: c.id })}
                    style={({ pressed, hovered }: any) => [
                      styles.car,
                      narrow && styles.carNarrow,
                      selected && styles.carOn,
                      hovered && !selected && styles.carHovered,
                      pressed && { opacity: 0.9 },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${c.name}, ${c.seats} passengers, ${q ? formatINR(q.total) : 'fare loading'}`}
                  >
                    {c.imageUrl ? (
                      <Image source={{ uri: c.imageUrl }} style={[styles.carImg, narrow && styles.carImgNarrow]} resizeMode="contain" />
                    ) : (
                      <View style={[styles.carImg, narrow && styles.carImgNarrow, styles.carIcon]}>
                        <Ionicons name={c.seats > 7 ? 'bus' : 'car-sport'} size={narrow ? 30 : 44} color={selected ? colors.primary : colors.slate} />
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.carName, narrow && styles.carNameNarrow]} numberOfLines={1}>
                          {c.name}
                        </Text>
                        {selected ? <View style={styles.selectedPill}><Text style={styles.selectedPillText}>Selected</Text></View> : null}
                      </View>
                      <Text style={styles.carSeats}>{c.seats} passengers · Air Conditioned</Text>
                    </View>
                    <View style={styles.carRight}>
                      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={selected ? colors.primary : colors.faint} />
                      <Text style={styles.carFare}>{q ? formatINR(q.total) : '—'}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {category ? (
              <View style={styles.infoRow}>
                <Ionicons name="information-circle-outline" size={22} color={colors.slate} />
                <Text style={styles.infoText}>{inclusionLine(category, outstation) || 'Fare as per the route distance'}</Text>
              </View>
            ) : null}

            {/* Mobile collapsible fare card */}
            {quote && category && isCompact ? (
              <View style={styles.fareBox}>
                <Pressable onPress={() => setShowFare((s) => !s)} style={styles.fareHead} accessibilityRole="button" accessibilityState={{ expanded: showFare }}>
                  <Ionicons name="document-text-outline" size={22} color={colors.ink} />
                  <Text style={styles.fareTitle}>Fare details</Text>
                  <Ionicons name={showFare ? 'chevron-up' : 'chevron-down'} size={22} color={colors.slate} />
                </Pressable>
                {showFare && fareBreakdown ? (
                  <View style={{ marginTop: space.md }}>
                    <FareLines lines={fareBreakdown.lines} total={quote.total} estimated />
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Right Column: Desktop Fare Summary & Action Pane */}
          {isDesktop ? (
            <View style={styles.desktopSidebarCol}>
              <View style={styles.desktopCheckoutCard}>
                <Text style={styles.checkoutTitle}>Fare Summary</Text>
                {category ? (
                  <View style={styles.checkoutCategoryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.checkoutCategoryName}>{category.name}</Text>
                      <Text style={styles.checkoutCategoryMeta}>{category.seats} seats · {tripType}</Text>
                    </View>
                    <Text style={styles.checkoutTotal}>{quote ? formatINR(quote.total) : '—'}</Text>
                  </View>
                ) : (
                  <Text style={styles.muted}>Select a vehicle above to see the price breakdown.</Text>
                )}

                {quote && category && fareBreakdown ? (
                  <View style={styles.checkoutLinesWrapper}>
                    <FareLines lines={fareBreakdown.lines} total={quote.total} estimated />
                  </View>
                ) : null}

                <View style={styles.checkoutFeatures}>
                  <View style={styles.featureItem}>
                    <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                    <Text style={styles.featureText}>Verified Drivers & Clean Vehicles</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="time" size={18} color={colors.primary} />
                    <Text style={styles.featureText}>Transparent distance billing, no surge</Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => canContinue && navigation.navigate('ConfirmBooking')}
                  disabled={!canContinue}
                  style={({ pressed, hovered }: any) => [
                    styles.desktopContinueBtn,
                    !canContinue && { opacity: 0.45 },
                    hovered && canContinue && { backgroundColor: colors.primaryDark },
                    pressed && canContinue && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canContinue }}
                >
                  <Text style={styles.desktopContinueText}>Proceed to Review</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.white} />
                </Pressable>
              </View>
            </View>
          ) : null}
        </DesktopRow>
      </ScrollView>

      {/* Floating Bottom Bar only on mobile/compact */}
      {isCompact ? (
        <View style={styles.bottomBarWrap}>
          <Content style={styles.bottomBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.estLabel}>Estimated fare</Text>
              <Text style={styles.estValue}>{quote ? formatINR(quote.total) : '—'}</Text>
            </View>
            <Pressable
              onPress={() => canContinue && navigation.navigate('ConfirmBooking')}
              disabled={!canContinue}
              style={({ pressed }) => [styles.continue, !canContinue && { opacity: 0.45 }, pressed && { backgroundColor: colors.primaryDark }]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canContinue }}
            >
              <Text style={styles.continueText}>Continue</Text>
              <Ionicons name="arrow-forward" size={22} color={colors.white} />
            </Pressable>
          </Content>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  pad: { paddingHorizontal: space.lg, paddingBottom: space.xxl, paddingTop: space.md },
  contentRow: { alignItems: 'flex-start' },
  mainCol: { width: '100%' },
  desktopSidebarCol: { flex: 1, minWidth: 320 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: space.md, marginTop: space.sm },
  muted: { fontSize: 14, color: colors.slate, marginBottom: space.md },
  summary: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: space.lg,
    marginBottom: space.lg,
    gap: 6,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)' as any,
  },
  summaryRoute: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  summaryPlace: { fontSize: 18, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  summaryMeta: { fontSize: 15, color: colors.slate, marginLeft: 32 },
  car: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: space.md,
    marginBottom: space.md,
    minHeight: 96,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)' as any,
  },
  carOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  carHovered: { borderColor: colors.slate, backgroundColor: '#F8FAFC' },
  carNarrow: { padding: space.sm, gap: space.sm, minHeight: 84 },
  carImg: { width: 96, height: 64 },
  carImgNarrow: { width: 56, height: 40 },
  carNameNarrow: { fontSize: 16 },
  carIcon: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: '#F1F5F9' },
  carName: { fontSize: 18, fontWeight: '800', color: colors.ink },
  selectedPill: { backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  selectedPillText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  carSeats: { fontSize: 14, color: colors.slate, marginTop: 4 },
  carRight: { alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch', gap: space.sm },
  carFare: { fontSize: 20, fontWeight: '900', color: colors.ink },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: space.sm },
  infoText: { fontSize: 14, color: colors.slate, flex: 1 },
  fareBox: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, padding: space.lg, marginTop: space.sm },
  fareHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  fareTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.ink },
  desktopCheckoutCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: space.xl,
    boxShadow: '0 4px 16px rgba(0,0,0,0.06)' as any,
  },
  checkoutTitle: { fontSize: 20, fontWeight: '900', color: colors.ink, marginBottom: space.md },
  checkoutCategoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  checkoutCategoryName: { fontSize: 18, fontWeight: '800', color: colors.ink },
  checkoutCategoryMeta: { fontSize: 14, color: colors.slate, marginTop: 2 },
  checkoutTotal: { fontSize: 26, fontWeight: '900', color: colors.primary },
  checkoutLinesWrapper: { marginVertical: space.md },
  checkoutFeatures: { backgroundColor: '#F8FAFC', borderRadius: radius.md, padding: space.md, gap: space.sm, marginVertical: space.md },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  featureText: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  desktopContinueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    marginTop: space.sm,
  },
  desktopContinueText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  bottomBarWrap: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  estLabel: { fontSize: 14, color: colors.slate },
  estValue: { fontSize: 26, fontWeight: '900', color: colors.ink },
  continue: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: space.xl, minHeight: 56 },
  continueText: { color: colors.white, fontSize: 19, fontWeight: '800' },
});

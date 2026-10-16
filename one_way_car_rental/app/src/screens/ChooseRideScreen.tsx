// Choose your ride — step 2 of 3: Cab types with transparent outstation pricing.
// Mobile-first world-class layout with official Nesam vehicle cards and no desktop elements.
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Notice } from '../components/ui';
import { ScrollView } from '../components/layout';
import { StepHeader, getVehicleImage } from '../components/brand';
import { FareLines } from '../components/FareLines';
import { useBookingDraft } from '../context/BookingDraft';
import { getRoute } from '../services/geoService';
import { calculateFare, isOutstation } from '../services/pricingService';
import { buildFareBreakup } from '../utils/fareBreakup';
import { inclusionLine } from '../utils/bookingRules';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import type { FareBreakdown, RideCategory } from '../types';
import { formatDate, formatDistance, formatDuration, formatINR, formatTime } from '../utils/format';
import { colors, fonts, radius, space } from '../theme';

// Standard fallback categories strictly following NTT / DEV-SPEC 2.0 & NESAM-ADD-001
const SPEC_DEFAULT_CATEGORIES: RideCategory[] = [
  {
    id: 'cat-sedan',
    name: 'Sedan',
    description: 'Swift Dzire, Toyota Etios or similar',
    seats: 4,
    displayOrder: 1,
    matchVehicleTypes: ['sedan', 'dzire', 'etios'],
    fare: {
      baseFare: 0,
      baseKm: 0,
      perKmRate: 15,
      perMinuteRate: 0,
      minimumFare: 1950,
      nightCharge: 0,
      driverAllowance: 400,
      outstationPerKmRate: 15,
      extras: { waitingPerHour: 0, extraKmRate: 15, tollIncluded: false, parkingIncluded: false, permitCharge: 0, carrierCharge: 400 },
    },
  },
  {
    id: 'cat-suv-6',
    name: 'SUV (6+1)',
    description: 'Maruti Ertiga, Mahindra Marazzo (6 Passengers)',
    seats: 6,
    displayOrder: 2,
    matchVehicleTypes: ['suv', 'ertiga', 'marazzo'],
    fare: {
      baseFare: 0,
      baseKm: 0,
      perKmRate: 20,
      perMinuteRate: 0,
      minimumFare: 2600,
      nightCharge: 0,
      driverAllowance: 400,
      outstationPerKmRate: 20,
      extras: { waitingPerHour: 0, extraKmRate: 20, tollIncluded: false, parkingIncluded: false, permitCharge: 0, carrierCharge: 400 },
    },
  },
  {
    id: 'cat-suv-7',
    name: 'SUV (7+1)',
    description: 'Mahindra Scorpio, Bolero Neo (7 Passengers)',
    seats: 7,
    displayOrder: 3,
    matchVehicleTypes: ['suv', 'scorpio', 'bolero'],
    fare: {
      baseFare: 0,
      baseKm: 0,
      perKmRate: 20,
      perMinuteRate: 0,
      minimumFare: 2600,
      nightCharge: 0,
      driverAllowance: 400,
      outstationPerKmRate: 20,
      extras: { waitingPerHour: 0, extraKmRate: 20, tollIncluded: false, parkingIncluded: false, permitCharge: 0, carrierCharge: 400 },
    },
  },
  {
    id: 'cat-innova',
    name: 'Innova',
    description: 'Toyota Innova (Spacious highway comfort, 7 Seater)',
    seats: 7,
    displayOrder: 4,
    matchVehicleTypes: ['innova'],
    fare: {
      baseFare: 0,
      baseKm: 0,
      perKmRate: 20,
      perMinuteRate: 0,
      minimumFare: 2600,
      nightCharge: 0,
      driverAllowance: 400,
      outstationPerKmRate: 20,
      extras: { waitingPerHour: 0, extraKmRate: 20, tollIncluded: false, parkingIncluded: false, permitCharge: 0, carrierCharge: 400 },
    },
  },
  {
    id: 'cat-crysta',
    name: 'Innova Crysta',
    description: 'Executive Luxury MPV, Premium Highway Chauffeur',
    seats: 7,
    displayOrder: 5,
    matchVehicleTypes: ['crysta', 'innova crysta'],
    fare: {
      baseFare: 0,
      baseKm: 0,
      perKmRate: 26,
      perMinuteRate: 0,
      minimumFare: 3380,
      nightCharge: 0,
      driverAllowance: 600,
      outstationPerKmRate: 26,
      extras: { waitingPerHour: 0, extraKmRate: 26, tollIncluded: false, parkingIncluded: false, permitCharge: 0, carrierCharge: 400 },
    },
  },
];

export function ChooseRideScreen() {
  const navigation = useNavigation();
  const { draft, update, route, setRoute, routeKey, categories: firestoreCats, categoryStatus, adjustment, serverQuote } = useBookingDraft();
  const { pickup, drop, tripType, scheduledAt, categoryId } = draft;
  const [expandedFareId, setExpandedFareId] = useState<string | null>(null);
  const [routeError, setRouteError] = useState('');
  const [now] = useState(() => Date.now());

  // Use firestore categories if available, otherwise use strict PDF-spec fallback
  const displayCategories = useMemo(() => {
    return firestoreCats.length > 0 ? firestoreCats : SPEC_DEFAULT_CATEGORIES;
  }, [firestoreCats]);

  useEffect(() => {
    if (!pickup || !drop || route) return undefined;
    const controller = new AbortController();
    getRoute(pickup, drop, controller.signal)
      .then((r) => !controller.signal.aborted && setRoute(routeKey, r))
      .catch(() => !controller.signal.aborted && setRouteError('Could not calculate driving distance. Check internet connection.'));
    return () => controller.abort();
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default auto-select first category if none selected
  useEffect(() => {
    if (!categoryId && displayCategories.length > 0) {
      update({ categoryId: displayCategories[0]!.id });
    }
  }, [categoryId, displayCategories, update]);

  if (!pickup || !drop) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.pad}>
          <StepHeader title="Choose your cab" step={2} onBack={() => navigation.goBack()} />
          <Notice message="Please set your pickup and destination locations first." />
        </View>
      </SafeAreaView>
    );
  }

  const pickupTime = scheduledAt ?? new Date(now);
  // The booking server's quotes are the fares. The local calculation is only an estimate shown
  // while they load, and can never be continued with.
  const server = serverQuote.status === 'ready' ? serverQuote.data : null;
  const quotes = new Map<string, FareBreakdown>();
  if (server) {
    for (const x of server.quotes) if (x.ok && x.fare) quotes.set(x.categoryId, x.fare);
  } else if (route) {
    for (const c of displayCategories) {
      quotes.set(c.id, calculateFare({ category: c, route, tripType, pickupTime, adjustment }));
    }
  }

  const selectedCategory = displayCategories.find((c) => c.id === categoryId) ?? displayCategories[0] ?? null;
  const selectedQuote = selectedCategory ? quotes.get(selectedCategory.id) ?? null : null;
  const outstation = route ? isOutstation(route.distanceKm) : true;
  const tooFar = route ? route.distanceKm > 1500 : false;
  const canContinue = !!route && !!selectedQuote && !tooFar && !!server && !!server.quotes.find((x) => x.categoryId === selectedCategory?.id && x.ok);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Mobile Step Header */}
      <StepHeader title="Choose Your Cab" step={2} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollPad}>
        {/* Route Summary Card */}
        <View style={styles.routeSummaryCard}>
          <View style={styles.routeEndpointsRow}>
            <View style={styles.routePointWrap}>
              <View style={[styles.endpointDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.routeEndpointText} numberOfLines={1}>
                {pickup.name}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.slate} style={{ marginHorizontal: 4 }} />
            <View style={styles.routePointWrap}>
              <View style={[styles.endpointDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.routeEndpointText} numberOfLines={1}>
                {drop.name}
              </Text>
            </View>
          </View>

          <View style={styles.routeMetaRow}>
            <View style={styles.routeMetaItem}>
              <Ionicons name="calendar-outline" size={13} color={colors.slate} />
              <Text style={styles.routeMetaText}>
                {scheduledAt ? `${formatDate(scheduledAt)} · ${formatTime(scheduledAt)}` : 'Pickup time not chosen'}
              </Text>
            </View>
            <View style={styles.routeMetaDot} />
            <View style={styles.routeMetaItem}>
              <Ionicons name="car-outline" size={13} color={colors.primary} />
              <Text style={[styles.routeMetaText, { color: colors.primary, fontFamily: fonts.bold, fontWeight: '700' }]}>{tripType}</Text>
            </View>
            {route ? (
              <>
                <View style={styles.routeMetaDot} />
                <View style={styles.routeMetaItem}>
                  <Ionicons name="speedometer-outline" size={13} color={colors.slate} />
                  <Text style={styles.routeMetaText}>{formatDistance(route.distanceKm)}</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {routeError ? <Notice message={routeError} tone="error" style={{ marginBottom: space.sm }} /> : null}
        {!route && !routeError ? (
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>Calculating best driving route and tariffs…</Text>
          </View>
        ) : null}

        {/* Vehicle Selection Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Available Cabs</Text>
          <Text style={styles.sectionSub}>All inclusive • No hidden surge</Text>
        </View>

        {/* Vehicle Cards List */}
        <View style={styles.carsList} accessibilityRole="radiogroup">
          {displayCategories.map((c) => {
            const q = quotes.get(c.id);
            const isSelected = c.id === (selectedCategory?.id ?? '');
            const isExpanded = expandedFareId === c.id;
            const fareBreakdown = q ? buildFareBreakup(c, q, outstation) : null;
            const vehicleImage = getVehicleImage(c.name);

            return (
              <Pressable
                key={c.id}
                onPress={() => update({ categoryId: c.id })}
                style={[styles.carCard, isSelected && styles.carCardSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                {/* Popular or Luxury badge */}
                {c.name.includes('Sedan') ? (
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagBadgeText}>MOST POPULAR</Text>
                  </View>
                ) : c.name.includes('Crysta') ? (
                  <View style={[styles.tagBadge, { backgroundColor: '#1E293B' }]}>
                    <Text style={styles.tagBadgeText}>EXECUTIVE LUXURY</Text>
                  </View>
                ) : null}

                <View style={styles.carTopRow}>
                  {/* Vehicle Image */}
                  <Image source={vehicleImage} style={styles.carImage} resizeMode="contain" />

                  {/* Vehicle Details */}
                  <View style={styles.carInfoCol}>
                    <Text style={styles.carName}>{c.name}</Text>
                    <Text style={styles.carModels} numberOfLines={1}>
                      {c.description || (c.name.includes('Sedan') ? 'Swift Dzire, Toyota Etios' : 'Air Conditioned Highway Cab')}
                    </Text>

                    <View style={styles.specsRow}>
                      <View style={styles.specBadge}>
                        <Ionicons name="people" size={12} color={colors.ink} />
                        <Text style={styles.specText}>{c.seats} Seats</Text>
                      </View>
                      <View style={styles.specBadge}>
                        <Ionicons name="briefcase" size={12} color={colors.ink} />
                        <Text style={styles.specText}>{c.seats > 4 ? '4 Bags' : '2 Bags'}</Text>
                      </View>
                      <View style={styles.specBadge}>
                        <Ionicons name="snow" size={12} color="#0284C7" />
                        <Text style={styles.specText}>AC</Text>
                      </View>
                    </View>
                  </View>

                  {/* Price & Radio Check */}
                  <View style={styles.priceCol}>
                    <Text style={styles.carPrice}>{q ? formatINR(q.total) : '…'}</Text>
                    <Text style={styles.perKmHint}>₹{c.fare.perKmRate}/km</Text>
                    <View style={styles.radioWrap}>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={isSelected ? colors.primary : '#CBD5E1'}
                      />
                    </View>
                  </View>
                </View>

                {/* Inclusions Line & Fare Breakdown Toggle */}
                <View style={styles.carFooterRow}>
                  <Text style={styles.inclusionSummary} numberOfLines={1}>
                    ✓ Includes fuel, {formatDistance(q?.distanceKm || 130)} & driver bata
                  </Text>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      setExpandedFareId(isExpanded ? null : c.id);
                    }}
                    style={styles.detailsToggle}
                  >
                    <Text style={styles.detailsToggleText}>{isExpanded ? 'Hide' : 'Fare details'}</Text>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
                  </Pressable>
                </View>

                {/* Expandable Fare Breakdown */}
                {isExpanded && fareBreakdown && q ? (
                  <View style={styles.expandedBreakup}>
                    <FareLines lines={fareBreakdown.lines} total={q.total} estimated />
                    <Text style={styles.fareNote}>
                      Note: Tolls, state permits and parking charges are payable directly to the chauffeur against official receipts.
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Bottom space for sticky footer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky Bottom Confirmation Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.selectedRecapCol}>
          <Text style={styles.recapCabName}>{selectedCategory?.name || 'Selected Cab'}</Text>
          <Text style={styles.recapFare}>{selectedQuote ? formatINR(selectedQuote.total) : '—'}</Text>
          <Text style={styles.recapGst}>Includes taxes & driver bata</Text>
        </View>

        <Pressable
          onPress={() => canContinue && navigation.navigate('ConfirmBooking')}
          disabled={!canContinue}
          style={({ pressed }) => [
            styles.continueBtn,
            !canContinue && { opacity: 0.5 },
            pressed && { backgroundColor: '#B71C1C' },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Proceed to Booking Confirmation"
        >
          <Text style={styles.continueBtnText}>Proceed to Book</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  pad: {
    padding: space.md,
  },
  scrollPad: {
    padding: space.md,
    paddingTop: space.xs,
  },
  routeSummaryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: space.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: space.sm,
  },
  routeEndpointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  routePointWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  endpointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeEndpointText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  routeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  routeMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
  routeMetaText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.slate,
  },
  loadingBox: {
    backgroundColor: '#FEF2F2',
    padding: space.sm,
    borderRadius: radius.md,
    marginBottom: space.sm,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.primary,
  },
  sectionHeaderRow: {
    marginBottom: space.xs,
    marginTop: space.xs,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
  },
  sectionSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.slate,
  },
  carsList: {
    gap: 12,
    marginTop: space.xs,
  },
  carCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: space.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  carCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFFBFA',
  },
  tagBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomRightRadius: radius.md,
    zIndex: 2,
  },
  tagBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.white,
    letterSpacing: 0.5,
  },
  carTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  carImage: {
    width: 80,
    height: 52,
  },
  carInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  carName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
  },
  carModels: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.slate,
    marginTop: 1,
  },
  specsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  specBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  specText: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.ink,
  },
  priceCol: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  carPrice: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.ink,
  },
  perKmHint: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.slate,
    marginTop: 1,
  },
  radioWrap: {
    marginTop: 4,
  },
  carFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  inclusionSummary: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: '#059669',
    flex: 1,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  detailsToggleText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.primary,
  },
  expandedBreakup: {
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  fareNote: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.slate,
    marginTop: space.sm,
    lineHeight: 15,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  selectedRecapCol: {
    flex: 1,
  },
  recapCabName: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.slate,
  },
  recapFare: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.ink,
    lineHeight: 24,
  },
  recapGst: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: '#10B981',
  },
  continueBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  continueBtnText: {
    fontFamily: fonts.bold,
    color: colors.white,
    fontSize: 14,
  },
});

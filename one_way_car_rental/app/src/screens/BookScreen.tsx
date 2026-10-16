// Booking Home — Step 1: Clean, modern, high-conversion mobile booking screen for one_way_car_rental.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Notice } from '../components/ui';
import { ScrollView } from '../components/layout';
import { MobileBrandHeader } from '../components/brand';
import { PlaceSearchModal } from '../components/PlaceSearchModal';
import { useCustomerData } from '../context/CustomerData';
import { useBookingDraft } from '../context/BookingDraft';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { LOCATION_ERROR_TEXT, reverseGeocode } from '../services/geoService';
import { SCHEDULE_MAX_DAYS, SCHEDULE_MIN_LEAD_MIN, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { scheduleProblem } from '../utils/bookingRules';
import { POPULAR_AIRPORTS, makeLocalDisposalPlace } from '../services/pricingService';
import type { GeoPlace, TripType } from '../types';
import { formatDate, formatTime } from '../utils/format';
import { haversineKm, isValidLatLng } from '../utils/geo';
import { colors, fonts, radius, space } from '../theme';
import { FEATURES, HEROES, ILLUSTRATIONS, getRouteImage } from '../assets/images';

type PickerTarget = { field: 'pickup' | 'drop'; query?: string } | null;

const TRIP_TYPE_OPTIONS: { id: TripType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'One Way', label: 'One Way', icon: 'arrow-forward-outline' },
  { id: 'Round Trip', label: 'Round Trip', icon: 'repeat-outline' },
  { id: 'Local Rental', label: 'Local Rental', icon: 'time-outline' },
  { id: 'Airport Taxi', label: 'Airport Taxi', icon: 'airplane-outline' },
];

const POPULAR_ROUTES: { from: string; to: string; distance: string }[] = [
  { from: 'Chennai', to: 'Puducherry', distance: '150 km' },
  { from: 'Chennai', to: 'Bengaluru', distance: '350 km' },
  { from: 'Chennai', to: 'Tirupati', distance: '135 km' },
  { from: 'Coimbatore', to: 'Ooty', distance: '85 km' },
  { from: 'Madurai', to: 'Rameshwaram', distance: '175 km' },
  { from: 'Madurai', to: 'Kodaikanal', distance: '120 km' },
  { from: 'Chennai', to: 'Tiruchirappalli', distance: '330 km' },
];

const FEATURES_LIST = [
  {
    image: FEATURES.cleanAc,
    title: 'Sanitized AC Cabs',
    desc: 'Deep cleaned, sanitized and inspected before every outstation journey.',
  },
  {
    image: FEATURES.chauffeur,
    title: 'Verified Highway Chauffeurs',
    desc: 'Experienced drivers with police verification and commercial badge.',
  },
  {
    image: FEATURES.transparentFare,
    title: 'Transparent Fixed Fares',
    desc: 'No hidden surge pricing. Clear per-km outstation rates and driver allowances.',
  },
  {
    image: FEATURES.support,
    title: '24×7 Active Trip Support',
    desc: 'Live helpline and safety assistance available around the clock.',
  },
];

export function BookScreen() {
  const navigation = useNavigation();
  const { profile, trips, liveRide, savedPlaces } = useCustomerData();
  const { draft, update } = useBookingDraft();
  const { pickup, drop, tripType, scheduledAt } = draft;
  const { position, error: locError, permission, locating, locate } = useDeviceLocation(true);
  const { online } = useNetworkStatus();
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [problem, setProblem] = useState('');
  const [returnDate, setReturnDate] = useState<Date | null>(() => {
    const base = scheduledAt ?? new Date();
    const next = new Date(base);
    next.setDate(next.getDate() + 1);
    return next;
  });

  // Automatically geocode device GPS to pickup unless already chosen
  const pickupFromGps = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!position || pickupFromGps.current || pickup) return;
    pickupFromGps.current = true;
    void reverseGeocode(position).then((p) => {
      if (mounted.current) update((d) => (d.pickup ? {} : { pickup: { ...p, type: 'current' } }));
    });
  }, [position, pickup, update]);

  const recentPlaces = useMemo(() => {
    const seen = new Set<string>();
    const out: GeoPlace[] = [];
    for (const t of trips) {
      for (const p of [t.drop, t.pickup]) {
        if (!isValidLatLng(p) || seen.has(p.name)) continue;
        seen.add(p.name);
        out.push({ ...p, id: `recent-${t.id}-${p.id}`, type: 'recent' });
      }
    }
    return out.slice(0, 5);
  }, [trips]);

  const locateMe = async () => {
    const p = await locate();
    if (!p) return;
    const place = await reverseGeocode(p);
    if (mounted.current) {
      pickupFromGps.current = true;
      update({ pickup: { ...place, type: 'current' } });
    }
  };

  const openSchedulePicker = () => {
    const min = new Date(Date.now() + SCHEDULE_MIN_LEAD_MIN * 60000);
    const max = new Date(Date.now() + SCHEDULE_MAX_DAYS * 86400000);
    const initial = scheduledAt ?? new Date(Date.now() + 60 * 60000);
    try {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        minimumDate: min,
        maximumDate: max,
        onChange: (event, date) => {
          if (event.type !== 'set' || !date) return;
          DateTimePickerAndroid.open({
            value: initial,
            mode: 'time',
            is24Hour: false,
            onChange: (e2, time) => {
              if (e2.type !== 'set' || !time) return;
              const d = new Date(date);
              d.setHours(time.getHours(), time.getMinutes(), 0, 0);
              update({ scheduledAt: d });
              if (returnDate && returnDate <= d) {
                const next = new Date(d);
                next.setDate(next.getDate() + 1);
                setReturnDate(next);
              }
              setProblem(scheduleProblem(d));
            },
          });
        },
      });
    } catch {
      setProblem('Date & time selection is not available on this device.');
    }
  };

  const openReturnPicker = () => {
    const pickupInstant = scheduledAt ?? new Date();
    const min = new Date(pickupInstant);
    const max = new Date(Date.now() + SCHEDULE_MAX_DAYS * 86400000);
    const initial = returnDate ?? new Date(pickupInstant.getTime() + 86400000);
    try {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        minimumDate: min,
        maximumDate: max,
        onChange: (event, date) => {
          if (event.type !== 'set' || !date) return;
          setReturnDate(date);
        },
      });
    } catch {
      setProblem('Date picker is not available on this device.');
    }
  };

  // The end instant sent to the server: the chosen return date at 20:00 India time, never before the
  // pickup. Only the DATE is billed (calendar days), the time just plans the vehicle's schedule.
  useEffect(() => {
    if (tripType !== 'Round Trip' || !returnDate || !scheduledAt) {
      if (draft.tripEndAt) update({ tripEndAt: null });
      return;
    }
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(returnDate);
    const target = Date.parse(`${day}T20:00:00+05:30`);
    const dayEnd = Date.parse(`${day}T23:59:00+05:30`);
    const end = new Date(Math.min(dayEnd, Math.max(target, scheduledAt.getTime() + 15 * 60000)));
    if (draft.tripEndAt?.getTime() !== end.getTime()) update({ tripEndAt: end });
  }, [tripType, returnDate, scheduledAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const roundTripDays = useMemo(() => {
    if (tripType !== 'Round Trip') return 1;
    const start = scheduledAt ?? new Date();
    const end = returnDate ?? start;
    const sDate = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const eDate = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    const diffDays = Math.round((eDate - sDate) / 86400000);
    return Math.max(1, diffDays + 1);
  }, [tripType, scheduledAt, returnDate]);

  const findCab = () => {
    let targetDrop = drop;
    if (tripType === 'Local Rental' && !targetDrop && pickup) {
      targetDrop = makeLocalDisposalPlace(pickup);
      update({ drop: targetDrop });
    }
    const reason = !online
      ? 'You are currently offline. Check your network to proceed.'
      : !pickup
        ? 'Please choose your pickup point.'
        : !targetDrop
          ? 'Please choose your destination.'
          : haversineKm(pickup, targetDrop) < 0.2 && tripType !== 'Local Rental'
            ? 'Pickup and destination cannot be the same place.'
            : scheduleProblem(scheduledAt) || (tripType === 'Round Trip' && !draft.tripEndAt ? 'Choose your return date.' : '');
    setProblem(reason);
    if (!reason) {
      navigation.navigate('ChooseRide');
    }
  };

  const selectPopularRoute = (routeItem: { from: string; to: string }) => {
    update({
      pickup: { id: 'p-' + routeItem.from, name: routeItem.from, address: routeItem.from + ', Tamil Nadu, India', lat: 13.0827, lng: 80.2707, type: 'other' },
      drop: { id: 'd-' + routeItem.to, name: routeItem.to, address: routeItem.to + ', India', lat: 11.9416, lng: 79.8083, type: 'other' },
    });
    setProblem('');
  };

  const firstName = profile.name.split(' ')[0] || 'Traveler';
  const locationHint = locError ? LOCATION_ERROR_TEXT[locError.kind] : permission === 'prompt' && !position ? 'Allow location access to set your pickup location automatically.' : '';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <PlaceSearchModal
        visible={picker !== null}
        title={picker?.field === 'pickup' ? 'Enter Pickup Location' : 'Where are you travelling to?'}
        initialQuery={picker?.query}
        onClose={() => setPicker(null)}
        onSelect={(p) => {
          if (picker?.field === 'pickup') {
            pickupFromGps.current = true;
            update({ pickup: p });
          } else {
            update({ drop: p });
          }
          setProblem('');
        }}
        savedPlaces={savedPlaces}
        recentPlaces={recentPlaces}
        near={picker?.field === 'drop' ? (pickup ?? position) : position}
        onUseCurrentLocation={picker?.field === 'pickup' ? () => void locateMe() : undefined}
      />

      {/* Top Mobile Brand Header with one_way_car_rental */}
      <MobileBrandHeader />

      <ScrollView
        contentContainerStyle={styles.scrollPad}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Active Booking Banner */}
        {liveRide ? (
          <Pressable
            style={styles.liveBanner}
            onPress={() => navigation.navigate('ActiveRide', { bookingId: liveRide.id })}
            accessibilityRole="button"
          >
            <View style={styles.liveDot} />
            <Text style={styles.liveText} numberOfLines={1}>
              Active Booking: {liveRide.pickup.name} → {liveRide.drop.name}
            </Text>
            <Ionicons name="arrow-forward-circle" size={20} color={colors.white} />
          </Pressable>
        ) : null}

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <Image
            source={HEROES.mobile}
            style={styles.heroImage}
            resizeMode="cover"
            accessible={false}
            importantForAccessibility="no"
          />
          <View style={styles.heroOverlay}>
            <View style={styles.heroBadge}>
              <Ionicons name="shield-checkmark" size={12} color={colors.white} />
              <Text style={styles.heroBadgeText}>TAMIL NADU’S OUTSTATION NETWORK</Text>
            </View>
            <Text style={styles.heroTitle}>Safe Journey,{'\n'}Happy Memories</Text>
            <Text style={styles.heroSubtitle}>
              Verified Chauffeurs • Fixed Fares • 24×7 Support
            </Text>
          </View>
        </View>

        {/* User Greeting */}
        <View style={styles.greetingRow}>
          <Text style={styles.welcomeSub}>Hello {firstName}</Text>
          <Text style={styles.welcomeTitle}>Where would you like to travel?</Text>
        </View>

        {/* Unified Sleek Booking Card */}
        <View style={styles.bookingCard}>
          {/* Segmented Trip Type Toggle (All 4 supported types) */}
          <View style={styles.tripTypeGrid}>
            {TRIP_TYPE_OPTIONS.map((item) => {
              const active = tripType === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.gridSegmentBtn, active && styles.gridSegmentBtnActive]}
                  onPress={() => {
                    update({ tripType: item.id });
                    if (item.id === 'Local Rental' && pickup && !drop) {
                      update({ drop: makeLocalDisposalPlace(pickup) });
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Select trip type: ${item.label}`}
                >
                  <Ionicons
                    name={item.icon}
                    size={15}
                    color={active ? colors.white : colors.primary}
                  />
                  <Text style={[styles.gridSegmentText, active && styles.gridSegmentTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Contextual Airport Assistant when Airport Taxi is selected */}
          {tripType === 'Airport Taxi' ? (
            <View style={styles.airportHelperBox}>
              <View style={styles.helperHeader}>
                <Ionicons name="airplane" size={14} color={colors.primary} />
                <Text style={styles.helperTitle}>Airport Transfers • Quick Airport Select</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickAirportRow}>
                {POPULAR_AIRPORTS.slice(0, 5).map((air) => (
                  <Pressable
                    key={air.id}
                    style={styles.airportChip}
                    onPress={() => {
                      if (pickup?.type === 'airport') {
                        update({ drop: air });
                      } else {
                        update({ drop: air });
                      }
                      setProblem('');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${air.name}`}
                  >
                    <Ionicons name="airplane-outline" size={12} color={colors.primary} />
                    <Text style={styles.airportChipText}>{air.name.split(' ')[0]} ({air.id.replace('airport-', '').toUpperCase()})</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.airportDirectionRow}>
                <Pressable
                  style={[styles.dirBtn, drop?.type === 'airport' && styles.dirBtnActive]}
                  onPress={() => {
                    if (pickup?.type === 'airport' && drop) {
                      update({ pickup: drop, drop: pickup });
                    } else if (drop?.type !== 'airport') {
                      update({ drop: POPULAR_AIRPORTS[0] });
                    }
                  }}
                >
                  <Ionicons name="arrow-up-circle-outline" size={14} color={drop?.type === 'airport' ? colors.primary : colors.slate} />
                  <Text style={[styles.dirBtnText, drop?.type === 'airport' && styles.dirBtnTextActive]}>Drop to Airport</Text>
                </Pressable>
                <Pressable
                  style={[styles.dirBtn, pickup?.type === 'airport' && styles.dirBtnActive]}
                  onPress={() => {
                    if (drop?.type === 'airport' && pickup) {
                      update({ pickup: drop, drop: pickup });
                    } else if (pickup?.type !== 'airport') {
                      update({ pickup: POPULAR_AIRPORTS[0] });
                    }
                  }}
                >
                  <Ionicons name="arrow-down-circle-outline" size={14} color={pickup?.type === 'airport' ? colors.primary : colors.slate} />
                  <Text style={[styles.dirBtnText, pickup?.type === 'airport' && styles.dirBtnTextActive]}>Pickup from Airport</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* Contextual Local Rental Assistant when Local Rental is selected */}
          {tripType === 'Local Rental' ? (
            <View style={styles.rentalHelperBox}>
              <View style={styles.helperHeader}>
                <Ionicons name="time" size={14} color="#D97706" />
                <Text style={styles.helperTitle}>Hourly Local City Rental Package</Text>
              </View>
              <Text style={styles.rentalSubtitle}>
                Chauffeur and cab at your disposal for city use. Package base includes minimum hours & km.
              </Text>
              <View style={styles.quickChipsRow}>
                <Pressable
                  style={styles.rentalChip}
                  onPress={() => {
                    update({ drop: makeLocalDisposalPlace(pickup) });
                    setProblem('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Use local city disposal destination"
                >
                  <Ionicons name="location-outline" size={12} color="#D97706" />
                  <Text style={styles.rentalChipText}>Set Destination: Within City Disposal</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* Route Section: Connected Pickup & Drop */}
          <View style={styles.routeBox}>
            {/* Pickup Row */}
            <Pressable
              style={styles.locationRow}
              onPress={() => setPicker({ field: 'pickup' })}
              accessibilityRole="button"
              accessibilityLabel={`Pickup: ${pickup?.name ?? 'not set'}`}
            >
              <View style={styles.iconCircleGreen}>
                <Ionicons name="location" size={16} color="#10B981" />
              </View>
              <View style={styles.locationTextWrap}>
                <Text style={styles.inputMiniLabel}>PICKUP LOCATION</Text>
                <Text style={[styles.locationName, !pickup && styles.placeholderText]} numberOfLines={1}>
                  {pickup?.name ?? (locating ? 'Locating your current address…' : 'Enter pickup city or landmark')}
                </Text>
                {pickup && pickup.address !== pickup.name ? (
                  <Text style={styles.locationAddress} numberOfLines={1}>
                    {pickup.address}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => void locateMe()}
                hitSlop={12}
                style={styles.gpsActionBtn}
                accessibilityRole="button"
                accessibilityLabel="Use current location"
              >
                <Ionicons name="locate" size={18} color={colors.primary} />
              </Pressable>
            </Pressable>

            {/* Middle Divider with Swap Button */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Pressable
                onPress={() => pickup && drop && update({ pickup: drop, drop: pickup })}
                disabled={!pickup || !drop}
                style={[styles.swapCircle, (!pickup || !drop) && { opacity: 0.4 }]}
                accessibilityRole="button"
                accessibilityLabel="Swap pickup and drop"
              >
                <Ionicons name="swap-vertical" size={16} color={colors.primary} />
              </Pressable>
              <View style={styles.dividerLine} />
            </View>

            {/* Drop Row */}
            <Pressable
              style={styles.locationRow}
              onPress={() => setPicker({ field: 'drop' })}
              accessibilityRole="button"
              accessibilityLabel={`Drop: ${drop?.name ?? 'not set'}`}
            >
              <View style={styles.iconCircleRed}>
                <Ionicons name="flag" size={16} color={colors.primary} />
              </View>
              <View style={styles.locationTextWrap}>
                <Text style={styles.inputMiniLabel}>DESTINATION</Text>
                <Text style={[styles.locationName, !drop && styles.placeholderText]} numberOfLines={1}>
                  {drop?.name ?? 'Where are you travelling to?'}
                </Text>
                {drop && drop.address !== drop.name ? (
                  <Text style={styles.locationAddress} numberOfLines={1}>
                    {drop.address}
                  </Text>
                ) : null}
              </View>
              {drop ? (
                <Pressable
                  onPress={() => update({ drop: null })}
                  hitSlop={12}
                  style={styles.gpsActionBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Clear destination"
                >
                  <Ionicons name="close-circle" size={18} color={colors.slate} />
                </Pressable>
              ) : (
                <View style={styles.gpsActionBtn}>
                  <Ionicons name="search" size={18} color={colors.slate} />
                </View>
              )}
            </Pressable>
          </View>

          {/* Schedule Section */}
          <View style={styles.scheduleSection}>
            <Pressable
              style={styles.scheduleItem}
              onPress={openSchedulePicker}
              accessibilityRole="button"
              accessibilityLabel="Select pickup date and time"
            >
              <View style={styles.scheduleIconWrap}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scheduleItemLabel}>PICKUP DATE & TIME</Text>
                <Text style={styles.scheduleItemValue} numberOfLines={1}>
                  {scheduledAt ? `${formatDate(scheduledAt)} · ${formatTime(scheduledAt)}` : 'Select date & time'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={colors.slate} />
            </Pressable>

            {/* Return Date if Round Trip */}
            {tripType === 'Round Trip' ? (
              <View style={styles.returnTripContainer}>
                <Pressable
                  style={styles.scheduleItem}
                  onPress={openReturnPicker}
                  accessibilityRole="button"
                  accessibilityLabel="Select return date"
                >
                  <View style={[styles.scheduleIconWrap, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="calendar" size={18} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.scheduleItemLabel}>RETURN DATE</Text>
                    <Text style={styles.scheduleItemValue} numberOfLines={1}>
                      {returnDate ? formatDate(returnDate) : 'Select return date'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color={colors.slate} />
                </Pressable>
                <View style={styles.roundTripInfoPill}>
                  <Ionicons name="information-circle" size={14} color="#B45309" />
                  <Text style={styles.roundTripInfoText}>
                    {roundTripDays} Calendar {roundTripDays === 1 ? 'Day' : 'Days'} • Min {roundTripDays * 250} km
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Direct Prominent "SEARCH CABS" Button */}
          <Pressable
            onPress={findCab}
            style={({ pressed }) => [styles.searchCabsBtn, pressed && styles.searchCabsBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Search Cabs"
          >
            <Text style={styles.searchCabsBtnText}>SEARCH CABS</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
          </Pressable>
        </View>

        {/* Validation Notices */}
        {problem ? <Notice message={problem} tone="warning" style={{ marginTop: space.sm }} /> : null}
        {locationHint && !pickup ? <Notice tone="info" message={locationHint} style={{ marginTop: space.sm }} /> : null}

        {/* Popular Outstation Routes Section */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionTitleRow}>
            <View>
              <Text style={styles.sectionTitle}>Popular Routes</Text>
              <Text style={styles.sectionSubtitle}>Tap any destination to plan your trip</Text>
            </View>
            <View style={styles.routeCountBadge}>
              <Text style={styles.routeCountText}>{POPULAR_ROUTES.length} Routes</Text>
            </View>
          </View>

          {/* Horizontal Destination Cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.routeCardsScroll}
          >
            {POPULAR_ROUTES.map((item, idx) => {
              const routeImg = getRouteImage(item.from, item.to);
              return (
                <Pressable
                  key={idx}
                  style={({ pressed }) => [styles.routeCard, pressed && { opacity: 0.85 }]}
                  onPress={() => selectPopularRoute(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.from} to ${item.to}, distance ${item.distance}`}
                >
                  <View style={styles.routeImageContainer}>
                    <Image
                      source={routeImg}
                      style={styles.routeImage}
                      resizeMode="cover"
                      accessible={false}
                      importantForAccessibility="no"
                    />
                    <View style={styles.routeDistanceBadge}>
                      <Ionicons name="speedometer-outline" size={11} color={colors.white} />
                      <Text style={styles.routeDistanceText}>{item.distance}</Text>
                    </View>
                  </View>
                  <View style={styles.routeCardBody}>
                    <Text style={styles.routeCardName} numberOfLines={1}>
                      {item.from} → {item.to}
                    </Text>
                    <Text style={styles.routeCardSub}>Fixed Outstation Rates</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Why Travel With one_way_car_rental Features */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionTitleRow}>
            <View>
              <Text style={styles.sectionTitle}>Why Travel With one_way_car_rental</Text>
              <Text style={styles.sectionSubtitle}>Guaranteed comfort & transparent service</Text>
            </View>
          </View>

          <View style={styles.featuresList}>
            {FEATURES_LIST.map((f, i) => (
              <View key={i} style={styles.featureItem}>
                <Image
                  source={f.image}
                  style={styles.featureThumb}
                  resizeMode="cover"
                  accessible={false}
                  importantForAccessibility="no"
                />
                <View style={styles.featureTextCol}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Support & Booking Help Card */}
        <View style={styles.supportCard}>
          <Image
            source={ILLUSTRATIONS.support}
            style={styles.supportIllustration}
            resizeMode="contain"
            accessible={false}
            importantForAccessibility="no"
          />
          <View style={styles.supportContent}>
            <Text style={styles.supportTitle}>Need Help With Your Booking?</Text>
            <Text style={styles.supportSubtitle}>
              Our 24×7 Tamil Nadu operations desk is ready to help you plan custom itineraries and multi-day tours.
            </Text>
            <Pressable
              style={styles.supportCallBtn}
              onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)}
              accessibilityRole="button"
              accessibilityLabel={`Call support desk at ${SUPPORT_PHONE_DISPLAY}`}
            >
              <Ionicons name="call" size={15} color={colors.white} />
              <Text style={styles.supportCallBtnText}>Call Support: {SUPPORT_PHONE_DISPLAY}</Text>
            </Pressable>
          </View>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: space.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollPad: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xl,
  },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: space.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontFamily: fonts.semiBold,
    color: colors.white,
    fontSize: 13,
    flex: 1,
  },
  greetingRow: {
    marginTop: space.xs,
    marginBottom: space.md,
  },
  welcomeSub: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  welcomeTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.ink,
    marginTop: 2,
    lineHeight: 28,
  },
  bookingCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  tripTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: space.sm,
  },
  gridSegmentBtn: {
    flexGrow: 1,
    flexBasis: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gridSegmentBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  gridSegmentText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink,
  },
  gridSegmentTextActive: {
    fontFamily: fonts.bold,
    color: colors.white,
  },
  tripTypeSegment: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: space.md,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  segmentTextActive: {
    fontFamily: fonts.bold,
    color: colors.white,
  },
  airportHelperBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: space.sm,
    marginBottom: space.md,
    gap: 8,
  },
  rentalHelperBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: space.sm,
    marginBottom: space.md,
    gap: 6,
  },
  helperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  helperTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.ink,
    letterSpacing: 0.3,
  },
  rentalSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slate,
    lineHeight: 16,
  },
  quickAirportRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  airportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  airportChipText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.ink,
  },
  airportDirectionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  dirBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dirBtnActive: {
    borderColor: colors.primary,
    backgroundColor: '#F0F9FF',
  },
  dirBtnText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.slate,
  },
  dirBtnTextActive: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  quickChipsRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  rentalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  rentalChipText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: '#92400E',
  },
  routeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    marginBottom: space.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  iconCircleGreen: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleRed: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTextWrap: {
    flex: 1,
  },
  inputMiniLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.slate,
    letterSpacing: 0.5,
  },
  locationName: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.ink,
    marginTop: 1,
  },
  placeholderText: {
    fontFamily: fonts.regular,
    color: '#94A3B8',
  },
  locationAddress: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slate,
    marginTop: 1,
  },
  gpsActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  swapCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: space.xs,
  },
  scheduleSection: {
    marginBottom: space.md,
    gap: 8,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: space.sm,
  },
  scheduleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleItemLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.slate,
    letterSpacing: 0.5,
  },
  scheduleItemValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
    marginTop: 1,
  },
  returnTripContainer: {
    gap: 6,
  },
  roundTripInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  roundTripInfoText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#B45309',
  },
  searchCabsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: radius.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchCabsBtnPressed: {
    backgroundColor: '#B71C1C',
  },
  searchCabsBtnText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
    letterSpacing: 0.5,
  },
  sectionWrap: {
    marginTop: space.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
  },
  sectionSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slate,
  },
  heroCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: space.sm,
    backgroundColor: '#0F172A',
    height: 150,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    opacity: 0.5,
  },
  heroOverlay: {
    flex: 1,
    padding: space.md,
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(227, 30, 36, 0.9)',
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    marginBottom: 6,
  },
  heroBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.white,
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.white,
    lineHeight: 25,
  },
  heroSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: '#E2E8F0',
    marginTop: 3,
  },
  routeCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  routeCountText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.slate,
  },
  routeCardsScroll: {
    paddingVertical: space.xs,
    gap: 12,
    marginBottom: space.sm,
  },
  routeCard: {
    width: 200,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  routeImageContainer: {
    width: '100%',
    height: 110,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  routeImage: {
    width: '100%',
    height: '100%',
  },
  routeDistanceBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
  },
  routeDistanceText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.white,
  },
  routeCardBody: {
    padding: 10,
  },
  routeCardName: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  routeCardSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.slate,
    marginTop: 2,
  },
  featuresList: {
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  featureDesc: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.slate,
    marginTop: 2,
    lineHeight: 15,
  },
  supportCard: {
    marginTop: space.lg,
    backgroundColor: '#FFF7ED',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    padding: space.md,
    alignItems: 'center',
  },
  supportIllustration: {
    width: 120,
    height: 90,
    marginBottom: space.xs,
  },
  supportContent: {
    alignItems: 'center',
    width: '100%',
  },
  supportTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#9A3412',
    textAlign: 'center',
  },
  supportSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#7C2D12',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  supportCallBtn: {
    marginTop: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: 18,
    width: '100%',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  supportCallBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
  },
});

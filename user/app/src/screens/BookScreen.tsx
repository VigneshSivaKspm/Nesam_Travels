// Home / booking step 1, in the customer reference layout: centred service title,
// One Way / Round Trip tabs, the route + schedule form, popular routes from
// Chennai, “The NESAM Way”, reviews, FAQs and the company footer. Pricing,
// validation and booking stay with the real services (BookingDraft → server quote).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView as RNScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Button, Disclosure, Notice, Segmented, Tabs } from '../components/ui';
import { ScrollView } from '../components/layout';
import { AppHeader } from '../components/brand';
import { Icon, type IconName } from '../components/Icon';
import { PlaceSearchModal } from '../components/PlaceSearchModal';
import { TimePickerSheet } from '../components/TimePickerSheet';
import { useCustomerData } from '../context/CustomerData';
import { useBookingDraft, type HomeService } from '../context/BookingDraft';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { LOCATION_ERROR_TEXT, reverseGeocode } from '../services/geoService';
import {
  COMPANY_LEGAL_NAME,
  SCHEDULED_CANCELLATION_FEE,
  SCHEDULED_FREE_CANCEL_BEFORE_MS,
  SCHEDULE_MAX_DAYS,
  SCHEDULE_MIN_LEAD_MIN,
  SUPPORT_PHONE,
  SUPPORT_PHONE_DISPLAY,
} from '../config/constants';
import { scheduleProblem } from '../utils/bookingRules';
import { POPULAR_AIRPORTS, makeLocalDisposalPlace } from '../services/pricingService';
import type { GeoPlace, TripType } from '../types';
import { formatTime } from '../utils/format';
import { haversineKm, isValidLatLng } from '../utils/geo';
import { colors, fonts, space, type } from '../theme';
import { ROUTE_ART } from '../assets/images';
import { useRideFocus } from '../navigation/MainNavigator';

type Field = 'pickup' | 'drop';
type TimeTarget = 'pickup' | 'return' | null;

const SERVICE_TITLE: Record<HomeService, string> = {
  airport: 'Airport Transfers',
  multicity: 'Multicity',
  outstation: 'One Way',
  rental: 'Local Rental',
};

const CHENNAI: GeoPlace = { id: 'city-chennai', name: 'Chennai', address: 'Chennai, Tamil Nadu', lat: 13.0827, lng: 80.2707, type: 'other' };

/** The reference's six popular journeys from Chennai, with real city-centre coordinates. */
const POPULAR: { city: string; art: keyof typeof ROUTE_ART; place: GeoPlace }[] = [
  { city: 'Trichy', art: 'trichy', place: { id: 'city-trichy', name: 'Trichy', address: 'Tiruchirappalli, Tamil Nadu', lat: 10.7905, lng: 78.7047, type: 'other' } },
  { city: 'Madurai', art: 'madurai', place: { id: 'city-madurai', name: 'Madurai', address: 'Madurai, Tamil Nadu', lat: 9.9252, lng: 78.1198, type: 'other' } },
  { city: 'Thanjavur', art: 'thanjavur', place: { id: 'city-thanjavur', name: 'Thanjavur', address: 'Thanjavur, Tamil Nadu', lat: 10.787, lng: 79.1378, type: 'other' } },
  { city: 'Puducherry', art: 'puducherry', place: { id: 'city-puducherry', name: 'Puducherry', address: 'Puducherry', lat: 11.9416, lng: 79.8083, type: 'other' } },
  { city: 'Coimbatore', art: 'coimbatore', place: { id: 'city-coimbatore', name: 'Coimbatore', address: 'Coimbatore, Tamil Nadu', lat: 11.0168, lng: 76.9558, type: 'other' } },
  { city: 'Rameswaram', art: 'rameswaram', place: { id: 'city-rameswaram', name: 'Rameswaram', address: 'Rameswaram, Tamil Nadu', lat: 9.2876, lng: 79.3129, type: 'other' } },
];

const BENEFITS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'receipt-text', title: 'Clear fares', text: 'Know your inclusions, applicable GST and extra rates before you book.' },
  { icon: 'map-pin', title: 'Doorstep pickup', text: 'Choose the pickup address that works for your journey.' },
  { icon: 'headphones', title: 'Trip support', text: 'A direct line to NESAM for booking and journey assistance.' },
];

const FREE_CANCEL_MIN = Math.round(SCHEDULED_FREE_CANCEL_BEFORE_MS / 60000);

/** Answers reflect how the live service works (server quote, cash/UPI payment, real cancellation rules). */
const FAQS: { q: string; a: string }[] = [
  {
    q: 'What does my fare include?',
    a: 'Your quote itemises cab charges, driver allowance where it applies and GST. Included kilometres and the extra kilometre rate are shown before you confirm.',
  },
  {
    q: 'Are toll, parking and state tax included?',
    a: 'Only when your fare breakup lists them as included. Otherwise toll, parking, permits and state tax are paid separately during the trip.',
  },
  {
    q: 'Can I book now and pay later?',
    a: 'Yes. Your booking is placed without an online payment, and you pay the trip fare by cash or UPI. Payments and refunds recorded by NESAM appear under Payments & Refunds.',
  },
  {
    q: 'When will I get my driver details?',
    a: 'NESAM reviews every booking first. The driver’s name, phone and vehicle number appear in My Bookings — and you are notified — as soon as a driver is assigned.',
  },
  {
    q: 'How do cancellations and refunds work?',
    a: `Cancel from My Bookings. It is free while your booking is under review or more than ${FREE_CANCEL_MIN} minutes before pickup; after that a ₹${SCHEDULED_CANCELLATION_FEE} fee applies once a partner is committed. Any refund is shown on the booking.`,
  },
];

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const formatDay = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

export function BookScreen() {
  const navigation = useNavigation();
  const { trips, liveRide, savedPlaces } = useCustomerData();
  const { draft, update, service, setService } = useBookingDraft();
  const { undismiss } = useRideFocus();
  const { pickup, drop, tripType, scheduledAt, tripEndAt, airportDirection } = draft;
  const { position, error: locError, permission, locating, locate } = useDeviceLocation(true);
  const { online } = useNetworkStatus();
  const [picker, setPicker] = useState<Field | null>(null);
  const [timeTarget, setTimeTarget] = useState<TimeTarget>(null);
  // A date picked before its time is kept here; once a time is chosen the draft's instant is the truth.
  const [pendingPickupDay, setPendingPickupDay] = useState<Date | null>(null);
  const [pendingReturnDay, setPendingReturnDay] = useState<Date | null>(null);
  const pickupDay = scheduledAt ? dayStart(scheduledAt) : pendingPickupDay;
  const returnDay = tripEndAt ? dayStart(tripEndAt) : pendingReturnDay;
  const [problem, setProblem] = useState('');
  const [fieldError, setFieldError] = useState<Partial<Record<'pickup' | 'drop' | 'date' | 'time' | 'return', string>>>({});
  const scroller = useRef<RNScrollView>(null);
  const faqY = useRef(0);

  const isAirport = service === 'airport';
  const isRental = service === 'rental';
  const isMulti = service === 'multicity';
  const isRound = service === 'outstation' && tripType === 'Round Trip';

  // Fill the pickup from GPS once, unless the customer already chose one.
  const pickupFromGps = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!position || pickupFromGps.current || pickup || (isAirport && airportDirection === 'from')) return;
    pickupFromGps.current = true;
    void reverseGeocode(position).then((p) => {
      if (mounted.current) update((d) => (d.pickup ? {} : { pickup: { ...p, type: 'current' } }));
    });
  }, [position, pickup, update, isAirport, airportDirection]);

  const recentPlaces = useMemo(() => {
    const seen = new Set<string>();
    const out: GeoPlace[] = [];
    for (const t of trips) {
      for (const p of [t.drop, t.pickup]) {
        if (!isValidLatLng(p) || seen.has(p.name)) continue;
        seen.add(p.name);
        out.push({ ...p, id: `recent-${t.id}-${p.id}`, type: p.type === 'airport' ? 'airport' : 'recent' });
      }
    }
    return out.slice(0, 6);
  }, [trips]);

  const clearErrors = () => {
    setProblem('');
    setFieldError({});
  };

  const locateMe = async () => {
    const p = await locate();
    if (!p) return;
    const place = await reverseGeocode(p);
    if (mounted.current) {
      pickupFromGps.current = true;
      update({ pickup: { ...place, type: 'current' } });
    }
  };

  // ── Which field is the airport ──────────────────────────────────────────────
  const airportField: Field | null = isAirport ? (airportDirection === 'to' ? 'drop' : 'pickup') : null;
  const setDirection = (dir: 'to' | 'from') => {
    if (dir === airportDirection) return;
    // The airport moves to the other end of the trip.
    update((d) => ({ airportDirection: dir, pickup: d.drop, drop: d.pickup }));
    clearErrors();
  };

  const switchOutstation = (t: TripType) => {
    update({ tripType: t });
    clearErrors();
  };

  // ── Dates and times ─────────────────────────────────────────────────────────
  const minPickup = () => new Date(Date.now() + SCHEDULE_MIN_LEAD_MIN * 60000);
  const maxPickup = () => new Date(Date.now() + SCHEDULE_MAX_DAYS * 86400000);

  const openDate = (target: 'pickup' | 'return') => {
    const base = target === 'pickup' ? pickupDay ?? scheduledAt ?? minPickup() : returnDay ?? tripEndAt ?? scheduledAt ?? minPickup();
    const min = target === 'pickup' ? minPickup() : scheduledAt ?? pickupDay ?? minPickup();
    try {
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        minimumDate: dayStart(min),
        maximumDate: maxPickup(),
        onChange: (event, date) => {
          if (event.type !== 'set' || !date) return;
          const day = dayStart(date);
          setFieldError((e) => ({ ...e, date: '', return: '' }));
          if (target === 'pickup') {
            setPendingPickupDay(day);
            if (scheduledAt) {
              const next = new Date(day);
              next.setHours(scheduledAt.getHours(), scheduledAt.getMinutes(), 0, 0);
              const p = scheduleProblem(next);
              update({ scheduledAt: p ? null : next });
              if (p) setFieldError((e) => ({ ...e, time: p }));
              if (!p && tripEndAt && tripEndAt <= next) update({ tripEndAt: null });
            } else {
              setTimeTarget('pickup');
            }
          } else {
            setPendingReturnDay(day);
            if (tripEndAt) {
              const next = new Date(day);
              next.setHours(tripEndAt.getHours(), tripEndAt.getMinutes(), 0, 0);
              update({ tripEndAt: scheduledAt && next > scheduledAt ? next : null });
            } else {
              setTimeTarget('return');
            }
          }
        },
      });
    } catch {
      setProblem('Date selection is not available on this device. Please call NESAM to book.');
    }
  };

  const openTime = (target: 'pickup' | 'return') => {
    if (target === 'pickup' && !pickupDay) return openDate('pickup');
    if (target === 'return' && !returnDay) return openDate('return');
    setTimeTarget(target);
  };

  const returnProblem = (at: Date) => {
    if (!scheduledAt) return 'Choose the pickup date and time first.';
    if (at.getTime() <= scheduledAt.getTime()) return 'The return must be after the pickup time.';
    if (at.getTime() - Date.now() > (SCHEDULE_MAX_DAYS + 7) * 86400000) return 'Choose an earlier return date.';
    return '';
  };

  // ── Search ──────────────────────────────────────────────────────────────────
  const findCab = () => {
    let targetDrop = drop;
    if (isRental && pickup) {
      targetDrop = makeLocalDisposalPlace(pickup);
      update({ drop: targetDrop });
    }
    const errs: typeof fieldError = {};
    if (!pickup) errs.pickup = airportField === 'pickup' ? 'Choose the airport.' : 'Choose your pickup location.';
    if (!targetDrop) errs.drop = airportField === 'drop' ? 'Choose the airport.' : 'Choose your drop location.';
    if (isAirport && airportField === 'drop' && drop && drop.type !== 'airport') errs.drop = 'Choose an airport for an airport drop.';
    if (isAirport && airportField === 'pickup' && pickup && pickup.type !== 'airport') errs.pickup = 'Choose the airport you are arriving at.';
    if (pickup && targetDrop && !isRental && haversineKm(pickup, targetDrop) < 0.2) errs.drop = 'Pickup and drop cannot be the same place.';
    if (!pickupDay) errs.date = 'Choose the pickup date.';
    const sched = scheduleProblem(scheduledAt);
    if (pickupDay && sched) errs.time = sched;
    if (isRound) {
      if (!tripEndAt) errs.return = 'Choose your return date and time.';
      else if (returnProblem(tripEndAt)) errs.return = returnProblem(tripEndAt);
    }
    setFieldError(errs);
    const first = Object.values(errs).find(Boolean);
    if (!online) {
      setProblem('You are offline. Check your connection and try again.');
      return;
    }
    setProblem(first ? 'Please check the highlighted details.' : '');
    if (!first) navigation.navigate('ChooseRide');
  };

  const planRoute = (dest: GeoPlace) => {
    setService('outstation');
    update({ pickup: CHENNAI, drop: dest });
    clearErrors();
    scroller.current?.scrollTo({ y: 0, animated: true });
  };

  const locationHint = locError ? LOCATION_ERROR_TEXT[locError.kind] : permission === 'prompt' && !position ? 'Allow location access to fill your pickup automatically.' : '';
  const title = service === 'outstation' ? tripType : SERVICE_TITLE[service];

  // ── Field rendering ─────────────────────────────────────────────────────────
  const fieldLabel = (f: Field) => (airportField === f ? 'Airport' : f === 'pickup' ? 'Pickup location' : 'Drop location');
  const fieldPlaceholder = (f: Field) => (airportField === f ? 'Choose airport' : f === 'pickup' ? (locating ? 'Finding your location…' : 'Enter pickup location') : 'Enter drop location');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <PlaceSearchModal
        visible={picker !== null}
        title={picker ? fieldLabel(picker) : ''}
        subtitle={picker && airportField === picker ? 'Choose an airport or search by name.' : undefined}
        onClose={() => setPicker(null)}
        onSelect={(p) => {
          if (picker === 'pickup') {
            pickupFromGps.current = true;
            update({ pickup: p });
          } else {
            update({ drop: p });
          }
          clearErrors();
        }}
        savedPlaces={picker && airportField === picker ? [] : savedPlaces}
        recentPlaces={picker && airportField === picker ? recentPlaces.filter((p) => p.type === 'airport') : recentPlaces.filter((p) => p.type !== 'airport')}
        suggestions={picker && airportField === picker ? POPULAR_AIRPORTS : []}
        suggestionsLabel="Airports"
        near={picker === 'drop' ? (pickup ?? position) : position}
        onUseCurrentLocation={picker === 'pickup' && airportField !== 'pickup' ? () => void locateMe() : undefined}
      />
      {timeTarget ? (
        <TimePickerSheet
          visible
          title={timeTarget === 'return' ? 'Return time' : 'Pickup time'}
          day={(timeTarget === 'return' ? returnDay : pickupDay) ?? dayStart(new Date())}
          value={timeTarget === 'return' ? tripEndAt : scheduledAt}
          problemOf={timeTarget === 'return' ? returnProblem : (at) => scheduleProblem(at)}
          onClose={() => setTimeTarget(null)}
          onConfirm={(at) => {
            if (timeTarget === 'return') {
              update({ tripEndAt: at });
              setPendingReturnDay(null);
            } else {
              update((d) => ({ scheduledAt: at, tripEndAt: d.tripEndAt && d.tripEndAt <= at ? null : d.tripEndAt }));
              setPendingPickupDay(null);
            }
            setFieldError((e) => ({ ...e, time: '', return: '' }));
            setTimeTarget(null);
          }}
        />
      ) : null}

      <AppHeader />

      <ScrollView ref={scroller} kind="narrow" contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {liveRide ? (
          <Pressable
            style={({ pressed }) => [styles.live, pressed && { opacity: 0.85 }]}
            onPress={() => {
              undismiss(liveRide.id);
              navigation.navigate('ActiveRide', { bookingId: liveRide.id });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Open your current trip, ${liveRide.pickup.name} to ${liveRide.drop.name}`}
          >
            <View style={styles.liveDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.liveTitle}>{liveRide.status === 'Ongoing' ? 'Trip in progress' : 'Your trip is coming up'}</Text>
              <Text style={styles.liveRoute} numberOfLines={1}>
                {liveRide.pickup.name} → {liveRide.drop.name}
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.success} />
          </Pressable>
        ) : null}

        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>

        {service === 'outstation' ? (
          <View style={{ marginBottom: 19 }}>
            <Tabs<TripType>
              options={[
                { value: 'One Way', label: 'One Way' },
                { value: 'Round Trip', label: 'Round Trip' },
              ]}
              value={tripType === 'Round Trip' ? 'Round Trip' : 'One Way'}
              onChange={switchOutstation}
            />
          </View>
        ) : null}

        <View style={styles.widget}>
          {isMulti ? (
            <MulticityNotice onOneWay={() => setService('outstation')} />
          ) : (
            <>
              {isAirport ? (
                <Segmented
                  style={{ marginTop: 15 }}
                  options={[
                    { value: 'to', label: 'To airport' },
                    { value: 'from', label: 'From airport' },
                  ]}
                  value={airportDirection}
                  onChange={setDirection}
                />
              ) : null}

              <View>
                <RouteField
                  pin="start"
                  label={fieldLabel('pickup')}
                  value={pickup?.name}
                  placeholder={fieldPlaceholder('pickup')}
                  error={fieldError.pickup}
                  onPress={() => setPicker('pickup')}
                  roomForSwap={service === 'outstation'}
                />
                {isRental ? null : (
                  <RouteField
                    pin="end"
                    label={fieldLabel('drop')}
                    value={drop?.name}
                    placeholder={fieldPlaceholder('drop')}
                    error={fieldError.drop}
                    onPress={() => setPicker('drop')}
                    divider
                    roomForSwap={service === 'outstation'}
                  />
                )}
                {service === 'outstation' ? (
                  <Pressable
                    onPress={() => {
                      update({ pickup: drop, drop: pickup });
                      clearErrors();
                    }}
                    disabled={!pickup && !drop}
                    style={({ pressed }) => [styles.swap, pressed && { backgroundColor: colors.subtle }]}
                    accessibilityRole="button"
                    accessibilityLabel="Swap pickup and drop"
                    hitSlop={6}
                  >
                    <Icon name="arrow-up-down" size={17} color="#657184" />
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.formRow}>
                <PickerBox
                  label="Pickup date"
                  value={pickupDay ? formatDay(pickupDay) : ''}
                  placeholder="Select date"
                  icon="calendar-days"
                  error={fieldError.date}
                  onPress={() => openDate('pickup')}
                />
                <PickerBox
                  label="Pickup time"
                  value={scheduledAt ? formatTime(scheduledAt).replace(/^0/, '') : ''}
                  placeholder="Select time"
                  icon="chevron-down"
                  error={fieldError.time}
                  onPress={() => openTime('pickup')}
                />
              </View>

              {isRound ? (
                <View style={styles.formRow}>
                  <PickerBox
                    label="Return date"
                    value={returnDay ? formatDay(returnDay) : ''}
                    placeholder="Select date"
                    icon="calendar-days"
                    error={fieldError.return && !returnDay ? fieldError.return : ''}
                    onPress={() => openDate('return')}
                  />
                  <PickerBox
                    label="Return time"
                    value={tripEndAt ? formatTime(tripEndAt).replace(/^0/, '') : ''}
                    placeholder="Select time"
                    icon="chevron-down"
                    error={fieldError.return && returnDay ? fieldError.return : ''}
                    onPress={() => openTime('return')}
                  />
                </View>
              ) : null}

              {isRental ? (
                <View style={styles.packageNote}>
                  <Text style={styles.formLabel}>Rental package</Text>
                  <View style={styles.packageBox}>
                    <Icon name="clock-3" size={16} color="#7E8896" />
                    <Text style={styles.packageText}>Hourly, within the city. Your quote shows the minimum hours and extra rates.</Text>
                  </View>
                </View>
              ) : null}

              {isAirport ? (
                <View style={styles.flight}>
                  <Disclosure title="Flight details (optional)" initiallyOpen={!!draft.flightNumber}>
                    <Text style={styles.formLabel}>Flight number</Text>
                    <TextInput
                      value={draft.flightNumber}
                      onChangeText={(v) => update({ flightNumber: v.toUpperCase().replace(/[^A-Z0-9 -]/g, '').slice(0, 10) })}
                      placeholder="e.g. 6E 562"
                      placeholderTextColor={colors.faint}
                      autoCapitalize="characters"
                      style={styles.flightInput}
                      accessibilityLabel="Flight number (optional)"
                    />
                    <Text style={styles.flightHint}>Shared with NESAM in your booking notes to help plan the pickup.</Text>
                  </Disclosure>
                </View>
              ) : null}

              <Button title="Search Cabs" iconRight="arrow-right" onPress={findCab} style={{ marginTop: 14 }} />
              <View style={styles.trust}>
                <Icon name="shield-check" size={12} color="#8994A4" />
                <Text style={styles.trustText}>Clear fares. Dedicated support.</Text>
              </View>
            </>
          )}
        </View>

        {problem ? <Notice message={problem} tone={online ? 'warning' : 'error'} style={{ marginTop: space.md }} /> : null}
        {locationHint && !pickup && !isMulti ? <Notice tone="info" message={locationHint} style={{ marginTop: space.md }} /> : null}

        {/* Popular routes */}
        <View style={styles.popular}>
          <Text style={styles.popularTitle} accessibilityRole="header">
            Popular routes
          </Text>
          <Text style={styles.caption}>A few favourites from Chennai.</Text>
        </View>
        <RNScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} style={styles.railWrap}>
          {POPULAR.map((r) => (
            <Pressable
              key={r.city}
              onPress={() => planRoute(r.place)}
              style={({ pressed }) => [styles.routeCard, pressed && { borderColor: '#D5DAE1' }]}
              accessibilityRole="button"
              accessibilityLabel={`Plan trip: Chennai to ${r.city}`}
            >
              <View style={styles.routeArt}>
                <Image source={ROUTE_ART[r.art]} style={styles.routeImg} resizeMode="contain" accessible={false} />
              </View>
              <View style={styles.routeBody}>
                <View style={styles.routeName}>
                  <Text style={styles.routeFrom}>Chennai</Text>
                  <Icon name="arrow-right" size={14} color="#9199A5" />
                  <Text style={styles.routeTo}>{r.city}</Text>
                </View>
                <View style={styles.planTrip}>
                  <Text style={styles.planText}>Plan trip</Text>
                  <Icon name="arrow-right" size={13} color={colors.primary} />
                </View>
              </View>
            </Pressable>
          ))}
        </RNScrollView>

        {/* The NESAM Way */}
        <View style={styles.why}>
          <Text style={type.eyebrow}>The NESAM Way</Text>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Travel with clarity.
          </Text>
          <View style={{ paddingTop: 12 }}>
            {BENEFITS.map((b, i) => (
              <View key={b.title} style={[styles.benefit, i > 0 && styles.benefitLine]}>
                <Icon name={b.icon} size={21} color="#A32B30" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitText}>{b.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Reviews: nothing is published yet, so the reference's empty state is shown. */}
        <View style={styles.section}>
          <Text style={type.eyebrow}>From our travellers</Text>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Customer reviews
          </Text>
          <View style={styles.reviewCard}>
            <View style={styles.reviewMark}>
              <Icon name="message-circle" size={17} color="#A12D33" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewTitle}>Your journey. Your words.</Text>
              <Text style={styles.reviewText}>Travelled with NESAM? We would love to hear about your experience.</Text>
              <Text style={styles.reviewSmall}>Customer reviews will appear here once published.</Text>
              <Pressable onPress={() => navigation.navigate('Support')} accessibilityRole="link" style={styles.inlineLink} hitSlop={6}>
                <Text style={styles.inlineLinkText}>Share feedback</Text>
                <Icon name="arrow-up-right" size={16} color={colors.link} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* FAQs */}
        <View
          style={styles.section}
          onLayout={(e) => {
            faqY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={type.eyebrow}>Good to know</Text>
          <Text style={[styles.sectionTitle, styles.faqTitle]} accessibilityRole="header">
            A little help, before you go.
          </Text>
          <Text style={styles.caption}>The details that make planning easier.</Text>
          <Pressable onPress={() => navigation.navigate('Support')} accessibilityRole="link" style={[styles.inlineLink, { marginTop: 6 }]} hitSlop={6}>
            <Text style={[styles.inlineLinkText, { fontSize: 13 }]}>Talk to NESAM</Text>
            <Icon name="arrow-up-right" size={16} color={colors.link} />
          </Pressable>
          <View style={styles.faqList}>
            {FAQS.map((f, i) => (
              <Disclosure key={f.q} title={f.q} variant="faq" initiallyOpen={i === 0}>
                <Text style={styles.faqAnswer}>{f.a}</Text>
              </Disclosure>
            ))}
          </View>
        </View>

        <Footer
          onService={(s) => {
            setService(s);
            scroller.current?.scrollTo({ y: 0, animated: true });
          }}
          onOneWay={(t) => {
            setService('outstation');
            update({ tripType: t });
            scroller.current?.scrollTo({ y: 0, animated: true });
          }}
          onFaq={() => scroller.current?.scrollTo({ y: Math.max(0, faqY.current - 12), animated: true })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function RouteField({
  pin,
  label,
  value,
  placeholder,
  error,
  onPress,
  divider,
  roomForSwap,
}: {
  pin: 'start' | 'end';
  label: string;
  value?: string;
  placeholder: string;
  error?: string;
  onPress: () => void;
  divider?: boolean;
  roomForSwap?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.field, divider && styles.fieldDivider, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? 'not set'}`}
      accessibilityHint={error || 'Opens location search'}
    >
      <View style={[styles.pin, pin === 'end' ? styles.pinEnd : styles.pinStart, !!error && { borderColor: colors.primary }]} />
      <View style={{ flex: 1, minWidth: 0, marginRight: roomForSwap ? 30 : 0 }}>
        <Text style={styles.formLabelTight}>{label}</Text>
        <Text style={[styles.fieldValue, !value && styles.fieldPlaceholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      </View>
      <View style={[styles.chev, roomForSwap && { marginRight: 32 }]}>
        <Icon name="chevron-right" size={17} color="#90939A" />
      </View>
    </Pressable>
  );
}

function PickerBox({ label, value, placeholder, icon, error, onPress }: { label: string; value: string; placeholder: string; icon: IconName; error?: string; onPress: () => void }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.formLabel}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pickerBox, !!error && styles.pickerError, pressed && { borderColor: '#B7BEC9' }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || 'not set'}`}
        accessibilityHint={error || undefined}
      >
        <Text style={[styles.pickerValue, !value && styles.fieldPlaceholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Icon name={icon} size={15} color="#858B95" />
      </Pressable>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

/** Multicity has no booking contract on the server yet, so it is booked through the office. */
function MulticityNotice({ onOneWay }: { onOneWay: () => void }) {
  return (
    <View style={{ paddingTop: 16 }}>
      <View style={styles.multiSteps} accessible accessibilityLabel="Pickup, up to four stops and a final drop">
        {['Pickup location', 'Stops along the way', 'Final drop'].map((t, i) => (
          <View key={t} style={[styles.multiStep, i > 0 && styles.fieldDivider]}>
            <View style={[styles.pin, i === 2 ? styles.pinEnd : styles.pinStart]} />
            <Text style={styles.multiStepText}>{t}</Text>
          </View>
        ))}
      </View>
      <Notice
        tone="info"
        message="Multicity trips with several stops are arranged by our office for now. Call us with your stops and dates, or book each leg as a one-way trip."
        style={{ marginTop: 14 }}
      />
      <Button title={`Call NESAM · ${SUPPORT_PHONE_DISPLAY}`} icon="phone" onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
      <Button title="Book a one-way trip" variant="secondary" onPress={onOneWay} style={{ marginTop: 10 }} />
    </View>
  );
}

function Footer({ onService, onOneWay, onFaq }: { onService: (s: HomeService) => void; onOneWay: (t: TripType) => void; onFaq: () => void }) {
  const navigation = useNavigation();
  const link = (label: string, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} accessibilityRole="link" style={styles.footLink} hitSlop={2}>
      <Text style={styles.footLinkText}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.footer}>
      <View style={styles.footWord}>
        <Text style={styles.footBrand}>NESAM</Text>
        <View style={styles.footBar} />
      </View>
      <Text style={styles.footTag}>Cabs & Car Rentals</Text>
      <Pressable onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} accessibilityRole="link" accessibilityLabel={`Call NESAM on ${SUPPORT_PHONE_DISPLAY}`} style={styles.footPhone}>
        <Text style={styles.footPhoneText}>{SUPPORT_PHONE_DISPLAY}</Text>
      </Pressable>
      <View style={styles.footGrid}>
        <View style={styles.footCol}>
          <Text style={styles.footHead}>Our services</Text>
          {link('One Way', () => onOneWay('One Way'))}
          {link('Round Trip', () => onOneWay('Round Trip'))}
          {link('Airport Transfers', () => onService('airport'))}
          {link('Multicity', () => onService('multicity'))}
          {link('Local Rental', () => onService('rental'))}
        </View>
        <View style={styles.footCol}>
          <Text style={styles.footHead}>Bookings & help</Text>
          {link('My Bookings', () => navigation.navigate('Tabs', { screen: 'Trips' }))}
          {link('Payments', () => navigation.navigate('PaymentHistory'))}
          {link('Help & Support', () => navigation.navigate('Support'))}
          {link('Frequently asked questions', onFaq)}
        </View>
      </View>
      <View style={styles.footCol}>
        <Text style={styles.footHead}>Company</Text>
        {link('About NESAM', () => navigation.navigate('Settings'))}
        {link('Offers & coupons', () => navigation.navigate('Offers'))}
        {link('Terms, privacy & cancellation policy', () => navigation.navigate('LegalDocuments'))}
      </View>
      <View style={styles.footBottom}>
        <Text style={styles.footCopy}>
          © {new Date().getFullYear()} {COMPANY_LEGAL_NAME.toUpperCase()}
        </Text>
        <Text style={styles.footPay}>
          Book now <Text style={{ color: '#727E8E' }}>·</Text> Pay by cash or UPI
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  page: { paddingHorizontal: space.xl, paddingTop: space.xl },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.successBorder,
    backgroundColor: colors.successSoft,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: space.lg,
  },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.successStrong },
  liveTitle: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.success },
  liveRoute: { fontFamily: fonts.regular, fontSize: 12, color: '#3E5A4C', marginTop: 2 },
  title: { fontFamily: fonts.semiBold, fontSize: 23, lineHeight: 32, letterSpacing: -0.6, color: colors.text, textAlign: 'center', marginBottom: 20 },
  widget: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: colors.white },
  field: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, minHeight: 67, gap: 13 },
  fieldDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  pin: { width: 8, height: 8, borderWidth: 1 },
  pinStart: { borderRadius: 4, borderColor: '#7D838D' },
  pinEnd: { borderRadius: 3, borderColor: colors.primary },
  formLabelTight: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15.4, color: '#7E8691' },
  formLabel: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16.5, color: '#697587', marginBottom: 5 },
  fieldValue: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 24.8, color: colors.value, letterSpacing: -0.3, marginTop: 3 },
  fieldPlaceholder: { color: '#99A1AD', fontFamily: fonts.regular },
  fieldError: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.primaryDark, marginTop: 3 },
  chev: { paddingHorizontal: 3, paddingVertical: 8 },
  swap: {
    position: 'absolute',
    right: 0,
    top: 50,
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E8EE',
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formRow: { flexDirection: 'row', gap: 11, marginTop: 14 },
  pickerBox: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
  },
  pickerError: { borderColor: colors.primary, backgroundColor: '#FFFBFB' },
  pickerValue: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.text, letterSpacing: -0.2 },
  packageNote: { marginTop: 14 },
  packageBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#FAFBFC' },
  packageText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: '#55606F' },
  flight: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 2 },
  flightInput: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 11, fontFamily: fonts.medium, fontSize: 15, color: colors.value },
  flightHint: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 5 },
  trust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 11 },
  trustText: { fontFamily: fonts.regular, fontSize: 9.5, color: '#7F8998' },
  multiSteps: { borderWidth: 1, borderColor: colors.divider, borderRadius: 8, paddingHorizontal: 12 },
  multiStep: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46 },
  multiStepText: { fontFamily: fonts.medium, fontSize: 13.5, color: '#8A929E' },
  popular: { marginTop: 25 },
  popularTitle: { fontFamily: fonts.heading, fontSize: 21, lineHeight: 29, letterSpacing: -0.6, color: colors.text },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 19, color: '#74808F', marginTop: 4 },
  railWrap: { marginHorizontal: -space.xl, marginTop: 13 },
  rail: { paddingHorizontal: space.xl, paddingBottom: 8, gap: 12 },
  routeCard: { width: 249, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: colors.white, overflow: 'hidden' },
  routeArt: { height: 110, margin: 5, marginBottom: 0, borderRadius: 4, backgroundColor: '#FFF5F2', overflow: 'hidden' },
  routeImg: { width: '100%', height: '100%' },
  routeBody: { paddingHorizontal: 14, paddingTop: 13, paddingBottom: 14 },
  routeName: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  routeFrom: { fontFamily: fonts.regular, fontSize: 14, color: '#3D4653', letterSpacing: -0.3 },
  routeTo: { fontFamily: fonts.semiBold, fontSize: 14, color: '#252D38', letterSpacing: -0.3, flexShrink: 1 },
  planTrip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  planText: { fontFamily: fonts.medium, fontSize: 11, color: colors.primary },
  why: { marginTop: 36, paddingTop: 25, borderTopWidth: 1, borderTopColor: '#E7E9ED' },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 23, lineHeight: 31, letterSpacing: -0.6, color: colors.ink, marginTop: 9 },
  benefit: { flexDirection: 'row', gap: 17, paddingVertical: 16 },
  benefitLine: { borderTopWidth: 1, borderTopColor: colors.divider },
  benefitTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: '#29323D', letterSpacing: -0.2 },
  benefitText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 22, color: '#6E7887', marginTop: 4 },
  section: { marginTop: 36 },
  reviewCard: { flexDirection: 'row', gap: 14, marginTop: 18, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#FAFBFC', paddingVertical: 20, paddingHorizontal: 18 },
  reviewMark: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#EADBDD', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  reviewTitle: { fontFamily: fonts.semiBold, fontSize: 15, lineHeight: 22.5, letterSpacing: -0.3, color: colors.ink },
  reviewText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 22, color: '#687383', marginTop: 5 },
  reviewSmall: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 17, color: '#808A97', marginTop: 11 },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 30, marginTop: 8 },
  inlineLinkText: { fontFamily: fonts.medium, fontSize: 12, color: colors.link },
  faqTitle: { fontSize: 25, lineHeight: 35, maxWidth: 300 },
  faqList: { marginTop: 18, borderTopWidth: 1, borderTopColor: '#E3E6EB' },
  faqAnswer: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 22.8, color: '#727D8B' },
  footer: { marginTop: 36, marginHorizontal: -space.xl, backgroundColor: colors.navy, paddingHorizontal: space.xl, paddingTop: 32, paddingBottom: 28 },
  footWord: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  footBrand: { fontFamily: fonts.brand, fontSize: 27, lineHeight: 30, color: colors.white, letterSpacing: 2 },
  footBar: { width: 16, height: 3, backgroundColor: '#DF4149', marginBottom: 6 },
  footTag: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 17.6, color: '#B2BDCB', marginTop: 8 },
  footPhone: { paddingVertical: 5, marginTop: 14, alignSelf: 'flex-start' },
  footPhoneText: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 27, color: colors.white, letterSpacing: 0.2 },
  footGrid: { flexDirection: 'row', gap: 20, marginTop: 22 },
  footCol: { flex: 1, marginBottom: 22 },
  footHead: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.white, marginBottom: 8 },
  footLink: { paddingVertical: 6, alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  footLinkText: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 18.7, color: '#B9C2CE' },
  footBottom: { borderTopWidth: 1, borderTopColor: '#343C47', paddingTop: 18, gap: 10 },
  footCopy: { fontFamily: fonts.regular, fontSize: 8.5, lineHeight: 14.4, color: '#9DA9B9', letterSpacing: 0.3 },
  footPay: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 18, color: '#9DA9B9' },
});

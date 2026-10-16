// Review & book — step 3 of 3: Payment method, promo code, passenger contact,
// driver instructions, fare summary and atomic server booking creation.
// Mobile-first layout with no desktop headers or sidebars.
import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Notice, TextField } from '../components/ui';
import { ScrollView } from '../components/layout';
import { StepHeader, getVehicleImage } from '../components/brand';
import { Checkbox } from '../components/Checkbox';
import { FareLines } from '../components/FareLines';
import { useCustomerData } from '../context/CustomerData';
import { useBookingDraft } from '../context/BookingDraft';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { calculateFare, isOutstation, serviceName, validateCoupon } from '../services/pricingService';
import { createRideRequest } from '../services/rideService';
import { buildFareBreakup } from '../utils/fareBreakup';
import type { AppliedCoupon, FareBreakdown, PaymentMethod } from '../types';
import { formatDate, formatDistance, formatDuration, formatINR, formatTime } from '../utils/format';
import { describeError } from '../utils/retry';
import { colors, fonts, radius, space } from '../theme';
import { scheduleProblem, whatsappProblem } from '../utils/bookingRules';

const PAYMENT_OPTIONS: {
  id: PaymentMethod;
  label: string;
  hint: string;
  icon: 'phone-portrait-outline' | 'cash-outline';
  badge?: string;
}[] = [
  {
    id: 'UPI',
    label: 'UPI / Online Advance',
    hint: 'GPay / PhonePe / Paytm / QR • Priority Dispatch',
    icon: 'phone-portrait-outline',
    badge: 'RECOMMENDED',
  },
  {
    id: 'Cash',
    label: 'Cash on Drop',
    hint: 'Pay chauffeur directly upon destination arrival',
    icon: 'cash-outline',
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ConfirmBookingScreen() {
  const navigation = useNavigation();
  const { profile, trips } = useCustomerData();
  const { draft, reset, route, categories, adjustment, coupons, serverQuote: serverQuoteState } = useBookingDraft();
  const { pickup, drop, tripType, scheduledAt, categoryId } = draft;
  const { online } = useNetworkStatus();

  const [payment, setPayment] = useState<PaymentMethod>('UPI');
  const [promoInput, setPromoInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [promoError, setPromoError] = useState('');
  const [notes, setNotes] = useState('');
  const [waSame, setWaSame] = useState(true);
  const [waCode, setWaCode] = useState('+91');
  const [waNumber, setWaNumber] = useState('');
  const [email, setEmail] = useState('');
  const [showFareLines, setShowFareLines] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [serverQuote, setServerQuote] = useState<{ key: string; fare: FareBreakdown } | null>(null);
  const submittingRef = useRef(false);

  const category = categories.find((c) => c.id === categoryId) ?? categories[0] ?? null;
  if (!pickup || !drop || !route || !category) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.pad}>
          <StepHeader title="Review & Confirm" step={3} onBack={() => navigation.goBack()} />
          <Notice message="Your trip parameters changed. Please return to step 2 to choose your cab." />
          <Button title="Back to Choose Cab" variant="secondary" onPress={() => navigation.goBack()} style={{ marginTop: space.md }} />
        </View>
      </SafeAreaView>
    );
  }

  const pickupTime = scheduledAt ?? new Date();
  const service = serviceName(pickup, drop, route.distanceKm, tripType);
  const history = trips.filter((t) => t.status !== 'Cancelled' && t.status !== 'Rejected');

  const checkCoupon = (code: string) => {
    const base = calculateFare({ category, route, tripType, pickupTime, adjustment });
    return validateCoupon(coupons, code, {
      subtotal: base.subtotal,
      categoryId: category.id,
      service,
      isFirstBooking: history.length === 0,
      customerUses: history.filter((t) => t.couponCode.toUpperCase() === code.trim().toUpperCase()).length,
    });
  };

  const couponCheck = appliedCode ? checkCoupon(appliedCode) : null;
  const coupon: AppliedCoupon | null = couponCheck?.ok ? couponCheck.coupon : null;
  const promoMsg = couponCheck
    ? couponCheck.ok
      ? { ok: true, text: couponCheck.coupon.message }
      : { ok: false, text: `Promo not applied: ${couponCheck.message}` }
    : promoError
      ? { ok: false, text: promoError }
      : null;

  const priceKey = JSON.stringify([draft, coupon?.code, adjustment?.id, adjustment?.percent]);
  const localQuote = calculateFare({ category, route, tripType, pickupTime, adjustment, discount: coupon?.discount ?? 0 });
  // The booking server's own fare for this exact trip (and promo, when it applies).
  const authoritativeEntry = serverQuoteState.status === 'ready' ? serverQuoteState.data?.quotes.find((x) => x.categoryId === category.id && x.ok && x.fare) : undefined;
  const authoritative = !!authoritativeEntry;
  const quote = serverQuote?.key === priceKey ? serverQuote.fare : authoritativeEntry?.fare ?? localQuote;
  const outstation = isOutstation(route.distanceKm);

  const emailError = email.trim() && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address or leave blank.' : '';
  const waError = whatsappProblem(waSame, waCode, waNumber);
  const blocker = !online
    ? 'You are offline. Please reconnect to confirm booking.'
    : scheduleProblem(scheduledAt)
      || (!authoritative && serverQuote?.key !== priceKey ? (serverQuoteState.status === 'loading' ? 'Confirming your fare with one_way_car_rental…' : serverQuoteState.error || 'We need to confirm your fare before you can submit.') : '')
      || (waError || emailError ? 'Check your contact details.' : '')
      || (!termsAccepted ? 'Accept the booking terms to submit your request.' : '');

  const applyPromo = () => {
    const res = checkCoupon(promoInput);
    if (res.ok) {
      setAppliedCode(res.coupon.code);
      setPromoError('');
    } else {
      setAppliedCode(null);
      setPromoError(res.message);
    }
  };

  const submit = async () => {
    if (blocker || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await createRideRequest({
        profile,
        pickup,
        drop,
        category,
        route,
        fare: quote,
        tripType,
        paymentMethod: payment,
        couponCode: coupon?.code ?? '',
        notes,
        scheduledAt,
        whatsapp: waSame
          ? { sameAsMobile: true }
          : { sameAsMobile: false, countryCode: waCode.trim(), number: waNumber.replace(/[\s()-]/g, '') },
        email: email.trim(),
        tripEndAt: tripType === 'Round Trip' ? draft.tripEndAt : null,
        termsAccepted,
      });
      reset();
      navigation.reset({
        index: 1,
        routes: [{ name: 'Tabs' }, { name: 'ActiveRide', params: { bookingId: res.id, unconfirmed: res.unconfirmed } }],
      });
    } catch (e) {
      const currentFare = (e as { details?: { fare?: FareBreakdown } }).details?.fare;
      if (currentFare && Number.isFinite(currentFare.total)) {
        setServerQuote({ key: priceKey, fare: currentFare });
      }
      setSubmitError(
        currentFare
          ? `The current fare is ${formatINR(currentFare.total)}. Please review and tap Confirm to book.`
          : describeError(e, 'Could not complete your booking request. Please try again or call our 24/7 helpline.'),
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const fareBreakup = buildFareBreakup(category, quote, outstation);
  const vehicleImage = getVehicleImage(category.name);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Mobile Step Header */}
      <StepHeader title="Review & Confirm Booking" step={3} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled">
        {/* Trip Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <Image source={vehicleImage} style={styles.carThumb} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.carNameText}>{category.name}</Text>
              <Text style={styles.carSubText}>
                {category.seats} Passengers · {tripType} · AC Cab
              </Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#059669" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>

          <View style={styles.routeDivider} />

          {/* Pickup & Destination stops */}
          <View style={styles.stopRow}>
            <View style={[styles.stopDot, { backgroundColor: '#10B981' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stopLabel}>PICKUP LOCATION</Text>
              <Text style={styles.stopName} numberOfLines={2}>
                {pickup.name}
              </Text>
              {pickup.address && pickup.address !== pickup.name ? (
                <Text style={styles.stopAddress} numberOfLines={1}>
                  {pickup.address}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.stopRow}>
            <View style={[styles.stopDot, { backgroundColor: colors.primary }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stopLabel}>DESTINATION</Text>
              <Text style={styles.stopName} numberOfLines={2}>
                {drop.name}
              </Text>
              {drop.address && drop.address !== drop.name ? (
                <Text style={styles.stopAddress} numberOfLines={1}>
                  {drop.address}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Schedule & Distance pill row */}
          <View style={styles.itineraryPillsRow}>
            <View style={styles.itineraryPill}>
              <Ionicons name="calendar-outline" size={14} color={colors.primary} />
              <Text style={styles.itineraryPillText}>
                {scheduledAt ? `${formatDate(scheduledAt)} · ${formatTime(scheduledAt)}` : 'Pickup time not chosen'}
              </Text>
            </View>
            <View style={styles.itineraryPill}>
              <Ionicons name="speedometer-outline" size={14} color={colors.slate} />
              <Text style={styles.itineraryPillText}>{formatDistance(route.distanceKm)}</Text>
            </View>
            <View style={styles.itineraryPill}>
              <Ionicons name="time-outline" size={14} color={colors.slate} />
              <Text style={styles.itineraryPillText}>~{formatDuration(route.durationMin)}</Text>
            </View>
          </View>
        </View>

        {/* Payment Method Selector */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Select Payment Mode</Text>
          <View style={styles.payList} accessibilityRole="radiogroup">
            {PAYMENT_OPTIONS.map((p) => {
              const on = payment === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPayment(p.id)}
                  style={[styles.payOption, on && styles.payOptionActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <View style={[styles.payIconBox, on && styles.payIconBoxActive]}>
                    <Ionicons name={p.icon} size={22} color={on ? colors.primary : colors.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.payOptionLabel, on && { color: colors.primary }]}>{p.label}</Text>
                      {p.badge ? (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedBadgeText}>{p.badge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.payOptionHint}>{p.hint}</Text>
                  </View>
                  <Ionicons
                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={on ? colors.primary : '#CBD5E1'}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Promo Code Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Have a Promo Code?</Text>
          <View style={styles.promoInputRow}>
            <TextInput
              style={styles.promoInput}
              placeholder="e.g. FIRST50"
              placeholderTextColor={colors.slate}
              value={promoInput}
              onChangeText={(t) => {
                setPromoInput(t);
                setPromoError('');
              }}
              autoCapitalize="characters"
            />
            <Pressable
              onPress={applyPromo}
              disabled={!promoInput.trim()}
              style={[styles.applyBtn, !promoInput.trim() && { opacity: 0.5 }]}
            >
              <Text style={styles.applyBtnText}>Apply</Text>
            </Pressable>
          </View>
          {promoMsg ? (
            <Text style={[styles.promoFeedback, { color: promoMsg.ok ? '#059669' : colors.primary }]}>
              {promoMsg.text}
            </Text>
          ) : null}
        </View>

        {/* Detailed Fare Breakup */}
        <View style={styles.card}>
          <Pressable
            style={styles.fareHeaderRow}
            onPress={() => setShowFareLines((v) => !v)}
            accessibilityRole="button"
          >
            <View>
              <Text style={styles.cardHeader}>Fare Breakdown</Text>
              <Text style={styles.fareSubText}>All taxes & driver allowance included</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.headerTotalFare}>{formatINR(quote.total)}</Text>
              <Ionicons name={showFareLines ? 'chevron-up' : 'chevron-down'} size={18} color={colors.slate} />
            </View>
          </Pressable>

          {showFareLines && fareBreakup ? (
            <View style={{ marginTop: space.sm }}>
              <FareLines lines={fareBreakup.lines} total={quote.total} estimated />
              <View style={styles.farePolicyBox}>
                <Ionicons name="information-circle-outline" size={16} color="#0284C7" />
                <Text style={styles.farePolicyText}>
                  Tolls, inter-state entry tax and parking charges are payable directly to the chauffeur against receipts.
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Passenger Information */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Rider Details & Communication</Text>
          <View style={styles.riderRow}>
            <View style={styles.riderAvatar}>
              <Ionicons name="person" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.riderName}>{profile.name}</Text>
              <Text style={styles.riderPhone}>{profile.phone}</Text>
            </View>
          </View>

          <View style={styles.checkboxRow}>
            <Checkbox
              checked={waSame}
              onChange={setWaSame}
              label="Send driver details, car number & live trip updates via WhatsApp"
            />
          </View>

          {!waSame ? (
            <View style={{ marginTop: space.sm }}>
              <TextField
                label="WhatsApp Number"
                value={waNumber}
                onChangeText={setWaNumber}
                keyboardType="phone-pad"
                placeholder="10-digit mobile number"
                error={waError}
              />
            </View>
          ) : null}

          {/* Optional Notes for Driver */}
          <View style={{ marginTop: space.sm }}>
            <Text style={styles.fieldSubLabel}>Special Instructions for Chauffeur (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g. Flight arrival timing, extra luggage carrier required, landmark details"
              placeholderTextColor={colors.slate}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />
          </View>
        </View>

        {/* Terms & Conditions Acceptance */}
        <View style={styles.termsBox}>
          <Checkbox
            checked={termsAccepted}
            onChange={setTermsAccepted}
            label="I accept the one_way_car_rental booking terms and cancellation policy, and understand this is a booking request that one_way_car_rental reviews before arranging a vehicle."
          />
        </View>

        {submitError ? <Notice message={submitError} tone="error" style={{ marginBottom: space.sm }} /> : null}

        {/* Spacing for bottom button */}
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Sticky Bottom Confirmation Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.totalRecapCol}>
          <Text style={styles.recapLabel}>TOTAL PAYABLE</Text>
          <Text style={styles.recapAmount}>{formatINR(quote.total)}</Text>
          <Text style={styles.recapMode}>
            {payment === 'UPI' ? 'Pay by UPI after your trip' : 'Cash to driver at drop'}
          </Text>
        </View>

        <Pressable
          onPress={submit}
          disabled={!!blocker || submitting}
          style={({ pressed }) => [
            styles.confirmBtn,
            (!!blocker || submitting) && { opacity: 0.5 },
            pressed && { backgroundColor: '#B71C1C' },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Submit booking request for ${formatINR(quote.total)}`}
        >
          {submitting ? (
            <Text style={styles.confirmBtnText}>Submitting…</Text>
          ) : (
            <>
              <Text style={styles.confirmBtnText}>Submit booking request</Text>
              <Ionicons name="checkmark-circle" size={20} color={colors.white} />
            </>
          )}
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
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: space.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  carThumb: {
    width: 64,
    height: 42,
  },
  carNameText: {
    fontFamily: fonts.black,
    fontSize: 17,
    fontWeight: '900',
    color: colors.ink,
  },
  carSubText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slate,
    marginTop: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: radius.full,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  verifiedText: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  routeDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  stopLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.slate,
    letterSpacing: 0.5,
  },
  stopName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
    marginTop: 1,
  },
  stopAddress: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.slate,
    marginTop: 1,
  },
  itineraryPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexWrap: 'wrap',
  },
  itineraryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.full,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itineraryPillText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.ink,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: space.md,
    marginBottom: space.sm,
  },
  cardHeader: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.ink,
    marginBottom: space.xs,
  },
  payList: {
    gap: 8,
    marginTop: space.xs,
  },
  payOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: radius.md,
    padding: space.sm,
    backgroundColor: '#F8FAFC',
  },
  payOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#FFFBFA',
  },
  payIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payIconBoxActive: {
    backgroundColor: '#FEE2E2',
  },
  payOptionLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  payOptionHint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.slate,
    marginTop: 2,
  },
  recommendedBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  recommendedBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.white,
  },
  promoInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: space.xs,
  },
  promoInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: 8,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: {
    fontFamily: fonts.bold,
    color: colors.white,
    fontSize: 13,
  },
  promoFeedback: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    marginTop: 6,
  },
  fareHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareSubText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.slate,
  },
  headerTotalFare: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.primary,
  },
  farePolicyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderRadius: radius.md,
    padding: space.sm,
    marginTop: space.sm,
  },
  farePolicyText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#0369A1',
    lineHeight: 15,
    flex: 1,
  },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  riderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  riderPhone: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.slate,
  },
  checkboxRow: {
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  fieldSubLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.slate,
    marginBottom: 4,
  },
  notesInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: radius.md,
    padding: space.sm,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.ink,
    minHeight: 52,
    textAlignVertical: 'top',
  },
  termsBox: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: space.md,
    marginBottom: space.sm,
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
  totalRecapCol: {
    flex: 1,
  },
  recapLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 9,
    color: colors.slate,
    letterSpacing: 0.5,
  },
  recapAmount: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.primary,
    lineHeight: 24,
  },
  recapMode: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.ink,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmBtnText: {
    fontFamily: fonts.bold,
    color: colors.white,
    fontSize: 15,
  },
});

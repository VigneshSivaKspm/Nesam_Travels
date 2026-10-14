// Review & book — step 3 of 3: payment method, promo, booking contact, note,
// the final fare breakup and the booking itself (createBooking on the server,
// which re-prices and refuses a fare that changed).
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScrollView, Content, DesktopRow } from '../components/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Notice, TextField } from '../components/ui';
import { StepHeader } from '../components/brand';
import { DesktopHeader } from '../components/DesktopHeader';
import { Checkbox } from '../components/Checkbox';
import { FareLines } from '../components/FareLines';
import { useCustomerData } from '../context/CustomerData';
import { useBookingDraft } from '../context/BookingDraft';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { calculateFare, isOutstation, serviceName, validateCoupon } from '../services/pricingService';
import { createRideRequest } from '../services/rideService';
import { buildFareBreakup } from '../utils/fareBreakup';
import type { AppliedCoupon, FareBreakdown, PaymentMethod } from '../types';
import { formatDate, formatINR, formatTime } from '../utils/format';
import { describeError } from '../utils/retry';
import { colors, radius, space } from '../theme';
import { useResponsive } from '../theme/responsive';
import { scheduleProblem, whatsappProblem } from '../utils/bookingRules';

// The booking server records Cash or UPI only.
const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; hint: string; icon: 'cash-outline' | 'phone-portrait-outline' }[] = [
  { id: 'Cash', label: 'Cash', hint: 'Pay the driver at drop', icon: 'cash-outline' },
  { id: 'UPI', label: 'UPI', hint: 'GPay / PhonePe / Paytm', icon: 'phone-portrait-outline' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ConfirmBookingScreen() {
  const { isDesktop, isCompact } = useResponsive();
  const navigation = useNavigation();
  const { profile, trips, liveRide } = useCustomerData();
  const { draft, reset, route, categories, adjustment, coupons } = useBookingDraft();
  const { pickup, drop, tripType, scheduledAt, categoryId } = draft;
  const { online } = useNetworkStatus();

  const [payment, setPayment] = useState<PaymentMethod>('Cash');
  const [promoInput, setPromoInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [promoError, setPromoError] = useState('');
  const [notes, setNotes] = useState('');
  const [waSame, setWaSame] = useState(true);
  const [waCode, setWaCode] = useState('+91');
  const [waNumber, setWaNumber] = useState('');
  const [email, setEmail] = useState('');
  const [showFare, setShowFare] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [serverQuote, setServerQuote] = useState<{ key: string; fare: FareBreakdown } | null>(null);
  const submittingRef = useRef(false);

  const category = categories.find((c) => c.id === categoryId) ?? null;
  if (!pickup || !drop || !route || !category) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.pad}>
          <StepHeader title="Review & book" step={3} onBack={() => navigation.goBack()} />
          <Notice message="Your trip details changed. Go back and choose your ride again." />
          <Button title="Back to choose your ride" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const pickupTime = scheduledAt ?? new Date();
  const service = serviceName(pickup, drop, route.distanceKm);
  const history = trips.filter((t) => t.status !== 'Cancelled' && t.status !== 'Rejected');

  /** Validates a promo code against the current, undiscounted fare. */
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
  // Re-validated on every render so a discount never outlives the fare it was granted on.
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
  const quote = serverQuote?.key === priceKey ? serverQuote.fare : localQuote;
  const outstation = isOutstation(route.distanceKm);

  const emailError = email.trim() && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address or leave it blank.' : '';
  const waError = whatsappProblem(waSame, waCode, waNumber);
  const blocker = !online
    ? 'You’re offline. Reconnect to book.'
    : liveRide
      ? 'You already have a ride in progress.'
      : scheduleProblem(scheduledAt) || (waError || emailError ? 'Check your contact details.' : '');

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
        whatsapp: waSame ? { sameAsMobile: true } : { sameAsMobile: false, countryCode: waCode.trim(), number: waNumber.replace(/[\s()-]/g, '') },
        email: email.trim(),
      });
      reset();
      // The ride screen takes over; Back returns to the booking home, not to this form.
      navigation.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'ActiveRide', params: { bookingId: res.id, unconfirmed: res.unconfirmed } }] });
    } catch (e) {
      const currentFare = (e as { details?: { fare?: FareBreakdown } }).details?.fare;
      if (currentFare && Number.isFinite(currentFare.total)) setServerQuote({ key: priceKey, fare: currentFare });
      setSubmitError(currentFare ? `The fare is now ${formatINR(currentFare.total)}. Review it and tap Book again to confirm.` : describeError(e, 'We couldn’t place your booking. Please try again.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const fareBreakup = buildFareBreakup(category, quote, outstation);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <DesktopHeader
        title="Review & Confirm Booking"
        subtitle="Step 3 of 3: Check trip parameters, payment method and rider contact"
        badge="Final Step"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        {isCompact ? <StepHeader title="Review & book" step={3} onBack={() => navigation.goBack()} /> : null}

        <DesktopRow gap={24} style={styles.contentRow}>
          {/* Left Column: Preferences, Payment, Contact, Notes */}
          <View style={[styles.mainCol, isDesktop && { flex: 1.3 }]}>
            {/* Payment Method */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment Method</Text>
              <Text style={styles.cardSubtitle}>Select how you wish to settle this trip</Text>
              <View style={styles.payRow} accessibilityRole="radiogroup">
                {PAYMENT_OPTIONS.map((p) => {
                  const on = payment === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setPayment(p.id)}
                      style={({ pressed, hovered }: any) => [
                        styles.pay,
                        on && styles.payOn,
                        hovered && !on && styles.payHovered,
                        pressed && { opacity: 0.9 },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                    >
                      <Ionicons name={p.icon} size={26} color={on ? colors.primary : colors.ink} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.payLabel, on && { color: colors.primary }]}>{p.label}</Text>
                        <Text style={styles.payHint}>{p.hint}</Text>
                      </View>
                      <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? colors.primary : colors.faint} />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Contact details for this trip */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Contact Details</Text>
              <Text style={styles.cardSubtitle}>Driver and booking dispatch updates will be sent here</Text>

              <Checkbox checked={waSame} onChange={setWaSame} label={`WhatsApp number is the same as my mobile (${profile.phone || 'not set'})`} />
              {!waSame ? (
                <View style={styles.waRow}>
                  <TextField label="Code" value={waCode} onChangeText={setWaCode} keyboardType="phone-pad" autoComplete="off" maxLength={4} style={{ width: 84, marginBottom: 0 }} accessibilityLabel="WhatsApp country code" />
                  <TextField label="WhatsApp number" required value={waNumber} onChangeText={setWaNumber} keyboardType="phone-pad" autoComplete="off" maxLength={16} placeholder="10-digit number" style={{ flex: 1, marginBottom: 0 }} />
                </View>
              ) : null}
              {waError ? <Text style={styles.err}>{waError}</Text> : null}

              <TextField
                label="Email (optional)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder={profile.email || 'name@example.com'}
                hint={profile.email ? 'Leave blank to use your account email.' : 'For booking confirmation and GST receipt.'}
                error={emailError}
                style={{ marginTop: space.md, marginBottom: 0 }}
              />
            </View>

            {/* Note for the driver */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Driver Instructions</Text>
              <Text style={styles.cardSubtitle}>Pickup landmark, gate number or luggage requirements</Text>
              <TextInput
                value={notes}
                onChangeText={(v) => setNotes(v.slice(0, 300))}
                placeholder="Gate number, building name, luggage notes…"
                placeholderTextColor={colors.faint}
                multiline
                style={styles.notes}
                accessibilityLabel="Note for the driver"
              />
              <Text style={styles.counter}>{notes.length}/300 characters</Text>
            </View>

            {/* Mobile collapsible fare card */}
            {isCompact ? (
              <View style={styles.card}>
                <Pressable onPress={() => setShowFare((s) => !s)} style={styles.fareHead} accessibilityRole="button" accessibilityState={{ expanded: showFare }}>
                  <Ionicons name="document-text-outline" size={22} color={colors.ink} />
                  <Text style={styles.fareTitle}>Fare details</Text>
                  <Ionicons name={showFare ? 'chevron-up' : 'chevron-down'} size={22} color={colors.slate} />
                </Pressable>
                {showFare ? (
                  <View style={{ marginTop: space.md }}>
                    <FareLines lines={fareBreakup.lines} total={quote.total} estimated />
                  </View>
                ) : null}
              </View>
            ) : null}

            {submitError ? <Notice message={submitError} onRetry={!serverQuote ? () => void submit() : undefined} style={{ marginTop: space.md }} /> : null}
          </View>

          {/* Right Column: Trip Overview, Promo Code, Fare Breakdown & CTA */}
          <View style={[styles.sidebarCol, isDesktop && { flex: 1 }]}>
            {/* Trip parameters overview */}
            <View style={styles.summaryCard}>
              <Text style={styles.cardTitle}>Journey Summary</Text>
              <View style={styles.placeRow}>
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
                <Text style={styles.place} numberOfLines={2}>
                  {pickup.name}
                </Text>
              </View>
              <View style={styles.connector} />
              <View style={styles.placeRow}>
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <Text style={styles.place} numberOfLines={2}>
                  {drop.name}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={18} color={colors.slate} />
                <Text style={styles.meta}>{scheduledAt ? `${formatDate(scheduledAt)} · ${formatTime(scheduledAt)}` : 'Today · Now'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="car-outline" size={18} color={colors.slate} />
                <Text style={styles.meta}>
                  {category.name} · {category.seats} seats · {tripType}
                </Text>
              </View>
            </View>

            {/* Promo code box */}
            <View style={styles.summaryCard}>
              <Text style={styles.cardTitle}>Promo Code</Text>
              <View style={styles.promoRow}>
                <TextInput
                  value={promoInput}
                  onChangeText={(v) => setPromoInput(v.toUpperCase())}
                  placeholder="Enter promo code"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="characters"
                  style={styles.promoInput}
                  editable={!appliedCode}
                  accessibilityLabel="Promo code"
                />
                {appliedCode ? (
                  <Button
                    small
                    variant="secondary"
                    title="Remove"
                    onPress={() => {
                      setAppliedCode(null);
                      setPromoError('');
                      setPromoInput('');
                    }}
                  />
                ) : (
                  <Button small variant="dark" title="Apply" disabled={!promoInput.trim()} onPress={applyPromo} />
                )}
              </View>
              {promoMsg ? <Text style={[styles.promoMsg, { color: promoMsg.ok ? colors.success : colors.primaryDark }]}>{promoMsg.text}</Text> : null}
            </View>

            {/* Desktop Fare Summary & Book CTA Card */}
            {isDesktop ? (
              <View style={styles.summaryCard}>
                <Text style={styles.cardTitle}>Payment Breakdown</Text>
                <View style={{ marginVertical: space.sm }}>
                  <FareLines lines={fareBreakup.lines} total={quote.total} estimated />
                </View>

                {blocker ? (
                  <View style={styles.blockerBox}>
                    <Ionicons name="alert-circle" size={18} color={colors.primaryDark} />
                    <Text style={styles.blockerText}>{blocker}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={() => void submit()}
                  disabled={!!blocker || submitting}
                  style={({ pressed, hovered }: any) => [
                    styles.desktopBookBtn,
                    (!!blocker || submitting) && { opacity: 0.45 },
                    hovered && !blocker && !submitting && { backgroundColor: colors.primaryDark },
                    pressed && !blocker && !submitting && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !!blocker || submitting, busy: submitting }}
                >
                  <Text style={styles.desktopBookText}>{submitting ? 'Placing Booking…' : scheduledAt ? 'Confirm Schedule Ride' : 'Confirm & Book Ride'}</Text>
                  <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                </Pressable>
              </View>
            ) : null}
          </View>
        </DesktopRow>
      </ScrollView>

      {/* Mobile/Compact Blocker Banner & Bottom Bar */}
      {isCompact && blocker ? <Text style={styles.blocker}>{blocker}</Text> : null}

      {isCompact ? (
        <View style={styles.bottomBarWrap}>
          <Content style={styles.bottomBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.estLabel}>{coupon ? `Estimated fare (−${formatINR(quote.discount)} promo)` : 'Estimated fare'}</Text>
              <Text style={styles.estValue}>{formatINR(quote.total)}</Text>
            </View>
            <Pressable
              onPress={() => void submit()}
              disabled={!!blocker || submitting}
              style={({ pressed }) => [styles.book, (!!blocker || submitting) && { opacity: 0.45 }, pressed && { backgroundColor: colors.primaryDark }]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!blocker || submitting, busy: submitting }}
            >
              <Text style={styles.bookText}>{submitting ? 'Booking…' : scheduledAt ? 'Schedule ride' : 'Book ride'}</Text>
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
  sidebarCol: { width: '100%', minWidth: 320 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: space.lg,
    marginBottom: space.md,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)' as any,
  },
  summaryCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: space.lg,
    marginBottom: space.md,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)' as any,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: 2 },
  cardSubtitle: { fontSize: 14, color: colors.slate, marginBottom: space.md },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 12, height: 12, borderRadius: 6 },
  connector: { width: 0, height: 16, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: colors.faint, marginLeft: 5 },
  place: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  meta: { flex: 1, fontSize: 14, color: colors.slate },
  payRow: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
  pay: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: space.md,
    minHeight: 64,
  },
  payOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  payHovered: { borderColor: colors.slate, backgroundColor: '#F8FAFC' },
  payLabel: { fontSize: 16, fontWeight: '800', color: colors.ink },
  payHint: { fontSize: 13, color: colors.slate },
  promoRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  promoInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 48,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  promoMsg: { fontSize: 14, marginTop: 6, fontWeight: '600' },
  waRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  err: { color: colors.primaryDark, fontSize: 13, fontWeight: '600', marginTop: 6 },
  notes: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  counter: { fontSize: 12, color: colors.slate, textAlign: 'right', marginTop: 4 },
  fareHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  fareTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.ink },
  blockerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.primarySoft,
    padding: space.md,
    borderRadius: radius.md,
    marginVertical: space.sm,
  },
  blockerText: { fontSize: 13, fontWeight: '700', color: colors.primaryDark, flex: 1 },
  blocker: { fontSize: 14, fontWeight: '700', color: colors.primaryDark, backgroundColor: colors.primarySoft, paddingHorizontal: space.lg, paddingVertical: space.sm },
  desktopBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    marginTop: space.sm,
  },
  desktopBookText: { color: colors.white, fontSize: 17, fontWeight: '800' },
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
  book: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: space.xl, minHeight: 56 },
  bookText: { color: colors.white, fontSize: 19, fontWeight: '800' },
});

// Booking status & advance itinerary hub:
// Submitted → Confirmed by Admin → Chauffeur Assigned → Boarding OTP → In Progress → Completed.
// World-class mobile experience without live hailing map.
import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useRideFocus } from '../navigation/MainNavigator';
import { useCustomerData } from '../context/CustomerData';
import { Avatar, Button, Card, Notice, Screen } from '../components/ui';
import { ScrollView } from '../components/layout';
import { CancelRideSheet } from '../components/CancelRideSheet';
import { RatingCard } from '../components/RatingCard';
import { TripReceipt } from '../components/TripReceipt';
import { SafetySheet, shareTrip } from '../components/SafetySheet';
import { subscribeToBoardingOtp, subscribeToBooking } from '../services/rideService';
import { customerStatus } from '../utils/tripView';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import type { TripRecord } from '../types';
import { formatDate, formatDateTime, formatDistance, formatINR, formatPhone, formatTime, localMobile } from '../utils/format';
import { describeError } from '../utils/retry';
import { colors, fonts, radius, space, type } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { ILLUSTRATIONS } from '../assets/images';

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveRide'>;

export function ActiveRideScreen({ route, navigation }: Props) {
  const { bookingId, unconfirmed } = route.params;
  const { profile } = useCustomerData();
  const { dismiss, undismiss } = useRideFocus();
  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [pending, setPending] = useState(!!unconfirmed);
  const [fromCache, setFromCache] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [vanished, setVanished] = useState(false);
  const [subKey, setSubKey] = useState(0);
  const [otp, setOtp] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const { online } = useNetworkStatus();

  // Leaving this screen stops auto re-opening
  useEffect(() => {
    undismiss(bookingId);
    return navigation.addListener('beforeRemove', () => dismiss(bookingId));
  }, [navigation, bookingId, dismiss, undismiss]);

  // Booking document — real-time source of truth
  useEffect(() => {
    return subscribeToBooking(
      bookingId,
      (s) => {
        setPending(s.pending);
        setFromCache(s.fromCache);
        if (s.trip) {
          setTrip(s.trip);
          setVanished(false);
        } else if (!s.fromCache) {
          setVanished(true);
          setTrip(null);
        }
      },
      (e) => setLoadError(describeError(e, 'Could not load your booking details.')),
    );
  }, [bookingId, subKey]);

  useEffect(() => subscribeToBoardingOtp(bookingId, setOtp), [bookingId]);

  if (loadError && !trip) {
    return (
      <Screen edges={['top']}>
        <View style={styles.pad}>
          <Notice
            message={loadError}
            tone="error"
            onRetry={() => {
              setLoadError('');
              setSubKey((k) => k + 1);
            }}
          />
          <Button title="Back to My Bookings" variant="secondary" onPress={() => navigation.navigate('Tabs', { screen: 'Trips' })} />
        </View>
      </Screen>
    );
  }

  if (vanished) {
    return (
      <Screen edges={['top']}>
        <View style={styles.pad}>
          <Notice message="This booking is no longer available on the server. If this was unexpected, please contact support." />
          <Button title="Back to My Bookings" variant="secondary" onPress={() => navigation.navigate('Tabs', { screen: 'Trips' })} />
        </View>
      </Screen>
    );
  }

  if (!trip) {
    return (
      <Screen edges={['top']}>
        <View style={styles.loadingCenter}>
          <Text style={styles.loadingTitle}>Loading Booking Details…</Text>
          <Text style={styles.loadingSub}>Ref: {bookingId}</Text>
        </View>
      </Screen>
    );
  }

  const status = customerStatus(trip);
  const phase = trip.phase;
  const isCompleted = trip.status === 'Completed';
  const isCancelled = trip.status === 'Cancelled' || trip.status === 'Rejected';
  const hasChauffeur = !!trip.driver && !!trip.driver.name;
  const driverPhone = trip.driver?.phone;

  const statusIllustration = isCompleted
    ? ILLUSTRATIONS.tripCompleted
    : isCancelled
      ? ILLUSTRATIONS.error
      : phase === 'in_trip'
        ? ILLUSTRATIONS.journeyProgress
        : hasChauffeur
          ? ILLUSTRATIONS.driverArriving
          : ILLUSTRATIONS.bookingConfirmed;

  const openCall = () => {
    if (driverPhone) void Linking.openURL(`tel:${driverPhone}`);
  };

  const openHelpline = () => {
    void Linking.openURL(`tel:${SUPPORT_PHONE}`);
  };

  const openWhatsApp = () => {
    const text = encodeURIComponent(`Hi one_way_car_rental, I am enquiring about my booking reference #${trip.bookingId || trip.id}`);
    void Linking.openURL(`https://wa.me/919025099990?text=${text}`);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <CancelRideSheet key={trip.id} trip={showCancel ? trip : null} onClose={() => setShowCancel(false)} />
      <SafetySheet visible={showSafety} trip={trip} profile={profile} location={null} onClose={() => setShowSafety(false)} />

      {/* Top Mobile Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.navigate('Tabs', { screen: 'Trips' })}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to My Bookings"
        >
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.topBookingRef}>BOOKING REF: #{trip.bookingId || trip.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.topTripType}>{trip.tripType} Outstation Cab</Text>
        </View>
        <Pressable onPress={openHelpline} style={styles.topCallBtn} accessibilityRole="button" accessibilityLabel="Call 24/7 Helpline">
          <Ionicons name="call" size={16} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollPad}>
        {/* Status Highlight Banner */}
        <View style={[styles.statusBanner, isCompleted && styles.statusBannerSuccess, isCancelled && styles.statusBannerCancelled]}>
          <View style={styles.statusBannerContent}>
            <View style={{ flex: 1 }}>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusTitle}>{status.label}</Text>
              </View>
              <Text style={styles.statusDetail}>
                {pending ? 'Submitting your advance booking request to dispatch desk…' : status.detail}
              </Text>
              {trip.scheduledAt ? (
                <View style={styles.scheduledPill}>
                  <Ionicons name="time-outline" size={13} color={colors.ink} />
                  <Text style={styles.scheduledPillText}>Pickup: {formatDateTime(trip.scheduledAt)}</Text>
                </View>
              ) : null}
            </View>
            <Image
              source={statusIllustration}
              style={styles.statusIllustration}
              resizeMode="contain"
              accessible={false}
              importantForAccessibility="no"
            />
          </View>
        </View>

        {/* Advance Booking Stepper */}
        {!isCancelled ? (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Journey Milestone</Text>
            <View style={styles.stepperContainer}>
              <StepItem
                num={1}
                label="Booking Placed"
                sub={trip.createdAt ? formatDateTime(trip.createdAt) : 'Submitted'}
                done={true}
              />
              <StepConnector done={trip.status !== 'Pending'} />
              <StepItem
                num={2}
                label="Desk Confirmation"
                sub={trip.status === 'Pending' ? 'In Review' : 'Confirmed'}
                done={trip.status !== 'Pending'}
                active={trip.status === 'Pending'}
              />
              <StepConnector done={hasChauffeur} />
              <StepItem
                num={3}
                label="Chauffeur Assigned"
                sub={hasChauffeur ? trip.driver!.name : 'Arranging chauffeur'}
                done={hasChauffeur}
                active={trip.status === 'Approved' && !hasChauffeur}
              />
              <StepConnector done={phase === 'in_trip' || isCompleted} />
              <StepItem
                num={4}
                label="Trip Completed"
                sub={isCompleted ? 'Finished' : 'Upcoming'}
                done={isCompleted}
                active={phase === 'in_trip'}
              />
            </View>
          </View>
        ) : null}

        {/* Boarding OTP Card */}
        {hasChauffeur && !isCompleted && !isCancelled ? (
          <View style={styles.otpCard}>
            <View style={styles.otpHeaderRow}>
              <Ionicons name="key-outline" size={22} color={colors.primary} />
              <Text style={styles.otpHeaderTitle}>Start of Ride Boarding OTP</Text>
            </View>
            <Text style={styles.otpCode}>{otp ?? '····'}</Text>
            <Text style={styles.otpInstruction}>
              Share this 4-digit security code with your chauffeur upon arrival to begin your trip.
            </Text>
          </View>
        ) : null}

        {/* Assigned Chauffeur & Vehicle Card */}
        {hasChauffeur ? (
          <View style={styles.card}>
            <View style={styles.chauffeurTopRow}>
              <Avatar name={trip.driver!.name} photoUrl={trip.driver?.photoUrl} size={54} />
              <View style={{ flex: 1 }}>
                <Text style={styles.chauffeurName}>{trip.driver!.name}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={13} color="#D97706" />
                  <Text style={styles.ratingText}>{trip.driver?.rating != null ? trip.driver.rating.toFixed(1) : '4.9'}</Text>
                  <Text style={styles.chauffeurMeta}>• Verified Chauffeur</Text>
                </View>
                <Text style={styles.carModelText}>
                  {trip.driver?.vehicleModel || trip.categoryName}
                </Text>
              </View>

              {trip.driver?.vehicleNumber ? (
                <View style={styles.plateBadge}>
                  <Text style={styles.plateText}>{trip.driver.vehicleNumber}</Text>
                </View>
              ) : null}
            </View>

            {driverPhone ? (
              <View style={styles.chauffeurActionRow}>
                <Pressable onPress={openCall} style={styles.callChauffeurBtn}>
                  <Ionicons name="call" size={16} color={colors.white} />
                  <Text style={styles.callChauffeurText}>Call Chauffeur ({formatPhone(driverPhone)})</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Itinerary Details */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Itinerary Details</Text>
          <View style={styles.itineraryRoute}>
            <View style={styles.stopRow}>
              <View style={[styles.stopDot, { backgroundColor: '#10B981' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stopLabel}>PICKUP LOCATION</Text>
                <Text style={styles.stopName}>{trip.pickup.name}</Text>
                {trip.pickup.address && trip.pickup.address !== trip.pickup.name ? (
                  <Text style={styles.stopAddr}>{trip.pickup.address}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.routeTrackLine} />

            <View style={styles.stopRow}>
              <View style={[styles.stopDot, { backgroundColor: colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stopLabel}>DESTINATION</Text>
                <Text style={styles.stopName}>{trip.drop.name}</Text>
                {trip.drop.address && trip.drop.address !== trip.drop.name ? (
                  <Text style={styles.stopAddr}>{trip.drop.address}</Text>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.specsRow}>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>CAB CATEGORY</Text>
              <Text style={styles.specVal}>{trip.categoryName}</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>SCHEDULED TIME</Text>
              <Text style={styles.specVal}>{trip.scheduledAt ? formatTime(trip.scheduledAt) : 'Today'}</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>TOTAL DISTANCE</Text>
              <Text style={styles.specVal}>{formatDistance(trip.distanceKm)}</Text>
            </View>
          </View>
        </View>

        {/* Fare & Payment Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Fare & Payment Summary</Text>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Total Agreed Fare</Text>
            <Text style={styles.fareValue}>{formatINR(trip.fare)}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Payment Method</Text>
            <Text style={styles.fareValue}>{trip.paymentMethod}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Payment Status</Text>
            <View style={styles.paymentStatusPill}>
              <Text style={styles.paymentStatusText}>{trip.paymentStatus || 'Pending'}</Text>
            </View>
          </View>
          {trip.tollCharges > 0 ? (
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Toll Charges</Text>
              <Text style={styles.fareValue}>{formatINR(trip.tollCharges)}</Text>
            </View>
          ) : null}

          <View style={styles.fareDivider} />
          <View style={styles.fareRow}>
            <Text style={styles.balanceLabel}>Balance to Collect at Drop</Text>
            <Text style={styles.balanceValue}>{formatINR(trip.fare + (trip.tollCharges || 0))}</Text>
          </View>
        </View>

        {/* Rating Card after completion */}
        {isCompleted ? (
          <View style={{ marginBottom: space.sm }}>
            <RatingCard trip={trip} profile={profile} />
          </View>
        ) : null}

        {/* Receipt trigger */}
        {isCompleted || showReceipt ? (
          <TripReceipt trip={trip} customerName={profile.name} />
        ) : null}

        {/* Operations Help & Actions */}
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>24/7 one_way_car_rental Operations Desk</Text>
          <Text style={styles.helpSub}>
            Need to amend pickup time, update passenger count, or need assistance?
          </Text>
          <View style={styles.helpButtonsRow}>
            <Pressable onPress={openHelpline} style={styles.helpBtn}>
              <Ionicons name="call" size={16} color={colors.primary} />
              <Text style={styles.helpBtnText}>Call Desk</Text>
            </Pressable>
            <Pressable onPress={openWhatsApp} style={[styles.helpBtn, styles.helpBtnGreen]}>
              <Ionicons name="logo-whatsapp" size={16} color="#059669" />
              <Text style={[styles.helpBtnText, { color: '#059669' }]}>WhatsApp</Text>
            </Pressable>
            <Pressable onPress={() => void shareTrip(trip, null)} style={styles.helpBtn}>
              <Ionicons name="share-social-outline" size={16} color={colors.ink} />
              <Text style={[styles.helpBtnText, { color: colors.ink }]}>Share</Text>
            </Pressable>
          </View>
        </View>

        {/* Cancellation Option (before trip completion) */}
        {!isCompleted && !isCancelled ? (
          <Pressable onPress={() => setShowCancel(true)} style={styles.cancelTrigger}>
            <Ionicons name="close-circle-outline" size={16} color={colors.slate} />
            <Text style={styles.cancelTriggerText}>Cancel this booking</Text>
          </Pressable>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StepItem({ num, label, sub, done, active }: { num: number; label: string; sub: string; done?: boolean; active?: boolean }) {
  return (
    <View style={styles.stepItemCol}>
      <View style={[styles.stepCircle, done && styles.stepCircleDone, active && styles.stepCircleActive]}>
        {done ? (
          <Ionicons name="checkmark" size={12} color={colors.white} />
        ) : (
          <Text style={[styles.stepNumber, active && { color: colors.white }]}>{num}</Text>
        )}
      </View>
      <Text style={[styles.stepItemLabel, active && { color: colors.primary, fontFamily: fonts.extraBold, fontWeight: '800' }]}>{label}</Text>
      <Text style={styles.stepItemSub} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

function StepConnector({ done }: { done?: boolean }) {
  return <View style={[styles.stepConnector, done && styles.stepConnectorDone]} />;
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBookingRef: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  topTripType: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.slate,
  },
  topCallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  statusBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusIllustration: {
    width: 76,
    height: 64,
  },
  statusBannerSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusBannerCancelled: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  statusTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
  },
  statusDetail: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slate,
    marginTop: 4,
    lineHeight: 17,
  },
  scheduledPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  scheduledPillText: {
    fontFamily: fonts.bold,
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  cardHeader: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: space.sm,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  stepItemCol: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepCircleDone: {
    backgroundColor: '#10B981',
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
  },
  stepNumber: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.slate,
  },
  stepItemLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.ink,
    textAlign: 'center',
  },
  stepItemSub: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.slate,
    textAlign: 'center',
    marginTop: 1,
  },
  stepConnector: {
    height: 2,
    backgroundColor: '#E2E8F0',
    flex: 0.6,
    marginTop: 10,
  },
  stepConnectorDone: {
    backgroundColor: '#10B981',
  },
  otpCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.lg,
    padding: space.md,
    alignItems: 'center',
    marginBottom: space.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  otpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  otpHeaderTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#B45309',
  },
  otpCode: {
    fontFamily: fonts.black,
    fontSize: 32,
    color: colors.primary,
    letterSpacing: 8,
    marginVertical: 4,
  },
  otpInstruction: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#92400E',
    textAlign: 'center',
  },
  chauffeurTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chauffeurName: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.ink,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  ratingText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#D97706',
  },
  chauffeurMeta: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#059669',
  },
  carModelText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slate,
    marginTop: 2,
  },
  plateBadge: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: radius.sm,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  plateText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  chauffeurActionRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  callChauffeurBtn: {
    backgroundColor: '#059669',
    borderRadius: radius.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  callChauffeurText: {
    fontFamily: fonts.bold,
    color: colors.white,
    fontSize: 13,
  },
  itineraryRoute: {
    marginBottom: 10,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stopDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  stopLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.slate,
    letterSpacing: 0.5,
  },
  stopName: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
    marginTop: 1,
  },
  stopAddr: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.slate,
    marginTop: 1,
  },
  routeTrackLine: {
    width: 2,
    height: 16,
    backgroundColor: '#CBD5E1',
    marginLeft: 3,
    marginVertical: 2,
  },
  specsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  specBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.sm,
    padding: 6,
  },
  specLabel: {
    fontFamily: fonts.bold,
    fontSize: 8,
    color: colors.slate,
  },
  specVal: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink,
    marginTop: 2,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  fareLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.slate,
  },
  fareValue: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.ink,
  },
  paymentStatusPill: {
    backgroundColor: '#EFF6FF',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  paymentStatusText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#0284C7',
  },
  fareDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 6,
  },
  balanceLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  balanceValue: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.primary,
  },
  helpCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: space.md,
    marginBottom: space.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  helpTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  helpSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.slate,
    marginTop: 2,
    marginBottom: 10,
  },
  helpButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  helpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: radius.md,
    paddingVertical: 8,
  },
  helpBtnGreen: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  helpBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
  },
  cancelTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  cancelTriggerText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.slate,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  loadingTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
  },
  loadingSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slate,
    marginTop: 4,
  },
});

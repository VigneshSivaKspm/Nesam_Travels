// Choose your cab — step 2 of 3, in the customer reference layout. Fares are the booking
// server's quotes (the only amount that can be booked); the local calculation is a labelled
// estimate while they load.
import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Badge, Button, FlowFooter, Notice, Sheet, Steps, TextButton } from '../components/ui';
import { Content, ScrollView } from '../components/layout';
import { AppHeader, SubHeader, getVehicleImage } from '../components/brand';
import { Icon } from '../components/Icon';
import { FareLines } from '../components/FareLines';
import { useBookingDraft } from '../context/BookingDraft';
import { getRoute } from '../services/geoService';
import { calculateFare, isOutstation } from '../services/pricingService';
import { buildFareBreakup } from '../utils/fareBreakup';
import { GST_RATE, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import type { FareBreakdown, RideCategory } from '../types';
import { formatDistance, formatINR, formatTime } from '../utils/format';
import { colors, fonts, space } from '../theme';

const dayText = (d: Date) => `${d.getDate()} ${d.toLocaleDateString('en-IN', { month: 'short' })}`;

export function ChooseRideScreen() {
  const navigation = useNavigation();
  const { draft, update, route, setRoute, routeKey, categories, adjustment, serverQuote } = useBookingDraft();
  const { pickup, drop, tripType, scheduledAt, tripEndAt, categoryId } = draft;
  const [fareFor, setFareFor] = useState<string | null>(null);
  const [routeError, setRouteError] = useState('');
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!pickup || !drop || route) return undefined;
    const controller = new AbortController();
    getRoute(pickup, drop, controller.signal)
      .then((r) => !controller.signal.aborted && setRoute(routeKey, r))
      .catch(() => !controller.signal.aborted && setRouteError('Could not calculate the driving distance. Check your connection and try again.'));
    return () => controller.abort();
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-select a cab when none is chosen yet.
  useEffect(() => {
    if (!categoryId && categories.length > 0) update({ categoryId: categories[0]!.id });
  }, [categoryId, categories, update]);

  const goHome = () => navigation.navigate('Tabs', { screen: 'Book' });

  if (!pickup || !drop) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <AppHeader />
        <View style={styles.pad}>
          <SubHeader plain title="Choose your cab" subtitle="Your journey. Your choice of comfort." onBack={() => navigation.goBack()} />
          <Notice message="Please set your pickup and drop locations first." />
          <Button title="Plan a trip" onPress={goHome} />
        </View>
      </SafeAreaView>
    );
  }

  const pickupTime = scheduledAt ?? new Date(now);
  const server = serverQuote.status === 'ready' ? serverQuote.data : null;
  const quotes = new Map<string, FareBreakdown>();
  if (server) {
    for (const x of server.quotes) if (x.ok && x.fare) quotes.set(x.categoryId, x.fare);
  } else if (route) {
    for (const c of categories) quotes.set(c.id, calculateFare({ category: c, route, tripType, pickupTime, adjustment }));
  }

  const selected: RideCategory | null = categories.find((c) => c.id === categoryId) ?? categories[0] ?? null;
  const selectedQuote = selected ? quotes.get(selected.id) ?? null : null;
  const outstation = route ? isOutstation(route.distanceKm) : true;
  const tooFar = route ? route.distanceKm > 1500 : false;
  const entryOf = (id?: string) => server?.quotes.find((x) => x.categoryId === id);
  const canContinue = !!route && !!selectedQuote && !tooFar && !!server && !!entryOf(selected?.id)?.ok;
  const selectedEntry = entryOf(selected?.id);
  const quoteLoading = !!route && !server && serverQuote.status === 'loading';
  const quoteProblem = !route
    ? ''
    : tooFar
      ? `This trip is too long to book online. Please call us on ${SUPPORT_PHONE_DISPLAY} to arrange it.`
      : !scheduledAt
        ? 'Choose a pickup date and time to see confirmed fares.'
        : serverQuote.status === 'error'
          ? serverQuote.error || 'We could not confirm the fare right now.'
          : selectedEntry && !selectedEntry.ok
            ? selectedEntry.error || 'This cab cannot be booked for this trip. Please choose another cab.'
            : '';

  const fareSheet = categories.find((c) => c.id === fareFor) ?? null;
  const fareSheetQuote = fareSheet ? quotes.get(fareSheet.id) ?? null : null;
  const included = route ? Math.round(route.distanceKm * (tripType === 'Round Trip' ? 2 : 1)) : 0;
  const serviceBadge = tripType === 'Airport Taxi' ? 'Airport' : tripType;
  const gstText = `${Math.round(GST_RATE * 100)}% GST`;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AppHeader />
      <ScrollView kind="narrow" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SubHeader plain title="Choose your cab" subtitle="Your journey. Your choice of comfort." onBack={() => navigation.goBack()} />
        <Steps step={2} />

        <View style={styles.summary}>
          <View style={styles.summaryTop}>
            <Badge label={serviceBadge} tone="success" />
            <TextButton title="Edit" icon="pencil" onPress={() => navigation.goBack()} accessibilityLabel="Edit trip details" />
          </View>
          <Text style={styles.route} accessibilityRole="header">
            {pickup.name}
            <Text style={styles.routeArrow}>{'  →  '}</Text>
            {tripType === 'Local Rental' ? 'Local Rental' : drop.name}
          </Text>
          <Text style={styles.meta}>
            {scheduledAt ? `${dayText(scheduledAt)} · ${formatTime(scheduledAt).replace(/^0/, '')}` : 'Pickup time not chosen'}
            {tripType === 'Round Trip' && tripEndAt ? `  –  Return ${dayText(tripEndAt)} · ${formatTime(tripEndAt).replace(/^0/, '')}` : ''}
          </Text>
          {route ? <Text style={[styles.meta, { marginTop: 14 }]}>{`${formatDistance(included)} route distance${tripType === 'Round Trip' ? ' (both ways)' : ''}`}</Text> : null}
        </View>
        <Text style={[styles.meta, { marginBottom: 14 }]}>Prices include GST.</Text>

        {routeError ? <Notice message={routeError} /> : null}
        {quoteProblem ? <Notice message={quoteProblem} tone={serverQuote.status === 'error' || tooFar ? 'error' : 'warning'} onRetry={serverQuote.status === 'error' ? serverQuote.retry : undefined} /> : null}
        {tooFar ? <Button title={`Call NESAM · ${SUPPORT_PHONE_DISPLAY}`} icon="phone" variant="secondary" onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} style={{ marginBottom: 12 }} /> : null}
        {!route && !routeError ? <Notice tone="info" message="Calculating the driving route and fares…" /> : null}
        {server && !!route ? null : route && serverQuote.status === 'loading' ? <Notice tone="info" message="Confirming fares with NESAM — amounts shown are estimates until then." /> : null}

        <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
          {categories.map((c) => {
            const q = quotes.get(c.id);
            const entry = entryOf(c.id);
            const unavailable = !!entry && !entry.ok;
            const on = c.id === selected?.id;
            const extra = c.fare.extras?.extraKmRate ?? (outstation && c.fare.outstationPerKmRate ? c.fare.outstationPerKmRate : c.fare.perKmRate);
            const includedKm = entry?.includedKm ?? (c.fare.baseKm > 0 ? c.fare.baseKm : 0);
            return (
              <View key={c.id} style={[styles.car, on && styles.carOn, unavailable && { opacity: 0.6 }]}>
                <Pressable
                  onPress={() => update({ categoryId: c.id })}
                  style={styles.carPick}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, disabled: false }}
                  accessibilityLabel={`${c.name}, ${c.seats} passengers, ${q ? formatINR(q.total) : 'fare loading'}${unavailable ? ', not available for this trip' : ''}`}
                >
                  <View style={[styles.choice, on && styles.choiceOn]}>{on ? <Icon name="check" size={10} color={colors.white} strokeWidth={3} /> : null}</View>
                  <View style={styles.carTop}>
                    <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                      <Text style={styles.carName}>{c.name}</Text>
                      <Text style={styles.carModel} numberOfLines={2}>
                        {entry?.model || c.description || 'Air-conditioned cab'}
                      </Text>
                    </View>
                    <Image source={c.imageUrl ? { uri: c.imageUrl } : getVehicleImage(c.name)} style={styles.carPhoto} resizeMode="contain" accessible={false} />
                  </View>
                  <View style={styles.facts}>
                    <Fact tint="slate" icon="seat-belt" text={`${c.seats} passengers`} />
                    <Fact tint="amber" icon="luggage" text={`${c.seats > 4 ? 3 : 2} bags`} />
                    <Fact tint="blue" icon="snowflake" text="AC" />
                  </View>
                  {includedKm > 0 ? <Text style={styles.included}>{`${includedKm} km included`}</Text> : null}
                  <View style={styles.rate}>
                    <Text style={styles.rateLabel}>
                      Total fare{'\n'}
                      {unavailable ? 'Not available' : 'GST included'}
                    </Text>
                    <Text style={styles.price}>{q ? formatINR(q.total) : '…'}</Text>
                  </View>
                </Pressable>
                <View style={styles.carFoot}>
                  <Text style={styles.extra}>{`Extra ${formatINR(extra)}/km + ${gstText}`}</Text>
                  <TextButton title="View fare" iconRight="chevron-right" size={11} onPress={() => setFareFor(c.id)} disabled={!q} accessibilityLabel={`View fare details for ${c.name}`} />
                </View>
                {unavailable ? <Text style={styles.unavail}>{entry?.error || 'Not available for this trip.'}</Text> : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.bottom}>
       <Content kind="narrow" style={{ gap: 8 }}>
        <View style={styles.bottomRow}>
          <View style={{ minWidth: 92 }}>
            <Text style={styles.totalLabel}>Total fare</Text>
            <Text style={styles.totalValue}>{selectedQuote ? formatINR(selectedQuote.total) : '—'}</Text>
          </View>
          <Button
            title={quoteLoading ? 'Confirming fare…' : 'Continue'}
            iconRight={quoteLoading ? undefined : 'arrow-right'}
            icon={undefined}
            disabled={!canContinue}
            loading={quoteLoading}
            onPress={() => navigation.navigate('ConfirmBooking')}
            style={{ flex: 1 }}
          />
        </View>
        <FlowFooter onBack={() => navigation.goBack()} onHome={goHome} />
       </Content>
      </View>

      <Sheet visible={!!fareSheet} onClose={() => setFareFor(null)} title={fareSheet ? `${fareSheet.name} fare` : 'Fare'} subtitle="Prices include GST.">
        {fareSheet && fareSheetQuote ? (
          <>
            <FareLines lines={buildFareBreakup(fareSheet, fareSheetQuote, outstation).lines} total={fareSheetQuote.total} estimated={!server} />
            <Text style={styles.note}>Toll, parking and state tax are paid separately against receipts. The cab assigned may differ in model from the photo.</Text>
          </>
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}

const FACT = {
  slate: { bg: '#F0F3F7', fg: '#465265', ic: '#465265' },
  amber: { bg: '#FFF6E7', fg: '#A8650E', ic: '#DC8A18' },
  blue: { bg: '#EAF5FF', fg: '#0969B9', ic: '#0686DF' },
} as const;

function Fact({ tint, icon, text }: { tint: keyof typeof FACT; icon: 'seat-belt' | 'luggage' | 'snowflake'; text: string }) {
  const t = FACT[tint];
  return (
    <View style={[styles.fact, { backgroundColor: t.bg }]}>
      <Icon name={icon} size={14} color={t.ic} />
      <Text style={[styles.factText, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  pad: { padding: space.xl },
  scroll: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: 24 },
  summary: { paddingBottom: 18, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  route: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 24, color: colors.text },
  routeArrow: { fontFamily: fonts.regular, color: '#8A929E' },
  meta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 19, color: '#6D7785', marginTop: 7 },
  car: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#E3E7EC', borderRadius: 13, overflow: 'hidden' },
  carOn: { borderColor: colors.primary },
  carPick: { paddingHorizontal: 14, paddingTop: 13, paddingBottom: 11 },
  choice: { position: 'absolute', top: 10, right: 10, width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#DCE1E8', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  choiceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  carTop: { flexDirection: 'row', alignItems: 'center', minHeight: 80 },
  carName: { fontFamily: fonts.semiBold, fontSize: 18, lineHeight: 23, letterSpacing: -0.4, color: colors.ink },
  carModel: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16.5, color: '#626E80', marginTop: 4 },
  carPhoto: { width: 130, height: 80 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4 },
  factText: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15 },
  included: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 17.6, color: '#626E80', marginTop: 8 },
  rate: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 9, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#EEF0F4' },
  rateLabel: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 15, color: '#6D7785' },
  price: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 29, letterSpacing: -0.6, color: colors.ink },
  carFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, minHeight: 45, borderTopWidth: 1, borderTopColor: '#EEF0F4' },
  extra: { fontFamily: fonts.regular, fontSize: 10, color: '#626E80', flexShrink: 1 },
  unavail: { fontFamily: fonts.medium, fontSize: 11, color: colors.primaryDark, paddingHorizontal: 14, paddingBottom: 10 },
  bottom: { backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: '#E5E8ED', paddingHorizontal: space.xl, paddingTop: 10, paddingBottom: 10, gap: 8 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  totalLabel: { fontFamily: fonts.regular, fontSize: 11, color: '#6D7785' },
  totalValue: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.5, color: colors.ink },
  note: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, color: '#6D7785', marginTop: space.md },
});

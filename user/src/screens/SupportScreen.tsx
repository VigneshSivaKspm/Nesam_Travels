// FAQs, raise a ticket, my tickets (port of user/web SupportScreen.tsx).
import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useCustomerData } from '../context/CustomerData';
import { Badge, Button, Card, Chip, EmptyState, Notice, Screen, Segmented, TextField } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { DesktopRow } from '../components/layout';
import { SUPPORT_CATEGORIES, submitSupportTicket, subscribeToSupportTickets } from '../services/userService';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import type { SupportTicket } from '../types';
import { describeError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';
import { useResponsive } from '../theme/responsive';

type Props = NativeStackScreenProps<RootStackParamList, 'Support'>;
type Tab = 'faqs' | 'ticket' | 'mine';

const FAQS = [
  { q: 'How do I cancel my booking?', a: 'Open the ride from My Trips and tap “Cancel ride”. The screen shows whether a cancellation fee applies before you confirm.' },
  { q: 'When are driver details shared?', a: 'As soon as a driver is assigned — name, phone, vehicle number and rating appear on your ride screen.' },
  { q: 'What is the boarding code?', a: 'A 4-digit code shown on your ride screen. Share it with your driver only once you are in the car; the trip cannot start without it.' },
  { q: 'How are tolls charged?', a: 'Tolls, parking and permits paid by the driver are added to your final receipt against actual receipts.' },
  { q: 'What payment modes are accepted?', a: 'We accept Cash and Direct UPI payments to the driver at the completion of your journey.' },
  { q: 'Can I book an outstation trip in advance?', a: 'Yes! Select "Outstation" during the booking step, choose your scheduled date and time, and our partner network will assign a verified vehicle.' },
];

export function SupportScreen({ route, navigation }: Props) {
  const { isDesktop } = useResponsive();
  const { profile } = useCustomerData();
  const [tab, setTab] = useState<Tab>(route.params?.bookingId ? 'ticket' : 'faqs');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [category, setCategory] = useState(SUPPORT_CATEGORIES[0]!);
  const [bookingId, setBookingId] = useState(route.params?.bookingId ?? '');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [listError, setListError] = useState('');

  useEffect(
    () => subscribeToSupportTickets(profile.uid, setTickets, (e) => setListError(describeError(e, 'Couldn’t load your tickets.'))),
    [profile.uid],
  );

  const submit = async () => {
    if (description.trim().length < 10) return setError('Please describe the issue in at least 10 characters.');
    if (sending) return undefined;
    setSending(true);
    setError('');
    try {
      await submitSupportTicket(profile, { category, bookingId, description });
      setDescription('');
      setBookingId('');
      setSubmitted(true);
      setTab('mine');
    } catch (e) {
      setError(describeError(e, 'We couldn’t submit your ticket. Please try again or call support.'));
    } finally {
      setSending(false);
    }
    return undefined;
  };

  return (
    <Screen edges={[]}>
      <DesktopHeader
        title="Help & Customer Support"
        subtitle="Frequently asked questions, instant helpline assistance, and complaint tickets"
        onBack={() => navigation.goBack()}
      />

      <View style={[styles.container, isDesktop && styles.desktopContainer]}>
        <Segmented
          options={[
            { value: 'faqs', label: 'FAQs & Guidance' },
            { value: 'ticket', label: 'Raise a Ticket' },
            { value: 'mine', label: `My Tickets (${tickets.length})` },
          ]}
          value={tab}
          onChange={setTab}
        />
        <View style={{ height: space.md }} />

        {tab === 'faqs' ? (
          <DesktopRow gap={24} style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: isDesktop ? 1.4 : 1, width: '100%' }}>
              {FAQS.map((f) => (
                <Card key={f.q} style={styles.faqCard}>
                  <Text style={type.h3}>{f.q}</Text>
                  <Text style={[type.small, { marginTop: 6, lineHeight: 20 }]}>{f.a}</Text>
                </Card>
              ))}
            </View>

            <View style={{ flex: isDesktop ? 1 : undefined, width: '100%' }}>
              <Card style={styles.helplineCard}>
                <Text style={styles.helplineTitle}>24/7 Passenger Support</Text>
                <Text style={styles.helplineSubtitle}>
                  Need immediate help with an ongoing trip or urgent cancellation? Our operations team is available around the clock.
                </Text>
                <Button
                  title={`Call Support: ${SUPPORT_PHONE_DISPLAY}`}
                  onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)}
                  style={{ marginTop: space.md }}
                />
                <Button
                  title="Raise a Support Ticket"
                  variant="secondary"
                  onPress={() => setTab('ticket')}
                  style={{ marginTop: space.sm }}
                />
              </Card>
            </View>
          </DesktopRow>
        ) : null}

        {tab === 'ticket' ? (
          <Card style={styles.ticketFormCard}>
            <Text style={styles.formTitle}>Submit a Support Request</Text>
            <Text style={styles.formSubtitle}>Our customer service team typically responds within 2 business hours.</Text>
            
            <Text style={[type.label, { marginBottom: space.sm, marginTop: space.md }]}>Issue Category</Text>
            <View style={styles.chips}>
              {SUPPORT_CATEGORIES.map((c) => (
                <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
              ))}
            </View>
            <TextField label="Booking ID (optional)" value={bookingId} onChangeText={setBookingId} autoCapitalize="characters" placeholder="e.g. NT260928-ABCDE" />
            <Text style={[type.label, { marginBottom: 6 }]}>Describe the Issue</Text>
            <TextInput
              value={description}
              onChangeText={(v) => setDescription(v.slice(0, 2000))}
              multiline
              placeholder="Explain what happened during your journey or with billing…"
              placeholderTextColor={colors.faint}
              style={styles.textarea}
            />
            <Notice message={error} />
            <Button title={sending ? 'Submitting…' : 'Submit Ticket'} loading={sending} onPress={() => void submit()} style={{ marginTop: space.md }} />
          </Card>
        ) : null}

        {tab === 'mine' ? (
          <View style={styles.ticketsList}>
            {submitted ? <Notice tone="success" message="Ticket submitted successfully. Our team will review and get back to you shortly." /> : null}
            <Notice message={listError} />
            {tickets.length === 0 ? (
              <EmptyState title="No tickets yet" message="Tickets you raise appear here with real-time status updates." />
            ) : (
              tickets.map((t) => (
                <Card key={t.id} style={styles.ticketCard}>
                  <View style={styles.ticketHead}>
                    <Text style={[type.h3, { flex: 1 }]}>{t.category}</Text>
                    <Badge label={t.status} tone={t.status === 'Resolved' || t.status === 'Closed' ? 'success' : 'warning'} />
                  </View>
                  {t.bookingId ? <Text style={styles.ticketBooking}>Booking ID: {t.bookingId}</Text> : null}
                  <Text style={[type.body, { marginTop: 6, lineHeight: 22 }]}>{t.description}</Text>
                  <Text style={styles.ticketTime}>Submitted on {t.createdAt}</Text>
                </Card>
              ))
            )}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  desktopContainer: { maxWidth: 1040, alignSelf: 'center', width: '100%', marginTop: space.sm },
  faqCard: { marginBottom: space.md, borderWidth: 1.5, borderColor: colors.border },
  helplineCard: {
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    boxShadow: '0 4px 16px rgba(0,0,0,0.04)' as any,
  },
  helplineTitle: { fontSize: 20, fontWeight: '900', color: colors.ink, marginBottom: space.xs },
  helplineSubtitle: { fontSize: 14, color: colors.slate, lineHeight: 20 },
  ticketFormCard: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  formTitle: { fontSize: 20, fontWeight: '900', color: colors.ink },
  formSubtitle: { fontSize: 14, color: colors.slate, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm },
  textarea: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 120,
    textAlignVertical: 'top',
    color: colors.ink,
    fontSize: 15,
    backgroundColor: '#F8FAFC',
    marginBottom: space.sm,
  },
  ticketsList: { maxWidth: 840, alignSelf: 'center', width: '100%' },
  ticketCard: { marginBottom: space.md, borderWidth: 1.5, borderColor: colors.border },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ticketBooking: { fontSize: 13, color: colors.slate, fontWeight: '700', marginTop: 4 },
  ticketTime: { fontSize: 12, color: colors.muted, marginTop: 8 },
});

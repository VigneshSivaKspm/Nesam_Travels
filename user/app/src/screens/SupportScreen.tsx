// FAQs, raise a ticket, my tickets (port of user/web SupportScreen.tsx).
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useCustomerData } from '../context/CustomerData';
import { Badge, Button, Card, Chip, EmptyState, Notice, Segmented, TextField } from '../components/ui';
import { SubHeader } from '../components/brand';
import { SUPPORT_CATEGORIES, submitSupportTicket, subscribeToSupportTickets } from '../services/userService';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import type { SupportTicket } from '../types';
import { describeError } from '../utils/retry';
import { colors, fonts, radius, space } from '../theme';
import { ILLUSTRATIONS } from '../assets/images';

type Props = NativeStackScreenProps<RootStackParamList, 'Support'>;
type Tab = 'faqs' | 'ticket' | 'mine';

const FAQS = [
  { q: 'How do I cancel my booking?', a: 'Open the ride from My Bookings and tap “Cancel ride”. The screen shows whether a cancellation fee applies before you confirm.' },
  { q: 'When are driver details shared?', a: 'As soon as a driver is assigned — name, phone, vehicle number and rating appear on your ride screen.' },
  { q: 'What is the boarding code?', a: 'A 4-digit OTP shown on your booking screen. Share it with your driver only once you are in the car; the trip cannot start without it.' },
  { q: 'How are tolls charged?', a: 'Tolls, parking and state entry permits paid by the chauffeur are added to your final receipt against actual receipts.' },
  { q: 'What payment modes are accepted?', a: 'We accept Cash and Direct UPI payments to the chauffeur at the completion of your journey.' },
  { q: 'Can I book an outstation trip in advance?', a: 'Yes! Select "Outstation" during booking, choose your scheduled date and time, and our partner network will assign a verified vehicle.' },
];

export function SupportScreen({ route, navigation }: Props) {
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
    <SafeAreaView style={styles.root} edges={['top']}>
      <SubHeader
        title="Help & Support"
        subtitle="24×7 Customer Care & FAQs"
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} style={styles.callHelplineBtn}>
            <Ionicons name="call" size={13} color={colors.primary} />
            <Text style={styles.callHelplineText}>Call Desk</Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        <Segmented
          options={[
            { value: 'faqs', label: 'FAQs' },
            { value: 'ticket', label: 'Raise Ticket' },
            { value: 'mine', label: `My Tickets (${tickets.length})` },
          ]}
          value={tab}
          onChange={setTab}
        />
        <View style={{ height: space.md }} />

        {tab === 'faqs' ? (
          <View style={{ width: '100%' }}>
            <Card style={styles.helplineCard}>
              <Text style={styles.helplineTitle}>24/7 Passenger Support</Text>
              <Text style={styles.helplineSubtitle}>
                Need immediate help with your advance booking or driver schedule? Our operations desk is available around the clock.
              </Text>
              <Button
                title={`Call Desk: ${SUPPORT_PHONE_DISPLAY}`}
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

            <View style={{ marginTop: space.md }}>
              {FAQS.map((f) => (
                <Card key={f.q} style={styles.faqCard}>
                  <Text style={styles.faqQ}>{f.q}</Text>
                  <Text style={styles.faqA}>{f.a}</Text>
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        {tab === 'ticket' ? (
          <Card style={styles.ticketFormCard}>
            <Text style={styles.formTitle}>Submit a Support Request</Text>
            <Text style={styles.formSubtitle}>Our customer service team typically responds within 2 business hours.</Text>

            <Text style={styles.fieldLabel}>Issue Category</Text>
            <View style={styles.chips}>
              {SUPPORT_CATEGORIES.map((c) => (
                <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
              ))}
            </View>
            <TextField label="Booking ID (optional)" value={bookingId} onChangeText={setBookingId} autoCapitalize="characters" placeholder="e.g. NT260928-ABCDE" />
            <Text style={styles.fieldLabel}>Describe the Issue</Text>
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
              <EmptyState
                image={ILLUSTRATIONS.support}
                title="No tickets yet"
                message="Tickets you raise appear here with real-time status updates."
                action={<Button title="Raise a Ticket" onPress={() => setTab('ticket')} />}
              />
            ) : (
              tickets.map((t) => (
                <Card key={t.id} style={styles.ticketCard}>
                  <View style={styles.ticketHead}>
                    <Text style={styles.ticketCategory}>{t.category}</Text>
                    <Badge label={t.status} tone={t.status === 'Resolved' || t.status === 'Closed' ? 'success' : 'warning'} />
                  </View>
                  {t.bookingId ? <Text style={styles.ticketBooking}>Booking ID: {t.bookingId}</Text> : null}
                  <Text style={styles.ticketDesc}>{t.description}</Text>
                  <Text style={styles.ticketTime}>Submitted on {t.createdAt}</Text>
                </Card>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollPad: { padding: space.md, paddingBottom: space.xxl },
  callHelplineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.full,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  callHelplineText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
  },
  helplineCard: {
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  helplineTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink, marginBottom: 4 },
  helplineSubtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.slate, lineHeight: 18 },
  faqCard: {
    marginBottom: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
    padding: space.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  faqQ: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  faqA: { fontFamily: fonts.regular, fontSize: 12, color: colors.slate, marginTop: 4, lineHeight: 18 },
  ticketFormCard: {
    width: '100%',
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  formTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  formSubtitle: { fontFamily: fonts.regular, fontSize: 12, color: colors.slate, marginTop: 2 },
  fieldLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, marginBottom: space.xs, marginTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.xs },
  textarea: {
    fontFamily: fonts.regular,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 100,
    textAlignVertical: 'top',
    color: colors.ink,
    fontSize: 14,
    backgroundColor: '#F8FAFC',
    marginBottom: space.sm,
  },
  ticketsList: { width: '100%' },
  ticketCard: {
    marginBottom: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
    padding: space.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  ticketHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  ticketCategory: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, flex: 1 },
  ticketBooking: { fontFamily: fonts.medium, fontSize: 12, color: colors.slate, marginTop: 4 },
  ticketDesc: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink, marginTop: 6, lineHeight: 18 },
  ticketTime: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 6 },
});

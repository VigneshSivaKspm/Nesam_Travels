import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useCustomerData } from '../context/CustomerData';
import { Button, Card, Chip, Notice, TextField } from '../components/ui';
import { SubHeader } from '../components/brand';
import { updateCustomerProfile } from '../services/userService';
import { formatPhone, isValidEmail, isValidIndianMobile, isValidName, localMobile } from '../utils/format';
import { describeError } from '../utils/retry';
import { colors, fonts, radius, space, type } from '../theme';

const LANGUAGES = ['English', 'தமிழ் (Tamil)', 'हिन्दी (Hindi)'];

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const { profile } = useCustomerData();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [emergency, setEmergency] = useState(localMobile(profile.emergencyContact));
  const [language, setLanguage] = useState(profile.language || 'English');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saved = useRef(false);

  const dirty =
    name.trim() !== profile.name ||
    email.trim().toLowerCase() !== profile.email ||
    emergency !== localMobile(profile.emergencyContact) ||
    language !== (profile.language || 'English');

  // Hardware back / header back with unsaved edits asks before discarding.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!dirty || saved.current) return;
        e.preventDefault();
        Alert.alert('Discard changes?', 'Your edits have not been saved.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]);
      }),
    [navigation, dirty],
  );

  const save = async () => {
    if (!isValidName(name)) return setError('Enter your full name (letters and spaces, 2–60 characters).');
    if (email.trim() && !isValidEmail(email)) return setError('Enter a valid email address, or leave it blank.');
    if (emergency && !isValidIndianMobile(emergency)) return setError('Enter a 10-digit emergency contact number, or leave it blank.');
    if (emergency && emergency === localMobile(profile.phone)) return setError('Emergency contact must differ from your own number.');
    setBusy(true);
    setError('');
    try {
      await updateCustomerProfile(profile.uid, {
        name,
        email: email.toLowerCase(),
        emergencyContact: emergency ? `+91 ${emergency}` : '',
        language,
      });
      saved.current = true;
      navigation.goBack();
    } catch (e) {
      setError(describeError(e, 'Couldn’t save your changes.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SubHeader title="Edit Profile" subtitle="Update your contact and preferences" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          <TextField
            label="Mobile number"
            value={formatPhone(profile.phone)}
            editable={false}
            hint="Your registered login number cannot be changed here. Contact support to migrate."
          />
          <TextField label="Full name" required value={name} onChangeText={setName} autoComplete="name" />
          <TextField
            label="Email address (optional)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            hint="Used for booking confirmations and tax invoices."
          />
          <TextField
            label="Emergency contact (optional)"
            prefix="+91"
            value={emergency}
            onChangeText={(v) => setEmergency(v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad"
            maxLength={10}
            hint="Receives instant alerts if SOS is triggered during a ride."
          />
          <Text style={styles.label}>Preferred Language</Text>
          <View style={styles.langRow}>
            {LANGUAGES.map((l) => (
              <Chip key={l} label={l} active={language === l} onPress={() => setLanguage(l)} />
            ))}
          </View>
          <Notice message={error} style={{ marginTop: space.md }} />
          <Button title={busy ? 'Saving…' : 'Save Changes'} loading={busy} disabled={!dirty} onPress={() => void save()} style={{ marginTop: space.lg }} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollPad: { padding: space.md, paddingBottom: space.xxl },
  formCard: {
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
  label: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
    marginBottom: space.sm,
    marginTop: space.sm,
  },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});

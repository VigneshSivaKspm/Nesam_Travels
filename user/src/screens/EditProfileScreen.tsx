// Edit contact details (port of EditProfileModal in user/web ProfileScreen.tsx),
// plus the language preference the customers/{uid} rules already allow.
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useCustomerData } from '../context/CustomerData';
import { Button, Card, Chip, Notice, Screen, TextField } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { updateCustomerProfile } from '../services/userService';
import { formatPhone, isValidEmail, isValidIndianMobile, isValidName, localMobile } from '../utils/format';
import { describeError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';
import { useResponsive } from '../theme/responsive';

const LANGUAGES = ['English', 'தமிழ் (Tamil)', 'हिन्दी (Hindi)'];

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const { isDesktop } = useResponsive();
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
    // E-mail and the emergency contact are optional; a value that is typed must still be valid.
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
    <Screen edges={[]}>
      <DesktopHeader
        title="Edit Profile"
        subtitle="Update your full name, email and emergency contact information"
        onBack={() => navigation.goBack()}
      />

      <View style={[styles.container, isDesktop && styles.desktopContainer]}>
        <Card style={styles.formCard}>
          <TextField
            label="Mobile number"
            value={formatPhone(profile.phone)}
            editable={false}
            hint="Your registered login number cannot be changed here. Contact support to migrate."
          />
          <TextField label="Full name" required value={name} onChangeText={setName} autoComplete="name" />
          <TextField label="Email address (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" hint="Used for booking confirmations and tax invoices." />
          <TextField
            label="Emergency contact (optional)"
            prefix="+91"
            value={emergency}
            onChangeText={(v) => setEmergency(v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad"
            maxLength={10}
            hint="Receives instant alerts if SOS is triggered during a ride."
          />
          <Text style={[type.label, { marginBottom: space.sm, marginTop: space.sm }]}>Preferred Language</Text>
          <View style={styles.langRow}>
            {LANGUAGES.map((l) => (
              <Chip key={l} label={l} active={language === l} onPress={() => setLanguage(l)} />
            ))}
          </View>
          <Notice message={error} style={{ marginTop: space.md }} />
          <Button title={busy ? 'Saving…' : 'Save Changes'} loading={busy} disabled={!dirty} onPress={() => void save()} style={{ marginTop: space.lg }} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  desktopContainer: { maxWidth: 680, alignSelf: 'center', width: '100%', marginTop: space.md },
  formCard: {
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    boxShadow: '0 4px 16px rgba(0,0,0,0.04)' as any,
  },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});

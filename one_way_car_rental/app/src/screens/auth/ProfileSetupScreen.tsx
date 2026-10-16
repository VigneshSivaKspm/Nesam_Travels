import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button, Card, LinkText, Notice, Screen, TextField } from '../../components/ui';
import { registerCustomerProfile } from '../../services/userService';
import { signOutUser } from '../../services/authService';
import { formatPhone, isValidEmail, isValidName } from '../../utils/format';
import { describeError } from '../../utils/retry';
import { colors, fonts, radius, space, type } from '../../theme';
import { useResponsive } from '../../theme/responsive';
import { getAuthIntent } from './authIntent';
import { ILLUSTRATIONS } from '../../assets/images';

export function ProfileSetupScreen({ phone }: { phone: string }) {
  const { isDesktop } = useResponsive();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const errors = {
    name: !isValidName(name) ? 'Enter your full name (letters and spaces, 2–60 characters).' : '',
    // Optional: only a value that was typed has to be a real address.
    email: email.trim() && !isValidEmail(email) ? 'Enter a valid email address, or leave it blank.' : '',
  };
  const valid = !errors.name && !errors.email;

  const save = async () => {
    setTouched(true);
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    try {
      await registerCustomerProfile({ name, email });
      // The profile listener in App.tsx moves on to the main app.
    } catch (e) {
      setError(describeError(e, 'We couldn’t create your profile. Please try again.'));
      setSaving(false);
    }
  };

  const fieldError = (k: keyof typeof errors) => (touched ? errors[k] : '');

  return (
    <Screen bg={colors.page}>
      <View style={[styles.container, isDesktop && styles.desktopContainer]}>
        <Image
          source={ILLUSTRATIONS.profileSetup}
          style={styles.illustration}
          resizeMode="contain"
          accessible={false}
          importantForAccessibility="no"
        />
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.sub}>
          {getAuthIntent() === 'login' ? 'Set up your profile to continue' : 'Create your passenger profile'} · {formatPhone(phone)}
        </Text>
        <Card style={styles.card}>
          <TextField label="Full name" required value={name} onChangeText={setName} autoComplete="name" error={fieldError('name')} placeholder="e.g. Priya Raman" />
          <TextField
            label="Email address (optional)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={fieldError('email')}
            placeholder="you@example.com"
            hint="Booking confirmations and receipts are sent here when you add one."
          />

          <Notice message={error} />
          <Button title={saving ? 'Saving Profile…' : 'Save & Start Booking'} loading={saving} onPress={() => void save()} style={{ marginTop: space.sm }} />
          <View style={styles.signOut}>
            <LinkText onPress={() => void signOutUser()}>Not your number? Sign out</LinkText>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  desktopContainer: { maxWidth: 520, width: '100%', alignSelf: 'center', marginTop: space.xl },
  illustration: { width: '100%', height: 120, alignSelf: 'center', marginTop: space.sm },
  title: { marginTop: space.md, fontFamily: fonts.bold, fontSize: 24, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.medium, fontSize: 13, color: colors.slate, marginBottom: space.lg, marginTop: 4, textAlign: 'center' },
  card: {
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  signOut: { alignItems: 'center', marginTop: space.lg },
});

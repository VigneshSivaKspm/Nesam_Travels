// New customer profile. The spec (page 20) names only the customer's name and
// mobile — the mobile is already verified — and an optional e-mail. The photo and
// emergency contact are not asked at signup; both stay available in the profile.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, LinkText, Notice, Screen, TextField } from '../../components/ui';
import { registerCustomerProfile } from '../../services/userService';
import { signOutUser } from '../../services/authService';
import { formatPhone, isValidEmail, isValidName } from '../../utils/format';
import { describeError } from '../../utils/retry';
import { colors, radius, space, type } from '../../theme';
import { useResponsive } from '../../theme/responsive';
import { getAuthIntent } from './authIntent';

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
        <Text style={[type.h1, styles.title]}>Complete your profile</Text>
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
  title: { marginTop: space.lg, fontSize: 26, fontWeight: '900', color: colors.ink },
  sub: { ...type.small, marginBottom: space.lg, marginTop: 4 },
  card: {
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    boxShadow: '0 4px 16px rgba(0,0,0,0.05)' as any,
  },
  signOut: { alignItems: 'center', marginTop: space.lg },
});

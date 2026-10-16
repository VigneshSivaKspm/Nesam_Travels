// Welcome → mobile number → OTP. Native port of the PhoneLogin part of
// user/web/src/screens/AuthFlow.tsx.
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ConfirmationResult } from 'firebase/auth';
import { Button, Card, LinkText, Notice, Screen, TextField } from '../../components/ui';
import { useRecaptchaVerifier } from '../../components/RecaptchaVerifier';
import { confirmOtpCode, describePhoneAuthError, sendOtpToPhone } from '../../services/authService';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { formatPhone, isValidIndianMobile } from '../../utils/format';
import { colors, fonts, radius, space, type } from '../../theme';
import { useResponsive } from '../../theme/responsive';
import { setAuthIntent, type AuthIntent } from './authIntent';

import { BRAND, ILLUSTRATIONS } from '../../assets/images';

const RESEND_COOLDOWN_S = 30;

export function AuthScreen() {
  const { isDesktop } = useResponsive();
  const [step, setStep] = useState<'welcome' | 'phone' | 'otp'>('welcome');
  const [intent, setIntent] = useState<AuthIntent>('login');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const otpRef = useRef<TextInput>(null);
  const verifier = useRecaptchaVerifier();
  const { online } = useNetworkStatus();

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Android back steps backwards through the flow instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'otp' && !verifying) {
        setStep('phone');
        setOtp('');
        setError('');
        return true;
      }
      if (step === 'phone' && !sending) {
        setStep('welcome');
        setError('');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step, verifying, sending]);

  const start = (i: AuthIntent) => {
    setIntent(i);
    setAuthIntent(i);
    setError('');
    setStep('phone');
  };

  const sendOtp = async () => {
    if (!isValidIndianMobile(mobile)) return setError('Enter a valid 10-digit Indian mobile number.');
    if (!online) return setError('You’re offline. Connect to the internet to receive your OTP.');
    if (sending) return undefined;
    setError('');
    setSending(true);
    try {
      const result = await sendOtpToPhone(`+91${mobile}`, verifier);
      setConfirmation(result);
      setOtp('');
      setStep('otp');
      setCooldown(RESEND_COOLDOWN_S);
      setTimeout(() => otpRef.current?.focus(), 250);
    } catch (e) {
      setError(describePhoneAuthError(e));
    } finally {
      setSending(false);
    }
    return undefined;
  };

  const verify = async (code: string) => {
    if (code.length !== 6) return setError('Enter the 6-digit OTP.');
    if (!confirmation) return setError('Your OTP session expired. Please request a new code.');
    if (verifying) return undefined;
    setError('');
    setVerifying(true);
    try {
      await confirmOtpCode(confirmation, code);
      // onAuthStateChanged in App.tsx takes over from here.
    } catch (e) {
      setError(describePhoneAuthError(e));
      setOtp('');
      setVerifying(false);
      otpRef.current?.focus();
    }
    return undefined;
  };

  const header = (subtitle: string) => (
    <View style={styles.brand}>
      <Image source={BRAND.logo} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
      <Text style={[styles.title, { color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>one_way_car_rental</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );

  if (step === 'welcome') {
    return (
      <Screen bg={colors.page}>
        <View style={[styles.authContainer, isDesktop && styles.desktopAuthContainer]}>
          {header('Safe Journey, Happy Memories')}
          <Image
            source={ILLUSTRATIONS.welcome}
            style={styles.authIllustration}
            resizeMode="contain"
            accessible={false}
            importantForAccessibility="no"
          />
          <Card style={styles.authCard}>
            <Button title="Login with Phone" onPress={() => start('login')} />
            <Text style={styles.helper}>I already have a passenger account</Text>
            <Button title="Create New Account" variant="dark" onPress={() => start('signup')} style={{ marginTop: space.lg }} />
            <Text style={styles.helper}>New to one_way_car_rental</Text>
          </Card>
          <Text style={styles.legal}>By continuing you agree to one_way_car_rental’s Terms & Conditions and Privacy Policy.</Text>
        </View>
      </Screen>
    );
  }

  if (step === 'phone') {
    return (
      <Screen bg={colors.page}>
        <View style={[styles.authContainer, isDesktop && styles.desktopAuthContainer]}>
          {header(intent === 'signup' ? 'Create your passenger account' : 'Sign in with your mobile number')}
          <Image
            source={ILLUSTRATIONS.phoneVerification}
            style={styles.authIllustrationPhone}
            resizeMode="contain"
            accessible={false}
            importantForAccessibility="no"
          />
          <Card style={styles.authCard}>
            <TextField
              label={intent === 'signup' ? 'Mobile number' : 'Registered mobile number'}
              prefix="+91"
              value={mobile}
              onChangeText={(v) => {
                setMobile(v.replace(/\D/g, '').slice(0, 10));
                setError('');
              }}
              keyboardType="phone-pad"
              autoComplete="tel-national"
              textContentType="telephoneNumber"
              maxLength={10}
              placeholder="98765 43210"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void sendOtp()}
              hint={intent === 'signup' ? 'This number becomes your login and primary contact for trips.' : undefined}
            />
            <Notice message={error} />
            <Button title={sending ? 'Sending OTP…' : 'Send Verification OTP'} loading={sending} disabled={mobile.length !== 10 || !online} onPress={() => void sendOtp()} />
            <View style={styles.backRow}>
              <LinkText onPress={() => !sending && setStep('welcome')}>← Back</LinkText>
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen bg={colors.page}>
      <View style={[styles.authContainer, isDesktop && styles.desktopAuthContainer]}>
        {header('Verify your mobile number')}
        <Image
          source={ILLUSTRATIONS.phoneVerification}
          style={styles.authIllustrationPhone}
          resizeMode="contain"
          accessible={false}
          importantForAccessibility="no"
        />
        <Card style={styles.authCard}>
          <Text style={[type.body, { marginBottom: space.md, textAlign: 'center' }]}>
            Enter the 6-digit OTP sent to <Text style={{ fontFamily: fonts.extraBold, fontWeight: '800' }}>{formatPhone(mobile)}</Text>
          </Text>
          <TextInput
            ref={otpRef}
            value={otp}
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, '').slice(0, 6);
              setOtp(digits);
              setError('');
              if (digits.length === 6) void verify(digits);
            }}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            maxLength={6}
            editable={!verifying}
            placeholder="••••••"
            placeholderTextColor={colors.faint}
            style={[styles.otp, !!error && { borderColor: colors.primary }]}
            accessibilityLabel="6-digit OTP"
          />
          <Notice message={error} />
          <Button title={verifying ? 'Verifying…' : 'Verify & Continue'} loading={verifying} disabled={otp.length !== 6} onPress={() => void verify(otp)} />
          <View style={styles.resendRow}>
            {cooldown > 0 ? (
              <Text style={type.small}>Resend code in {cooldown}s</Text>
            ) : (
              <LinkText onPress={() => void sendOtp()}>{sending ? 'Resending…' : 'Resend code'}</LinkText>
            )}
            <LinkText
              onPress={() => {
                if (verifying) return;
                setStep('phone');
                setOtp('');
                setError('');
              }}
            >
              Change number
            </LinkText>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  authContainer: { width: '100%' },
  desktopAuthContainer: { maxWidth: 480, width: '100%', alignSelf: 'center', marginTop: space.xl },
  authIllustration: {
    width: '100%',
    height: 130,
    marginBottom: space.sm,
    alignSelf: 'center',
  },
  authIllustrationPhone: {
    width: '100%',
    height: 100,
    marginBottom: space.xs,
    alignSelf: 'center',
  },
  authCard: {
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
  brand: { alignItems: 'center', marginTop: space.xs, marginBottom: space.sm },
  logo: { width: 72, height: 72, borderRadius: 18, marginBottom: space.xs },
  title: { fontFamily: fonts.black, fontSize: 22, letterSpacing: 0, textAlign: 'center' },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.slate, marginTop: 4, textAlign: 'center' },
  helper: { fontFamily: fonts.regular, fontSize: 12, color: colors.slate, textAlign: 'center', marginTop: 6 },
  legal: { fontFamily: fonts.regular, fontSize: 11, textAlign: 'center', marginTop: space.lg, paddingHorizontal: space.lg, color: colors.muted, lineHeight: 16 },
  backRow: { marginTop: space.lg, alignItems: 'center' },
  otp: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: radius.md,
    fontFamily: fonts.bold,
    fontSize: 28,
    letterSpacing: 10,
    textAlign: 'center',
    paddingVertical: 12,
    color: colors.ink,
    backgroundColor: '#F8FAFC',
    marginBottom: space.md,
  },
  resendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.lg },
});

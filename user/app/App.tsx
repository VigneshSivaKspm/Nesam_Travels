import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import type { User } from 'firebase/auth';
import { RecaptchaProvider } from './src/components/RecaptchaVerifier';
import { NetworkBanner } from './src/components/NetworkBanner';
import { FullScreenLoader } from './src/components/ui';
import { AuthScreen } from './src/screens/auth/AuthScreen';
import { ProfileSetupScreen } from './src/screens/auth/ProfileSetupScreen';
import { AccountHoldScreen, LoadErrorScreen } from './src/screens/auth/AccountStateScreens';
import { MainNavigator } from './src/navigation/MainNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { CustomerDataProvider } from './src/context/CustomerData';
import { InboxProvider } from './src/context/Inbox';
import { LegalGate } from './src/components/LegalGate';
import { signOutUser, subscribeToAuthUser } from './src/services/authService';
import { subscribeToCustomerProfile } from './src/services/userService';
import type { UserProfile } from './src/types';
import { describeError } from './src/utils/retry';
import { Text, TextInput } from 'react-native';
import { colors } from './src/theme';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Ensure default Poppins font family across all Text and TextInput elements
const defaultFont = { fontFamily: 'Poppins_400Regular' };
// @ts-ignore
if ((Text as any).defaultProps == null) {
  // @ts-ignore
  (Text as any).defaultProps = {};
}
// @ts-ignore
(Text as any).defaultProps.style = { ...defaultFont, ...(Text as any).defaultProps.style };

// @ts-ignore
if ((TextInput as any).defaultProps == null) {
  // @ts-ignore
  (TextInput as any).defaultProps = {};
}
// @ts-ignore
(TextInput as any).defaultProps.style = { ...defaultFont, ...(TextInput as any).defaultProps.style };

// Same as firestore.rules: only these statuses may use the app (anything else, or none, is on hold).
const ACTIVE_STATUSES = ['Approved', 'Active'];

const APP_TITLE = 'NESAM Cabs';

// Browser tab title: "Screen title · App name" (on Android / iOS this is ignored).
const documentTitle = {
  formatter: (options: { title?: string } | undefined) => (options?.title ? `${options.title} · ${APP_TITLE}` : APP_TITLE),
};

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.primary, background: colors.bg, card: colors.card, text: colors.ink, border: colors.border },
  fonts: {
    ...DefaultTheme.fonts,
    regular: { fontFamily: 'Poppins_400Regular', fontWeight: '400' as const },
    medium: { fontFamily: 'Poppins_500Medium', fontWeight: '500' as const },
    bold: { fontFamily: 'Poppins_700Bold', fontWeight: '700' as const },
    heavy: { fontFamily: 'Poppins_900Black', fontWeight: '900' as const },
  },
};

interface ProfileState {
  /** The uid + attempt this result belongs to; stale results are ignored. */
  key: string;
  profile?: UserProfile | null;
  error: string;
}

function Root() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  // undefined = still resolving; null = signed out / no profile doc yet.
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [profileState, setProfileState] = useState<ProfileState>({ key: '', error: '' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => subscribeToAuthUser(setAuthUser), []);

  const uid = authUser?.uid;
  const key = uid ? `${uid}#${attempt}` : '';
  useEffect(() => {
    if (!uid) return undefined;
    const k = `${uid}#${attempt}`;
    return subscribeToCustomerProfile(
      uid,
      (p) => setProfileState({ key: k, profile: p, error: '' }),
      (e) => setProfileState({ key: k, error: describeError(e, 'We couldn’t load your account.') }),
    );
  }, [uid, attempt]);

  const current = profileState.key === key ? profileState : null;
  const profile = current?.profile;
  const profileError = current?.error ?? '';

  const resolved = fontsLoaded && authUser !== undefined && (!authUser || profile !== undefined || !!profileError);
  useEffect(() => {
    if (resolved) void SplashScreen.hideAsync().catch(() => undefined);
  }, [resolved]);

  if (!fontsLoaded || authUser === undefined) return <FullScreenLoader />;
  if (!authUser) return <AuthScreen />;
  if (profile === undefined && profileError) {
    return <LoadErrorScreen message={profileError} onRetry={() => setAttempt((k) => k + 1)} onSignOut={() => void signOutUser()} />;
  }
  if (profile === undefined) return <FullScreenLoader label="Loading your account…" />;
  if (profile === null) return <ProfileSetupScreen phone={authUser.phoneNumber ?? ''} />;
  if (!ACTIVE_STATUSES.includes(profile.status)) return <AccountHoldScreen status={profile.status} onSignOut={() => void signOutUser()} />;

  return (
    <LegalGate key={profile.uid} role="customer">
      <InboxProvider userId={profile.uid} role="customer">
        <CustomerDataProvider profile={profile}>
          <MainNavigator />
        </CustomerDataProvider>
      </InboxProvider>
    </LegalGate>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <RecaptchaProvider>
        <NavigationContainer ref={navigationRef} theme={navTheme} documentTitle={documentTitle}>
          <StatusBar style="dark" />
          <Root />
          <NetworkBanner />
        </NavigationContainer>
      </RecaptchaProvider>
    </SafeAreaProvider>
  );
}

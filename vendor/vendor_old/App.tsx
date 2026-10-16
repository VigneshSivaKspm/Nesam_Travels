// Gatekeeper for the Vendor app (native port of vendor/web/src/App.tsx):
// Firebase Auth user → vendors/{uid} snapshot → screen for its status. When an
// admin approves the application the snapshot fires and the dashboard mounts.
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import type { User } from 'firebase/auth';
import { RecaptchaProvider } from './src/components/RecaptchaVerifier';
import { NetworkBanner } from './src/components/NetworkBanner';
import { FullScreenLoader } from './src/components/ui';
import { AuthScreen } from './src/screens/auth/AuthScreen';
import { AccountStatusScreen, LoadErrorScreen } from './src/screens/auth/AccountStatusScreen';
import { OnboardingWizard } from './src/screens/onboarding/OnboardingWizard';
import { RegistrationGate } from './src/screens/onboarding/RegistrationGate';
import { MainNavigator } from './src/navigation/MainNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { VendorDataProvider } from './src/context/VendorData';
import { InboxProvider } from './src/context/Inbox';
import { LegalGate } from './src/components/LegalGate';
import { signOutUser, subscribeToAuthUser } from './src/services/authService';
import { subscribeToVendor, type VendorSnapshot } from './src/services/onboardingService';
import type { VendorProfile, VendorRecord } from './src/types/vendor';
import { describeDataError } from './src/utils/retry';
import { colors } from './src/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const APP_TITLE = 'NESAM Fleet Partner';

// Browser tab title: "Screen title · App name" (on Android / iOS this is ignored).
const documentTitle = {
  formatter: (options: { title?: string } | undefined) => (options?.title ? `${options.title} · ${APP_TITLE}` : APP_TITLE),
};

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.primary, background: colors.bg, card: colors.card, text: colors.ink, border: colors.border },
};

interface VendorState {
  key: string;
  vendor?: VendorSnapshot | null;
  error: string;
}

function Root() {
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [state, setState] = useState<VendorState>({ key: '', error: '' });
  const [attempt, setAttempt] = useState(0);
  const [reapplying, setReapplying] = useState(false);

  useEffect(() => subscribeToAuthUser(setAuthUser), []);

  const uid = authUser?.uid;
  const key = uid ? `${uid}#${attempt}` : '';
  useEffect(() => {
    if (!uid) return undefined;
    const k = `${uid}#${attempt}`;
    return subscribeToVendor(
      uid,
      (vendor) => setState({ key: k, vendor, error: '' }),
      (e) => setState({ key: k, error: describeDataError(e) }),
    );
  }, [uid, attempt]);

  const current = state.key === key ? state : null;
  const vendor = current?.vendor;
  const vendorError = current?.error ?? '';
  const status = vendor?.record.status;

  const resolved = authUser !== undefined && (!authUser || vendor !== undefined || !!vendorError);
  useEffect(() => {
    if (resolved) void SplashScreen.hideAsync().catch(() => undefined);
  }, [resolved]);

  const [devPreview, setDevPreview] = useState<'onboarding' | 'dashboard' | null>(null);

  const signOut = () => {
    setDevPreview(null);
    setReapplying(false);
    void signOutUser();
  };

  if (authUser === undefined) return <FullScreenLoader />;
  if (!authUser) return <AuthScreen />;
  if (vendor === undefined && vendorError) return <LoadErrorScreen message={vendorError} onRetry={() => setAttempt((a) => a + 1)} onSignOut={signOut} />;
  if (vendor === undefined) return <FullScreenLoader label="Loading your account…" />;

  const phone = authUser.phoneNumber || vendor?.record.phone || '';

  if (__DEV__ && devPreview === 'dashboard') {
    const mockProfile: VendorProfile = {
      id: authUser.uid,
      companyName: 'NESAM Fast Fleet Tours',
      contactPerson: 'Vignesh',
      phone: phone || '+919876543210',
      email: authUser.email || 'partner@nesamtravels.com',
      gstin: '33AAAAA0000A1Z5',
      panNumber: 'ABCDE1234F',
      address: '42 Bypass Road',
      city: 'Madurai',
      totalFleetSize: 1,
      totalDriversCount: 1,
      verificationStatus: 'Approved',
      joinedDate: '2026-01-15',
      bankAccountName: 'NESAM Fast Fleet',
      bankAccountNumber: 'XXXXXX5678',
      ifscCode: 'SBIN0001234',
      upiId: 'nesam@sbi',
      commissionRate: 0.15,
    };
    const mockRecord: VendorRecord = {
      uid: authUser.uid,
      phone: phone || '+919876543210',
      status: 'APPROVED',
      onboardingStep: 4,
      business: {
        vendorName: 'Vignesh',
        businessName: 'NESAM Fast Fleet Tours',
        email: authUser.email || 'partner@nesamtravels.com',
        altPhone: phone || '+919876543210',
        address: { line1: '42 Bypass Road', line2: '', city: 'Madurai', state: 'Tamil Nadu', pincode: '625001' },
      },
      documents: {
        businessRegistration: { type: 'GST', number: '33AAAAA0000A1Z5', files: [] },
        identityProof: { type: 'AADHAAR', maskedNumber: 'XXXX-XXXX-1234', files: [] },
      },
      fleet: {
        vehicleTypes: ['SUV'],
        fleetSize: 1,
        rcFiles: [],
        vehiclePhotos: [],
        insuranceFiles: [],
        vehicles: [],
      },
      payoutSummary: {
        accountHolderName: 'NESAM Fast Fleet',
        bankLast4: '5678',
        ifsc: 'SBIN0001234',
        upiId: 'nesam@sbi',
      },
      review: null,
      submittedAt: Date.now(),
    };

    return (
      <LegalGate key="dev-vendor" role="vendor">
        <InboxProvider userId={authUser.uid} role="vendor" penaltyField="vendorId">
          <VendorDataProvider profile={mockProfile} record={mockRecord}>
            <MainNavigator onSignOut={signOut} />
          </VendorDataProvider>
        </InboxProvider>
      </LegalGate>
    );
  }

  if (__DEV__ && devPreview === 'onboarding') {
    const draftRecord: VendorRecord = {
      uid: authUser.uid,
      phone: phone || '+919876543210',
      status: 'INCOMPLETE',
      onboardingStep: 0,
      business: {
        vendorName: '',
        businessName: '',
        email: '',
        altPhone: '',
        address: { line1: '', line2: '', city: 'Madurai', state: 'Tamil Nadu', pincode: '625001' },
      },
      documents: null,
      fleet: {
        vehicleTypes: [],
        fleetSize: 0,
        rcFiles: [],
        vehiclePhotos: [],
        insuranceFiles: [],
      },
      payoutSummary: null,
      review: null,
      submittedAt: null,
    };
    return <OnboardingWizard key={authUser.uid} record={draftRecord} phone={phone} onSignOut={signOut} />;
  }

  // No vendor account: registration is by one-time invitation (spec page 13).
  if (!vendor) return <RegistrationGate key={authUser.uid} phone={phone} onSignOut={signOut} onDevPreview={__DEV__ ? setDevPreview : undefined} />;
  if (status === 'INCOMPLETE' || status === 'CHANGES_REQUESTED' || (status === 'REJECTED' && reapplying)) {
    return <OnboardingWizard key={authUser.uid} record={vendor.record} phone={phone} onSignOut={signOut} />;
  }
  if (status !== 'APPROVED') {
    return <AccountStatusScreen record={vendor.record} onSignOut={signOut} onReapply={status === 'REJECTED' ? () => setReapplying(true) : undefined} />;
  }

  return (
    <LegalGate key={vendor.profile.id} role="vendor">
      <InboxProvider userId={vendor.profile.id} role="vendor" penaltyField="vendorId">
        <VendorDataProvider profile={vendor.profile} record={vendor.record}>
          <MainNavigator onSignOut={signOut} />
        </VendorDataProvider>
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

// Phone-number sign-in (Firebase Auth), native version of
// user/web/src/services/authService.ts. Same Auth users as the Web panel.
import {
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  type ApplicationVerifier,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import type { NativeRecaptchaVerifier } from '../components/RecaptchaVerifier';

export async function sendOtpToPhone(phoneE164: string, verifier: NativeRecaptchaVerifier): Promise<ConfirmationResult> {
  // The SDK only needs `type`, `verify()` and `_reset()` from its verifier.
  const appVerifier: ApplicationVerifier = verifier;
  return signInWithPhoneNumber(auth, phoneE164, appVerifier);
}

export async function confirmOtpCode(confirmation: ConfirmationResult, code: string): Promise<User> {
  const credential = await confirmation.confirm(code);
  return credential.user;
}

export function subscribeToAuthUser(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

/** User-facing message for a Firebase phone-auth failure with actionable resolution guidance. */
export function describePhoneAuthError(error: unknown): string {
  const err = error as {
    code?: string;
    message?: string;
    customData?: {
      serverResponse?: {
        error?: {
          message?: string;
          code?: number;
        };
      };
    };
  };

  const code = err?.code ?? '';
  const serverMsg = (err?.customData?.serverResponse?.error?.message ?? err?.message ?? '').toUpperCase();

  if (__DEV__) {
    console.warn('[auth error]', { code, serverMsg, err });
  }

  if (serverMsg.includes('SITE_MISMATCH') || code === 'auth/unauthorized-domain') {
    return 'Domain Not Authorized: Your current address/IP is not listed in Firebase Authorized Domains. Open Firebase Console > Authentication > Settings > Authorized domains and add it, or use http://localhost.';
  }

  if (
    serverMsg.includes('TOO_MANY_ATTEMPTS_TRY_LATER') ||
    serverMsg.includes('SMS_QUOTA_EXCEEDED') ||
    code === 'auth/quota-exceeded'
  ) {
    return 'Daily SMS Limit Reached (10 SMS/day on free Spark tier). To test freely, add a test phone number in Firebase Console > Authentication > Sign-in method > Phone > Phone numbers for testing (e.g. +91 99999 99999 / 123456).';
  }

  if (serverMsg.includes('BILLING_NOT_ENABLED')) {
    return 'Firebase Billing Required: Carrier SMS sending requires Firebase Blaze plan. For development, add a test phone number in Firebase Console (Authentication > Sign-in method > Phone) to test completely free.';
  }

  if (serverMsg.includes('OPERATION_NOT_ALLOWED') || code === 'auth/operation-not-allowed') {
    return 'Phone sign-in is disabled. Please enable Phone provider in Firebase Console > Authentication > Sign-in method.';
  }

  if (serverMsg.includes('INVALID_APP_CREDENTIAL') || serverMsg.includes('MISSING_CLIENT_IDENTIFIER')) {
    return 'App security verification failed. Check authorized domains in Firebase Console or configure a test phone number.';
  }

  switch (code) {
    case 'auth/invalid-phone-number':
      return 'Enter a valid 10-digit mobile number (+91).';
    case 'auth/missing-phone-number':
      return 'Please enter your mobile number.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes, or use a configured Firebase test phone number.';
    case 'auth/invalid-verification-code':
      return 'Incorrect OTP. Please check your SMS and try again.';
    case 'auth/code-expired':
    case 'auth/session-expired':
      return 'This OTP has expired. Tap "Resend code" to get a new one.';
    case 'auth/missing-verification-code':
      return 'Please enter the 6-digit OTP.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please check your internet.';
    case 'auth/quota-exceeded':
      return 'SMS limit reached for today. Please add a test phone number in Firebase Console or try again tomorrow.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/cancelled':
      return 'Verification cancelled.';
    case 'auth/timeout':
      return 'The security check timed out. Please try again.';
    case 'auth/captcha-check-failed':
    case 'auth/invalid-app-credential':
      return 'The security check failed. Check your domain in Firebase Authorized Domains or use a Firebase test phone number.';
    default:
      if (err?.customData?.serverResponse?.error?.message) {
        return `Verification failed: ${err.customData.serverResponse.error.message}`;
      }
      return 'Unable to complete verification. Please check your domain in Firebase Console or try a test phone number.';
  }
}

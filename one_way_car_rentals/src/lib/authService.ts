// Phone-number sign-in (Firebase Auth) for the browser: Firebase's own invisible
// reCAPTCHA, a fresh verifier per OTP request (a used or failed one cannot be reused).
//
// Phone ssign-in on a deployed site needs its domain under Firebase console ›
// Authentication › Settings › Authorized domains (localhost is there by default).
import {
  RecaptchaVerifier,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { auth } from '@/platform/firebase';

let activeVerifier: RecaptchaVerifier | null = null;

function getFreshContainer(): HTMLElement {
  const existing = document.getElementById('recaptcha-container');
  if (existing && existing.parentNode) {
    const fresh = document.createElement('div');
    fresh.id = 'recaptcha-container';
    existing.parentNode.replaceChild(fresh, existing);
    return fresh;
  }
  if (existing) {
    existing.remove();
  }
  const fresh = document.createElement('div');
  fresh.id = 'recaptcha-container';
  document.body.appendChild(fresh);
  return fresh;
}

export function resetRecaptchaVerifier(): void {
  if (activeVerifier) {
    try {
      activeVerifier.clear();
    } catch {
      /* already cleared */
    }
    activeVerifier = null;
  }
  getFreshContainer();
}

export function createFreshRecaptchaVerifier(): RecaptchaVerifier {
  resetRecaptchaVerifier();
  const host = getFreshContainer();
  activeVerifier = new RecaptchaVerifier(auth, host, {
    size: 'invisible',
    callback: () => {
      /* reCAPTCHA solved */
    },
    'expired-callback': () => {
      resetRecaptchaVerifier();
    },
  });
  return activeVerifier;
}

export async function sendOtpToPhone(phoneE164: string): Promise<ConfirmationResult> {
  const verifier = createFreshRecaptchaVerifier();
  try {
    return await signInWithPhoneNumber(auth, phoneE164, verifier);
  } catch (error) {
    resetRecaptchaVerifier();
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
    console.error('[Firebase Phone Auth Error]', {
      code: err?.code,
      message: err?.message,
      serverMessage: err?.customData?.serverResponse?.error?.message,
      raw: error,
    });
    throw error;
  }
}

export async function confirmOtpCode(confirmation: ConfirmationResult, code: string): Promise<User> {
  return (await confirmation.confirm(code)).user;
}

export const subscribeToAuthUser = (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb);
export const signOutUser = () => firebaseSignOut(auth);

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
  const message = err?.message ?? '';
  const serverMsg = (err?.customData?.serverResponse?.error?.message ?? message).toUpperCase();

  if (serverMsg.includes('ALREADY BEEN RENDERED')) {
    return 'Security check refreshed. Please tap Continue again.';
  }

  if (
    code === 'auth/invalid-app-credential' ||
    serverMsg.includes('INVALID_APP_CREDENTIAL') ||
    serverMsg.includes('INVALID-APP-CREDENTIAL')
  ) {
    return 'Test Number Setup Required: To test with this number without carrier SMS / reCAPTCHA failures, add "+91" followed by your 10-digit number (e.g. +91 63790 56759) with test OTP 123456 under Firebase Console > Authentication > Sign-in method > Phone > "Phone numbers for testing (optional)".';
  }

  if (serverMsg.includes('SITE_MISMATCH') || code === 'auth/unauthorized-domain') {
    return 'Domain Not Authorized: Your current address/IP is not listed in Firebase Authorized Domains. Please use http://localhost or add your IP/domain under Firebase Console > Authentication > Settings > Authorized domains.';
  }

  if (
    serverMsg.includes('TOO_MANY_ATTEMPTS_TRY_LATER') ||
    serverMsg.includes('SMS_QUOTA_EXCEEDED') ||
    code === 'auth/quota-exceeded'
  ) {
    return 'Daily SMS Limit Reached (10 SMS/day on free Spark tier). Add this number under Firebase Console > Authentication > Sign-in method > Phone > "Phone numbers for testing" to test instantly without limits.';
  }

  if (serverMsg.includes('BILLING_NOT_ENABLED')) {
    return 'Firebase Billing Required: Carrier SMS sending requires Firebase Blaze plan. For development, add your number in Firebase Console (Authentication > Sign-in method > Phone > Phone numbers for testing) to test completely free.';
  }

  if (serverMsg.includes('OPERATION_NOT_ALLOWED') || code === 'auth/operation-not-allowed') {
    return 'Phone sign-in is disabled. Please enable Phone provider in Firebase Console > Authentication > Sign-in method.';
  }

  if (serverMsg.includes('MISSING_CLIENT_IDENTIFIER')) {
    return 'App security verification failed. Ensure your current domain/IP is authorized in Firebase Console, or configure this number under Firebase test phone numbers.';
  }

  switch (code) {
    case 'auth/invalid-phone-number':
      return 'Enter a valid 10-digit mobile number.';
    case 'auth/missing-phone-number':
      return 'Please enter your mobile number.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes, or add this number under Firebase test phone numbers.';
    case 'auth/invalid-verification-code':
      return 'That code is not correct. Check your SMS or Firebase test code and try again.';
    case 'auth/code-expired':
    case 'auth/session-expired':
      return 'This code has expired. Request a new one.';
    case 'auth/missing-verification-code':
      return 'Enter the 6-digit code.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Check your internet and try again.';
    case 'auth/quota-exceeded':
      return 'The SMS limit for today has been reached. Please add this number in Firebase Console Phone numbers for testing.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/captcha-check-failed':
    case 'auth/internal-error':
      return 'The security check could not be completed. Check your domain in Firebase Console > Authorized domains or add this number under Firebase test phone numbers.';
    case 'auth/unauthorized-domain':
      return 'This website address or IP is not authorised for sign-in. Add it under Firebase Console > Authentication > Settings > Authorized domains.';
    default:
      if (err?.customData?.serverResponse?.error?.message) {
        return `Verification failed: ${err.customData.serverResponse.error.message}`;
      }
      return 'Verification failed. To test without carrier SMS, add "+91" with your 10-digit number in Firebase Console > Authentication > Sign-in method > Phone > Phone numbers for testing.';
  }
}

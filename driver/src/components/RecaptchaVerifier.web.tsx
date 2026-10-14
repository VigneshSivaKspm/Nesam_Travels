// Browser application verifier for Firebase phone auth.
//
// Same public surface as RecaptchaVerifier.tsx (the Android WebView version), so
// the auth screens and authService are unchanged. In a browser Firebase's own
// invisible reCAPTCHA runs directly in the page; a fresh verifier is created per
// OTP request because a used or failed one cannot be reused.
//
// Phone sign-in on a deployed site requires its domain to be listed under
// Firebase console › Authentication › Settings › Authorized domains.
import React from 'react';
import { RecaptchaVerifier } from 'firebase/auth';
import { auth } from '../config/firebase';

export interface NativeRecaptchaVerifier {
  readonly type: 'recaptcha';
  verify(): Promise<string>;
  _reset(): void;
}

export class RecaptchaError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const webVerifier: NativeRecaptchaVerifier = {
  type: 'recaptcha',
  async verify() {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const verifier = new RecaptchaVerifier(auth, host, { size: 'invisible' });
    try {
      return await verifier.verify();
    } catch (e) {
      const code = (e as { code?: string })?.code ?? 'auth/captcha-check-failed';
      throw new RecaptchaError(code, 'The security check could not be completed. Check your connection and try again.');
    } finally {
      try {
        verifier.clear();
      } catch {
        /* already cleared */
      }
      host.remove();
    }
  },
  _reset: () => undefined,
};

export function useRecaptchaVerifier(): NativeRecaptchaVerifier {
  return webVerifier;
}

/** Nothing to host on the web — the verifier talks to the page directly. */
export function RecaptchaProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

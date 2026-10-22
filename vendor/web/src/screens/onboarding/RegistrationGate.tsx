import React, { useState } from 'react';
import { Car, LogOut, PhoneCall, ShieldCheck, ArrowRight } from 'lucide-react';
import { registerVendorWithVehicle } from '../../services/onboardingService';
import { displayPlate, isPlate, normalizePlate } from '../../utils/fleet';
import { describeDataError } from '../../utils/retry';
import { Button, ErrorBanner, TextField } from '../../components/onboarding/ui';

interface Props {
  phone: string;
  onSignOut: () => void;
}

/**
 * Sign-up for a new fleet partner: the verified mobile number plus the vehicle's registration number.
 * Submitting creates the application (already submitted for NESAM's review); the real-time listener
 * on vendors/{uid} in App.tsx then shows the "under review" screen.
 */
export const RegistrationGate: React.FC<Props> = ({ phone, onSignOut }) => {
  const [plate, setPlate] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const invalid = !isPlate(plate);
  const fieldError = touched && invalid ? 'Enter the registration number as printed on the plate, e.g. TN 01 AB 1234.' : '';

  const handleRegister = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (invalid || busy) return;
    setBusy(true);
    setError('');
    try {
      await registerVendorWithVehicle(phone, plate);
      // The vendors/{uid} listener in App.tsx fires and routes to the account status screen.
    } catch (err) {
      setError(describeDataError(err));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full font-sans antialiased flex items-center justify-center px-4 py-12" style={{ background: '#F5F5F5' }}>
      <form className="w-full max-w-lg space-y-6" onSubmit={handleRegister} noValidate>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-md text-white mb-4" style={{ background: '#E21B23' }}>
            <Car className="w-8 h-8" />
          </div>
          <h1 className="text-[24px] font-extrabold text-[#111] tracking-tight">Become a NESAM Fleet Partner</h1>
          <p className="text-[13px] text-[#666] mt-2 max-w-md mx-auto">
            Sign up with your vehicle number. That is all we need to start your application.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-6 space-y-4">
          <TextField
            id="registrationNumber"
            label="Vehicle registration number"
            required
            value={plate}
            onChange={(v) => setPlate(v.toUpperCase())}
            error={fieldError}
            placeholder="TN 01 AB 1234"
            hint="As printed on the number plate."
          />
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 flex items-start gap-2.5 text-[12px] text-blue-900">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Admin verification:</strong> NESAM reviews your application and verifies the vehicle before Bookings, Marketplace, Drivers, Vehicles and Wallet become active. We will contact you on <strong>{phone}</strong> if anything else is needed.
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-center text-[12px] text-[#888]">
            Signed in with mobile: <strong className="text-[#111]">{phone}</strong>
            {!invalid && <> · Vehicle: <strong className="text-[#111] font-mono">{displayPlate(normalizePlate(plate))}</strong></>}
          </div>

          {error && <ErrorBanner message={error} onRetry={() => void handleRegister()} />}

          <Button type="submit" loading={busy} className="w-full py-3.5 text-[14px] font-bold flex items-center justify-center gap-2 shadow-sm">
            {busy ? 'Submitting…' : 'Register vehicle'}
            {!busy && <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex items-center justify-between text-[12px] font-semibold text-[#666] px-2 pt-2">
          <a href="tel:+919025099990" className="flex items-center gap-1.5 hover:text-[#111] transition-colors">
            <PhoneCall className="w-4 h-4 text-[#E21B23]" /> Partner support: +91 90250 99990
          </a>
          <button type="button" onClick={onSignOut} className="flex items-center gap-1.5 hover:text-[#111] transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </form>
    </div>
  );
};

export function captureInviteFromUrl(): string {
  return '';
}

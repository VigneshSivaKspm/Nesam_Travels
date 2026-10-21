import React, { useState } from 'react';
import { Building2, LogOut, PhoneCall, ShieldCheck, Car, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { createVendorApplication } from '../../services/onboardingService';
import { describeDataError } from '../../utils/retry';
import { Button, ErrorBanner } from '../../components/onboarding/ui';

interface Props {
  phone: string;
  onSignOut: () => void;
}

const STEPS = [
  {
    icon: Building2,
    title: 'Business & Bank Details',
    desc: 'Owner name, travels/agency name, operating base, and bank account for settlements.',
  },
  {
    icon: FileText,
    title: 'Identity & Business Documents',
    desc: 'GST / Trade License / Business Reg and government-issued ID proof.',
  },
  {
    icon: Car,
    title: 'Fleet Documentation',
    desc: 'Register each vehicle with RC, Insurance, FC, Permit and front photo.',
  },
  {
    icon: CheckCircle2,
    title: 'Admin Review & Approval',
    desc: 'Our admin team reviews your application. Once approved, all vendor features unlock automatically.',
  },
];

export const RegistrationGate: React.FC<Props> = ({ phone, onSignOut }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleStart = async () => {
    setBusy(true);
    setError('');
    try {
      await createVendorApplication(phone);
      // The real-time listener on vendors/{uid} in App.tsx will immediately detect the
      // new INCOMPLETE record and route to the OnboardingWizard.
    } catch (e) {
      setError(describeDataError(e));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full font-sans antialiased flex items-center justify-center px-4 py-12" style={{ background: '#F5F5F5' }}>
      <div className="w-full max-w-lg space-y-6">
        {/* Hero */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-md text-white mb-4" style={{ background: '#E21B23' }}>
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-[24px] font-extrabold text-[#111] tracking-tight">Become a NESAM Fleet Partner</h1>
          <p className="text-[13px] text-[#666] mt-2 max-w-md mx-auto">
            Register your travel agency or fleet and start receiving bookings from thousands of NESAM customers.
          </p>
        </div>

        {/* Steps overview */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-6 space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#999]">Application Process</div>

          <div className="space-y-4">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="flex items-start gap-3.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-[12px]"
                    style={{ background: '#FEF2F2', color: '#E21B23' }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-[#111] flex items-center gap-1.5">
                      <Icon className="w-4 h-4 text-[#E21B23]" />
                      {s.title}
                    </div>
                    <div className="text-[12px] text-[#666] mt-0.5 leading-relaxed">{s.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 flex items-start gap-2.5 text-[12px] text-blue-900">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Admin verification:</strong> All registrations create a pending application reviewed by our admin team before Bookings, Marketplace, Drivers, Vehicles, and Wallet become active.
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <div className="text-center text-[12px] text-[#888]">
            Signed in with mobile: <strong className="text-[#111]">{phone}</strong>
          </div>

          {error && <ErrorBanner message={error} onRetry={handleStart} />}

          <Button
            onClick={handleStart}
            loading={busy}
            className="w-full py-3.5 text-[14px] font-bold flex items-center justify-center gap-2 shadow-sm"
          >
            {busy ? 'Starting Application…' : 'Start Vendor Application'}
            {!busy && <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[12px] font-semibold text-[#666] px-2 pt-2">
          <a href="tel:+919025099990" className="flex items-center gap-1.5 hover:text-[#111] transition-colors">
            <PhoneCall className="w-4 h-4 text-[#E21B23]" /> Partner support: +91 90250 99990
          </a>
          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center gap-1.5 hover:text-[#111] transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export function captureInviteFromUrl(): string {
  return '';
}

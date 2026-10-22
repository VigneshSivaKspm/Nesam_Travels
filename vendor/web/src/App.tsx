import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { VendorProfile, VendorRecord } from './types';
import type { PartnerNotification } from './notificationTypes';
import { subscribeToAuthUser, signOutUser, setAuthIntent, resetRecaptchaVerifier } from './services/authService';
import { subscribeToVendor, type VendorSnapshot } from './services/onboardingService';
import { describeDataError } from './utils/retry';
import { OnboardingWizard } from './screens/onboarding/OnboardingWizard';
import { RegistrationGate, captureInviteFromUrl } from './screens/onboarding/RegistrationGate';
import { AccountStatusScreen } from './screens/AccountStatusScreen';
import { VendorLoginScreen } from './screens/VendorLoginScreen';
import { FullScreenLoader } from './components/onboarding/ui';
import { LegalGate } from './components/LegalGate';
import { NotificationPopups } from './components/NotificationPopups';
import { PenaltyAckModal } from './components/PenaltyAckModal';
import { PartnerProvider, usePartner, type PageId } from './state/Partner';
import { Shell } from './ui/Shell';
import { Banner, Button, Toast, useToast } from './ui/kit';
import { IconSprite } from './ui/Icon';
import { DutiesPage } from './pages/DutiesPage';
import { DriversPage } from './pages/DriversPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { RequestsPage } from './pages/RequestsPage';
import { PayoutsPage } from './pages/PayoutsPage';
import { AccountPage } from './pages/AccountPage';
import { AlertsPage } from './pages/AlertsPage';

async function handleSignOut() {
  setAuthIntent(null);
  resetRecaptchaVerifier();
  try {
    await signOutUser();
  } catch (error) {
    console.warn('Sign out failed:', error);
  }
}

/**
 * Gatekeeper. Routing is driven entirely by two live listeners:
 *   Firebase Auth user  →  vendors/{uid} snapshot  →  screen for its status.
 * When an admin approves the vendor, the snapshot fires and the workspace mounts immediately — no refresh needed.
 */
export function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  // undefined = still loading, null = no vendors/{uid} doc yet
  const [vendor, setVendor] = useState<VendorSnapshot | null | undefined>(undefined);
  const [vendorError, setVendorError] = useState('');
  const [listenerKey, setListenerKey] = useState(0);
  const [reapplying, setReapplying] = useState(false);

  useEffect(() => { captureInviteFromUrl(); }, []);

  useEffect(() => subscribeToAuthUser((fbUser) => { setUser(fbUser); setAuthLoading(false); }), []);

  useEffect(() => {
    setVendor(undefined);
    setVendorError('');
    setReapplying(false);
    if (!user) return undefined;
    return subscribeToVendor(
      user.uid,
      (snap) => { setVendor(snap); setVendorError(''); },
      (error) => setVendorError(describeDataError(error)),
    );
  }, [user?.uid, listenerKey]);

  const status = vendor?.record.status;
  // Leave "reapply" mode once the vendor resubmits or the admin acts.
  useEffect(() => { if (status !== 'REJECTED') setReapplying(false); }, [status]);

  if (authLoading) return <FullScreenLoader />;
  if (!user) return <VendorLoginScreen />;

  if (vendorError) {
    return (
      <div className="vx">
        <IconSprite />
        <div className="vx-auth">
          <div className="vx-auth__col">
            <div className="vx-card" style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Couldn’t load your account</h1>
              <p className="vx-muted" style={{ marginBottom: 16 }}>{vendorError}</p>
              <div className="vx-actions" style={{ justifyContent: 'center', marginTop: 0 }}>
                <Button onClick={handleSignOut}>Sign out</Button>
                <Button variant="primary" onClick={() => setListenerKey((k) => k + 1)}>Try again</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (vendor === undefined) return <FullScreenLoader label="Loading your account…" />;

  const phone = user.phoneNumber || vendor?.record.phone || '';

  // No vendor account yet: sign up with a vehicle number.
  if (!vendor) return <RegistrationGate key={user.uid} phone={phone} onSignOut={handleSignOut} />;

  if (status === 'INCOMPLETE' || status === 'CHANGES_REQUESTED' || (status === 'REJECTED' && reapplying)) {
    return <OnboardingWizard key={user.uid} record={vendor.record} phone={phone} onSignOut={handleSignOut} />;
  }

  if (status !== 'APPROVED') {
    return <AccountStatusScreen record={vendor.record} onSignOut={handleSignOut} onReapply={status === 'REJECTED' ? () => setReapplying(true) : undefined} />;
  }

  return (
    <LegalGate role="vendor">
      <VendorWorkspace profile={vendor.profile} record={vendor.record} />
    </LegalGate>
  );
}

function VendorWorkspace({ profile, record }: { profile: VendorProfile; record: VendorRecord }) {
  return (
    <PartnerProvider profile={profile} record={record}>
      <Workspace />
    </PartnerProvider>
  );
}

/** Where a notification's call-to-action leads. */
function pageFor(n: PartnerNotification): PageId {
  if (n.category === 'penalties') return 'alerts';
  switch (n.ctaPage) {
    case 'marketplace': case 'dashboard': case 'trips': case 'trip': case 'booking-detail': return 'duties';
    case 'wallet': return 'payouts';
    case 'profile': case 'documents': return 'account';
    case 'links': return 'requests';
    case 'drivers': return 'drivers';
    case 'vehicles': return 'vehicles';
    default: return n.category === 'bookings' ? 'duties' : 'alerts';
  }
}

function Workspace() {
  const p = usePartner();
  const { toast, show, dismiss } = useToast();
  const [ackDone, setAckDone] = useState<string[]>([]);

  // A penalty must be acknowledged (or disputed) before the partner carries on.
  const mustAcknowledge = p.penalties.find((x) => x.status === 'Pending' && !x.acknowledged && !ackDone.includes(x.id)) ?? null;

  const body = (() => {
    switch (p.page) {
      case 'drivers': return <DriversPage />;
      case 'vehicles': return <VehiclesPage />;
      case 'requests': return <RequestsPage />;
      case 'payouts': return <PayoutsPage />;
      case 'account': return <AccountPage />;
      case 'alerts': return <AlertsPage />;
      default: return <DutiesPage />;
    }
  })();

  return (
    <Shell page={p.page} go={p.go} partnerName={p.profile.companyName || 'Fleet partner'} partnerId={p.profile.id}
      counts={{ requests: p.openLinks.length, unread: p.unread, newDuties: p.openTrips.length }}
      overlays={
        <>
          <Toast toast={toast} onDismiss={dismiss} />
          <NotificationPopups notifications={p.notifications} onOpen={(n) => { p.actions.markRead(n.id); p.go(pageFor(n)); }} />
          {mustAcknowledge && (
            <PenaltyAckModal key={mustAcknowledge.id} penalty={mustAcknowledge} onDone={(m) => { setAckDone((d) => [...d, mustAcknowledge.id]); show(m); }} />
          )}
        </>
      }>
      {p.loadError && <Banner tone="err" action={{ label: 'Retry', onClick: p.retry }}>{p.loadError}</Banner>}
      {body}
    </Shell>
  );
}

export default App;

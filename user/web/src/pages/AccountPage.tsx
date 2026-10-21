import { useRef, useState } from 'react';
import { useCustomerData } from '@/state/CustomerData';
import { updateCustomerProfile } from '@core/services/userService';
import { isActiveStatus } from '@core/services/rideService';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { formatINR, formatPhone } from '@core/utils/format';
import { describeError } from '@core/utils/retry';
import { Avatar, Button, Dialog, ListRow, Notice, PageHead } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { AccountLayout, SignInPrompt } from '@/components/AccountLayout';
import { PhotoError, uploadProfilePhoto } from '@/lib/avatarUpload';
import { useSeo } from '@/lib/seo';
import { useAuth } from '@/state/Auth';
import { useInbox } from '@/state/Inbox';

export function AccountPage() {
  useSeo({ title: 'My Account', noindex: true });
  const { profile, trips } = useCustomerData();
  const { signOut } = useAuth();
  const { unreadCount } = useInbox();
  const file = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);

  if (!profile) {
    return (
      <AccountLayout>
        <PageHead backTo="/book" title="Account">
          Everything for your journey.
        </PageHead>
        <SignInPrompt title="Sign in to your account" text="Sign in with your mobile number to see your bookings, payments, saved addresses and notifications." />
        <div className="card card--list acct-list">
          <ListRow icon="support" title="Help & Support" text="Get help with your journey" to="/support" />
          <ListRow icon="offers" title="Offers" text="Current promo codes" to="/offers" />
          <ListRow icon="document" title="Terms & privacy" text="Customer terms and privacy policy" to="/legal" />
          <ListRow icon="information" title="About NESAM" text="Company details" to="/about" />
        </div>
      </AccountLayout>
    );
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    setProgress(0);
    try {
      const url = await uploadProfilePhoto(profile.uid, f, setProgress);
      await updateCustomerProfile(profile.uid, { photoUrl: url });
    } catch (e) {
      setError(e instanceof PhotoError ? e.message : describeError(e, 'We couldn’t update your photo.'));
    } finally {
      setProgress(null);
      if (file.current) file.current.value = '';
    }
  };
  const active = trips.filter((t) => isActiveStatus(t.status)).length;

  return (
    <AccountLayout>
      <PageHead backTo="/book" title="Account">
        Everything for your journey.
      </PageHead>
      {error ? <Notice tone="error">{error}</Notice> : null}

      <section className="card acct-hero">
        <button type="button" className="acct-hero__photo" onClick={() => file.current?.click()} disabled={progress != null} aria-label="Change profile photo">
          <Avatar name={profile.name} photoUrl={profile.photoUrl} size={52} />
          <span className="acct-hero__cam">
            <Icon name={progress != null ? 'document-upload' : 'camera'} size={12} />
          </span>
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        <div className="acct-hero__text">
          <h2>{profile.name}</h2>
          <p className="num">{formatPhone(profile.phone)}</p>
          {progress != null ? <p className="small muted">Uploading photo… {progress}%</p> : null}
        </div>
      </section>

      <div className="card card--list acct-list">
        <ListRow icon="booking" title="My Bookings" text="Upcoming, ongoing & past trips" to="/trips" trailing={active ? <em className="count count--soft">{active}</em> : undefined} />
        <ListRow icon="wallet" title="Payments & Refunds" text={`Trip payments, refunds · credits ${formatINR(profile.walletBalance)}`} to="/account/payments" />
      </div>
      <div className="card card--list acct-list">
        <ListRow icon="profile" title="My Profile" text="Personal details, WhatsApp, emergency contact & language" to="/account/edit" />
        <ListRow icon="saved-place" title="Saved addresses" text="Your regular pickup & drop places" to="/account/places" />
        <ListRow icon="support" title="Help & Support" text="Get help with your journey" to="/support" />
      </div>
      <div className="card card--list acct-list">
        <ListRow icon="notifications" title="Notifications & updates" text="Booking and payment updates" to="/notifications" trailing={unreadCount ? <em className="count count--soft">{unreadCount}</em> : undefined} />
        <ListRow icon="offers" title="Offers" text="Current promo codes" to="/offers" />
        <ListRow icon="information" title="Terms, privacy & about NESAM" text="Policies you accepted and company details" to="/legal" />
        <ListRow icon="phone" title="Call NESAM" text={SUPPORT_PHONE_DISPLAY} href={`tel:${SUPPORT_PHONE}`} />
      </div>
      <button type="button" className="signout" onClick={() => setConfirm(true)}>
        <Icon name="logout" size={16} /> Sign out
      </button>

      {confirm ? (
        <Dialog
          title="Sign out of NESAM?"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Stay signed in
              </Button>
              <Button onClick={() => void signOut().catch(() => setError('We couldn’t sign you out. Please try again.'))}>Sign out</Button>
            </>
          }
        >
          <p className="muted">You’ll need to verify your mobile number again to sign back in.</p>
        </Dialog>
      ) : null}
    </AccountLayout>
  );
}

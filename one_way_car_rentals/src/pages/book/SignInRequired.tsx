import { useAuth } from '@/state/Auth';
import { useBooking } from '@/state/Booking';
import { setPendingReturn } from '@/lib/pendingReturn';
import { Button, PageHead } from '@/components/ui';
import { RoutePoints } from '@/components/RoutePoints';
import { formatDate, formatTime } from '@core/utils/format';

/** Keep the booking draft mounted while the existing phone/OTP flow verifies the rider. */
export function SignInRequired() {
  const { openLoginModal } = useAuth();
  const { draft } = useBooking();
  const { pickup, drop, scheduledAt, tripEndAt, tripType } = draft;

  const signIn = () => {
    // Resume vehicle selection only; never submit a booking as an authentication side effect.
    setPendingReturn('/book/ride');
    openLoginModal({
      title: 'Sign in to see your fares',
      subtitle: 'Verify your mobile number to continue with your saved trip.',
    });
  };

  return (
    <div className="page">
      <PageHead backTo="/book" title="Sign in to compare fares">
        Your trip is saved. Verify your mobile number to get confirmed fares and choose a vehicle.
      </PageHead>
      <section className="card" aria-label="Saved trip and sign in">
        <div className="card__body stack">
          {pickup && drop ? (
            <RoutePoints pickup={pickup.name} drop={drop.name} pickupAddress={pickup.address} dropAddress={drop.address} />
          ) : null}
          <p>{tripType}{scheduledAt ? ` · ${formatDate(scheduledAt)} · ${formatTime(scheduledAt)}` : ''}</p>
          {tripType === 'Round Trip' && tripEndAt ? (
            <p>Return: {formatDate(tripEndAt)} · {formatTime(tripEndAt)}</p>
          ) : null}
          <Button size="lg" onClick={signIn}>Sign in with mobile number</Button>
          <p className="muted small">No payment is taken when you sign in. You will review and confirm the booking separately.</p>
        </div>
      </section>
    </div>
  );
}

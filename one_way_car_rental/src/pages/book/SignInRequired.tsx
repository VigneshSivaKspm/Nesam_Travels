// Shown instead of the vehicle / review steps while the rider is not signed in: fares come from the
// booking server, which only quotes for a signed-in account. The trip stays in the draft, and once
// sign-in completes the rider is resumed at vehicle selection (never booked automatically).
import { Link } from 'react-router-dom';
import { formatDate, formatTime } from '@core/utils/format';
import { Badge, Button, FlowSteps, Notice, PageHead } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/state/Auth';
import { useBooking } from '@/state/Booking';
import { setPendingReturn } from '@/lib/pendingReturn';
import { tripTypeLabel } from '@/lib/services';

export function SignInRequired() {
  const { state, openLoginModal, isLoginModalOpen } = useAuth();
  const { draft } = useBooking();
  const { pickup, drop, tripType, scheduledAt, tripEndAt } = draft;
  const when = scheduledAt ? `${formatDate(scheduledAt)} · ${formatTime(scheduledAt)}` : 'Pickup time not chosen';

  const signIn = () => {
    setPendingReturn('/book/ride');
    openLoginModal({
      title: 'Sign in to see fares',
      subtitle: 'Enter your mobile number to compare vehicles and upfront fares for your trip.',
    });
  };

  return (
    <div className="flow-page">
      <div className="wrap flow-page__wrap">
        <div className="signin-gate">
          <PageHead backTo="/book" title="Sign in to see fares">
            Fares are priced by our booking server for your account. Your trip details are saved.
          </PageHead>
          <FlowSteps current={2} />

          {pickup && drop ? (
            <section className="trip-sum" aria-label="Your trip">
              <div className="trip-sum__top">
                <Badge tone="green">{tripTypeLabel(tripType)}</Badge>
                <Link to="/book" className="link-btn">
                  <Icon name="edit" size={14} /> Edit
                </Link>
              </div>
              <div className="trip-sum__route">
                <p className="route-title">
                  <span>{pickup.name}</span>
                  <Icon name="arrow-right" size={16} />
                  <span>{drop.id === 'place-local-disposal' ? 'Within city limits' : drop.name}</span>
                </p>
                <p className="trip-sum__when">{when}</p>
              </div>
              {tripType === 'Round Trip' && tripEndAt ? <p className="trip-sum__meta">Return {formatDate(tripEndAt)}, {formatTime(tripEndAt)}</p> : null}
            </section>
          ) : null}

          <div className="card signin-gate__card">
            <span className="signin-gate__icon" aria-hidden="true">
              <Icon name="lock" size={24} />
            </span>
            <h2>Sign in to continue</h2>
            <p className="muted">Verify your mobile number with a one-time code and we’ll take you straight to the vehicles and upfront fares for this trip. No payment is taken now.</p>
            {state.status === 'needs-profile' ? <Notice>Your number is verified. Finish your profile in the sign-in window to continue.</Notice> : null}
            <Button size="lg" block onClick={signIn} disabled={isLoginModalOpen}>
              Sign in with mobile number
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCustomerData } from '@/state/customer';
import { COMPANY_LEGAL_NAME, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { formatPhone } from '@core/utils/format';
import { useInbox } from '@/state/Inbox';
import { useAuth } from '@/state/Auth';
import { useBooking } from '@/state/Booking';
import { useOnline } from '@/lib/hooks';
import { SERVICES, parseService, serviceHref, serviceOfTrip, type ServiceId } from '@/lib/services';
import { Avatar, Button, Dialog, PageLoader } from './ui';
import { Icon } from './Icon';
import { DashboardMainSkeleton } from './DashboardSkeleton';

export function Brand() {
  return (
    <Link to="/book" className="brand" aria-label="One Way Car Rentals — book a cab">
      <img src="/brand/one-way-car-rentals-logo.png" alt="One Way Car Rentals logo" width={126} height={42} />
    </Link>
  );
}

const FLOW = [/^\/book\/(ride|confirm|done\/[^/]+)$/, /^\/ride\//, /^\/trips\/[^/]+$/];
const ACCOUNT_PATHS = /^\/(account|trips|notifications|offers|support|legal)(\/|$)/;

function NotificationsLink({ compact = false }: { compact?: boolean }) {
  const { unreadCount } = useInbox();
  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) => `head-action ${compact ? 'head-action--icon' : ''} ${isActive ? 'is-active' : ''}`}
      aria-label={compact ? `Notifications${unreadCount ? `, ${unreadCount} unread` : ''}` : undefined}
    >
      <span className="head-action__icon">
        <Icon name="notifications" size={compact ? 22 : 17} />
        {unreadCount > 0 ? (
          <em className="count" aria-hidden={compact || undefined}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </em>
        ) : null}
      </span>
      {compact ? null : <span>Notifications</span>}
    </NavLink>
  );
}

function MyTripsLink({ compact = false }: { compact?: boolean }) {
  return (
    <NavLink to="/trips" className={({ isActive }) => `head-trips ${compact ? 'head-trips--compact' : ''} ${isActive ? 'is-active' : ''}`}>
      <Icon name="trip-history" size={compact ? 18 : 17} />
      <span>My Trips</span>
    </NavLink>
  );
}

function BottomNav() {
  const location = useLocation();
  const [params] = useSearchParams();
  const { draft } = useBooking();
  const onHome = location.pathname === '/book' || location.pathname === '/';
  const current: ServiceId | null = onHome ? (parseService(params.get('service')) ?? serviceOfTrip(draft.tripType)) : null;
  const accountActive = ACCOUNT_PATHS.test(location.pathname) && !location.pathname.startsWith('/notifications') && !location.pathname.startsWith('/support');

  return (
    <nav className="bottom-nav" aria-label="Services and account">
      {SERVICES.map((s) => (
        <Link key={s.id} to={serviceHref(s.id)} className={`bottom-nav__item ${current === s.id ? 'is-active' : ''}`} aria-current={current === s.id ? 'page' : undefined}>
          <span className="bottom-nav__symbol">
            <Icon name={s.icon} size={24} />
          </span>
          <span className="bottom-nav__label">{s.label}</span>
        </Link>
      ))}
      <Link to="/account" className={`bottom-nav__item ${accountActive ? 'is-active' : ''}`} aria-current={accountActive ? 'page' : undefined}>
        <span className="bottom-nav__symbol">
          <Icon name="travel-account" size={24} />
        </span>
        <span className="bottom-nav__label">Account</span>
      </Link>
    </nav>
  );
}

function ProfileMenu() {
  const { profile } = useCustomerData();
  const { signOut, openLoginModal } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  if (!profile) {
    return (
      <Button
        variant="primary"
        size="sm"
        onClick={() => openLoginModal({ title: 'Sign in to One Way Car Rentals' })}
      >
        <Icon name="profile" size={16} /> Sign in
      </Button>
    );
  }

  const first = profile.name.split(' ')[0] || 'Account';
  return (
    <div className="menu" ref={root}>
      <button type="button" className="menu__trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Avatar name={profile.name} photoUrl={profile.photoUrl} size={36} />
        <span className="menu__name">{first}</span>
        <Icon name="chevron-down" size={15} />
      </button>
      {open ? (
        <div className="menu__panel" role="menu">
          <div className="menu__who">
            <strong className="truncate">{profile.name}</strong>
            <span className="muted small">{formatPhone(profile.phone)}</span>
          </div>
          <Link role="menuitem" to="/account">
            <Icon name="profile" size={16} /> Account
          </Link>
          <Link role="menuitem" to="/trips">
            <Icon name="trip-history" size={16} /> My trips
          </Link>
          <Link role="menuitem" to="/account/places">
            <Icon name="saved-place" size={16} /> Saved places
          </Link>
          <Link role="menuitem" to="/account/payments">
            <Icon name="wallet" size={16} /> Payments
          </Link>
          <Link role="menuitem" to="/legal">
            <Icon name="document" size={16} /> Terms &amp; privacy
          </Link>
          <button role="menuitem" type="button" onClick={() => setConfirm(true)}>
            <Icon name="logout" size={16} /> Log out
          </button>
        </div>
      ) : null}
      {confirm ? (
        <Dialog
          title="Log out of One Way Car Rentals?"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Stay signed in
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  signOut().catch(() => {
                    setError('We couldn’t log you out. Please try again.');
                  })
                }
              >
                Log out
              </Button>
            </>
          }
        >
          <p className="muted">You will need to verify your mobile number again when signing back in.</p>
          {error ? <p className="field__error">{error}</p> : null}
        </Dialog>
      ) : null}
    </div>
  );
}

function Footer() {
  const scrollToConsole = () => {
    const el = document.getElementById('book-console');
    const top = el ? Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - 80) : 0;
    window.scrollTo({ top, behavior: 'smooth' });
    setTimeout(() => {
      const el2 = document.getElementById('book-console');
      const top2 = el2 ? Math.max(0, el2.getBoundingClientRect().top + window.pageYOffset - 80) : 0;
      window.scrollTo({ top: top2, behavior: 'smooth' });
    }, 120);
  };

  return (
    <footer className="footer">
      <div className="wrap footer__inner">
        <div className="footer__cta">
          <div className="footer__cta-copy">
            <span className="eyebrow eyebrow--brand">
              <Icon name="phone" size={13} /> ONE WAY CAR RENTALS 24/7 HELPLINE
            </span>
            <h3>Ready to travel? Book your cab online in seconds.</h3>
            <p className="footer__cta-sub">
              Verified chauffeurs, upfront transparent fares, and air-conditioned cars across South India.
            </p>
          </div>
          <div className="footer__cta-actions">
            <Link to="/book" className="btn btn--primary btn--lg" onClick={scrollToConsole}>
              Book a Ride Now <Icon name="arrow-right" size={18} />
            </Link>
            <a href={`tel:${SUPPORT_PHONE}`} className="btn btn--secondary btn--lg">
              <Icon name="phone" size={18} /> {SUPPORT_PHONE_DISPLAY}
            </a>
          </div>
        </div>
        <div className="footer__grid">
          <div className="footer__brand">
            <Brand />
            <p className="footer__tag">Premium Outstation Cabs &amp; Car Rentals</p>
            <address>
              {COMPANY_LEGAL_NAME}
              <br />
              Tamil Nadu, India
            </address>
            <a className="footer__phone num" href={`tel:${SUPPORT_PHONE}`}>
              <Icon name="phone" size={16} /> {SUPPORT_PHONE_DISPLAY}
            </a>
          </div>
          <nav aria-label="Our services">
            <h2>Our services</h2>
            <Link to="/book?service=outstation&trip=one-way" onClick={scrollToConsole}>One-way drop taxi</Link>
            <Link to="/book?service=outstation&trip=round-trip" onClick={scrollToConsole}>Round trips</Link>
            <Link to="/book?service=airport" onClick={scrollToConsole}>Airport transfers</Link>
            <Link to="/book?service=rental" onClick={scrollToConsole}>Local hourly rental</Link>
            <Link to="/book?service=multicity" onClick={scrollToConsole}>Multicity itineraries</Link>
          </nav>
          <nav aria-label="Bookings and help">
            <h2>Bookings &amp; help</h2>
            <Link to="/trips">My Bookings</Link>
            <Link to="/account/payments">Payment options</Link>
            <Link to="/offers">Current offers</Link>
            <Link to="/support">24/7 Support</Link>
            <Link to="/book#faq">FAQ</Link>
          </nav>
          <nav aria-label="Company policies">
            <h2>Company</h2>
            <Link to="/legal#terms">Terms &amp; Conditions</Link>
            <Link to="/legal#privacy">Privacy &amp; location</Link>
            <Link to="/legal#cancellation">Cancellation policy</Link>
            <Link to="/legal#refund">Refund policy</Link>
            <Link to="/legal#payment">Fare &amp; payment policy</Link>
          </nav>
        </div>
        <div className="footer__bottom">
          <p>© {new Date().getFullYear()} {COMPANY_LEGAL_NAME}. All rights reserved.</p>
          <p>Fares shown before you book · Pay your driver by cash or UPI</p>
        </div>
      </div>
    </footer>
  );
}

export function Shell() {
  const { online, recovered } = useOnline();
  const location = useLocation();
  const navigate = useNavigate();
  const flow = FLOW.some((re) => re.test(location.pathname));
  const bookActive = location.pathname === '/book' || location.pathname.startsWith('/book/');
  const isBookingHome = location.pathname === '/' || location.pathname === '/book';

  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) {
        window.setTimeout(() => el.scrollIntoView({ block: 'start' }), 60);
        return;
      }
    }
    window.scrollTo({ top: 0 });
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [location.pathname, location.hash]);

  return (
    <div className={`shell ${flow ? 'shell--flow' : 'shell--nav'}`}>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      {!online ? (
        <div className="net-banner" role="status">
          <Icon name="offline" size={15} /> You’re offline. Bookings and live updates resume when you reconnect.
        </div>
      ) : recovered ? (
        <div className="net-banner net-banner--ok" role="status">
          Back online.
        </div>
      ) : null}

      <header className="topbar">
        <div className="wrap topbar__inner">
          <Brand />
          <nav className="topbar__nav" aria-label="Main">
            <Link to="/book" className={`topbar__link ${bookActive ? 'is-active' : ''}`}>
              <Icon name="car" size={17} /> Book a cab
            </Link>
            <NavLink to="/offers" className={({ isActive }) => `topbar__link ${isActive ? 'is-active' : ''}`}>
              <Icon name="offers" size={17} /> Offers
            </NavLink>
          </nav>

          <div className="topbar__actions">
            <MyTripsLink />
            <NotificationsLink />
            <NavLink to="/support" className={({ isActive }) => `head-action ${isActive ? 'is-active' : ''}`}>
              <Icon name="support" size={17} />
              <span>24/7 Support</span>
            </NavLink>
            <ProfileMenu />
          </div>

          <div className="topbar__mobile">
            <MyTripsLink compact />
            <NotificationsLink compact />
            <button
              type="button"
              className="head-action head-action--icon"
              aria-label="Help and support"
              onClick={() => navigate('/support')}
            >
              <Icon name="support" size={22} />
            </button>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="main">
        <Suspense fallback={isBookingHome ? <DashboardMainSkeleton /> : <PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      <Footer />
      {!flow ? <BottomNav /> : null}
    </div>
  );
}

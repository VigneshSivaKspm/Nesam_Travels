import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCustomerData } from '@core/context/CustomerData';
import { formatPhone } from '@core/utils/format';
import { COMPANY_LEGAL_NAME, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { useInbox } from '@/state/Inbox';
import { useAuth } from '@/state/Auth';
import { useBooking } from '@/state/Booking';
import { useOnline } from '@/lib/hooks';
import { scrollToBookingForm } from '@/lib/scrollToForm';
import { SERVICES, parseService, serviceHref, serviceOfTrip, type ServiceId } from '@/lib/services';
import { Avatar, Button, Dialog, PageLoader } from './ui';
import { Icon } from './Icon';
import { FloatingCallButton } from './FloatingCallButton';
import { AiChatbot } from './AiChatbot';
import { ALL_ROUTES } from '@/pages/routes/routesData';

export function Brand({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <Link to="/" className={`brand ${compact ? 'brand--compact' : ''} ${light ? 'brand--light' : ''}`} aria-label="People Taxi — book a ride">
      <img
        src={compact ? '/brand/peopletaxi-symbol.png' : '/brand/peopletaxi-logo.png'}
        alt="People Taxi"
        width={compact ? 44 : 192}
        height={compact ? 44 : 44}
        style={{ objectFit: 'contain' }}
      />
    </Link>
  );
}

const NAV = [
  { to: '/book', label: 'Book a ride', short: 'Book', icon: 'car' },
  { to: '/trips', label: 'My trips', short: 'Trips', icon: 'trip-history' },
  { to: '/notifications', label: 'Notifications', short: 'Alerts', icon: 'notifications' },
] as const;

/** Desktop header links. Account lives in the profile menu there. On phones the bottom bar holds the four
    services and Account, and the header holds My trips and Notifications. */
const TOP_NAV = [NAV[0], NAV[1], { to: '/offers', label: 'Offers', short: 'Offers', icon: 'offers' }, NAV[2]] as const;

/** Active booking flow pages where the phone bottom tab bar steps aside for the sticky FlowBar. */
const FLOW = [/^\/book\/(ride|confirm|done\/[^/]+)$/, /^\/ride\//, /^\/trips\/[^/]+$/];
const IMMERSIVE = [/^\/ride\//, /^\/trips\/[^/]+$/];
const ACCOUNT_PATHS = /^\/(account|trips|offers|legal)(\/|$)/;

/** Phone bottom bar: the four services (each opens the booking form on that service) and Account. */
function BottomNav() {
  const location = useLocation();
  const [params] = useSearchParams();
  const { draft } = useBooking();
  const onHome = location.pathname === '/book' || location.pathname === '/';
  const current: ServiceId | null = onHome ? (parseService(params.get('service')) ?? serviceOfTrip(draft.tripType)) : null;
  const accountActive = ACCOUNT_PATHS.test(location.pathname);

  return (
    <nav className="tabbar" aria-label="Services and account">
      {SERVICES.map((s) => (
        <Link key={s.id} to={serviceHref(s.id)} className={`tabbar__link ${current === s.id ? 'is-active' : ''}`} aria-current={current === s.id ? 'page' : undefined}>
          <span className="tabbar__icon">
            <Icon name={s.icon} size={22} />
          </span>
          <span className="tabbar__label">{s.label}</span>
        </Link>
      ))}
      <Link to="/account" className={`tabbar__link ${accountActive ? 'is-active' : ''}`} aria-current={accountActive ? 'page' : undefined}>
        <span className="tabbar__icon">
          <Icon name="profile" size={22} />
        </span>
        <span className="tabbar__label">Account</span>
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
        onClick={() => openLoginModal({ title: 'Sign in to People Taxi' })}
      >
        <Icon name="profile" size={16} /> Sign in
      </Button>
    );
  }

  const first = profile.name.split(' ')[0] || 'Account';
  return (
    <div className="menu" ref={root}>
      <button type="button" className="menu__trigger" aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu, ${first}`} title={profile.name} onClick={() => setOpen((o) => !o)}>
        <Avatar name={profile.name} photoUrl={profile.photoUrl} size={38} />
        <span className="menu__name">{first}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open ? (
        <div className="menu__panel" role="menu">
          <div className="menu__who">
            <strong className="truncate">{profile.name}</strong>
            <span className="muted small">{formatPhone(profile.phone)}</span>
          </div>
          <Link role="menuitem" to="/account">
            <Icon name="profile" /> Account
          </Link>
          <Link role="menuitem" to="/account/places">
            <Icon name="saved-place" /> Saved places
          </Link>
          <Link role="menuitem" to="/account/payments">
            <Icon name="wallet" /> Payments
          </Link>
          <Link role="menuitem" to="/legal">
            <Icon name="document" /> Terms &amp; privacy
          </Link>
          <button role="menuitem" type="button" onClick={() => setConfirm(true)}>
            <Icon name="logout" /> Log out
          </button>
        </div>
      ) : null}
      {confirm ? (
        <Dialog
          title="Log out of People Taxi?"
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
          <p className="muted">You’ll need to verify your mobile number again to sign back in.</p>
          {error ? <p className="field__error">{error}</p> : null}
        </Dialog>
      ) : null}
    </div>
  );
}

function Footer() {
  const scrollToConsole = () => scrollToBookingForm();

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__cta">
          <div className="footer__cta-copy">
            <span className="eyebrow eyebrow--sun">
              <Icon name="phone" size={13} /> PEOPLE TAXI 24/7 HELPLINE
            </span>
            <h3>Ready to travel? Book your cab online in seconds.</h3>
            <p className="footer__cta-sub">
              Verified drivers, upfront transparent fares, and air-conditioned cars across South India.
            </p>
          </div>
          <div className="footer__cta-actions">
            <Link to="/" className="btn btn--sun btn--lg" onClick={scrollToConsole}>
              Book a Ride Now <Icon name="arrow-right" size={18} />
            </Link>
            <a href={`tel:${SUPPORT_PHONE}`} className="btn btn--ghost-light btn--lg">
              <Icon name="phone" size={18} /> {SUPPORT_PHONE_DISPLAY}
            </a>
          </div>
        </div>
        <div className="footer__grid">
          <div className="footer__brand">
            <Brand light />
            <p className="muted">
              Tamil Nadu and South India's trusted cab network for outstation one-way drops, round trips, airport transfers, and hourly rentals.
            </p>
          </div>
          <nav className="footer__col" aria-label="Services">
            <h2>Services</h2>
            <ul>
              <li>
                <Link to="/services/one-way-drop-taxi">One Way Drop Taxi</Link>
              </li>
              <li>
                <Link to="/services/outstation-round-trip">Round Trips</Link>
              </li>
              <li>
                <Link to="/services/airport-taxi">Airport Transfers</Link>
              </li>
              <li>
                <Link to="/services/local-rental">Hourly City Rental</Link>
              </li>
              <li>
                <Link to="/services/pilgrimage-tours">Temple &amp; Pilgrimage Tours</Link>
              </li>
              <li>
                <Link to="/?service=multicity" onClick={scrollToConsole}>Multicity Itineraries</Link>
              </li>
            </ul>
          </nav>
          <nav className="footer__col" aria-label="Popular routes">
            <h2>Popular Routes</h2>
            <ul>
              {ALL_ROUTES.map((r) => (
                <li key={r.slug}>
                  <Link to={`/routes/${r.slug}`}>
                    {r.origin} to {r.destination}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav className="footer__col" aria-label="Support">
            <h2>Support</h2>
            <ul>
              <li>
                <Link to="/support">Help &amp; Support</Link>
              </li>
              <li>
                <Link to="/offers">Special Offers</Link>
              </li>
              <li>
                <a href={`tel:${SUPPORT_PHONE}`}>Call {SUPPORT_PHONE_DISPLAY}</a>
              </li>
            </ul>
          </nav>
          <nav className="footer__col" aria-label="Policies">
            <h2>Policies</h2>
            <ul>
              <li>
                <Link to="/legal#terms">Terms &amp; Conditions</Link>
              </li>
              <li>
                <Link to="/legal#privacy">Privacy &amp; Location</Link>
              </li>
              <li>
                <Link to="/legal#cancellation">Cancellation Policy</Link>
              </li>
              <li>
                <Link to="/legal#refund">Refund Policy</Link>
              </li>
              <li>
                <Link to="/legal#payment">Fare &amp; Payment Policy</Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="footer__legal">
          <span>© {new Date().getFullYear()} People Taxi · A Unit of {COMPANY_LEGAL_NAME}</span>
          <span>Cash or UPI to your driver · nothing is charged when you book</span>
        </div>
      </div>
    </footer>
  );
}

/**
 * Publishes how much of the viewport's bottom edge is covered (floating tab bar, sticky flow bar,
 * bottom sheet) as --dock-h, so toasts and other floating UI always clear it. Measured from the
 * elements themselves, so safe-area insets and responsive visibility are accounted for.
 */
function useDockInset() {
  useEffect(() => {
    const root = document.documentElement;
    const SELECTOR = '.tabbar, .flow-bar, .done-actions, .overlay > .dialog';
    let frame = 0;
    let watched = new Set<HTMLElement>();
    const resize = new ResizeObserver(() => schedule());
    const measure = () => {
      frame = 0;
      const vh = window.innerHeight;
      let covered = 0;
      const present = new Set(Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)));
      for (const el of watched) if (!present.has(el)) resize.unobserve(el);
      for (const el of present) if (!watched.has(el)) resize.observe(el);
      watched = present;
      for (const el of present) {
        if (el.getClientRects().length === 0) continue;
        const r = el.getBoundingClientRect();
        // Only what touches the bottom edge matters; a near full-screen page covers everything, so ignore it.
        if (r.bottom < vh - 48 || r.top >= vh) continue;
        const height = vh - r.top;
        if (height < vh * 0.6) covered = Math.max(covered, height);
      }
      root.style.setProperty('--dock-h', `${Math.round(covered)}px`);
    };
    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(measure);
    }
    const mutate = new MutationObserver(schedule);
    mutate.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      mutate.disconnect();
      resize.disconnect();
      watched.clear();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
      root.style.removeProperty('--dock-h');
    };
  }, []);
}

export function Shell() {
  useDockInset();
  const { unreadCount } = useInbox();
  const { profile } = useCustomerData();
  const { openLoginModal } = useAuth();
  const { online, recovered } = useOnline();
  const location = useLocation();
  const navigate = useNavigate();
  const isFlow = FLOW.some((re) => re.test(location.pathname));
  const isImmersive = IMMERSIVE.some((re) => re.test(location.pathname));

  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className={`shell ${isImmersive ? 'shell--immersive' : ''} ${isFlow ? '' : 'shell--dock'}`}>
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
          You’re offline. Bookings and live updates resume when you reconnect.
        </div>
      ) : recovered ? (
        <div className="net-banner net-banner--ok" role="status">
          Back online.
        </div>
      ) : null}

      <header className="topbar">
        <div className="topbar__inner">
          <Brand />
          <nav className="topnav" aria-label="Main">
            {TOP_NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                aria-label={n.to === '/notifications' && unreadCount > 0 ? `${n.label}, ${unreadCount} unread` : n.label}
                title={n.label}
                className={({ isActive }) => `topnav__link ${isActive || (n.to === '/book' && location.pathname === '/') ? 'is-active' : ''}`}
              >
                <Icon name={n.icon} size={19} />
                <span className="lbl-long">{n.label}</span>
                {n.to === '/notifications' && unreadCount > 0 ? (
                  <em className="count" aria-label={`${unreadCount} unread`}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </em>
                ) : null}
              </NavLink>
            ))}
          </nav>
          <div className="topbar__right">
            <Link to="/support" className="help-link" aria-label="Help and support" title="Help">
              <Icon name="help" size={18} />
              <span className="help-link__text">Help</span>
            </Link>
            <a className="help-link help-link--phone" href={`tel:${SUPPORT_PHONE}`} aria-label={`Call People Taxi support ${SUPPORT_PHONE_DISPLAY}`} title={SUPPORT_PHONE_DISPLAY}>
              <Icon name="phone" size={18} />
              <span className="num">{SUPPORT_PHONE_DISPLAY}</span>
            </a>
            <ProfileMenu />
          </div>
          <div className="topbar__mobile">
            {!profile ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => openLoginModal({ title: 'Sign in to People Taxi' })}
              >
                Sign in
              </Button>
            ) : (
              <>
                <NavLink to="/trips" className={({ isActive }) => `icon-btn ${isActive ? 'is-active' : ''}`} aria-label="My trips" title="My trips">
                  <Icon name="trip-history" size={20} />
                </NavLink>
                <NavLink
                  to="/notifications"
                  className={({ isActive }) => `icon-btn icon-btn--badge ${isActive ? 'is-active' : ''}`}
                  aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                  title="Notifications"
                >
                  <Icon name="notifications" size={20} />
                  {unreadCount > 0 ? <em className="count" aria-hidden="true">{unreadCount > 9 ? '9+' : unreadCount}</em> : null}
                </NavLink>
              </>
            )}
            <button type="button" className="icon-btn" aria-label="Help and support" onClick={() => navigate('/support')}>
              <Icon name="help" size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* The footer waits for the page: while a screen loads, only its placeholder shows. */}
      <Suspense
        fallback={
          <main id="main" tabIndex={-1} className="main">
            <PageLoader />
          </main>
        }
      >
        <main id="main" tabIndex={-1} className="main">
          <Outlet />
        </main>
        {!isImmersive ? <Footer /> : null}
      </Suspense>

      {!isFlow ? <BottomNav /> : null}
      <FloatingCallButton />
      <AiChatbot />
    </div>
  );
}
export default Shell;

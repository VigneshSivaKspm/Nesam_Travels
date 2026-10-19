import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCustomerData } from '@/state/customer';
import { formatPhone } from '@core/utils/format';
import { COMPANY_LEGAL_NAME, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { useInbox } from '@/state/Inbox';
import { useAuth } from '@/state/Auth';
import { useOnline } from '@/lib/hooks';
import { Avatar, Button, Dialog, PageLoader } from './ui';
import { Icon } from './Icon';

export function Brand({ light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <Link to="/book" className={`brand ${light ? 'brand--light' : ''}`} aria-label="One Way Car Rental — book a ride">
      <img src="/brand/ow-logo.png" alt="" width={44} height={44} />
      <span className="brand__word">
        <b>One Way</b>
        <small>Car Rental</small>
      </span>
    </Link>
  );
}

const NAV = [
  { to: '/book', label: 'Book a ride', short: 'Book', icon: 'car' },
  { to: '/trips', label: 'My trips', short: 'Trips', icon: 'trip-history' },
  { to: '/notifications', label: 'Notifications', short: 'Alerts', icon: 'notifications' },
  { to: '/account', label: 'Account', short: 'Account', icon: 'profile' },
] as const;

/** Sidebar links. Account lives in the profile menu there; the phone tab bar keeps all four. */
const SIDE_NAV = [NAV[0], NAV[1], { to: '/offers', label: 'Offers', short: 'Offers', icon: 'offers' }, NAV[2]] as const;

/** Booking steps and the live ride are full-screen workspaces (panel + map), so the footer and tab bar step aside. */
const IMMERSIVE = [/^\/book\/(ride|confirm)$/, /^\/ride\//, /^\/trips\/[^/]+$/];

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
      <button type="button" className="side__signin" title="Sign in" onClick={() => openLoginModal({ title: 'Sign in to One Way Car Rental' })}>
        <Icon name="profile" size={20} />
        <span className="lbl-long">Sign in</span>
      </button>
    );
  }

  const first = profile.name.split(' ')[0] || 'Account';
  return (
    <div className="menu" ref={root}>
      <button type="button" className="menu__trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} title={profile.name}>
        <Avatar name={profile.name} photoUrl={profile.photoUrl} size={38} />
        <span className="menu__who-mini">
          <span className="menu__name">{first}</span>
          <small>Your account</small>
        </span>
        <Icon name="chevron-up" size={16} />
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
          title="Log out of One Way Car Rental?"
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
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__grid">
          <div className="footer__about">
            <Brand light />
            <p>Outstation and intercity cabs across Tamil Nadu and beyond — fares shown before you book, verified chauffeurs and a team you can call.</p>
            <a className="footer__call" href={`tel:${SUPPORT_PHONE}`}>
              <Icon name="phone" size={22} />
              <span>
                <small>Talk to One Way Car Rental</small>
                <span className="num">{SUPPORT_PHONE_DISPLAY}</span>
              </span>
            </a>
          </div>
          <nav className="footer__col" aria-label="Book">
            <h2>Book</h2>
            <ul>
              <li>
                <Link to="/book">Outstation one way</Link>
              </li>
              <li>
                <Link to="/book">Round trip</Link>
              </li>
              <li>
                <Link to="/book">Airport transfer</Link>
              </li>
              <li>
                <Link to="/offers">Offers</Link>
              </li>
            </ul>
          </nav>
          <nav className="footer__col" aria-label="Your account">
            <h2>Your account</h2>
            <ul>
              <li>
                <Link to="/trips">My trips</Link>
              </li>
              <li>
                <Link to="/account/places">Saved places</Link>
              </li>
              <li>
                <Link to="/account/payments">Payments &amp; refunds</Link>
              </li>
              <li>
                <Link to="/notifications">Notifications</Link>
              </li>
            </ul>
          </nav>
          <nav className="footer__col" aria-label="Support">
            <h2>Support</h2>
            <ul>
              <li>
                <Link to="/support">Help &amp; tickets</Link>
              </li>
              <li>
                <a href={`tel:${SUPPORT_PHONE}`}>Call {SUPPORT_PHONE_DISPLAY}</a>
              </li>
              <li>
                <Link to="/legal">Terms &amp; privacy</Link>
              </li>
            </ul>
          </nav>
        </div>
        <p className="footer__mark" aria-hidden="true">
          One Way
        </p>
        <div className="footer__legal">
          <span>© {new Date().getFullYear()} {COMPANY_LEGAL_NAME}</span>
          <span>Cash or UPI to your driver · nothing is charged when you book</span>
        </div>
      </div>
    </footer>
  );
}

export function Shell() {
  const { unreadCount } = useInbox();
  const { profile } = useCustomerData();
  const { openLoginModal } = useAuth();
  const { online, recovered } = useOnline();
  const location = useLocation();
  const navigate = useNavigate();
  const immersive = IMMERSIVE.some((re) => re.test(location.pathname));

  // New page → start at the top and move focus to the page (keyboard and screen-reader users).
  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className={`shell ${immersive ? 'shell--immersive' : ''}`}>
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

      <aside className="side" aria-label="Site">
        <Brand />
        <nav className="side__nav" aria-label="Main">
          <p className="side__label">Menu</p>
          {SIDE_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} title={n.label} className={({ isActive }) => `side__link ${isActive ? 'is-active' : ''}`}>
              <Icon name={n.icon} size={21} />
              <span className="lbl-long">{n.label}</span>
              {n.to === '/notifications' && unreadCount > 0 ? (
                <em className="count" aria-label={`${unreadCount} unread`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </em>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="side__foot">
          <Link to="/support" className="side__link" title="Help and support" aria-label="Help and support">
            <Icon name="support" size={21} />
            <span className="lbl-long">Help &amp; tickets</span>
          </Link>
          <a className="side__call" href={`tel:${SUPPORT_PHONE}`} aria-label={`Call One Way Car Rental support ${SUPPORT_PHONE_DISPLAY}`}>
            <Icon name="phone" size={20} />
            <span className="lbl-long">
              <small>Talk to us</small>
              <span className="num">{SUPPORT_PHONE_DISPLAY}</span>
            </span>
          </a>
          <ProfileMenu />
        </div>
      </aside>

      <div className="shell__body">
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
            <div className="topbar__mobile">
              {!profile ? (
                <Button variant="primary" size="sm" onClick={() => openLoginModal({ title: 'Sign in to One Way Car Rental' })}>
                  Sign in
                </Button>
              ) : null}
              <button type="button" className="icon-btn" aria-label="Help and support" onClick={() => navigate('/support')}>
                <Icon name="support" size={22} />
              </button>
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="main">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>

        {!immersive ? <Footer /> : null}
      </div>

      {!immersive ? (
        <nav className="tabbar" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `tabbar__link ${isActive ? 'is-active' : ''}`}>
              <span className="tabbar__icon">
                <Icon name={n.icon} size={24} />
                {n.to === '/notifications' && unreadCount > 0 ? <em className="count">{unreadCount > 9 ? '9+' : unreadCount}</em> : null}
              </span>
              <span>{n.short}</span>
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

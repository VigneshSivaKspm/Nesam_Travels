import React from 'react';
import { Brand, Avatar } from './kit';
import { Icon, IconSprite, type IconName } from './Icon';
import type { PageId } from '../state/Partner';

interface NavItem { id: PageId; label: string; icon: IconName }

const DESKTOP_NAV: NavItem[] = [
  { id: 'duties', label: 'Duties', icon: 'trip' },
  { id: 'drivers', label: 'Drivers', icon: 'users' },
  { id: 'vehicles', label: 'Vehicles', icon: 'car' },
  { id: 'requests', label: 'Requests', icon: 'swap' },
  { id: 'payouts', label: 'Payouts', icon: 'wallet' },
  { id: 'account', label: 'Account', icon: 'user' },
];

const PHONE_NAV: NavItem[] = [
  { id: 'drivers', label: 'Drivers', icon: 'users' },
  { id: 'vehicles', label: 'Vehicles', icon: 'car' },
  { id: 'duties', label: 'Duties', icon: 'trip' },
  { id: 'payouts', label: 'Payouts', icon: 'wallet' },
  { id: 'account', label: 'Account', icon: 'user' },
];

export const TITLES: Record<PageId, [string, string]> = {
  duties: ['Duties', 'New offers, upcoming dispatch and live trips.'],
  drivers: ['Drivers', 'Invite, link and manage the drivers of your fleet.'],
  vehicles: ['Vehicles', 'Add vehicles, pair them with drivers and keep them in service.'],
  requests: ['Requests', 'Drivers and vehicles joining your fleet.'],
  payouts: ['Payouts', 'Wallet balance, earnings and payout requests.'],
  account: ['Account', 'Your business, documents and agreements.'],
  alerts: ['Notifications', 'Trips, approvals, payments and penalties.'],
};

interface ShellProps {
  page: PageId;
  go: (page: PageId) => void;
  partnerName: string;
  partnerId: string;
  counts: { requests: number; unread: number; newDuties: number };
  children: React.ReactNode;
  overlays?: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ page, go, partnerName, partnerId, counts, children, overlays }) => {
  const [title, subtitle] = TITLES[page];
  // The bell opens Notifications; the section it belongs to stays unhighlighted.
  const active = page === 'alerts' ? '' : page;
  const countOf = (id: PageId) => (id === 'requests' ? counts.requests : id === 'duties' ? counts.newDuties : 0);

  const bell = (extra = '') => (
    <button type="button" className={`vx-iconbtn ${extra}`.trim()} onClick={() => go('alerts')} aria-label={counts.unread ? `Notifications, ${counts.unread} unread` : 'Notifications'}>
      <Icon name="bell" />
      {counts.unread > 0 && <span className="vx-iconbtn__dot">{counts.unread > 9 ? '9+' : counts.unread}</span>}
    </button>
  );

  return (
    <div className="vx">
      <IconSprite />
      <div className="vx-app">
        <aside className="vx-side" aria-label="Primary">
          <Brand />
          <nav aria-label="Sections" style={{ display: 'grid', gap: 2 }}>
            {DESKTOP_NAV.map((n) => (
              <button key={n.id} type="button" className="vx-nav" aria-current={active === n.id ? 'page' : undefined} onClick={() => go(n.id)} title={n.label}>
                <Icon name={n.icon} />
                <span className="vx-nav__label">{n.label}</span>
                {countOf(n.id) > 0 && <span className="vx-nav__count">{countOf(n.id)}</span>}
              </button>
            ))}
          </nav>
          <div className="vx-side__foot">
            <div className="vx-partner">
              <Avatar name={partnerName} />
              <div className="vx-partner__text" style={{ minWidth: 0 }}>
                <div className="vx-partner__name">{partnerName}</div>
                <div className="vx-partner__id">Fleet partner · {partnerId.slice(0, 6).toUpperCase()}</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="vx-main" id="main">
          <div className="vx-mobilebar">
            <Brand />
            {bell()}
          </div>
          <div className="vx-page">
            <header className="vx-top">
              <div>
                <h1>{title}</h1>
                <p>{subtitle}</p>
              </div>
              <div className="vx-top__actions">{bell('vx-iconbtn--desk')}</div>
            </header>
            {children}
          </div>
        </main>
      </div>

      <nav className="vx-bottom" aria-label="Primary">
        {PHONE_NAV.map((n) => {
          const c = n.id === 'account' ? counts.requests : n.id === 'duties' ? counts.newDuties : 0;
          return (
            <button key={n.id} type="button" className={n.id === 'duties' ? 'is-center' : ''} aria-current={active === n.id || (n.id === 'account' && active === 'requests') ? 'page' : undefined} onClick={() => go(n.id)}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {c > 0 && <span className="vx-bottom__count">{c}</span>}
            </button>
          );
        })}
      </nav>
      {overlays}
    </div>
  );
};

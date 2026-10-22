import React from 'react';
import type { VendorRecord } from '../types';
import { SECTION_LABELS } from '../config/onboarding';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { formatDateTime12 } from '../utils/time';
import { Banner, Button } from '../ui/kit';
import { Icon, IconSprite } from '../ui/Icon';

interface AccountStatusScreenProps {
  record: VendorRecord;
  onSignOut: () => void;
  /** REJECTED only: reopen the wizard to correct and reapply. */
  onReapply?: () => void;
}

const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || '+91 90250 99990';
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || '';

const LOCKED = [
  { icon: 'trip' as const, label: 'See and accept duties' },
  { icon: 'users' as const, label: 'Add and dispatch drivers' },
  { icon: 'car' as const, label: 'Manage your vehicles' },
  { icon: 'wallet' as const, label: 'Wallet and payouts' },
];

const formatDate = (ms: number | null) => (ms ? formatDateTime12(new Date(ms)) : '');

export const AccountStatusScreen: React.FC<AccountStatusScreenProps> = ({ record, onSignOut, onReapply }) => {
  const online = useOnlineStatus();
  const businessName = record.business?.businessName || record.fleet?.plates?.[0] || 'your fleet';

  const shell = (children: React.ReactNode) => (
    <div className="vx">
      <IconSprite />
      <div className="vx-auth">
        <div className="vx-auth__col">
          {!online && <Banner tone="warn">You’re offline. This page updates when your connection is back.</Banner>}
          <div className="vx-card" style={{ padding: 24 }}>{children}</div>
          <div className="vx-auth__foot">
            <span>{[SUPPORT_PHONE, SUPPORT_EMAIL].filter(Boolean).length ? <>Need help? <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}>{SUPPORT_PHONE}</a></> : ''}</span>
            <button type="button" onClick={onSignOut}><Icon name="logout" />Sign out</button>
          </div>
        </div>
      </div>
    </div>
  );

  const hero = (icon: 'clock' | 'alert' | 'power', tone: 'amber' | 'red' | 'gray', title: string, body: React.ReactNode) => (
    <div style={{ textAlign: 'center' }}>
      <span className="vx-avatar vx-avatar--lg" style={{ margin: '0 auto 14px', background: tone === 'amber' ? 'var(--amber-soft)' : tone === 'red' ? 'var(--red-soft)' : 'var(--gray-soft)', color: tone === 'amber' ? 'var(--amber)' : tone === 'red' ? 'var(--red-dark)' : '#596072' }}><Icon name={icon} /></span>
      <h1 style={{ fontSize: 21, fontWeight: 700 }}>{title}</h1>
      <p className="vx-muted" style={{ marginTop: 6 }}>{body}</p>
    </div>
  );

  if (record.status === 'SUSPENDED') {
    return shell(
      <>
        {hero('power', 'gray', 'Account suspended', <>Operations for {businessName} are paused by the NESAM team. Contact partner support to resolve this.</>)}
        {record.review?.note && <div className="vx-banner" style={{ marginTop: 14, whiteSpace: 'pre-wrap' }}><div>{record.review.note}</div></div>}
      </>,
    );
  }

  if (record.status === 'REJECTED') {
    return shell(
      <>
        {hero('alert', 'red', 'Application not approved', <>We couldn’t approve {businessName} with the information provided.</>)}
        {record.review?.note && <div style={{ marginTop: 14 }}><Banner tone="err"><strong>Reason from the verification team</strong><br /><span style={{ whiteSpace: 'pre-wrap' }}>{record.review.note}</span></Banner></div>}
        {!!record.review?.flaggedSections.length && <p className="vx-muted" style={{ marginBottom: 12 }}>Sections to fix: <strong style={{ color: 'var(--ink)' }}>{record.review.flaggedSections.map((s) => SECTION_LABELS[s]).join(', ')}</strong></p>}
        {onReapply && <Button variant="primary" block onClick={onReapply}>Correct details & reapply</Button>}
      </>,
    );
  }

  const steps = [
    { label: 'Application submitted', sub: formatDate(record.submittedAt) || 'Application received', state: 'done' as const },
    { label: 'NESAM reviews your vehicle and details', sub: 'Usually within 24–48 business hours', state: 'active' as const },
    { label: 'Approval and activation', sub: 'You are taken to your dashboard automatically', state: 'todo' as const },
  ];

  return shell(
    <>
      {hero('clock', 'amber', 'Application under review', <>Thanks for applying! NESAM is verifying <strong style={{ color: 'var(--ink)' }}>{businessName}</strong>. Duties, drivers, vehicles and payouts open once it is approved.</>)}
      <ol className="vx-timeline">
        {steps.map((s) => (
          <li key={s.label} data-state={s.state}>
            <span className="vx-timeline__dot"><Icon name={s.state === 'done' ? 'check' : s.state === 'active' ? 'clock' : 'lock'} /></span>
            <div><strong>{s.label}</strong><small>{s.sub}</small></div>
          </li>
        ))}
      </ol>
      <div className="vx-found" style={{ marginTop: 18, marginBottom: 14 }}>
        <div className="vx-card__sub" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, fontSize: 11, marginBottom: 8 }}>Unlocks after approval</div>
        <div className="vx-grid vx-grid--2" style={{ gap: 8 }}>
          {LOCKED.map((l) => <span key={l.label} className="vx-facts" style={{ margin: 0 }}><span><Icon name={l.icon} />{l.label}</span></span>)}
        </div>
      </div>
      <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--green)' }}><i className="vx-pulse" /> This page updates by itself when NESAM approves</p>
    </>,
  );
};

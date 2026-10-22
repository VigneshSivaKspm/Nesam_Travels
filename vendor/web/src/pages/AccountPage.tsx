import React, { useEffect, useMemo, useState } from 'react';
import type { StoredFile } from '../types';
import { usePartner } from '../state/Partner';
import { BUSINESS_REG_TYPES, IDENTITY_PROOF_TYPES, INDIAN_STATES } from '../config/onboarding';
import { updateApprovedContactInfo } from '../services/onboardingService';
import { resolveFileUrl } from '../services/storageService';
import { currentTextOf, subscribeToMyAcceptances, type Acceptance } from '../services/agreements';
import { describeDataError } from '../utils/retry';
import { digitsOnly, normalizeSpaces, validateAltPhone, validateEmail, validatePincode } from '../utils/validation';
import { Avatar, Badge, Banner, Button, Dialog, Empty, KV, SelectInput, Tabs, TextInput, Toast, useToast } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { formatDateTime12 } from '../utils/time';
import { signOutUser } from '../services/authService';

const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || '+91 90250 99990';
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || '';

const FileLinks: React.FC<{ files: StoredFile[] }> = ({ files }) => {
  const [opening, setOpening] = useState('');
  const [error, setError] = useState('');
  const open = async (f: StoredFile) => {
    const win = window.open('', '_blank');
    if (win) win.opener = null;
    setOpening(f.path); setError('');
    try {
      const url = await resolveFileUrl(f.path);
      if (win) win.location.href = url; else window.open(url, '_blank', 'noopener');
    } catch (e) { win?.close(); setError(describeDataError(e)); } finally { setOpening(''); }
  };
  if (!files.length) return <span className="vx-muted">No files</span>;
  return (
    <span className="vx-wrap" style={{ justifyContent: 'flex-end' }}>
      {files.map((f) => <Button key={f.path} size="sm" icon="document" loading={opening === f.path} onClick={() => open(f)} title={f.name}>{f.name.length > 18 ? `${f.name.slice(0, 16)}…` : f.name}</Button>)}
      {error && <span className="vx-err" style={{ width: '100%' }}>{error}</span>}
    </span>
  );
};

export const AccountPage: React.FC = () => {
  const { profile, record, penalties, links, go } = usePartner();
  const [tab, setTab] = useState<'business' | 'documents' | 'agreements' | 'help'>('business');
  const { toast, show, dismiss } = useToast();
  const openLinks = links.filter((l) => l.toVendorId === profile.id && (l.status === 'Awaiting OTP' || l.status === 'Office review')).length;
  const owed = penalties.filter((p) => p.status === 'Pending').length;

  return (
    <div>
      <Toast toast={toast} onDismiss={dismiss} />
      <div className="vx-card">
        <div className="vx-split vx-split--center" style={{ flexWrap: 'wrap' }}>
          <div className="vx-media">
            <Avatar name={profile.companyName} large />
            <div>
              <strong style={{ fontSize: 17 }}>{profile.companyName || 'Fleet partner'}</strong>
              <small>{record.phone}</small>
              <small>Partner ID {profile.id.slice(0, 8).toUpperCase()}</small>
            </div>
          </div>
          <Badge tone="green" icon="shield">Verified partner</Badge>
        </div>
      </div>

      <div className="vx-wrap" style={{ margin: '14px 0' }}>
        <Button icon="swap" onClick={() => go('requests')}>Linking requests{openLinks > 0 ? ` · ${openLinks}` : ''}</Button>
        <Button icon="alert" onClick={() => go('alerts')}>Penalties{owed > 0 ? ` · ${owed}` : ''}</Button>
      </div>

      <Tabs label="Account" value={tab} onChange={setTab} tabs={[
        { id: 'business', label: 'Business' }, { id: 'documents', label: 'Documents' }, { id: 'agreements', label: 'Agreements' }, { id: 'help', label: 'Help & sign out' },
      ]} />

      {tab === 'business' && <BusinessTab onToast={show} />}
      {tab === 'documents' && <DocumentsTab />}
      {tab === 'agreements' && <AgreementsTab />}
      {tab === 'help' && (
        <div className="vx-card">
          <div className="vx-card__head"><h2 className="vx-card__title">NESAM office</h2></div>
          <p className="vx-muted" style={{ marginBottom: 12 }}>Call us for payouts, vehicle or driver verification, penalties, or anything that will not go through here.</p>
          <div className="vx-actions" style={{ marginTop: 0 }}>
            <a className="vx-btn vx-btn--primary" href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}><Icon name="phone" />{SUPPORT_PHONE}</a>
            {SUPPORT_EMAIL && <a className="vx-btn" href={`mailto:${SUPPORT_EMAIL}`}><Icon name="document" />{SUPPORT_EMAIL}</a>}
          </div>
          <hr className="vx-divider" />
          <Button variant="danger" icon="logout" onClick={() => void signOutUser()}>Sign out</Button>
        </div>
      )}
    </div>
  );
};

const BusinessTab: React.FC<{ onToast: (t: string, k?: 'ok' | 'err') => void }> = ({ onToast }) => {
  const { record } = usePartner();
  const b = record.business;
  const [form, setForm] = useState({ email: b?.email ?? '', altPhone: b?.altPhone ?? '', line1: b?.address.line1 ?? '', line2: b?.address.line2 ?? '', city: b?.address.city ?? '', state: b?.address.state ?? '', pincode: b?.address.pincode ?? '' });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Contact details are optional for a partner who signed up with a vehicle number; whatever is typed must still be valid.
  const errors = useMemo(() => ({
    email: form.email ? validateEmail(form.email) : '',
    altPhone: form.altPhone ? validateAltPhone(form.altPhone, record.phone) : '',
    pincode: form.pincode ? validatePincode(form.pincode) : '',
    city: form.line1 && !form.city.trim() ? 'Enter the city.' : '',
  }), [form, record.phone]);
  const set = (k: keyof typeof form) => (v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(''); };
  const bad = Object.values(errors).some(Boolean);

  const save = async () => {
    setTouched(true);
    if (!b || bad) return;
    setSaving(true); setError('');
    try {
      await updateApprovedContactInfo(b, {
        email: form.email.trim().toLowerCase(), altPhone: digitsOnly(form.altPhone),
        address: { line1: normalizeSpaces(form.line1), line2: normalizeSpaces(form.line2), city: normalizeSpaces(form.city), state: form.state, pincode: form.pincode.trim() },
      });
      onToast('Contact details saved.');
    } catch (e) { setError(describeDataError(e)); } finally { setSaving(false); }
  };
  const e = (k: keyof typeof errors) => (touched ? errors[k] : '');

  return (
    <div className="vx-card">
      <div className="vx-card__head"><h2 className="vx-card__title">Contact details</h2></div>
      <KV label="Login number">{record.phone}</KV>
      <KV label="Registered name">{b?.vendorName || 'Added by the NESAM office'}</KV>
      <p className="vx-hint" style={{ marginBottom: 14 }}>The registered name and login number can only be changed by the NESAM office.</p>
      <div className="vx-grid vx-grid--2" style={{ gap: '0 14px' }}>
        <TextInput id="c-email" label="Email" type="email" value={form.email} onChange={(ev) => set('email')(ev.target.value)} error={e('email')} />
        <div className="vx-field">
          <label className="vx-field__label" htmlFor="c-alt">Alternate number</label>
          <div className="vx-phone"><span>+91</span><input id="c-alt" inputMode="numeric" maxLength={10} value={form.altPhone} onChange={(ev) => set('altPhone')(digitsOnly(ev.target.value))} /></div>
          {e('altPhone') && <p className="vx-err">{e('altPhone')}</p>}
        </div>
        <TextInput id="c-l1" label="Address line 1" value={form.line1} onChange={(ev) => set('line1')(ev.target.value)} />
        <TextInput id="c-l2" label="Address line 2" value={form.line2} onChange={(ev) => set('line2')(ev.target.value)} />
        <TextInput id="c-city" label="City" value={form.city} onChange={(ev) => set('city')(ev.target.value)} error={e('city')} />
        <SelectInput id="c-state" label="State / UT" value={form.state} onChange={set('state')} placeholder="Select state" options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} />
        <TextInput id="c-pin" label="PIN code" inputMode="numeric" maxLength={6} value={form.pincode} onChange={(ev) => set('pincode')(digitsOnly(ev.target.value))} error={e('pincode')} />
      </div>
      {error && <Banner tone="err">{error}</Banner>}
      <div className="vx-actions vx-actions--end"><Button variant="primary" loading={saving} disabled={!b} onClick={save}>Save contact details</Button></div>
    </div>
  );
};

const DocumentsTab: React.FC = () => {
  const { record } = usePartner();
  const d = record.documents;
  const f = record.fleet;
  const p = record.payoutSummary;
  const nothing = !d && !p && !(f && (f.rcFiles.length || f.insuranceFiles.length));
  return (
    <div className="vx-card">
      <div className="vx-card__head"><h2 className="vx-card__title">What NESAM holds for you</h2></div>
      {nothing && <Banner>You signed up with a vehicle number. NESAM collects documents as they are needed — each vehicle’s papers during its review, and bank details before your first payout.</Banner>}
      {d && <KV label={BUSINESS_REG_TYPES.find((t) => t.value === d.businessRegistration.type)?.label ?? 'Business registration'}><span className="vx-mono">{d.businessRegistration.number || '—'}</span> <FileLinks files={d.businessRegistration.files ?? []} /></KV>}
      {d && <KV label={IDENTITY_PROOF_TYPES.find((t) => t.value === d.identityProof.type)?.label ?? 'Identity proof'}><span className="vx-mono">{d.identityProof.maskedNumber || '—'}</span> <FileLinks files={d.identityProof.files ?? []} /></KV>}
      <KV label="Vehicles registered">{f ? `${f.fleetSize} · ${(f.plates ?? []).join(', ') || f.vehicleTypes.join(', ')}` : '—'}</KV>
      {f && <KV label="Registration certificates (RC)"><FileLinks files={f.rcFiles ?? []} /></KV>}
      {f && <KV label="Insurance"><FileLinks files={f.insuranceFiles ?? []} /></KV>}
      {f && <KV label="Fitness certificates"><FileLinks files={f.fcFiles ?? []} /></KV>}
      {f && <KV label="Permits"><FileLinks files={f.permitFiles ?? []} /></KV>}
      <KV label="Payout account">{p ? `${p.accountHolderName} · ••••${p.bankLast4} · ${p.ifsc}${p.upiId ? ` · ${p.upiId}` : ''}` : 'Not added yet'}</KV>
      <p className="vx-hint" style={{ marginTop: 8 }}>To change bank details, call the NESAM office — changes are re-verified.</p>
    </div>
  );
};

const AgreementsTab: React.FC = () => {
  const { profile } = usePartner();
  const [list, setList] = useState<Acceptance[] | null>(null);
  const [view, setView] = useState<{ a: Acceptance; body: string; current: boolean } | null>(null);
  const [loading, setLoading] = useState('');

  useEffect(() => subscribeToMyAcceptances(profile.id, setList, () => setList([])), [profile.id]);

  const open = async (a: Acceptance) => {
    setLoading(a.id);
    try { const t = await currentTextOf(a); setView({ a, ...t }); } catch { setView({ a, body: '', current: false }); } finally { setLoading(''); }
  };

  return (
    <div className="vx-card">
      <div className="vx-card__head"><h2 className="vx-card__title">Agreements you accepted</h2></div>
      {list === null ? <p className="vx-muted">Loading…</p> : list.length === 0 ? (
        <Empty icon="filecheck" title="No agreements recorded yet">When NESAM publishes terms for fleet partners, the ones you accept are listed here with the version and time.</Empty>
      ) : (
        list.map((a) => (
          <div className="vx-listrow" key={a.id}>
            <span className="vx-avatar vx-avatar--grey"><Icon name="filecheck" /></span>
            <div className="vx-listrow__body">
              <strong>{a.title}</strong>
              <small>Version {a.version} · accepted {a.acceptedAt ? formatDateTime12(a.acceptedAt) : '—'}</small>
            </div>
            <Button size="sm" icon="eye" loading={loading === a.id} onClick={() => open(a)}>Read</Button>
          </div>
        ))
      )}
      <Dialog open={!!view} onClose={() => setView(null)} eyebrow={view ? `Version ${view.a.version} · accepted ${view.a.acceptedAt ? formatDateTime12(view.a.acceptedAt) : ''}` : ''} title={view?.a.title ?? ''}
        footer={<Button variant="primary" onClick={() => setView(null)}>Close</Button>}>
        {view && (view.current && view.body
          ? <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, margin: 0 }}>{view.body}</pre>
          : <Banner tone="warn">This is not the version in force any more, so its text is not shown here. The NESAM office can send you the exact copy you accepted.</Banner>)}
      </Dialog>
    </div>
  );
};

// Terms & privacy: the customer documents NESAM has published, the version in force and
// whether this account has accepted it (acceptance itself happens in LegalGate when a new
// version is published).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/platform/firebase';
import { callFunction } from '@core/services/callables';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { Badge, Button, EmptyState, Notice, PageHead, PageLoader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useSeo } from '@/lib/seo';

interface DocRow {
  key: string;
  title: string;
  version: number;
  body: string;
  accepted: boolean;
}

export function LegalPage() {
  useSeo({
    title: 'Terms of Service & Customer Privacy Policy',
    description: 'Read the official terms and conditions, customer privacy policy, fare transparency rules and cancellation guidelines for People Taxi.',
    canonical: '/legal',
  });
  const [rows, setRows] = useState<DocRow[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError('');
    (async () => {
      try {
        const s = await callFunction<unknown, { missing: { key: string }[]; required: { key: string; title: string; version: number }[] }>('getLegalStatus', { role: 'customer' });
        const missing = new Set(s.missing.map((m) => m.key));
        const bodies = await Promise.all(s.required.map(async (r) => String((await getDoc(doc(db, 'legal_documents', r.key))).data()?.body ?? '')));
        if (!alive) return;
        const list = s.required.map((r, i) => ({ key: r.key, title: r.title || r.key, version: r.version, body: bodies[i] ?? '', accepted: !missing.has(r.key) }));
        setRows(list);
        if (list.length === 1) setOpen(list[0]!.key);
      } catch {
        if (alive) setError('We couldn’t load the documents. Check your connection and try again.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  return (
    <>
      <PageHead
        eyebrow="Account"
        title="Terms and privacy"
        back={
          <Link to="/account" className="back-link">
            <Icon name="arrow-left" size={18} /> Account
          </Link>
        }
      >
        The agreements and policies that apply when you ride with People Taxi.
      </PageHead>

      <div className="page split">
        <div className="stack">
          {error ? (
            <Notice
              tone="error"
              action={
                <Button size="sm" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </Button>
              }
            >
              {error}
            </Notice>
          ) : null}
          {rows === null && !error ? <PageLoader label="Loading documents…" /> : null}
          {rows && rows.length === 0 ? (
            <div className="card card--center">
              <EmptyState
                art="account-review"
                title="No documents online yet"
                action={
                  <a className="btn btn--primary" href={`tel:${SUPPORT_PHONE}`}>
                    <Icon name="phone" /> Call {SUPPORT_PHONE_DISPLAY}
                  </a>
                }
              >
                People Taxi hasn’t published customer terms or a privacy policy online yet. Contact support for a copy.
              </EmptyState>
            </div>
          ) : null}

          {rows?.map((r) => (
            <section key={r.key} className="card legal-doc">
              <button type="button" className="legal-doc__head" aria-expanded={open === r.key} onClick={() => setOpen(open === r.key ? '' : r.key)}>
                <span>
                  <strong>{r.title}</strong>
                  <small className="muted"> Version {r.version}</small>
                </span>
                <span className="legal-doc__right">
                  <Badge tone={r.accepted ? 'green' : 'amber'}>{r.accepted ? 'Accepted' : 'Not yet accepted'}</Badge>
                  <Icon name={open === r.key ? 'chevron-up' : 'chevron-down'} />
                </span>
              </button>
              {open === r.key ? <div className="legal-doc__body">{r.body || 'This document has no text yet.'}</div> : null}
            </section>
          ))}
        </div>

        <aside className="split__aside">
          <div className="aside-card">
            <img src="/art/support.webp" alt="" width={220} height={220} />
            <h2>Questions about these terms?</h2>
            <p className="muted">Our team can walk you through cancellation, payment and privacy terms.</p>
            <a className="btn btn--secondary btn--block" href={`tel:${SUPPORT_PHONE}`}>
              <Icon name="phone" /> Call {SUPPORT_PHONE_DISPLAY}
            </a>
          </div>
        </aside>
      </div>
    </>
  );
}

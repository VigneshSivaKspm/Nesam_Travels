import React, { useState } from 'react';
import { linkIsOpen, usePartner } from '../state/Partner';
import { Button, Empty, Tabs, Toast, useToast } from '../ui/kit';
import { LinkCard } from './LinkParts';

/**
 * Every driver or vehicle request that touches this fleet: ones the vendor asked for (enter a code, wait for the office)
 * and ones where another vendor is taking a record away. The server finishes them; this screen shows where each stands.
 */
export const RequestsPage: React.FC = () => {
  const { links, profile, go } = usePartner();
  const [tab, setTab] = useState<'open' | 'away' | 'history'>('open');
  const { toast, show, dismiss } = useToast();

  const mine = links.filter((l) => l.toVendorId === profile.id);
  const open = mine.filter(linkIsOpen);
  const away = links.filter((l) => l.fromVendorId === profile.id && l.toVendorId !== profile.id && linkIsOpen(l));
  const history = links.filter((l) => !linkIsOpen(l));

  const list = tab === 'open' ? open : tab === 'away' ? away : history;

  return (
    <div>
      <Toast toast={toast} onDismiss={dismiss} />
      <Tabs label="Requests" value={tab} onChange={setTab} tabs={[
        { id: 'open', label: 'Needs action', count: open.length, hot: true },
        { id: 'away', label: 'Leaving my fleet', count: away.length },
        { id: 'history', label: 'History', count: history.length },
      ]} />
      {list.length === 0 ? (
        <div className="vx-card">
          <Empty icon="swap" title={tab === 'open' ? 'Nothing is waiting' : tab === 'away' ? 'Nobody is taking a driver or car from you' : 'No past requests'}
            action={tab === 'open' ? <><Button icon="userplus" onClick={() => go('drivers', 'add')}>Add driver</Button><Button icon="car" onClick={() => go('vehicles', 'add')}>Add vehicle</Button></> : undefined}>
            {tab === 'open' ? 'When you add a driver or car that is already on NESAM, the request and its code appear here.' : 'Completed and declined requests are kept here.'}
          </Empty>
        </div>
      ) : (
        <div className="vx-grid">
          {list.map((l) => <LinkCard key={l.id} link={l} mine={l.toVendorId === profile.id} onToast={show} />)}
        </div>
      )}
    </div>
  );
};

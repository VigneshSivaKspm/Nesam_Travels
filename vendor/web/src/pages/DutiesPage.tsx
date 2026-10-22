import React, { useMemo, useState } from 'react';
import type { BidProposal, FleetDriver, FleetVehicle, OpenTrip, VendorTrip } from '../types';
import { canDispatch, isCompleted, isLive, isUpcoming, usePartner } from '../state/Partner';
import { dispatchableDriver, dispatchableVehicle } from '../services/vendorMappers';
import { validateCounterRate } from '../services/vendorFirestoreService';
import { Badge, Banner, Button, Dialog, Empty, RouteStack, SelectInput, Stat, Tabs, TextInput, Field, useToast, Toast } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { formatDateTime12 } from '../utils/time';
import { inr } from '../ui/format';

type Tab = 'new' | 'upcoming' | 'live' | 'completed';

const bidTone = (s: string) => (s === 'Accepted' ? 'green' : s === 'Rejected' ? 'red' : 'amber') as 'green' | 'red' | 'amber';

export const DutiesPage: React.FC = () => {
  const { openTrips, bids, trips, drivers, vehicles, wallet, openLinks, go, actions } = usePartner();
  const [tab, setTab] = useState<Tab>('new');
  const [bidFor, setBidFor] = useState<OpenTrip | null>(null);
  const [assignFor, setAssignFor] = useState<VendorTrip | null>(null);
  const [acceptingId, setAcceptingId] = useState('');
  const { toast, show, dismiss } = useToast();

  const upcoming = useMemo(() => trips.filter(isUpcoming), [trips]);
  const live = useMemo(() => trips.filter(isLive), [trips]);
  const done = useMemo(() => trips.filter(isCompleted), [trips]);
  const needDispatch = upcoming.filter((t) => !t.driverId).length;
  const pendingBid = (tripId: string) => bids.some((b) => b.tripId === tripId && b.status === 'Pending Review');

  const accept = async (trip: OpenTrip) => {
    if (acceptingId) return;
    setAcceptingId(trip.id);
    try {
      await actions.acceptOffer(trip);
      setTab('upcoming');
      show(`${trip.bookingId} is yours. Now choose a driver and vehicle for it.`);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not accept this trip.', 'err');
    } finally {
      setAcceptingId('');
    }
  };

  return (
    <div>
      <Toast toast={toast} onDismiss={dismiss} />
      <div className="vx-stats">
        <Stat value={openTrips.length} label="New offers" tone={openTrips.length ? 'accent' : undefined} />
        <Stat value={needDispatch} label="Need a driver" tone={needDispatch ? 'accent' : undefined} />
        <Stat value={live.length} label="On the road" />
        <Stat value={inr(wallet.available)} label="Available to withdraw" tone="good" />
      </div>

      {openLinks.length > 0 && (
        <Banner tone="warn" action={{ label: 'Open requests', onClick: () => go('requests') }}>
          {openLinks.length} {openLinks.length === 1 ? 'request needs' : 'requests need'} your attention — a code to enter, or waiting for the NESAM office.
        </Banner>
      )}

      <div className="vx-wrap" style={{ marginBottom: 16 }}>
        <Button icon="userplus" onClick={() => go('drivers', 'add')}>Add driver</Button>
        <Button icon="car" onClick={() => go('vehicles', 'add')}>Add vehicle</Button>
      </div>

      <Tabs label="Duties" value={tab} onChange={setTab} tabs={[
        { id: 'new', label: 'New', count: openTrips.length, hot: true },
        { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
        { id: 'live', label: 'Live', count: live.length },
        { id: 'completed', label: 'Completed' },
      ]} />

      {tab === 'new' && (
        <>
          {openTrips.length === 0 ? (
            <div className="vx-card"><Empty icon="trip" title="No new offers right now">Offers from NESAM appear here the moment they are published. You will also get a notification.</Empty></div>
          ) : (
            <div className="vx-grid">
              {openTrips.map((t) => (
                <OfferCard key={t.id} trip={t} bidding={pendingBid(t.id)} accepting={acceptingId === t.id} onAccept={() => accept(t)} onBid={() => setBidFor(t)} />
              ))}
            </div>
          )}
          {bids.length > 0 && (
            <div className="vx-card" style={{ marginTop: 18 }}>
              <div className="vx-card__head"><h2 className="vx-card__title">Your bids</h2><span className="vx-card__sub">{bids.length}</span></div>
              <div className="vx-list">
                {bids.map((b) => <BidRow key={b.id} bid={b} onWithdraw={async () => {
                  try { await actions.withdrawBid(b); show(`Bid for ${b.bookingId} withdrawn.`); } catch (e) { show(e instanceof Error ? e.message : 'The bid was not withdrawn.', 'err'); }
                }} />)}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'upcoming' && (
        upcoming.length === 0
          ? <div className="vx-card"><Empty icon="calendar" title="Nothing waiting for dispatch">Trips you accept or win are listed here until they start.</Empty></div>
          : <div className="vx-grid">{upcoming.map((t) => <TripCard key={t.id} trip={t} onAssign={() => setAssignFor(t)} />)}</div>
      )}
      {tab === 'live' && (
        live.length === 0
          ? <div className="vx-card"><Empty icon="pin" title="No trip is running">Trips show here once the driver reaches the pickup.</Empty></div>
          : <div className="vx-grid">{live.map((t) => <TripCard key={t.id} trip={t} />)}</div>
      )}
      {tab === 'completed' && (
        done.length === 0
          ? <div className="vx-card"><Empty icon="check" title="No completed trips yet">Finished trips and their payouts are kept here.</Empty></div>
          : <div className="vx-grid">{done.map((t) => <TripCard key={t.id} trip={t} />)}</div>
      )}

      <BidDialog trip={bidFor} onClose={() => setBidFor(null)} onSubmit={async (rate, note) => {
        await actions.submitBid(bidFor!, rate, note);
        show(`Counter bid of ${inr(rate)} sent for ${bidFor!.bookingId}. NESAM will review it.`);
        setBidFor(null);
      }} />
      <AssignDialog trip={assignFor} drivers={drivers} vehicles={vehicles} onClose={() => setAssignFor(null)} onGo={(p) => { setAssignFor(null); go(p, 'add'); }}
        onAssign={async (driverId, vehicleId) => {
          await actions.assign(assignFor!.id, driverId, vehicleId);
          const d = drivers.find((x) => x.id === driverId);
          const v = vehicles.find((x) => x.id === vehicleId);
          show(`${d?.name || 'The driver'} is assigned with ${v?.vehicleNumber || 'the vehicle'}. The trip is now in their NESAM Driver app.`);
          setAssignFor(null);
        }} />
    </div>
  );
};

const OfferCard: React.FC<{ trip: OpenTrip; bidding: boolean; accepting: boolean; onAccept: () => void; onBid: () => void }> = ({ trip, bidding, accepting, onAccept, onBid }) => (
  <article className="vx-card">
    <div className="vx-split vx-split--center">
      <span className="vx-muted" style={{ fontSize: 12 }}>{trip.bookingId}</span>
      <Badge tone={trip.status === 'Bidding' ? 'amber' : 'blue'}>{trip.status === 'Bidding' ? 'Bids open' : 'New'}</Badge>
    </div>
    <div className="vx-facts" style={{ marginTop: 10 }}>
      <span><Icon name="calendar" />{trip.travelDate || 'Date to be confirmed'}{trip.pickup.time ? ` · ${trip.pickup.time}` : ''}</span>
    </div>
    <RouteStack pickup={trip.pickup.address || trip.route} drop={trip.drop.address || trip.drop.city} />
    <div className="vx-facts">
      {trip.vehicleCategory && <span><Icon name="car" />{trip.vehicleCategory}</span>}
      {trip.distanceKm !== null && <span><Icon name="distance" />{Math.round(trip.distanceKm)} km</span>}
    </div>
    <div className="vx-money" style={{ gridTemplateColumns: '1fr' }}>
      <div className="is-good"><span>Offered payout</span><strong>{trip.offeredPayout !== null ? inr(trip.offeredPayout) : 'Under review'}</strong></div>
    </div>
    <div className="vx-actions" style={{ marginTop: 0 }}>
      {trip.mode !== 'bid_review' && (
        <Button variant="primary" loading={accepting} disabled={trip.offeredPayout === null} title={trip.offeredPayout === null ? 'NESAM is still reviewing this trip’s payout.' : undefined} onClick={onAccept} style={{ flex: 1 }}>
          Accept {trip.offeredPayout !== null ? inr(trip.offeredPayout) : ''}
        </Button>
      )}
      {trip.mode !== 'accept_offer' && (
        <Button variant={trip.mode === 'bid_review' ? 'primary' : 'secondary'} icon="gavel" onClick={onBid} disabled={bidding} style={trip.mode === 'bid_review' ? { flex: 1 } : undefined}>{bidding ? 'Bid sent' : 'Counter bid'}</Button>
      )}
    </div>
    {trip.mode === 'bid_review' && <p className="vx-hint">NESAM reviews bids and assigns the duty — sending a bid does not assign it to you.</p>}
  </article>
);

const BidRow: React.FC<{ bid: BidProposal; onWithdraw: () => void }> = ({ bid, onWithdraw }) => (
  <div className="vx-listrow">
    <div className="vx-listrow__body">
      <strong>{bid.bookingId} · {inr(bid.vendorCounterRate)}</strong>
      <small>Offered {inr(bid.offeredPayout)} · {bid.submittedAt ? formatDateTime12(bid.submittedAt) : '—'}</small>
      {bid.biddingNote && <small>“{bid.biddingNote}”</small>}
    </div>
    <div style={{ textAlign: 'right', display: 'grid', gap: 6, justifyItems: 'end' }}>
      <Badge tone={bidTone(bid.status)}>{bid.status}</Badge>
      {bid.status === 'Pending Review' && <Button size="sm" variant="ghost" onClick={onWithdraw}>Withdraw</Button>}
    </div>
  </div>
);

const stageLabel = (t: VendorTrip) => (isCompleted(t) ? 'Completed' : t.tripSubStatus && t.tripSubStatus !== 'Not Started' ? t.tripSubStatus : t.driverId ? 'Assigned' : 'Needs a driver');

const TripCard: React.FC<{ trip: VendorTrip; onAssign?: () => void }> = ({ trip, onAssign }) => {
  const tone = isCompleted(trip) ? 'green' : trip.driverId ? (isLive(trip) ? 'blue' : 'green') : 'amber';
  return (
    <article className="vx-card">
      <div className="vx-split vx-split--center">
        <span className="vx-muted" style={{ fontSize: 12 }}>{trip.bookingId}</span>
        <Badge tone={tone as 'green' | 'blue' | 'amber'}>{stageLabel(trip)}</Badge>
      </div>
      <div className="vx-facts" style={{ marginTop: 10 }}>
        <span><Icon name="calendar" />{trip.scheduledTime || '—'}</span>
      </div>
      <RouteStack pickup={trip.pickupAddress} drop={trip.dropAddress} />
      <div className="vx-money">
        <div className="is-good"><span>Your payout</span><strong>{trip.vendorPayout !== null ? inr(trip.vendorPayout) : 'Not recorded'}</strong></div>
        <div><span>{trip.paymentStatus ? `Customer · ${trip.paymentStatus}` : 'Customer fare'}</span><strong>{trip.balanceDue !== null && trip.balanceDue > 0 ? `${inr(trip.balanceDue)} due` : inr(trip.grossFare)}</strong></div>
      </div>
      {trip.driverId ? (
        <div className="vx-media" style={{ marginBottom: onAssign ? 12 : 0 }}>
          <span className="vx-avatar" aria-hidden="true"><Icon name="user" /></span>
          <div>
            <strong>{trip.driverName || 'Driver'}</strong>
            <small className="vx-plate">{trip.vehicleNumber || '—'}{trip.driverPhone ? ` · ${trip.driverPhone}` : ''}</small>
            {!isCompleted(trip) && <small style={{ color: trip.verificationSubmitted ? 'var(--green)' : undefined }}>{trip.verificationSubmitted ? '✓ Vehicle photos submitted' : 'Vehicle photos not submitted yet'}</small>}
          </div>
        </div>
      ) : (
        <div className="vx-banner vx-banner--warn" style={{ marginBottom: onAssign ? 12 : 0 }}><Icon name="alert" /><div>No driver assigned yet.</div></div>
      )}
      {onAssign && canDispatch(trip) && (
        <Button variant={trip.driverId ? 'secondary' : 'primary'} block onClick={onAssign} icon={trip.driverId ? 'swap' : 'userplus'}>
          {trip.driverId ? 'Change driver / vehicle' : 'Assign driver & vehicle'}
        </Button>
      )}
    </article>
  );
};

const BidDialog: React.FC<{ trip: OpenTrip | null; onClose: () => void; onSubmit: (rate: number, note: string) => Promise<void> }> = ({ trip, onClose, onSubmit }) => {
  const [rate, setRate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastTrip, setLastTrip] = useState<string | null>(null);
  if ((trip?.id ?? null) !== lastTrip) {
    setLastTrip(trip?.id ?? null);
    setRate(''); setNote(''); setError('');
  }
  const submit = async () => {
    const n = Number(rate);
    const invalid = validateCounterRate(n, trip?.offeredPayout ?? null);
    if (invalid) return setError(invalid);
    if (!note.trim()) return setError('Add a short note for the NESAM team.');
    setBusy(true); setError('');
    try { await onSubmit(n, note); } catch (e) { setError(e instanceof Error ? e.message : 'The bid was not submitted.'); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!trip} onClose={onClose} eyebrow="Counter bid" title={trip ? trip.bookingId : ''} locked={busy}
      footer={<><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" loading={busy} onClick={submit}>Send bid</Button></>}>
      {trip && (
        <>
          <p className="vx-muted" style={{ marginBottom: 14 }}>{trip.route}<br />NESAM offers <strong style={{ color: 'var(--ink)' }}>{trip.offeredPayout !== null ? inr(trip.offeredPayout) : 'a payout that is still under review'}</strong>. Propose your own and the office will decide.</p>
          <TextInput id="bid-rate" label="Your payout (₹)" inputMode="numeric" value={rate} onChange={(e) => { setRate(e.target.value.replace(/\D/g, '')); setError(''); }} placeholder="e.g. 3200" />
          <Field label="Note for the NESAM team" htmlFor="bid-note" required>
            <textarea id="bid-note" className="vx-textarea" value={note} maxLength={300} onChange={(e) => { setNote(e.target.value); setError(''); }} placeholder="Why this payout — vehicle, driver experience, route conditions…" />
          </Field>
          {error && <p className="vx-err" role="alert">{error}</p>}
        </>
      )}
    </Dialog>
  );
};

const AssignDialog: React.FC<{
  trip: VendorTrip | null; drivers: FleetDriver[]; vehicles: FleetVehicle[]; onClose: () => void; onGo: (p: 'drivers' | 'vehicles') => void;
  onAssign: (driverId: string, vehicleId: string) => Promise<void>;
}> = ({ trip, drivers, vehicles, onClose, onGo, onAssign }) => {
  const readyDrivers = drivers.filter(dispatchableDriver);
  const readyVehicles = vehicles.filter(dispatchableVehicle);
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastTrip, setLastTrip] = useState<string | null>(null);
  if ((trip?.id ?? null) !== lastTrip) {
    setLastTrip(trip?.id ?? null);
    setDriverId(trip && readyDrivers.some((d) => d.id === trip.driverId) ? trip.driverId : '');
    setVehicleId(trip && readyVehicles.some((v) => v.id === trip.vehicleId) ? trip.vehicleId : '');
    setError('');
  }
  const pickDriver = (id: string) => {
    setDriverId(id);
    const paired = readyVehicles.find((v) => v.assignedDriverId === id);
    if (paired) setVehicleId(paired.id);
  };
  const submit = async () => {
    setBusy(true); setError('');
    try { await onAssign(driverId, vehicleId); } catch (e) { setError(e instanceof Error ? e.message : 'The trip was not dispatched.'); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!trip} onClose={onClose} eyebrow={trip?.driverId ? 'Change assignment' : 'Dispatch'} title="Driver & vehicle" locked={busy}
      footer={<><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" loading={busy} disabled={!driverId || !vehicleId} onClick={submit}>{trip?.driverId ? 'Update trip' : 'Assign trip'}</Button></>}>
      {trip && (
        <>
          <p className="vx-muted" style={{ marginBottom: 14 }}>{trip.bookingId} · {trip.scheduledTime || '—'}</p>
          {readyDrivers.length === 0 && (
            <Banner tone="warn" action={{ label: 'Add a driver', onClick: () => onGo('drivers') }}>No approved driver in your fleet yet.</Banner>
          )}
          {readyVehicles.length === 0 && (
            <Banner tone="warn" action={{ label: 'Add a vehicle', onClick: () => onGo('vehicles') }}>No approved vehicle is in service.</Banner>
          )}
          <SelectInput id="as-driver" label="Driver (approved, not suspended)" value={driverId} onChange={pickDriver} placeholder="Choose a driver"
            options={readyDrivers.map((d) => ({ value: d.id, label: `${d.name || 'Unnamed driver'}${d.phone ? ` · ${d.phone}` : ''} · ${d.online ? 'Online' : 'Offline'}` }))} />
          <SelectInput id="as-vehicle" label="Vehicle (documents approved, in service)" value={vehicleId} onChange={setVehicleId} placeholder="Choose a vehicle"
            options={readyVehicles.map((v) => ({ value: v.id, label: `${v.vehicleNumber}${v.make || v.model ? ` · ${[v.make, v.model].filter(Boolean).join(' ')}` : ''}` }))} />
          <p className="vx-hint">The server checks the driver’s licence, the vehicle’s documents and any clash with another duty before it assigns.</p>
          {error && <p className="vx-err" role="alert">{error}</p>}
        </>
      )}
    </Dialog>
  );
};

import React, { useEffect, useState } from 'react';
import type { FleetVehicle } from '../types';
import { usePartner } from '../state/Partner';
import { findVehicle, requestVehicleLink, type LinkRequestResult, type VehicleLookup } from '../services/partnerLinks';
import { Badge, Banner, Button, Dialog, Empty, KV, SelectInput, TextInput, Toast, useToast, Avatar } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { displayPlate, isPlate, normalizePlate } from '../utils/fleet';
import { CodePanel } from './LinkParts';

const docTone = { Approved: 'green', Pending: 'amber', 'Needs Correction': 'amber', Rejected: 'red' } as const;
const docText = { Approved: 'Approved', Pending: 'Awaiting NESAM review', 'Needs Correction': 'Needs correction', Rejected: 'Rejected' } as const;
const currentYear = new Date().getFullYear();

export const VehiclesPage: React.FC = () => {
  const { vehicles, drivers, intent, clearIntent, actions } = usePartner();
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState('');
  const { toast, show, dismiss } = useToast();

  useEffect(() => {
    if (intent === 'add') { setAdding(true); clearIntent(); }
  }, [intent, clearIntent]);

  const assignable = drivers.filter((d) => d.accountStatus === 'Approved' && !d.suspended);
  const act = async (id: string, work: () => Promise<void>, ok: string) => {
    if (busyId) return;
    setBusyId(id);
    try { await work(); show(ok); } catch (e) { show(e instanceof Error ? e.message : 'The change was not saved.', 'err'); } finally { setBusyId(''); }
  };

  return (
    <div>
      <Toast toast={toast} onDismiss={dismiss} />
      <div className="vx-actions" style={{ marginTop: 0, marginBottom: 16, justifyContent: 'flex-end' }}>
        <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Add vehicle</Button>
      </div>

      {vehicles.length === 0 ? (
        <div className="vx-card"><Empty icon="car" title="No vehicles in your fleet yet" action={<Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Add your first vehicle</Button>}>
          Enter the registration number. If the car is already on NESAM you can link it; otherwise you register it for document review.
        </Empty></div>
      ) : (
        <div className="vx-grid">
          {vehicles.map((v) => <VehicleCard key={v.id} v={v} busy={busyId === v.id}
            driverOptions={assignable.map((d) => ({ value: d.id, label: d.name || d.phone || 'Driver' }))}
            onPair={(driverId) => act(v.id, () => actions.pairDriver(v.id, driverId), driverId ? 'Driver paired with the vehicle.' : 'Driver unpaired.')}
            onStatus={(s) => act(v.id, () => actions.setVehicleStatus(v.id, s), `${v.vehicleNumber} is now ${s.toLowerCase()}.`)} />)}
        </div>
      )}

      <AddVehicleDialog open={adding} onClose={() => setAdding(false)} onToast={show} />
    </div>
  );
};

const VehicleCard: React.FC<{
  v: FleetVehicle; busy: boolean; driverOptions: { value: string; label: string }[]; onPair: (driverId: string) => void; onStatus: (s: FleetVehicle['status']) => void;
}> = ({ v, busy, driverOptions, onPair, onStatus }) => {
  const held = v.status === 'Accident Hold';
  return (
    <article className="vx-card">
      <div className="vx-split">
        <div className="vx-media">
          <Avatar name={v.vehicleNumber} icon="car" large />
          <div>
            <strong className="vx-plate">{v.vehicleNumber}</strong>
            <small>{[v.make, v.model].filter(Boolean).join(' ') || 'Make / model not recorded'}</small>
            <small>{[v.category, v.seatingCapacity ? `${v.seatingCapacity} seats` : '', v.year].filter(Boolean).join(' · ')}</small>
          </div>
        </div>
        <Badge tone={docTone[v.docStatus]}>{docText[v.docStatus]}</Badge>
      </div>
      {v.docStatus === 'Rejected' && v.rejectionReason && <Banner tone="err">{v.rejectionReason}</Banner>}
      {held && <Banner tone="warn">This vehicle is on hold by NESAM and cannot be dispatched.</Banner>}
      <div style={{ marginTop: 10 }}>
        <KV label="Paired driver">{v.assignedDriverName || 'None'}</KV>
      </div>
      <div className="vx-grid vx-grid--2" style={{ gap: 10, marginTop: 6 }}>
        <SelectInput id={`pair-${v.id}`} label="Driver" value={v.assignedDriverId} onChange={onPair} placeholder="No driver" options={driverOptions} />
        <SelectInput id={`st-${v.id}`} label="Status" value={held ? 'Accident Hold' : v.status} onChange={(s) => onStatus(s as FleetVehicle['status'])}
          options={held ? [{ value: 'Accident Hold', label: 'On hold (NESAM)' }] : [{ value: 'Active', label: 'In service' }, { value: 'Maintenance', label: 'Maintenance' }, { value: 'Inactive', label: 'Inactive' }]} />
      </div>
      {busy && <p className="vx-hint">Saving…</p>}
    </article>
  );
};

type Step = 'plate' | 'new' | 'found' | 'code' | 'added';

const AddVehicleDialog: React.FC<{ open: boolean; onClose: () => void; onToast: (t: string, k?: 'ok' | 'err') => void }> = ({ open, onClose, onToast }) => {
  const { vehicles, categories, links, go, actions } = usePartner();
  const [step, setStep] = useState<Step>('plate');
  const [plate, setPlate] = useState('');
  const [found, setFound] = useState<VehicleLookup | null>(null);
  const [result, setResult] = useState<LinkRequestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ categoryId: '', make: '', model: '', year: '', seats: '' });

  useEffect(() => {
    if (open) { setStep('plate'); setPlate(''); setFound(null); setResult(null); setError(''); setBusy(false); setForm({ categoryId: '', make: '', model: '', year: '', seats: '' }); }
  }, [open]);

  const key = normalizePlate(plate);
  const link = result ? links.find((l) => l.id === result.linkId) : undefined;

  const check = async () => {
    if (!isPlate(plate)) return setError('Enter the registration number as printed on the plate, e.g. TN 01 AB 1234.');
    if (vehicles.some((v) => normalizePlate(v.vehicleNumber) === key)) return setError('This vehicle is already in your fleet.');
    setBusy(true); setError('');
    try {
      const r = await findVehicle(plate);
      setFound(r);
      setStep(r.found ? 'found' : 'new');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not check that number.'); } finally { setBusy(false); }
  };

  const register = async () => {
    const category = categories.find((c) => c.id === form.categoryId);
    const year = Number(form.year);
    const seats = Number(form.seats);
    if (!category) return setError('Choose the vehicle category.');
    if (!form.make.trim() || !form.model.trim()) return setError('Enter the make and model.');
    if (!Number.isInteger(year) || year < 1990 || year > currentYear + 1) return setError(`Enter a manufacturing year between 1990 and ${currentYear + 1}.`);
    if (!Number.isInteger(seats) || seats < 1 || seats > 60) return setError('Enter the seating capacity (1–60).');
    setBusy(true); setError('');
    try {
      await actions.addVehicle({ vehicleNumber: displayPlate(key), categoryId: category.id, category: category.name, make: form.make.trim(), model: form.model.trim(), year: String(year), seatingCapacity: seats });
      setStep('added');
    } catch (e) { setError(e instanceof Error ? e.message : 'The vehicle was not saved.'); } finally { setBusy(false); }
  };

  const request = async (office: boolean) => {
    setBusy(true); setError('');
    try { const r = await requestVehicleLink(plate, office); setResult(r); setStep('code'); } catch (e) { setError(e instanceof Error ? e.message : 'The request could not be sent.'); } finally { setBusy(false); }
  };

  const f = found;
  const blocked = !!f && (f.mine || !!f.pendingLinkId);
  const set = (k: keyof typeof form, v: string) => { setForm((x) => ({ ...x, [k]: v })); setError(''); };
  const title = step === 'plate' ? 'Add a vehicle' : step === 'new' ? 'New to NESAM' : step === 'added' ? 'Sent for review' : step === 'code' ? 'Confirm the change' : displayPlate(key);

  return (
    <Dialog open={open} onClose={onClose} eyebrow="Manage your fleet" title={title} locked={busy}
      footer={
        step === 'plate' ? <><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" loading={busy} onClick={check}>Find vehicle</Button></>
        : step === 'new' ? <><Button onClick={() => { setStep('plate'); setError(''); }} disabled={busy}>Back</Button><Button variant="primary" loading={busy} onClick={register}>Submit for review</Button></>
        : step === 'found' ? <>
            <Button onClick={() => { setStep('plate'); setError(''); }} disabled={busy}>Back</Button>
            {f && !blocked && f.otpReceiver && <Button variant="primary" icon="send" loading={busy} onClick={() => request(false)}>Send code to {f.otpReceiver.name}</Button>}
            {f && !blocked && !f.otpReceiver && <Button variant="primary" icon="headset" loading={busy} onClick={() => request(true)}>Ask the office to verify</Button>}
            {f?.pendingLinkId && <Button variant="primary" onClick={() => { onClose(); go('requests'); }}>Open requests</Button>}
          </>
        : <Button variant="primary" onClick={onClose}>{step === 'code' && link?.status === 'Completed' ? 'Done' : 'Close'}</Button>
      }>
      {step === 'plate' && (
        <>
          <p className="vx-muted" style={{ marginBottom: 14 }}>Enter the registration number. If the car is already verified on NESAM, you will not need to upload its documents again.</p>
          <TextInput id="add-vehicle-plate" label="Vehicle registration number" plate value={plate} autoFocus placeholder="TN 01 AB 1234" autoComplete="off" maxLength={14}
            onChange={(e) => { setPlate(e.target.value.toUpperCase()); setError(''); }} onKeyDown={(e) => e.key === 'Enter' && check()} error={error} />
        </>
      )}

      {step === 'new' && (
        <>
          <Banner>This number is not on NESAM yet. Register it now; NESAM reviews the documents and you can dispatch the car once it is approved.</Banner>
          <SelectInput id="nv-cat" label="Category" required value={form.categoryId} onChange={(v) => set('categoryId', v)} placeholder="Choose a category" options={categories.map((c) => ({ value: c.id, label: c.name + (c.seatingCapacity ? ` · ${c.seatingCapacity} seats` : '') }))} />
          <div className="vx-grid vx-grid--2" style={{ gap: 12 }}>
            <TextInput id="nv-make" label="Make" required value={form.make} onChange={(e) => set('make', e.target.value)} placeholder="Maruti" />
            <TextInput id="nv-model" label="Model" required value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Dzire" />
            <TextInput id="nv-year" label="Year" required inputMode="numeric" maxLength={4} value={form.year} onChange={(e) => set('year', e.target.value.replace(/\D/g, ''))} placeholder="2022" />
            <TextInput id="nv-seats" label="Seats" required inputMode="numeric" maxLength={2} value={form.seats} onChange={(e) => set('seats', e.target.value.replace(/\D/g, ''))} placeholder="4" />
          </div>
          {error && <p className="vx-err" role="alert">{error}</p>}
        </>
      )}

      {step === 'found' && f && (
        <>
          <div className="vx-found">
            <div className="vx-media">
              <Avatar name={f.plate ?? ''} icon="car" large />
              <div>
                <strong className="vx-plate">{f.plate}</strong>
                <small>{[f.model, f.category].filter(Boolean).join(' · ') || 'Already on NESAM'}</small>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <KV label="Currently with">{f.mine ? 'Your fleet' : f.owner}</KV>
              <KV label="Documents">{f.verified ? <Badge tone="green">Verified</Badge> : <Badge tone="amber">Not verified</Badge>}</KV>
            </div>
          </div>
          {f.mine && <Banner>This vehicle is already in your fleet.</Banner>}
          {f.pendingLinkId && <Banner tone="warn">You already have an open request for this vehicle.</Banner>}
          {!blocked && f.onHold && <Banner tone="warn">This vehicle is on hold. Only the NESAM office can move it.</Banner>}
          {!blocked && !f.verified && <Banner tone="warn">This vehicle is not verified yet, so the NESAM office has to approve the move.</Banner>}
          {!blocked && (f.openDuties ?? 0) > 0 && <Banner tone="warn">It has {f.openDuties} booked {f.openDuties === 1 ? 'duty' : 'duties'}. Those must be reassigned before it can move.</Banner>}
          {!blocked && (f.otpReceiver
            ? <Banner>To confirm the change we send a code to <strong>{f.otpReceiver.name}</strong> ({f.otpReceiver.phoneMask}), who drove this car last. They read it to you and you enter it. The car’s verified documents stay valid.</Banner>
            : <Banner tone="warn">No driver has completed a trip in this car recently, so there is nobody to send a code to. The NESAM office will verify the change with you.</Banner>)}
          {error && <p className="vx-err" role="alert">{error}</p>}
        </>
      )}

      {step === 'code' && result && (link ? <CodePanel link={link} testCode={result.testCode} onToast={onToast} /> : <Banner>Request sent. Loading its status…</Banner>)}

      {step === 'added' && (
        <>
          <Banner tone="ok"><strong>{displayPlate(key)}</strong> was added and is awaiting NESAM document review.</Banner>
          <p className="vx-muted"><Icon name="info" /> You can dispatch it once it is approved. Documents are collected during review.</p>
        </>
      )}
    </Dialog>
  );
};

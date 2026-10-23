// Vehicles of this fleet. Adding starts with the registration number: a car that is new to NESAM is registered with its documents
// for review; a car NESAM already knows is linked by a request that the driver who drove it last confirms with a code
// (see components/links). Pairing a driver and changing a vehicle's service status stay direct, rules-checked writes.
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useVendorData } from '../context/VendorData';
import { Badge, Button, Card, Chip, EmptyState, Notice, Row, Screen, Segmented, Sheet, TextField } from '../components/ui';
import { CodePanel } from '../components/links/LinkParts';
import { VehicleForm } from '../components/fleet/VehicleForm';
import { assignVehicle, deleteVehicle, setVehicleStatus, VendorActionError } from '../services/vendorService';
import { findVehicle, requestVehicleLink, type LinkRequestResult, type VehicleLookup } from '../services/partnerLinks';
import type { FleetVehicle, VehicleStatus } from '../types/operations';
import type { TabParamList } from '../navigation/types';
import { displayDate } from '../components/fields';
import { daysUntil } from '../utils/wallet';
import { isPlate, normalizePlate as plateKey } from '../utils/fleet';
import { describeDataError } from '../utils/retry';
import { EXPIRY_WARNING_DAYS } from '../config/constants';
import { colors, space, type } from '../theme';


function ExpiryBadge({ label, date }: { label: string; date: string }) {
  const days = daysUntil(date);
  if (days == null || days > EXPIRY_WARNING_DAYS) return null;
  return <Badge label={days < 0 ? `${label} expired` : `${label} in ${days}d`} tone={days < 0 ? 'danger' : 'warning'} />;
}

export function VehiclesScreen() {
  const route = useRoute<RouteProp<TabParamList, 'Vehicles'>>();
  const { vehicles, drivers } = useVendorData();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FleetVehicle | null>(null);
  const [register, setRegister] = useState<string | null>(null);
  const [pairFor, setPairFor] = useState<FleetVehicle | null>(null);
  const [message, setMessage] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  // "Add …" from another screen arrives as a fresh timestamp param; open the sheet once per value.
  const addRequest = route.params?.add;
  const [seenAdd, setSeenAdd] = useState(addRequest);
  if (addRequest !== seenAdd) {
    setSeenAdd(addRequest);
    if (addRequest) setAdding(true);
  }

  const changeStatus = (v: FleetVehicle, status: VehicleStatus) => {
    setMessage(null);
    setVehicleStatus(v.id, status).catch((e: unknown) => setMessage({ tone: 'error', text: describeDataError(e) }));
  };

  const remove = (v: FleetVehicle) =>
    Alert.alert('Remove vehicle?', `${v.vehicleNumber} will be removed from your fleet.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deleteVehicle(v)
            .then(() =>
              setMessage({
                tone: 'success',
                text: `${v.vehicleNumber} removed.`,
              }),
            )
            .catch((e: unknown) =>
              setMessage({
                tone: 'error',
                text: e instanceof VendorActionError ? e.message : describeDataError(e),
              }),
            );
        },
      },
    ]);

  const approvedCount = vehicles.filter((v) => v.docStatus === 'Approved').length;

  return (
    <View style={styles.root}>
      {editing ? (
        <VehicleForm
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setMessage({ tone: 'success', text });
          }}
        />
      ) : null}
      {register ? (
        <VehicleForm
          existing={null}
          initialPlate={register}
          onClose={() => setRegister(null)}
          onSaved={(text) => {
            setRegister(null);
            setMessage({ tone: 'success', text });
          }}
        />
      ) : null}
      {pairFor ? (
        <PairSheet
          key={pairFor.id}
          vehicle={pairFor}
          onClose={() => setPairFor(null)}
          onDone={(text) => {
            setPairFor(null);
            setMessage({ tone: 'success', text });
          }}
        />
      ) : null}
      {adding ? (
        <AddVehicleSheet
          onClose={() => setAdding(false)}
          onMessage={(text, tone = 'success') => setMessage({ tone, text })}
          onRegister={(plate) => {
            setAdding(false);
            setRegister(plate);
          }}
        />
      ) : null}
      <Screen edges={[]}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={type.h1}>Vehicles</Text>
            <Text style={type.small}>
              {vehicles.length} in your fleet · {approvedCount} approved
            </Text>
          </View>
          <Button small title="+ Add vehicle" onPress={() => setAdding(true)} />
        </View>
        {message ? <Notice tone={message.tone} message={message.text} /> : null}
        {vehicles.length === 0 ? (
          <EmptyState
            title="No vehicles in your fleet yet"
            message="Enter the registration number. If the car is already on NESAM you can link it; otherwise you register it for document review."
            action={<Button title="Add your first vehicle" onPress={() => setAdding(true)} />}
          />
        ) : (
          vehicles.map((v) => (
            <Card key={v.id}>
              <View style={styles.between}>
                <Text style={type.h2}>{v.vehicleNumber}</Text>
                <Badge
                  label={v.docStatus === 'Approved' ? 'Approved' : v.docStatus === 'Rejected' ? 'Rejected' : 'Awaiting NESAM review'}
                  tone={v.docStatus === 'Approved' ? 'success' : v.docStatus === 'Rejected' ? 'danger' : 'warning'}
                />
              </View>
              <Text style={type.small}>
                {[v.make, v.model].filter(Boolean).join(' ') || 'Make / model not recorded'} · {v.category} · {v.seatingCapacity} seats
              </Text>
              {v.docStatus === 'Rejected' && v.rejectionReason ? <Notice message={`Reason: ${v.rejectionReason}`} style={{ marginTop: space.sm }} /> : null}
              <View style={styles.badges}>
                <ExpiryBadge label="Insurance" date={v.insuranceExpiry} />
                <ExpiryBadge label="Permit" date={v.permitExpiry} />
                <ExpiryBadge label="FC" date={v.fitnessExpiry} />
              </View>
              <Row label="Paired driver" value={v.assignedDriverName || 'None'} />
              <Row label="Insurance till" value={displayDate(v.insuranceExpiry) || '—'} />
              <Row label="Permit till" value={displayDate(v.permitExpiry) || '—'} />
              <Segmented
                options={[
                  { value: 'Active', label: 'In service' },
                  { value: 'Maintenance', label: 'Maintenance' },
                  { value: 'Inactive', label: 'Inactive' },
                ]}
                value={v.status}
                onChange={(s) => changeStatus(v, s)}
              />
              <View style={styles.actions}>
                <Button small variant="secondary" title="Pair driver" onPress={() => setPairFor(v)} style={{ flex: 1 }} disabled={drivers.length === 0} />
                <Button small variant="secondary" title="Documents" onPress={() => setEditing(v)} style={{ flex: 1 }} />
                <Button small variant="ghost" title="Remove" onPress={() => remove(v)} />
              </View>
            </Card>
          ))
        )}
      </Screen>
    </View>
  );
}

function PairSheet({ vehicle, onClose, onDone }: { vehicle: FleetVehicle; onClose: () => void; onDone: (text: string) => void }) {
  const { drivers, vehicles } = useVendorData();
  const [driverId, setDriverId] = useState(vehicle.assignedDriverId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const usable = drivers.filter((d) => d.approvalStatus === 'Approved' && d.fleetStatus !== 'Suspended');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const target = drivers.find((d) => d.id === driverId);
      if (target) await assignVehicle(target, vehicle, vehicles);
      else {
        const current = drivers.find((d) => d.id === vehicle.assignedDriverId);
        if (current) await assignVehicle(current, null, vehicles);
      }
      onDone(target ? `${target.name} paired with ${vehicle.vehicleNumber}.` : `${vehicle.vehicleNumber} unpaired.`);
    } catch (e) {
      setError(e instanceof VendorActionError ? e.message : describeDataError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible onClose={onClose} title={`Pair driver · ${vehicle.vehicleNumber}`} dismissible={!busy}>
      {usable.length === 0 ? <Notice tone="info" message="No approved drivers yet. Add a driver from the Drivers tab." /> : null}
      <View style={styles.chips}>
        <Chip label="None" active={!driverId} onPress={() => setDriverId('')} />
        {usable.map((d) => (
          <Chip key={d.id} label={d.name} active={driverId === d.id} onPress={() => setDriverId(d.id)} />
        ))}
      </View>
      <Notice message={error} />
      <Button title={busy ? 'Saving…' : 'Save'} loading={busy} disabled={driverId === vehicle.assignedDriverId} onPress={() => void save()} />
    </Sheet>
  );
}

type Step = 'plate' | 'found' | 'code';

function AddVehicleSheet({
  onClose,
  onMessage,
  onRegister,
}: {
  onClose: () => void;
  onMessage: (text: string, tone?: 'success' | 'error') => void;
  onRegister: (plate: string) => void;
}) {
  const { vehicles, links } = useVendorData();
  const navigation = useNavigation();
  const [step, setStep] = useState<Step>('plate');
  const [plate, setPlate] = useState('');
  const [found, setFound] = useState<VehicleLookup | null>(null);
  const [result, setResult] = useState<LinkRequestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const key = plateKey(plate);
  const link = result ? links.find((l) => l.id === result.linkId) : undefined;

  const check = async () => {
    if (!isPlate(plate)) return setError('Enter the registration number as printed on the plate, e.g. TN 01 AB 1234.');
    if (vehicles.some((v) => plateKey(v.vehicleNumber) === key)) return setError('This vehicle is already in your fleet.');
    setBusy(true);
    setError('');
    try {
      const r = await findVehicle(plate);
      if (!r.found) {
        onRegister(key);
        return;
      }
      setFound(r);
      setStep('found');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check that number.');
    } finally {
      setBusy(false);
    }
  };
  const request = async (office: boolean) => {
    setBusy(true);
    setError('');
    try {
      setResult(await requestVehicleLink(plate, office));
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The request could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const f = found;
  const blocked = !!f && (f.mine || !!f.pendingLinkId);

  return (
    <Sheet
      visible
      onClose={onClose}
      title={step === 'plate' ? 'Add a vehicle' : step === 'code' ? 'Confirm the change' : (f?.plate ?? 'Vehicle')}
      dismissible={!busy}
    >
      {step === 'plate' ? (
        <>
          <Text style={[type.small, { marginBottom: space.md }]}>
            Enter the registration number. If the car is already verified on NESAM you will not need to upload its documents again.
          </Text>
          <TextField
            label="Vehicle registration number"
            value={plate}
            onChangeText={(t) => {
              setPlate(t.toUpperCase().slice(0, 14));
              setError('');
            }}
            autoCapitalize="characters"
            placeholder="TN 01 AB 1234"
            error={error}
          />
          <Button title="Find vehicle" loading={busy} onPress={() => void check()} />
        </>
      ) : null}

      {step === 'found' && f ? (
        <>
          <Card style={{ marginBottom: space.md }}>
            <View style={styles.head}>
              <Ionicons name="car-outline" size={26} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{f.plate}</Text>
                <Text style={type.small}>{[f.model, f.category].filter(Boolean).join(' · ') || 'Already on NESAM'}</Text>
              </View>
            </View>
            <Row label="Currently with" value={f.mine ? 'Your fleet' : f.owner || 'Another owner'} />
            <Row label="Documents" value={f.verified ? 'Verified' : 'Not verified'} />
          </Card>
          {f.mine ? <Notice tone="info" message="This vehicle is already in your fleet." /> : null}
          {f.pendingLinkId ? <Notice tone="warning" message="You already have an open request for this vehicle." /> : null}
          {!blocked && f.onHold ? <Notice tone="warning" message="This vehicle is on hold. Only the NESAM office can move it." /> : null}
          {!blocked && !f.verified ? <Notice tone="warning" message="This vehicle is not verified yet, so the NESAM office has to approve the move." /> : null}
          {!blocked && (f.openDuties ?? 0) > 0 ? (
            <Notice
              tone="warning"
              message={`It has ${f.openDuties} booked ${f.openDuties === 1 ? 'duty' : 'duties'}. Those must be reassigned before it can move.`}
            />
          ) : null}
          {!blocked ? (
            f.otpReceiver ? (
              <Notice
                tone="info"
                message={`To confirm the change we send a code to ${f.otpReceiver.name} (${f.otpReceiver.phoneMask}), who drove this car last. They read it to you and you enter it. The car’s verified documents stay valid.`}
              />
            ) : (
              <Notice
                tone="warning"
                message="No driver has completed a trip in this car recently, so there is nobody to send a code to. The NESAM office will verify the change with you."
              />
            )
          ) : null}
          <Notice message={error} />
          {!blocked && f.otpReceiver ? <Button title={`Send code to ${f.otpReceiver.name}`} loading={busy} onPress={() => void request(false)} /> : null}
          {!blocked && !f.otpReceiver ? <Button title="Ask the office to verify" loading={busy} onPress={() => void request(true)} /> : null}
          {f.pendingLinkId ? (
            <Button
              title="Open requests"
              onPress={() => {
                onClose();
                navigation.navigate('Requests');
              }}
            />
          ) : null}
          <Button
            variant="ghost"
            title="Back"
            disabled={busy}
            onPress={() => {
              setStep('plate');
              setError('');
            }}
            style={{ marginTop: space.sm }}
          />
        </>
      ) : null}

      {step === 'code' && result ? (
        link ? (
          <>
            <CodePanel link={link} testCode={result.testCode} say={onMessage} />
            <Button title={link.status === 'Completed' ? 'Done' : 'Close'} variant="secondary" onPress={onClose} style={{ marginTop: space.md }} />
          </>
        ) : (
          <Notice tone="info" message="Request sent. Loading its status…" />
        )
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.md,
  },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginVertical: space.sm,
  },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
});

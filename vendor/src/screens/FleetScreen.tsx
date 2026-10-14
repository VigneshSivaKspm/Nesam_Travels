// Fleet vehicles (native port of vendor/web FleetScreen.tsx). New vehicles and
// document changes go to NESAM review (docStatus 'Pending' — firestore.rules).
import React, { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, View } from 'react-native';
import { Content, FlatList, Frame, ScrollView, DesktopRow } from '../components/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVendorData } from '../context/VendorData';
import { Badge, Button, Card, Chip, EmptyState, Notice, Row, Segmented, TextField } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { DateField, SingleDocField, displayDate, todayIso } from '../components/fields';
import { addVehicle, deleteVehicle, newVehicleId, setVehicleStatus, updateVehicleDocuments, VendorActionError, type VehicleInput } from '../services/vendorService';
import type { FleetVehicle, VehicleStatus } from '../types/operations';
import { daysUntil } from '../utils/wallet';
import { describeDataError } from '../utils/retry';
import { EXPIRY_WARNING_DAYS, FLEET_CATEGORIES, FUEL_TYPES } from '../config/constants';
import { colors, radius, space, type } from '../theme';
import { useResponsive } from '../theme/responsive';

const VEHICLE_NO_RE = /^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{0,3}[\s-]?\d{1,4}$/;

function ExpiryBadge({ label, date }: { label: string; date: string }) {
  const days = daysUntil(date);
  if (days == null || days > EXPIRY_WARNING_DAYS) return null;
  return <Badge label={days < 0 ? `${label} expired` : `${label} in ${days}d`} tone={days < 0 ? 'danger' : 'warning'} />;
}

export function FleetScreen() {
  const { isDesktop, isCompact } = useResponsive();
  const { vehicles } = useVendorData();
  const [editing, setEditing] = useState<{ mode: 'add' } | { mode: 'edit'; vehicle: FleetVehicle } | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

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
            .then(() => setMessage({ tone: 'success', text: `${v.vehicleNumber} removed.` }))
            .catch((e: unknown) => setMessage({ tone: 'error', text: e instanceof VendorActionError ? e.message : describeDataError(e) }));
        },
      },
    ]);

  const approvedCount = vehicles.filter((v) => v.docStatus === 'Approved').length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <DesktopHeader
        title="Fleet Management"
        subtitle={`${vehicles.length} vehicle(s) in fleet · ${approvedCount} approved for active dispatch`}
        badge={`${vehicles.length} Vehicles`}
        actions={
          <Button
            small
            title="+ Add New Vehicle"
            onPress={() => setEditing({ mode: 'add' })}
          />
        }
      />

      {editing ? (
        <VehicleForm
          existing={editing.mode === 'edit' ? editing.vehicle : null}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setMessage({ tone: 'success', text });
          }}
        />
      ) : null}

      <FlatList
        multiColumn
        data={vehicles}
        keyExtractor={(v) => v.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerArea}>
            {isCompact ? (
              <>
                <Text style={type.h1}>Fleet</Text>
                <Text style={[type.small, { marginBottom: space.md }]}>
                  {vehicles.length} vehicle(s) · {approvedCount} approved
                </Text>
                <Button title="+ Add vehicle" onPress={() => setEditing({ mode: 'add' })} style={{ marginBottom: space.md }} />
              </>
            ) : null}
            {message ? <Notice tone={message.tone} message={message.text} /> : null}
          </View>
        }
        ListEmptyComponent={<EmptyState title="No vehicles yet" message="Add your vehicles with RC, insurance and permit so NESAM can approve them for trips." />}
        renderItem={({ item: v }) => (
          <Card style={styles.vehicleCard}>
            <View style={styles.rowBetween}>
              <View style={styles.plateBadge}>
                <Text style={styles.plateText}>{v.vehicleNumber}</Text>
              </View>
              <Badge
                label={v.docStatus === 'Approved' ? 'Approved' : v.docStatus === 'Rejected' ? 'Rejected' : 'Under Review'}
                tone={v.docStatus === 'Approved' ? 'success' : v.docStatus === 'Rejected' ? 'danger' : 'warning'}
              />
            </View>

            <Text style={styles.vehicleModelText}>
              {v.make} {v.model} {v.year ? `(${v.year})` : ''}
            </Text>
            <Text style={styles.vehicleMetaText}>
              Category: <Text style={{ fontWeight: '700', color: colors.ink }}>{v.category}</Text> · {v.seatingCapacity} Passenger Seats {v.fuelType ? `· ${v.fuelType}` : ''}
            </Text>

            {v.docStatus === 'Rejected' && v.rejectionReason ? <Notice message={`Reason: ${v.rejectionReason}`} style={{ marginTop: space.sm }} /> : null}

            <View style={styles.badges}>
              <ExpiryBadge label="Insurance" date={v.insuranceExpiry} />
              <ExpiryBadge label="Permit" date={v.permitExpiry} />
              <ExpiryBadge label="FC" date={v.fitnessExpiry} />
            </View>

            <View style={styles.detailsBox}>
              <Row label="Assigned Driver" value={v.assignedDriverName || 'Unassigned'} bold={!!v.assignedDriverName} />
              <Row label="Insurance Valid Till" value={displayDate(v.insuranceExpiry) || '—'} />
              <Row label="Permit Valid Till" value={displayDate(v.permitExpiry) || '—'} />
            </View>

            <View style={{ marginVertical: space.sm }}>
              <Segmented
                options={[
                  { value: 'Active', label: 'Active' },
                  { value: 'Maintenance', label: 'Maintenance' },
                  { value: 'Inactive', label: 'Inactive' },
                ]}
                value={v.status}
                onChange={(s) => changeStatus(v, s)}
              />
            </View>

            <View style={styles.actions}>
              <Button small variant="secondary" title="Update Documents" onPress={() => setEditing({ mode: 'edit', vehicle: v })} style={{ flex: 1 }} />
              <Button small variant="ghost" title="Remove" onPress={() => remove(v)} />
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

function VehicleForm({ existing, onClose, onSaved }: { existing: FleetVehicle | null; onClose: () => void; onSaved: (message: string) => void }) {
  const { identity, vehicles } = useVendorData();
  const [id] = useState(() => existing?.id ?? newVehicleId());
  const [form, setForm] = useState<VehicleInput>({
    vehicleNumber: existing?.vehicleNumber ?? '',
    category: existing?.category ?? 'Sedan',
    make: existing?.make ?? '',
    model: existing?.model ?? '',
    year: existing?.year ?? '',
    seatingCapacity: existing?.seatingCapacity ?? 4,
    fuelType: existing?.fuelType ?? 'Diesel',
    status: existing?.status ?? 'Active',
    rcNumber: existing?.rcNumber ?? '',
    rcDocUrl: existing?.rcDocUrl ?? '',
    insuranceExpiry: existing?.insuranceExpiry ?? '',
    insuranceDocUrl: existing?.insuranceDocUrl ?? '',
    fitnessExpiry: existing?.fitnessExpiry ?? '',
    fitnessDocUrl: existing?.fitnessDocUrl ?? '',
    permitExpiry: existing?.permitExpiry ?? '',
    statePermitDocUrl: existing?.statePermitDocUrl ?? '',
  });
  const [uploads, setUploads] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof VehicleInput>(k: K, v: VehicleInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const onBusy = (b: boolean) => setUploads((n) => Math.max(0, n + (b ? 1 : -1)));
  const today = todayIso();

  const errors = {
    vehicleNumber: VEHICLE_NO_RE.test(form.vehicleNumber.trim().toUpperCase()) ? '' : 'Enter a valid registration number (e.g. TN 01 AB 1234).',
    make: form.make.trim() ? '' : 'Required',
    model: form.model.trim() ? '' : 'Required',
    year: Number(form.year) >= 2000 && Number(form.year) <= new Date().getFullYear() ? '' : 'Enter a valid year',
    seatingCapacity: form.seatingCapacity >= 2 && form.seatingCapacity <= 60 ? '' : 'Enter seats (2–60)',
    rcNumber: form.rcNumber.trim() ? '' : 'Required',
    rcDocUrl: form.rcDocUrl ? '' : 'Upload the RC',
    insuranceExpiry: !form.insuranceExpiry ? 'Required' : form.insuranceExpiry <= today ? 'Insurance has expired' : '',
    insuranceDocUrl: form.insuranceDocUrl ? '' : 'Upload the insurance policy',
    permitExpiry: !form.permitExpiry ? 'Required' : form.permitExpiry <= today ? 'Permit has expired' : '',
    statePermitDocUrl: form.statePermitDocUrl ? '' : 'Upload the permit',
    fitnessExpiry: form.fitnessExpiry && form.fitnessExpiry <= today ? 'Fitness certificate has expired' : '',
  };
  const err = (k: keyof typeof errors) => (submitted ? errors[k] : '');

  const save = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return setError('Please fix the highlighted fields.');
    if (uploads > 0) return setError('Please wait for uploads to finish.');
    setBusy(true);
    setError('');
    try {
      if (existing) {
        const { status: _status, ...docs } = form;
        await updateVehicleDocuments(existing.id, { ...docs, vehicleNumber: form.vehicleNumber.trim().toUpperCase(), rcNumber: form.rcNumber.trim().toUpperCase() });
        onSaved(`${form.vehicleNumber.toUpperCase()} sent to NESAM for re-verification.`);
      } else {
        await addVehicle(identity, id, form, vehicles);
        onSaved(`${form.vehicleNumber.toUpperCase()} added. NESAM will verify its documents.`);
      }
    } catch (e) {
      setError(e instanceof VendorActionError ? e.message : describeDataError(e));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Modal visible animationType="slide" onRequestClose={() => !busy && onClose()}>
      <SafeAreaView style={styles.modalRoot} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <Content style={styles.formHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{existing ? `Update Vehicle · ${existing.vehicleNumber}` : 'Add New Fleet Vehicle'}</Text>
              <Text style={styles.modalSubtitle}>Upload registration certificates and compliance policies</Text>
            </View>
            <Button small variant="ghost" title="Close" disabled={busy} onPress={onClose} />
          </Content>
        </View>
        <Frame>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={styles.modalFormContainer}>
              <TextField
                label="Registration number"
                required
                value={form.vehicleNumber}
                onChangeText={(t) => set('vehicleNumber', t.toUpperCase())}
                autoCapitalize="characters"
                editable={!existing}
                error={err('vehicleNumber')}
                placeholder="TN 01 AB 1234"
              />
              <Text style={[type.label, { marginBottom: 6 }]}>Category</Text>
              <View style={styles.chips}>
                {FLEET_CATEGORIES.map((c) => (
                  <Chip key={c} label={c} active={form.category === c} onPress={() => set('category', c)} />
                ))}
              </View>
              <View style={styles.formGrid}>
                <TextField label="Make" required value={form.make} onChangeText={(t) => set('make', t)} error={err('make')} placeholder="Toyota" style={{ flex: 1 }} />
                <TextField label="Model" required value={form.model} onChangeText={(t) => set('model', t)} error={err('model')} placeholder="Innova Crysta" style={{ flex: 1 }} />
              </View>
              <View style={styles.formGrid}>
                <TextField label="Year" required value={form.year} onChangeText={(t) => set('year', t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" error={err('year')} placeholder="2023" style={{ flex: 1 }} />
                <TextField
                  label="Seats (excl. driver)"
                  required
                  value={form.seatingCapacity ? String(form.seatingCapacity) : ''}
                  onChangeText={(t) => set('seatingCapacity', Number(t.replace(/\D/g, '').slice(0, 2)) || 0)}
                  keyboardType="number-pad"
                  error={err('seatingCapacity')}
                  placeholder="6"
                  style={{ flex: 1 }}
                />
              </View>
              <Text style={[type.label, { marginBottom: 6 }]}>Fuel Type</Text>
              <View style={styles.chips}>
                {FUEL_TYPES.map((f) => (
                  <Chip key={f} label={f} active={form.fuelType === f} onPress={() => set('fuelType', f)} />
                ))}
              </View>

              <Text style={styles.docsSectionTitle}>Official Compliance Documents</Text>
              <TextField label="RC Number" required value={form.rcNumber} onChangeText={(t) => set('rcNumber', t.toUpperCase())} autoCapitalize="characters" error={err('rcNumber')} />
              <SingleDocField label="Registration Certificate (RC)" vehicleId={id} kind="rc" value={form.rcDocUrl} onChange={(u) => set('rcDocUrl', u)} required error={err('rcDocUrl')} onBusyChange={onBusy} />
              <DateField label="Insurance Policy Expiry" required value={form.insuranceExpiry} onChange={(d) => set('insuranceExpiry', d)} minimumDate={new Date()} error={err('insuranceExpiry')} />
              <SingleDocField label="Insurance Policy Document" vehicleId={id} kind="insurance" value={form.insuranceDocUrl} onChange={(u) => set('insuranceDocUrl', u)} required error={err('insuranceDocUrl')} onBusyChange={onBusy} />
              <DateField label="Permit Expiry" required value={form.permitExpiry} onChange={(d) => set('permitExpiry', d)} minimumDate={new Date()} error={err('permitExpiry')} />
              <SingleDocField label="Tourist / Commercial Permit" vehicleId={id} kind="permit" value={form.statePermitDocUrl} onChange={(u) => set('statePermitDocUrl', u)} required error={err('statePermitDocUrl')} onBusyChange={onBusy} />
              <DateField label="Fitness (FC) Expiry (if applicable)" value={form.fitnessExpiry} onChange={(d) => set('fitnessExpiry', d)} minimumDate={new Date()} error={err('fitnessExpiry')} />
              <SingleDocField label="Fitness Certificate (FC)" vehicleId={id} kind="fitness" value={form.fitnessDocUrl} onChange={(u) => set('fitnessDocUrl', u)} onBusyChange={onBusy} />

              {existing ? <Notice tone="info" message="Saving updates sends this vehicle back to NESAM operations for document re-verification." /> : null}
              <Notice message={error} />
              <Button title={busy ? 'Saving Vehicle…' : uploads > 0 ? 'Uploading Documents…' : existing ? 'Save & Resubmit' : 'Add Vehicle to Fleet'} loading={busy} disabled={uploads > 0} onPress={() => void save()} style={{ marginTop: space.md }} />
            </View>
          </ScrollView>
        </Frame>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  modalRoot: { flex: 1, backgroundColor: colors.page },
  headerArea: { marginBottom: space.sm },
  list: { padding: space.lg, paddingBottom: space.xxl },
  vehicleCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.md,
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)' as any,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  plateBadge: {
    backgroundColor: '#FEFCE8',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  plateText: { fontSize: 16, fontWeight: '900', color: colors.ink, letterSpacing: 1 },
  vehicleModelText: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 8 },
  vehicleMetaText: { fontSize: 14, color: colors.slate, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginVertical: space.sm },
  detailsBox: { backgroundColor: '#F8FAFC', borderRadius: radius.md, padding: space.md, gap: 4, marginVertical: space.xs },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  modalHeader: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  formHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colors.ink },
  modalSubtitle: { fontSize: 13, color: colors.slate, marginTop: 2 },
  modalBody: { padding: space.lg, paddingBottom: space.xxl },
  modalFormContainer: { maxWidth: 680, width: '100%', alignSelf: 'center' },
  formGrid: { flexDirection: 'row', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.sm },
  docsSectionTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, marginTop: space.md, marginBottom: space.sm },
});

// Driver roster, vehicle assignment and invites (native port of vendor/web
// DriverManagementScreen.tsx; invites go to driver_invites and are never
// pre-approved, as firestore.rules require).
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVendorData } from '../context/VendorData';
import { Avatar, Badge, Button, Card, Chip, EmptyState, Notice, Row, Screen, Sheet, TextField } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { DesktopRow } from '../components/layout';
import { assignVehicle, inviteDriver, revokeInvite, setDriverFleetStatus, VendorActionError } from '../services/vendorService';
import type { FleetDriver } from '../types/operations';
import { displayDate } from '../components/fields';
import { formatPhone } from '../utils/format';
import { daysUntil } from '../utils/wallet';
import { describeDataError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';
import { useResponsive } from '../theme/responsive';

export function DriversScreen() {
  const { isDesktop, isCompact } = useResponsive();
  const { drivers, invites, vehicles } = useVendorData();
  const [assignFor, setAssignFor] = useState<FleetDriver | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const toggleFleetStatus = (d: FleetDriver) => {
    const next = d.fleetStatus === 'Suspended' ? 'Active' : 'Suspended';
    Alert.alert(next === 'Suspended' ? `Suspend ${d.name}?` : `Reactivate ${d.name}?`, next === 'Suspended' ? 'They will not be dispatched on your trips until reactivated.' : 'They can be dispatched on your trips again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: next === 'Suspended' ? 'Suspend' : 'Reactivate',
        style: next === 'Suspended' ? 'destructive' : 'default',
        onPress: () => {
          setDriverFleetStatus(d.id, next).catch((e: unknown) => setMessage({ tone: 'error', text: describeDataError(e) }));
        },
      },
    ]);
  };

  const revoke = (phone: string) =>
    Alert.alert('Revoke invite?', `${formatPhone(phone)} will no longer be linked to your fleet when they register.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => {
          revokeInvite(phone).catch((e: unknown) => setMessage({ tone: 'error', text: describeDataError(e) }));
        },
      },
    ]);

  const onlineDrivers = drivers.filter((d) => d.presenceStatus === 'Online').length;

  return (
    <Screen edges={[]}>
      <DesktopHeader
        title="Driver Management"
        subtitle={`${drivers.length} registered driver(s) · ${onlineDrivers} online right now`}
        badge={`${drivers.length} Drivers`}
        actions={
          <Button
            small
            title="+ Invite New Driver"
            onPress={() => setInviteOpen(true)}
          />
        }
      />

      {assignFor ? (
        <AssignSheet
          key={assignFor.id}
          driver={assignFor}
          onClose={() => setAssignFor(null)}
          onDone={(text) => {
            setAssignFor(null);
            setMessage({ tone: 'success', text });
          }}
        />
      ) : null}
      {inviteOpen ? (
        <InviteSheet
          onClose={() => setInviteOpen(false)}
          onDone={(text) => {
            setInviteOpen(false);
            setMessage({ tone: 'success', text });
          }}
        />
      ) : null}

      {isCompact ? (
        <Button title="+ Invite a driver" onPress={() => setInviteOpen(true)} style={{ marginBottom: space.md }} />
      ) : null}
      {message ? <Notice tone={message.tone} message={message.text} /> : null}

      <DesktopRow gap={24} style={styles.contentRow}>
        {/* Left Column: Drivers Roster */}
        <View style={[styles.mainCol, isDesktop && { flex: 1.4 }]}>
          <Text style={styles.sectionTitle}>Fleet Drivers ({drivers.length})</Text>
          {drivers.length === 0 ? (
            <EmptyState title="No drivers linked yet" message="Invite drivers by mobile number. They are linked to your fleet when they register in the NESAM Driver app." />
          ) : (
            drivers.map((d) => {
              const licenceDays = daysUntil(d.licenseExpiry);
              return (
                <Card key={d.id} style={styles.driverCard}>
                  <View style={styles.head}>
                    <Avatar name={d.name} photoUrl={d.photoUrl} size={48} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.driverName}>{d.name}</Text>
                      <Text style={styles.driverPhone}>
                        {formatPhone(d.phone)} · ★ {d.rating.toFixed(1)}
                      </Text>
                    </View>
                    <Badge label={d.approvalStatus} tone={d.approvalStatus === 'Approved' ? 'success' : d.approvalStatus === 'Rejected' ? 'danger' : 'warning'} />
                  </View>
                  <View style={styles.badges}>
                    <Badge label={d.presenceStatus} tone={d.presenceStatus === 'Online' ? 'success' : d.presenceStatus === 'On Trip' ? 'brand' : 'neutral'} />
                    {d.fleetStatus === 'Suspended' ? <Badge label="Suspended by you" tone="danger" /> : null}
                    {licenceDays != null && licenceDays < 0 ? <Badge label="Licence expired" tone="danger" /> : null}
                  </View>
                  <View style={styles.detailsBox}>
                    <Row label="Assigned Vehicle" value={d.assignedVehicleNumber || 'None'} bold={!!d.assignedVehicleNumber} />
                    <Row label="Licence Number" value={d.licenseNumber ? `${d.licenseNumber} · till ${displayDate(d.licenseExpiry) || '—'}` : '—'} />
                    <Row label="Document Verification" value={d.docStatus} />
                  </View>
                  <View style={styles.actions}>
                    <Button small variant="secondary" title="Assign vehicle" onPress={() => setAssignFor(d)} style={{ flex: 1 }} disabled={vehicles.length === 0} />
                    <Button small variant="ghost" title={d.fleetStatus === 'Suspended' ? 'Reactivate' : 'Suspend'} onPress={() => toggleFleetStatus(d)} />
                  </View>
                </Card>
              );
            })
          )}
        </View>

        {/* Right Column: Pending Invites */}
        <View style={[styles.sidebarCol, isDesktop && { flex: 1 }]}>
          <Text style={styles.sectionTitle}>Pending Invites ({invites.length})</Text>
          {invites.length === 0 ? (
            <Card style={styles.emptyInviteCard}>
              <Ionicons name="mail-unread-outline" size={32} color={colors.slate} />
              <Text style={styles.emptyInviteText}>No pending invites. Click "Invite New Driver" to add drivers to your fleet.</Text>
            </Card>
          ) : (
            invites.map((i) => (
              <View key={i.phone} style={styles.invite}>
                <Ionicons name="mail-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.invitePhone}>{formatPhone(i.phone)}</Text>
                  <Text style={styles.inviteMeta}>{i.vehicleAssignment ? `Vehicle: ${i.vehicleAssignment}` : 'No vehicle pre-assigned'}</Text>
                </View>
                <Pressable onPress={() => revoke(i.phone)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Revoke invite for ${i.phone}`}>
                  <Text style={styles.revoke}>Revoke</Text>
                </Pressable>
              </View>
            ))
          )}

          <Card style={styles.driverInfoCard}>
            <Text style={styles.driverInfoTitle}>How Driver Invites Work</Text>
            <Text style={styles.driverInfoText}>
              Invited drivers simply download the NESAM Driver app, sign up using the invited mobile number, and their profile is instantly linked to your fleet. All drivers undergo mandatory licence and background checks by NESAM.
            </Text>
          </Card>
        </View>
      </DesktopRow>
    </Screen>
  );
}

function AssignSheet({ driver, onClose, onDone }: { driver: FleetDriver; onClose: () => void; onDone: (text: string) => void }) {
  const { vehicles } = useVendorData();
  const [vehicleId, setVehicleId] = useState(driver.assignedVehicleId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const approved = vehicles.filter((v) => v.docStatus === 'Approved' && v.status !== 'Inactive');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
      await assignVehicle(driver, vehicle, vehicles);
      onDone(vehicle ? `${vehicle.vehicleNumber} assigned to ${driver.name}.` : `Vehicle unassigned from ${driver.name}.`);
    } catch (e) {
      setError(e instanceof VendorActionError ? e.message : describeDataError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible onClose={onClose} title={`Assign Vehicle · ${driver.name}`} dismissible={!busy}>
      {approved.length === 0 ? <Notice tone="info" message="No approved vehicles yet. Vehicles become assignable once NESAM approves their documents." /> : null}
      <View style={styles.chips}>
        <Chip label="None" active={!vehicleId} onPress={() => setVehicleId('')} />
        {approved.map((v) => (
          <Chip key={v.id} label={`${v.vehicleNumber}${v.assignedDriverId && v.assignedDriverId !== driver.id ? ` (${v.assignedDriverName})` : ''}`} active={vehicleId === v.id} onPress={() => setVehicleId(v.id)} />
        ))}
      </View>
      <Text style={[type.tiny, { marginBottom: space.md }]}>Choosing a vehicle already assigned to someone else moves it to {driver.name}.</Text>
      <Notice message={error} />
      <Button title={busy ? 'Saving…' : 'Save Assignment'} loading={busy} disabled={vehicleId === driver.assignedVehicleId} onPress={() => void save()} />
    </Sheet>
  );
}

function InviteSheet({ onClose, onDone }: { onClose: () => void; onDone: (text: string) => void }) {
  const { identity, vehicles } = useVendorData();
  const [mobile, setMobile] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await inviteDriver(identity, mobile, vehicle);
      onDone(`Invite sent for ${formatPhone(mobile)}. Ask them to sign up in the NESAM Driver app with this number.`);
    } catch (e) {
      setError(e instanceof VendorActionError ? e.message : describeDataError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible onClose={onClose} title="Invite Driver to Fleet" dismissible={!busy}>
      <Text style={[type.small, { marginBottom: space.md }]}>
        The driver signs up in the NESAM Driver app with this mobile number and is linked to your fleet automatically.
      </Text>
      <TextField label="Driver Mobile Number" required prefix="+91" value={mobile} onChangeText={(t) => setMobile(t.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" placeholder="98765 43210" />
      {vehicles.length ? (
        <>
          <Text style={[type.label, { marginBottom: 6 }]}>Pre-assigned Vehicle (optional)</Text>
          <View style={styles.chips}>
            <Chip label="None" active={!vehicle} onPress={() => setVehicle('')} />
            {vehicles.map((v) => (
              <Chip key={v.id} label={v.vehicleNumber} active={vehicle === v.vehicleNumber} onPress={() => setVehicle(v.vehicleNumber)} />
            ))}
          </View>
        </>
      ) : null}
      <Notice message={error} />
      <Button title={busy ? 'Sending Invite…' : 'Send Invitation'} loading={busy} onPress={() => void submit()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  contentRow: { alignItems: 'flex-start' },
  mainCol: { width: '100%' },
  sidebarCol: { width: '100%' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: space.sm },
  driverCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.md,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)' as any,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  driverName: { fontSize: 18, fontWeight: '800', color: colors.ink },
  driverPhone: { fontSize: 13, color: colors.slate, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginVertical: space.sm },
  detailsBox: { backgroundColor: '#F8FAFC', borderRadius: radius.md, padding: space.md, gap: 4, marginVertical: space.xs },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.sm },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.md,
    marginBottom: space.sm,
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)' as any,
  },
  invitePhone: { fontSize: 15, fontWeight: '800', color: colors.ink },
  inviteMeta: { fontSize: 12, color: colors.slate, marginTop: 2 },
  revoke: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  emptyInviteCard: { padding: space.xl, alignItems: 'center', textAlign: 'center', marginBottom: space.md, borderWidth: 1.5, borderColor: colors.border },
  emptyInviteText: { fontSize: 13, color: colors.slate, textAlign: 'center', marginTop: space.sm, lineHeight: 18 },
  driverInfoCard: { padding: space.lg, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#F8FAFC' },
  driverInfoTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  driverInfoText: { fontSize: 13, color: colors.slate, lineHeight: 18 },
});

// Driver profile (reference "My Profile"): identity, contact & payout account (editable), document status with expiry
// badges, help and sign-out. Validation and the save call are the app's existing ones.
import React, { useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/nx/Text';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useDriverData } from '../context/DriverData';
import { useSignOut } from '../navigation/MainNavigator';
import { NxScreen, useShell } from '../components/nx/Shell';
import { NxColumns } from '../components/nx/layout';
import { NxDialog } from '../components/nx/Dialog';
import { NxIcon } from '../components/nx/Icon';
import { NxBadge, NxButton, NxField, NxFormError, NxInfo, NxPanel, NxRow, NxSectionHeading, NxTextButton, nxText } from '../components/nx/primitives';
import { updateDriverContactDetails, type ContactFields } from '../services/driverService';
import { displayDate } from '../components/forms';
import { IFSC_RE, MOBILE_RE, UPI_RE } from '../validation/kyc';
import { initials } from '../utils/format';
import { describeError } from '../utils/retry';
import { nx } from '../theme/nx';

function expiryBadge(date: string) {
  if (!date) return null;
  const days = Math.floor((new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86400000);
  if (Number.isNaN(days)) return null;
  if (days < 0) return <NxBadge label="Expired" tone="red" />;
  if (days <= 30) return <NxBadge label={`Expires in ${days}d`} tone="amber" />;
  return null;
}

function DocRow({ label, url, expiry }: { label: string; url: string; expiry?: string }) {
  return (
    <Pressable style={styles.doc} disabled={!url} onPress={() => void Linking.openURL(url)} accessibilityRole="button" accessibilityLabel={`${label}${url ? '' : ', not uploaded'}`}>
      <NxIcon name="document" size={17} color={nx.muted} />
      <Text style={styles.docLabel} numberOfLines={2}>
        {label}
      </Text>
      {expiry ? expiryBadge(expiry) : null}
      {url ? <NxBadge label="Uploaded" tone="green" icon="check" /> : <NxBadge label="Not uploaded" tone="neutral" />}
    </Pressable>
  );
}

export function ProfileScreen() {
  const navigation = useNavigation();
  const signOut = useSignOut();
  const { openSupport } = useShell();
  const { account, completedTrips } = useDriverData();
  const { driver, identity, license, vehicle, bank } = account;
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You’ll need to verify your phone number again to sign back in.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);

  const docTone = driver.docStatus === 'Approved' ? 'green' : driver.docStatus === 'Rejected' ? 'red' : 'amber';

  return (
    <NxScreen>
      {driver.docStatus === 'Rejected' && driver.rejectionReason ? <NxInfo tone="amber" style={{ marginTop: 0, marginBottom: 16 }}>Document note from NESAM: {driver.rejectionReason}</NxInfo> : null}
      {saved ? <NxInfo style={{ marginTop: 0, marginBottom: 16 }}>Profile updated.</NxInfo> : null}

      <NxColumns>
      <NxPanel style={styles.identity}>
        {driver.photoUrl ? (
          <Image source={{ uri: driver.photoUrl }} style={styles.avatar} accessibilityLabel={driver.name} />
        ) : (
          <View style={styles.avatar} accessibilityElementsHidden>
            <Text style={styles.avatarText}>{initials(driver.name)}</Text>
          </View>
        )}
        <Text style={styles.name}>{driver.name}</Text>
        <Text style={nxText.copy}>{driver.vendorName ? `Fleet driver · ${driver.vendorName}` : 'Single vehicle owner / driver'}</Text>
        <View style={{ marginTop: 10 }}>
          <NxBadge label="Account approved" tone="green" icon="shield" />
        </View>
        <View style={styles.details}>
          <NxRow label="Mobile" value={driver.phone} />
          <NxRow label="Rating" value={driver.rating != null ? `★ ${driver.rating.toFixed(1)}` : 'No ratings yet'} />
          <NxRow label="Completed trips" value={String(completedTrips.length)} />
          {driver.joiningDate ? <NxRow label="Partner since" value={driver.joiningDate} /> : null}
          <NxRow label="Vehicle" value={[vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'} />
          <NxRow label="Registration" value={vehicle.vehicleNumber || '—'} />
          <NxRow label="Category" value={`${vehicle.vehicleType}${vehicle.capacity ? ` · ${vehicle.capacity} seats` : ''}${vehicle.fuelType ? ` · ${vehicle.fuelType}` : ''}`} />
        </View>
      </NxPanel>

      <NxPanel>
        <NxSectionHeading title="Contact & payout account" right={<NxTextButton title="Edit" icon="edit" onPress={() => setEditing(true)} />} />
        <NxRow label="Email" value={driver.email || '—'} />
        <NxRow label="Date of birth" value={displayDate(driver.dob) || '—'} />
        <NxRow label="Address" value={[driver.address, driver.city, driver.pincode].filter(Boolean).join(', ') || '—'} />
        <NxRow label="Emergency contact" value={driver.emergencyContact ? `${driver.emergencyContactName} (${driver.emergencyContact})` : '—'} />
        <NxRow label="Account holder" value={bank.accountHolder || '—'} />
        <NxRow label="Account no." value={bank.accountNumber ? `••••${bank.accountNumber.slice(-4)}` : '—'} />
        <NxRow label="IFSC" value={bank.ifsc || '—'} />
        <NxRow label="UPI" value={bank.upiId || '—'} />
      </NxPanel>

      <NxPanel>
        <NxSectionHeading title="Licence & ID" />
        <NxRow label="Licence no." value={license.number || '—'} />
        <NxRow label="Licence valid till" value={displayDate(license.expiryDate) || '—'} />
        <NxRow label="Aadhaar" value={identity.aadhaarNumber ? `XXXX XXXX ${identity.aadhaarNumber.slice(-4)}` : '—'} />
        <NxRow label="PAN" value={identity.panNumber || '—'} />
        <NxRow label="Colour" value={vehicle.color || '—'} />
      </NxPanel>

      <NxPanel>
        <NxSectionHeading title="Document verification" caption="Your licence and vehicle papers" right={<NxBadge label={driver.docStatus} tone={docTone} />} />
        <DocRow label="Driving licence (front)" url={license.frontPhotoUrl} expiry={license.expiryDate} />
        <DocRow label="Driving licence (back)" url={license.backPhotoUrl} />
        <DocRow label="Aadhaar (front)" url={identity.aadhaarFrontUrl} />
        <DocRow label="Aadhaar (back)" url={identity.aadhaarBackUrl} />
        <DocRow label="PAN" url={identity.panPhotoUrl} />
        <DocRow label="Registration certificate (RC)" url={vehicle.rcDocUrl} />
        <DocRow label="Vehicle insurance" url={vehicle.insuranceDocUrl} expiry={vehicle.insuranceExpiry} />
        <DocRow label="Vehicle permit" url={vehicle.statePermitDocUrl} expiry={vehicle.permitExpiry} />
        <DocRow label="Fitness certificate (FC)" url={vehicle.fitnessDocUrl} expiry={vehicle.fitnessExpiry} />
        <DocRow label="Vehicle photo · front" url={vehicle.frontPhotoUrl} />
        <DocRow label="Vehicle photo · rear" url={vehicle.rearPhotoUrl} />
        <DocRow label="Vehicle photo · side" url={vehicle.sidePhotoUrl} />
        <DocRow label="Vehicle photo · interior" url={vehicle.interiorPhotoUrl} />
        <NxButton title="Update documents" trailingIcon="arrow" onPress={() => navigation.navigate('UpdateDocuments')} style={{ marginTop: 18 }} />
      </NxPanel>

      <NxPanel>
        <NxSectionHeading title="Help" right={<NxIcon name="help" size={20} color={nx.ink} />} />
        <View style={{ gap: 14 }}>
          <NxTextButton title="Help & SOS" icon="help" onPress={() => openSupport()} />
          <NxTextButton title="Sign out" icon="logout" onPress={confirmSignOut} />
        </View>
        <Text style={[nxText.small, { marginTop: 16 }]}>NESAM Driver v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </NxPanel>

      </NxColumns>

      {editing ? (
        <ContactDialog
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setSaved(true);
          }}
        />
      ) : null}
    </NxScreen>
  );
}

function ContactDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { account } = useDriverData();
  const { driver, bank } = account;
  const [form, setForm] = useState<ContactFields>({
    email: driver.email,
    address: driver.address,
    city: driver.city,
    pincode: driver.pincode,
    emergencyContactName: driver.emergencyContactName,
    emergencyContact: driver.emergencyContact,
    bank: { ...bank },
  });
  const [confirm, setConfirm] = useState(bank.accountNumber);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<ContactFields>) => setForm((f) => ({ ...f, ...patch }));
  const setBank = (patch: Partial<ContactFields['bank']>) => setForm((f) => ({ ...f, bank: { ...f.bank, ...patch } }));

  const save = async () => {
    if (form.email && !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(form.email.trim())) return setError('Invalid email.');
    if (!form.address.trim() || !form.city.trim()) return setError('Enter your address and city.');
    if (!/^[1-9]\d{5}$/.test(form.pincode)) return setError('Enter a 6-digit pincode.');
    if (!form.emergencyContactName.trim()) return setError('Enter the emergency contact name.');
    if (!MOBILE_RE.test(form.emergencyContact)) return setError('Enter a valid emergency contact number.');
    if (!form.bank.accountHolder.trim()) return setError('Enter the account holder name.');
    if (!/^\d{9,18}$/.test(form.bank.accountNumber)) return setError('Enter a valid bank account number.');
    if (confirm !== form.bank.accountNumber) return setError('Account numbers do not match.');
    if (!IFSC_RE.test(form.bank.ifsc.toUpperCase())) return setError('Invalid IFSC code.');
    if (form.bank.upiId && !UPI_RE.test(form.bank.upiId)) return setError('Invalid UPI ID.');
    setSaving(true);
    setError('');
    try {
      await updateDriverContactDetails(driver.id, {
        ...form,
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        emergencyContactName: form.emergencyContactName.trim(),
        bank: { ...form.bank, ifsc: form.bank.ifsc.toUpperCase(), accountHolder: form.bank.accountHolder.trim() },
      });
      onSaved();
    } catch (e) {
      setError(describeError(e, 'Could not save your changes.'));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <NxDialog visible onClose={onClose} eyebrow="PROFILE" title="Edit contact & payout account" locked={saving}>
      <NxField label="Email" value={form.email} onChangeText={(t) => set({ email: t })} keyboardType="email-address" autoCapitalize="none" style={{ marginTop: 0 }} />
      <NxField label="Address" value={form.address} onChangeText={(t) => set({ address: t })} multiline />
      <NxField label="City" value={form.city} onChangeText={(t) => set({ city: t })} />
      <NxField label="Pincode" value={form.pincode} onChangeText={(t) => set({ pincode: t.replace(/\D/g, '').slice(0, 6) })} keyboardType="number-pad" />
      <NxField label="Emergency contact name" value={form.emergencyContactName} onChangeText={(t) => set({ emergencyContactName: t })} />
      <NxField label="Emergency mobile" value={form.emergencyContact} onChangeText={(t) => set({ emergencyContact: t.replace(/\D/g, '').slice(0, 10) })} keyboardType="phone-pad" />
      <Text style={[nxText.heading, { fontSize: 14, marginTop: 22 }]}>Bank account</Text>
      <NxField label="Account holder" value={form.bank.accountHolder} onChangeText={(t) => setBank({ accountHolder: t })} />
      <NxField label="Account number" value={form.bank.accountNumber} onChangeText={(t) => setBank({ accountNumber: t.replace(/\D/g, '').slice(0, 18) })} keyboardType="number-pad" secureTextEntry />
      <NxField label="Confirm account number" value={confirm} onChangeText={(t) => setConfirm(t.replace(/\D/g, '').slice(0, 18))} keyboardType="number-pad" contextMenuHidden />
      <NxField label="IFSC" value={form.bank.ifsc} onChangeText={(t) => setBank({ ifsc: t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11) })} autoCapitalize="characters" />
      <NxField label="Bank name" value={form.bank.bankName} onChangeText={(t) => setBank({ bankName: t })} />
      <NxField label="UPI ID" value={form.bank.upiId} onChangeText={(t) => setBank({ upiId: t.trim() })} autoCapitalize="none" />
      <NxFormError message={error} />
      <NxButton title={saving ? 'Saving…' : 'Save changes'} trailingIcon="check" loading={saving} onPress={() => void save()} style={{ marginTop: 14 }} />
    </NxDialog>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', paddingTop: 24 },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: nx.redSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarText: { fontSize: 24, fontWeight: '800', color: nx.red },
  name: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, color: nx.ink, marginBottom: 4 },
  details: { alignSelf: 'stretch', marginTop: 18 },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: nx.line },
  docLabel: { flex: 1, fontSize: 12, color: nx.ink },
});

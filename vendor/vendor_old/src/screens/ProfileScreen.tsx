// Business profile. Approved vendors may update contact details only (email,
// alternate phone, address) — legal names and bank details stay fixed
// (firestore.rules), matching updateApprovedContactInfo on the Web.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useVendorData } from '../context/VendorData';
import { Button, Card, Notice, Row, Screen, TextField } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { DesktopRow } from '../components/layout';
import { SelectField } from '../components/SelectField';
import { updateApprovedContactInfo } from '../services/onboardingService';
import { INDIAN_STATES } from '../config/onboarding';
import { digitsOnly, hasErrors, normalizeSpaces, validateAltPhone, validateEmail, validatePincode, validateRequired } from '../utils/validation';
import { formatPhone } from '../utils/format';
import { describeDataError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';
import { useResponsive } from '../theme/responsive';

export function ProfileScreen() {
  const { isDesktop } = useResponsive();
  const navigation = useNavigation();
  const { record, profile } = useVendorData();
  const b = record.business;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    email: b?.email ?? '',
    altPhone: b?.altPhone ?? '',
    line1: b?.address.line1 ?? '',
    line2: b?.address.line2 ?? '',
    city: b?.address.city ?? '',
    state: b?.address.state ?? '',
    pincode: b?.address.pincode ?? '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const errors = {
    email: validateEmail(form.email),
    altPhone: validateAltPhone(form.altPhone, record.phone),
    line1: validateRequired(form.line1, 'Address line 1', 150),
    city: validateRequired(form.city, 'City', 60),
    state: form.state ? '' : 'Select a state.',
    pincode: validatePincode(form.pincode),
  };
  const err = (k: keyof typeof errors) => (submitted ? errors[k] : '');

  const save = async () => {
    setSubmitted(true);
    if (!b || hasErrors(errors) || busy) return;
    setBusy(true);
    setError('');
    try {
      await updateApprovedContactInfo(b, {
        email: form.email.trim().toLowerCase(),
        altPhone: digitsOnly(form.altPhone),
        address: { line1: normalizeSpaces(form.line1), line2: normalizeSpaces(form.line2), city: normalizeSpaces(form.city), state: form.state, pincode: form.pincode.trim() },
      });
      setEditing(false);
      setSaved(true);
    } catch (e) {
      setError(describeDataError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <DesktopHeader
        title="Business Profile"
        subtitle="Manage registered partner details, fleet capacity, and authorized contact info"
        onBack={() => navigation.goBack()}
      />

      <View style={[styles.container, isDesktop && styles.desktopContainer]}>
        {saved ? <Notice tone="success" message="Contact details successfully updated." /> : null}

        <DesktopRow gap={24} style={styles.contentRow}>
          {/* Left Column: Registered Enterprise Identity */}
          <View style={[styles.mainCol, isDesktop && { flex: 1 }]}>
            <Card style={styles.profileCard}>
              <Text style={styles.cardTitle}>Registered Enterprise</Text>
              <View style={styles.rowsBox}>
                <Row label="Business Name" value={profile.companyName} bold />
                <Row label="Owner / Authorised Person" value={profile.contactPerson} />
                <Row label="Registered Mobile" value={formatPhone(profile.phone)} />
                <Row label="GSTIN" value={profile.gstin || 'Unregistered'} />
                <Row label="Fleet Size (Declared)" value={`${profile.totalFleetSize} Vehicles`} />
                <Row label="Platform Commission" value={`${Math.round(profile.commissionRate * 100)}%`} />
              </View>
              <Text style={styles.legalNote}>Official company names and bank details can only be amended by NESAM partner support.</Text>
            </Card>
          </View>

          {/* Right Column: Contact & Address Information */}
          <View style={[styles.sidebarCol, isDesktop && { flex: 1.2 }]}>
            <Card style={styles.profileCard}>
              <Text style={styles.cardTitle}>Contact Coordinates</Text>
              {editing ? (
                <View style={{ marginTop: space.sm }}>
                  <TextField label="Official Email" required value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" error={err('email')} />
                  <TextField label="Alternate Contact Number" prefix="+91" value={form.altPhone} onChangeText={(v) => set('altPhone')(digitsOnly(v).slice(0, 10))} keyboardType="phone-pad" error={err('altPhone')} />
                  <TextField label="Address Line 1" required value={form.line1} onChangeText={set('line1')} error={err('line1')} />
                  <TextField label="Address Line 2 (Optional)" value={form.line2} onChangeText={set('line2')} />
                  <View style={styles.rowGrid}>
                    <TextField label="City" required value={form.city} onChangeText={set('city')} error={err('city')} style={{ flex: 1 }} />
                    <TextField label="PIN Code" required value={form.pincode} onChangeText={(v) => set('pincode')(digitsOnly(v).slice(0, 6))} keyboardType="number-pad" error={err('pincode')} style={{ width: 120 }} />
                  </View>
                  <SelectField label="State / Union Territory" required value={form.state} onChange={set('state')} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} error={err('state')} />
                  <Notice message={error} />
                  <View style={styles.btnRow}>
                    <Button title="Cancel" variant="ghost" disabled={busy} onPress={() => setEditing(false)} style={{ flex: 1 }} />
                    <Button title={busy ? 'Saving…' : 'Save Changes'} loading={busy} onPress={() => void save()} style={{ flex: 1 }} />
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: space.sm }}>
                  <View style={styles.rowsBox}>
                    <Row label="Contact Email" value={b?.email || '—'} />
                    <Row label="Alternate Number" value={b?.altPhone ? `+91 ${b.altPhone}` : '—'} />
                    <Row label="Registered Address" value={b ? [b.address.line1, b.address.line2, b.address.city, `${b.address.state} ${b.address.pincode}`].filter(Boolean).join(', ') : '—'} />
                  </View>
                  <Button
                    title="Edit Contact Details"
                    variant="secondary"
                    onPress={() => {
                      setSaved(false);
                      setEditing(true);
                    }}
                    style={{ marginTop: space.md }}
                  />
                </View>
              )}
            </Card>
          </View>
        </DesktopRow>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  desktopContainer: { maxWidth: 1000, width: '100%', alignSelf: 'center', marginTop: space.sm },
  contentRow: { alignItems: 'flex-start' },
  mainCol: { width: '100%' },
  sidebarCol: { width: '100%' },
  profileCard: {
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)' as any,
    marginBottom: space.md,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: space.sm },
  rowsBox: { gap: 6 },
  legalNote: { fontSize: 12, color: colors.muted, marginTop: space.md, lineHeight: 16 },
  rowGrid: { flexDirection: 'row', gap: space.md },
  btnRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
});

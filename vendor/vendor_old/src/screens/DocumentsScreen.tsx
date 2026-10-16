// Company documents + fleet compliance (native port of vendor/web
// DocumentsVerificationScreen.tsx). Stored onboarding files are opened via
// short-lived download URLs resolved on demand (storage.rules stay in charge).
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useVendorData } from '../context/VendorData';
import { Badge, Card, EmptyState, Notice, Screen } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { DesktopRow } from '../components/layout';
import { resolveFileUrl } from '../services/storageService';
import { BUSINESS_REG_TYPES, IDENTITY_PROOF_TYPES } from '../config/onboarding';
import { EXPIRY_WARNING_DAYS } from '../config/constants';
import type { StoredFile } from '../types/vendor';
import { daysUntil } from '../utils/wallet';
import { displayDate } from '../components/fields';
import { describeDataError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';
import { useResponsive } from '../theme/responsive';

function FileRow({ file, onError }: { file: StoredFile; onError: (msg: string) => void }) {
  const [opening, setOpening] = useState(false);
  const open = async () => {
    setOpening(true);
    try {
      await Linking.openURL(await resolveFileUrl(file.path));
    } catch (e) {
      onError(describeDataError(e));
    } finally {
      setOpening(false);
    }
  };
  return (
    <Pressable
      style={({ pressed, hovered }: any) => [
        styles.file,
        hovered && { backgroundColor: '#F8FAFC', borderColor: colors.primary },
        pressed && { opacity: 0.8 },
      ]}
      onPress={() => void open()}
      disabled={opening}
      accessibilityRole="button"
      accessibilityLabel={`Open ${file.name}`}
    >
      <Ionicons name={file.contentType === 'application/pdf' ? 'document-text-outline' : 'image-outline'} size={20} color={colors.primary} />
      <Text style={styles.fileName} numberOfLines={1}>
        {file.name}
      </Text>
      <Text style={styles.open}>{opening ? 'Opening…' : 'View File →'}</Text>
    </Pressable>
  );
}

export function DocumentsScreen() {
  const { isDesktop } = useResponsive();
  const navigation = useNavigation();
  const { record, vehicles } = useVendorData();
  const [error, setError] = useState('');
  const d = record.documents;
  const f = record.fleet;

  const compliance = useMemo(
    () =>
      vehicles
        .flatMap((v) =>
          (
            [
              ['Insurance', v.insuranceExpiry],
              ['Permit', v.permitExpiry],
              ['Fitness (FC)', v.fitnessExpiry],
            ] as const
          ).map(([label, date]) => ({ key: `${v.id}-${label}`, vehicle: v.vehicleNumber, label, date, days: daysUntil(date) })),
        )
        .filter((x) => x.days != null)
        .sort((a, b) => (a.days ?? 0) - (b.days ?? 0)),
    [vehicles],
  );

  const group = (title: string, files: StoredFile[] | undefined, sub?: string) => (
    <Card style={styles.docGroupCard}>
      <Text style={styles.groupTitle}>{title}</Text>
      {sub ? <Text style={styles.groupSub}>Registration / Policy No: {sub}</Text> : null}
      <View style={{ gap: 6, marginTop: space.sm }}>
        {files?.length ? files.map((file) => <FileRow key={file.path} file={file} onError={setError} />) : <Text style={type.small}>No documents uploaded.</Text>}
      </View>
    </Card>
  );

  return (
    <Screen edges={[]}>
      <DesktopHeader
        title="Documents & Compliance"
        subtitle="Manage fleet regulatory compliance, vehicle certificates, and business registration files"
        onBack={() => navigation.goBack()}
      />

      <View style={[styles.container, isDesktop && styles.desktopContainer]}>
        <Notice message={error} />
        <Notice
          tone="info"
          message="Your business application documents are locked after approval. To update bank or PAN records, contact NESAM partner support. Vehicle documents can be refreshed from Fleet."
        />

        <DesktopRow gap={24} style={styles.contentRow}>
          {/* Left Column: Fleet Compliance Tracker */}
          <View style={[styles.mainCol, isDesktop && { flex: 1.2 }]}>
            <Text style={styles.sectionTitle}>Fleet Compliance & Expiry Tracker</Text>
            {compliance.length === 0 ? (
              <EmptyState title="No vehicle expiry dates yet" message="Add vehicles with insurance and permit dates in the Fleet tab." />
            ) : (
              compliance.map((c) => (
                <View key={c.key} style={styles.complianceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.complianceVehicle}>{c.vehicle}</Text>
                    <Text style={styles.complianceMeta}>
                      {c.label} · Valid till {displayDate(c.date)}
                    </Text>
                  </View>
                  <Badge
                    label={(c.days ?? 0) < 0 ? 'Expired' : (c.days ?? 0) <= EXPIRY_WARNING_DAYS ? `${c.days} days left` : 'Valid'}
                    tone={(c.days ?? 0) < 0 ? 'danger' : (c.days ?? 0) <= EXPIRY_WARNING_DAYS ? 'warning' : 'success'}
                  />
                </View>
              ))
            )}
          </View>

          {/* Right Column: Application Documents */}
          <View style={[styles.sidebarCol, isDesktop && { flex: 1 }]}>
            <Text style={styles.sectionTitle}>Business Application Files</Text>
            {d ? group(BUSINESS_REG_TYPES.find((t) => t.value === d.businessRegistration.type)?.label ?? 'Business Registration', d.businessRegistration.files, d.businessRegistration.number) : null}
            {d ? group(IDENTITY_PROOF_TYPES.find((t) => t.value === d.identityProof.type)?.label ?? 'Identity Proof', d.identityProof.files, d.identityProof.maskedNumber) : null}
            {group('Vehicle RCs (Onboarding)', f?.rcFiles)}
            {group('Insurance Policies (Onboarding)', f?.insuranceFiles)}
          </View>
        </DesktopRow>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  desktopContainer: { maxWidth: 1040, width: '100%', alignSelf: 'center', marginTop: space.sm },
  contentRow: { alignItems: 'flex-start' },
  mainCol: { width: '100%' },
  sidebarCol: { width: '100%' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: space.sm },
  complianceRow: {
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
  complianceVehicle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  complianceMeta: { fontSize: 13, color: colors.slate, marginTop: 2 },
  docGroupCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.md,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)' as any,
  },
  groupTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  groupSub: { fontSize: 13, color: colors.slate, marginTop: 2 },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.sm,
  },
  fileName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  open: { fontSize: 13, fontWeight: '700', color: colors.primary },
});

// My Account: profile, refund credits, preferences, payments & support, privacy.
import React, { useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useCustomerData } from '../context/CustomerData';
import { Notice, Screen } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { DesktopRow } from '../components/layout';
import { choosePhotoSource } from '../components/photoSource';
import { PickerError, pickImage, uploadProfilePhoto } from '../services/storageService';
import { updateCustomerProfile } from '../services/userService';
import { signOutUser } from '../services/authService';
import { COMPANY_LEGAL_NAME, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { formatINR, formatPhone, initials } from '../utils/format';
import { describeError } from '../utils/retry';
import { colors, radius, space } from '../theme';
import { useResponsive } from '../theme/responsive';

function Item({ icon, label, value, onPress, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress?: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed, hovered }: any) => [
        styles.item,
        !last && styles.itemLine,
        hovered && onPress && { backgroundColor: '#F8FAFC' },
        pressed && onPress && { opacity: 0.8 },
      ]}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      <Ionicons name={icon} size={24} color={colors.ink} />
      <Text style={styles.itemLabel}>{label}</Text>
      {value ? (
        <Text style={styles.itemValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={20} color={colors.slate} /> : null}
    </Pressable>
  );
}

export function AccountScreen() {
  const { isDesktop, isCompact } = useResponsive();
  const navigation = useNavigation();
  const { profile } = useCustomerData();
  const [photoBusy, setPhotoBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  const changePhoto = async () => {
    const source = await choosePhotoSource();
    if (!source) return;
    setError('');
    try {
      const asset = await pickImage(source);
      if (!asset) return;
      setPhotoBusy(0);
      const url = await uploadProfilePhoto(profile.uid, asset, setPhotoBusy);
      await updateCustomerProfile(profile.uid, { photoUrl: url });
    } catch (e) {
      setError(e instanceof PickerError ? e.message : describeError(e, 'Couldn’t update your photo.'));
    } finally {
      setPhotoBusy(null);
    }
  };

  const logout = () =>
    Alert.alert('Log out?', 'You’ll need to verify your phone number again to sign back in.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          signOutUser().catch(() => setError('Couldn’t log out. Please try again.'));
        },
      },
    ]);

  return (
    <Screen bg={colors.page} edges={['top']}>
      <DesktopHeader
        title="My Account"
        subtitle="Manage rider profile, preferences, refund balance and support"
        badge="Active Passenger"
      />

      {isCompact ? (
        <Text style={styles.title} accessibilityRole="header">
          My Account
        </Text>
      ) : null}

      <Notice message={error} />

      <DesktopRow gap={24} style={styles.contentRow}>
        {/* Left Column: Rider Identity Card & Wallet Credits */}
        <View style={[styles.mainCol, isDesktop && { flex: 1 }]}>
          <View style={[styles.card, styles.profile]}>
            <Pressable onPress={() => void changePhoto()} disabled={photoBusy != null} accessibilityRole="button" accessibilityLabel="Change profile photo">
              {profile.photoUrl ? (
                <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.initials]}>
                  <Text style={styles.initialsText}>{initials(profile.name)}</Text>
                </View>
              )}
              <View style={styles.camBadge}>
                <Ionicons name={photoBusy != null ? 'cloud-upload-outline' : 'camera'} size={14} color={colors.ink} />
              </View>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {profile.name}
              </Text>
              <Text style={styles.phone}>{formatPhone(profile.phone)}</Text>
              {profile.email ? <Text style={styles.email} numberOfLines={1}>{profile.email}</Text> : null}
              <Text style={styles.manage}>{photoBusy != null ? `Uploading photo… ${photoBusy}%` : 'Customer ID: verified'}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed, hovered }: any) => [
              styles.card,
              styles.wallet,
              hovered && { borderColor: colors.primary },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => navigation.navigate('PaymentHistory')}
            accessibilityRole="button"
            accessibilityLabel={`Refund credits ${formatINR(profile.walletBalance)}. Open history`}
          >
            <Ionicons name="wallet-outline" size={36} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.walletLabel}>Refund Credits</Text>
              <Text style={styles.walletValue}>{formatINR(profile.walletBalance)}</Text>
            </View>
            <Text style={styles.history}>View Ledger</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.slate} />
          </Pressable>

          {isDesktop ? (
            <View style={styles.desktopInfoCard}>
              <Text style={styles.desktopInfoTitle}>Emergency & Safety</Text>
              <Text style={styles.desktopInfoText}>
                {profile.emergencyContact ? `Emergency Contact: ${profile.emergencyContact}` : 'No emergency contact set. Add one for rapid SOS alerts during trips.'}
              </Text>
            </View>
          ) : null}

          <Pressable onPress={logout} style={styles.logout} accessibilityRole="button">
            <Ionicons name="log-out-outline" size={20} color={colors.primary} />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
          <Text style={styles.footer}>{COMPANY_LEGAL_NAME}</Text>
          <Text style={styles.version}>Customer App v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>

        {/* Right Column: Settings, Preferences, Support, Legal */}
        <View style={[styles.sidebarCol, isDesktop && { flex: 1.2 }]}>
          <Text style={styles.section}>PROFILE & PREFERENCES</Text>
          <View style={styles.card0}>
            <Item icon="person-outline" label="Edit Profile & Details" onPress={() => navigation.navigate('EditProfile')} />
            <Item icon="bookmark-outline" label="Saved Places (Home & Work)" onPress={() => navigation.navigate('SavedPlaces')} />
            <Item icon="language-outline" label="App Language" value={profile.language || 'English'} last />
          </View>

          <Text style={styles.section}>PAYMENTS & SUPPORT</Text>
          <View style={styles.card0}>
            <Item icon="card-outline" label="Payment & Refund History" onPress={() => navigation.navigate('PaymentHistory')} />
            <Item icon="help-circle-outline" label="Help, FAQs & Support Tickets" onPress={() => navigation.navigate('Support')} />
            <Item icon="call-outline" label={`Call Helpline ${SUPPORT_PHONE_DISPLAY}`} onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} last />
          </View>

          <Text style={styles.section}>LEGAL & POLICIES</Text>
          <View style={styles.card0}>
            <Item icon="shield-checkmark-outline" label="Terms of Service & Privacy Policy" onPress={() => navigation.navigate('LegalDocuments')} last />
          </View>
        </View>
      </DesktopRow>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: '900', color: colors.ink, marginBottom: space.lg },
  contentRow: { alignItems: 'flex-start' },
  mainCol: { width: '100%' },
  sidebarCol: { width: '100%' },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: space.lg,
    marginBottom: space.md,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)' as any,
  },
  card0: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
    marginBottom: space.md,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)' as any,
  },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  initials: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontSize: 28, fontWeight: '800', color: colors.primary },
  camBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 20, fontWeight: '800', color: colors.ink },
  phone: { fontSize: 14, color: colors.slate, marginTop: 2 },
  email: { fontSize: 13, color: colors.slate, marginTop: 1 },
  manage: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 4 },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  walletLabel: { fontSize: 14, color: colors.slate },
  walletValue: { fontSize: 26, fontWeight: '900', color: colors.success },
  history: { fontSize: 15, fontWeight: '800', color: colors.primary },
  desktopInfoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.md,
  },
  desktopInfoTitle: { fontSize: 14, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  desktopInfoText: { fontSize: 13, color: colors.slate, lineHeight: 18 },
  section: { fontSize: 13, fontWeight: '800', color: colors.slate, letterSpacing: 0.6, marginTop: space.md, marginBottom: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg, minHeight: 56 },
  itemLine: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  itemLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.ink },
  itemValue: { fontSize: 15, color: colors.slate, maxWidth: '45%' },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, minHeight: 48, marginTop: space.md },
  logoutText: { color: colors.primary, fontWeight: '800', fontSize: 17 },
  footer: { textAlign: 'center', fontSize: 13, color: colors.slate, marginTop: space.sm },
  version: { textAlign: 'center', fontSize: 12, color: colors.muted, marginTop: 2 },
});

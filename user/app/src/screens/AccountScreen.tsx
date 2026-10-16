import React, { useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useCustomerData } from '../context/CustomerData';
import { Notice } from '../components/ui';
import { choosePhotoSource } from '../components/photoSource';
import { PickerError, pickImage, uploadProfilePhoto } from '../services/storageService';
import { updateCustomerProfile } from '../services/userService';
import { signOutUser } from '../services/authService';
import { COMPANY_LEGAL_NAME, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { formatINR, formatPhone, initials } from '../utils/format';
import { describeError } from '../utils/retry';
import { colors, fonts, radius, space } from '../theme';

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
      <Ionicons name={icon} size={22} color={colors.ink} />
      <Text style={styles.itemLabel}>{label}</Text>
      {value ? (
        <Text style={styles.itemValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.slate} /> : null}
    </Pressable>
  );
}

export function AccountScreen() {
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
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Mobile Top Header */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Account & Settings</Text>
          <Text style={styles.subtitle}>Manage profile, refunds, preferences & help</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        <Notice message={error} />

        <View style={styles.mainCol}>
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
                <Ionicons name={photoBusy != null ? 'cloud-upload-outline' : 'camera'} size={13} color={colors.ink} />
              </View>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {profile.name}
              </Text>
              <Text style={styles.phone}>{formatPhone(profile.phone)}</Text>
              {profile.email ? <Text style={styles.email} numberOfLines={1}>{profile.email}</Text> : null}
              <Text style={styles.manage}>{photoBusy != null ? `Uploading photo… ${photoBusy}%` : 'Customer ID: Verified'}</Text>
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
            <Ionicons name="wallet-outline" size={32} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.walletLabel}>Refund Credits</Text>
              <Text style={styles.walletValue}>{formatINR(profile.walletBalance)}</Text>
            </View>
            <Text style={styles.history}>View Ledger</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.slate} />
          </Pressable>

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

          <Pressable onPress={logout} style={styles.logout} accessibilityRole="button">
            <Ionicons name="log-out-outline" size={18} color={colors.primary} />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
          <Text style={styles.footer}>{COMPANY_LEGAL_NAME}</Text>
          <Text style={styles.version}>Customer App v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 12, color: colors.slate, marginTop: 1 },
  scrollPad: { padding: space.md, paddingBottom: space.xxl },
  mainCol: { width: '100%' },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
    padding: space.md,
    marginBottom: space.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  card0: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
    overflow: 'hidden',
    marginBottom: space.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  initials: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontFamily: fonts.bold, fontSize: 24, color: colors.primary },
  camBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  phone: { fontFamily: fonts.regular, fontSize: 13, color: colors.slate, marginTop: 2 },
  email: { fontFamily: fonts.regular, fontSize: 12, color: colors.slate, marginTop: 1 },
  manage: { fontFamily: fonts.medium, fontSize: 11, color: colors.primary, marginTop: 3 },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  walletLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.slate },
  walletValue: { fontFamily: fonts.bold, fontSize: 24, color: colors.success, marginTop: 1 },
  history: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  section: { fontFamily: fonts.bold, fontSize: 11, color: colors.slate, letterSpacing: 0.8, marginTop: space.sm, marginBottom: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, minHeight: 52 },
  itemLine: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  itemLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  itemValue: { fontFamily: fonts.regular, fontSize: 13, color: colors.slate, maxWidth: '45%' },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minHeight: 44, marginTop: space.md },
  logoutText: { fontFamily: fonts.bold, color: colors.primary, fontSize: 15 },
  footer: { fontFamily: fonts.medium, textAlign: 'center', fontSize: 12, color: colors.slate, marginTop: space.sm },
  version: { fontFamily: fonts.regular, textAlign: 'center', fontSize: 11, color: colors.muted, marginTop: 2 },
});

// Account hub in the reference layout: person header, grouped menu rows with counts,
// and sign out. Every pre-existing destination (profile, saved places, payments,
// support, offers, legal) stays reachable.
import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useCustomerData } from '../context/CustomerData';
import { Notice, MenuGroup, MenuRow, PageHead } from '../components/ui';
import { ScrollView } from '../components/layout';
import { AppHeader } from '../components/brand';
import { Icon } from '../components/Icon';
import { choosePhotoSource } from '../components/photoSource';
import { PickerError, pickImage, uploadProfilePhoto } from '../services/storageService';
import { updateCustomerProfile } from '../services/userService';
import { signOutUser } from '../services/authService';
import { isActiveStatus } from '../services/rideService';
import { formatINR, formatPhone, initials } from '../utils/format';
import { describeError } from '../utils/retry';
import { colors, fonts, space } from '../theme';

export function AccountScreen() {
  const navigation = useNavigation();
  const { profile, trips } = useCustomerData();
  const [photoBusy, setPhotoBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const upcoming = useMemo(() => trips.filter((t) => isActiveStatus(t.status)).length, [trips]);

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
    Alert.alert('Sign out?', 'You’ll need to verify your phone number again to sign back in.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          signOutUser().catch(() => setError('Couldn’t sign out. Please try again.'));
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AppHeader />
      <ScrollView kind="narrow" contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <PageHead title="Account" subtitle="Everything for your journey." onBack={() => navigation.navigate('Tabs', { screen: 'Book' })} />
        <Notice message={error} />

        <View style={styles.person}>
          <Pressable onPress={() => void changePhoto()} disabled={photoBusy != null} accessibilityRole="button" accessibilityLabel="Change profile photo">
            {profile.photoUrl ? (
              <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.initials]}>
                <Text style={styles.initialsText}>{initials(profile.name)}</Text>
              </View>
            )}
            <View style={styles.camBadge}>
              <Icon name="camera" size={12} color="#6B7482" />
            </View>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.name}
            </Text>
            <Text style={styles.phone}>{formatPhone(profile.phone)}</Text>
            {photoBusy != null ? <Text style={styles.uploading}>Uploading photo… {photoBusy}%</Text> : null}
          </View>
        </View>

        <MenuGroup>
          <MenuRow icon="tickets" title="My Bookings" subtitle="Upcoming, ongoing & past trips" count={upcoming} onPress={() => navigation.navigate('Tabs', { screen: 'Trips' })} />
          <MenuRow
            icon="wallet"
            title="Payments & Refunds"
            subtitle={profile.walletBalance > 0 ? `Refund credits ${formatINR(profile.walletBalance)}` : 'Transactions, balances & refunds'}
            onPress={() => navigation.navigate('PaymentHistory')}
          />
        </MenuGroup>

        <MenuGroup>
          <MenuRow icon="user-round" title="My Profile" subtitle="Personal details & contact information" onPress={() => navigation.navigate('EditProfile')} />
          <MenuRow icon="map-pin" title="Saved addresses" subtitle="Your regular pickup & drop places" onPress={() => navigation.navigate('SavedPlaces')} />
          <MenuRow icon="headphones" title="Help & Support" subtitle="Get help with your journey" onPress={() => navigation.navigate('Support')} />
        </MenuGroup>

        <MenuGroup>
          <MenuRow icon="bell" title="Notifications & updates" subtitle="Booking and payment updates" onPress={() => navigation.navigate('Tabs', { screen: 'Alerts' })} />
          <MenuRow icon="tag" title="Offers & coupons" subtitle="Discounts you can use on a booking" onPress={() => navigation.navigate('Offers')} />
          <MenuRow icon="file-text" title="Terms & privacy" subtitle="Agreements and policies" onPress={() => navigation.navigate('LegalDocuments')} />
          <MenuRow icon="info" title="Settings / About NESAM" subtitle="Language, preferences & company details" onPress={() => navigation.navigate('Settings')} />
        </MenuGroup>

        <Pressable onPress={logout} style={({ pressed }) => [styles.logout, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel="Sign out">
          <Icon name="log-out" size={17} color={colors.primary} />
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  page: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xxl },
  person: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingBottom: 22 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  initials: { backgroundColor: '#FFF1F1', alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontFamily: fonts.medium, fontSize: 18, color: colors.primary },
  camBadge: { position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E3E7EC', alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.semiBold, fontSize: 20, lineHeight: 25, letterSpacing: -0.35, color: colors.ink },
  phone: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: '#6D7785', marginTop: 2 },
  uploading: { fontFamily: fonts.medium, fontSize: 11, color: colors.primary, marginTop: 2 },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 4, alignSelf: 'flex-start' },
  logoutText: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
});

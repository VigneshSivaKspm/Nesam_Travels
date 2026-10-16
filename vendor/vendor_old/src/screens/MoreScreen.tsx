import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Content } from '../components/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useVendorData } from '../context/VendorData';
import { useInbox } from '../context/Inbox';
import { useSignOut } from '../navigation/MainNavigator';
import { Card } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { formatINR } from '../utils/format';
import { colors, radius, space, type } from '../theme';
import { useResponsive } from '../theme/responsive';

function Item({ icon, label, value, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      style={({ pressed, hovered }: any) => [
        styles.item,
        hovered && { backgroundColor: '#F8FAFC' },
        pressed && { opacity: 0.8 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.ink} />
      <Text style={[styles.label, danger && { color: colors.danger }]}>{label}</Text>
      {value ? <Text style={styles.valueText}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.slate} />
    </Pressable>
  );
}

export function MoreScreen() {
  const { isDesktop, isCompact } = useResponsive();
  const navigation = useNavigation();
  const signOut = useSignOut();
  const { profile, drivers, invites, wallet } = useVendorData();
  const { unreadCount, penalties, unacknowledged } = useInbox();
  const owed = penalties.filter((x) => ['Pending', 'Acknowledged', 'Disputed'].includes(x.status)).length;

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You’ll need to verify your phone number again to sign back in.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <DesktopHeader
        title="Settings & Fleet Administration"
        subtitle={profile.companyName ? `${profile.companyName} · Preferences, Compliance & Support` : 'Preferences, Compliance & Support'}
      />

      <View style={[styles.container, isDesktop && styles.desktopContainer]}>
        {isCompact ? (
          <Content kind="narrow" style={styles.content}>
            <Text style={type.h1}>More</Text>
            <Text style={[type.small, { marginBottom: space.md }]}>{profile.companyName}</Text>
          </Content>
        ) : null}

        <Card style={styles.menuCard}>
          <Item icon="notifications-outline" label="Alerts & Notifications" value={unreadCount ? `${unreadCount} new` : undefined} onPress={() => navigation.navigate('Notifications')} />
          <Item icon="alert-circle-outline" label="Penalties & Disputes" value={unacknowledged.length ? `${unacknowledged.length} to review` : owed ? `${owed} open` : undefined} onPress={() => navigation.navigate('Penalties')} />
          <Item icon="people-outline" label="Drivers & Crew Invites" value={`${drivers.length} drivers · ${invites.length} pending`} onPress={() => navigation.navigate('Drivers')} />
          <Item icon="wallet-outline" label="Fleet Wallet & Payouts" value={formatINR(wallet.available)} onPress={() => navigation.navigate('Wallet')} />
          <Item icon="document-text-outline" label="Documents & Compliance" onPress={() => navigation.navigate('Documents')} />
          <Item icon="business-outline" label="Business Profile & Addresses" onPress={() => navigation.navigate('Profile')} />
          <Item icon="call-outline" label={`Partner Helpline (${SUPPORT_PHONE_DISPLAY})`} onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
          <Item icon="log-out-outline" label="Sign Out from Vendor Portal" onPress={confirmSignOut} danger />
        </Card>

        <Text style={styles.versionText}>NESAM Fleet Partner v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  container: { width: '100%' },
  desktopContainer: { maxWidth: 680, width: '100%', alignSelf: 'center', marginTop: space.md },
  content: { padding: space.lg },
  menuCard: {
    padding: 0,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)' as any,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    minHeight: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.ink },
  valueText: { fontSize: 14, color: colors.slate, fontWeight: '600' },
  versionText: { textAlign: 'center', fontSize: 13, color: colors.slate, marginTop: space.lg },
});

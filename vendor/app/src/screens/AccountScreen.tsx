// Account: who this partner is, the things that need attention (requests, alerts, penalties), the documents and agreements on
// file, and help. Everything else lives in the tabs.
import React from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useVendorData } from '../context/VendorData';
import { useInbox } from '../context/Inbox';
import { useSignOut } from '../navigation/MainNavigator';
import { Avatar, Badge, Card, MenuRow, Screen } from '../components/ui';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { formatPhone } from '../utils/format';
import { colors, space, type } from '../theme';

export function AccountScreen() {
  const navigation = useNavigation();
  const signOut = useSignOut();
  const { profile, openLinks } = useVendorData();
  const { unreadCount, penalties, unacknowledged } = useInbox();
  const owed = penalties.filter((x) => ['Pending', 'Acknowledged', 'Disputed'].includes(x.status)).length;

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You’ll need to verify your phone number again to sign back in.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);

  return (
    <View style={styles.root}>
      <Screen edges={[]}>
        <Text style={[type.h1, { marginBottom: space.md }]}>Account</Text>
        <Card>
          <View style={styles.head}>
            <Avatar name={profile.companyName} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={type.h2} numberOfLines={1}>
                {profile.companyName || 'Fleet partner'}
              </Text>
              <Text style={type.small}>{formatPhone(profile.phone)}</Text>
              <Text style={type.tiny}>Partner ID {profile.id.slice(0, 8).toUpperCase()}</Text>
            </View>
          </View>
          <View style={{ marginTop: space.sm, flexDirection: 'row' }}>
            <Badge label="Verified partner" tone="success" />
          </View>
        </Card>

        <Text style={[type.label, styles.group]}>Needs your attention</Text>
        <Card style={styles.menu}>
          <MenuRow
            icon="swap-horizontal-outline"
            label="Linking requests"
            value={openLinks.length ? `${openLinks.length} open` : undefined}
            onPress={() => navigation.navigate('Requests')}
          />
          <MenuRow
            icon="notifications-outline"
            label="Alerts"
            value={unreadCount ? `${unreadCount} new` : undefined}
            onPress={() => navigation.navigate('Alerts')}
          />
          <MenuRow
            icon="alert-circle-outline"
            label="Penalties"
            value={unacknowledged.length ? `${unacknowledged.length} to review` : owed ? `${owed} open` : undefined}
            onPress={() => navigation.navigate('Penalties')}
          />
        </Card>

        <Text style={[type.label, styles.group]}>On file</Text>
        <Card style={styles.menu}>
          <MenuRow icon="business-outline" label="Business & contact details" onPress={() => navigation.navigate('Profile')} />
          <MenuRow icon="document-text-outline" label="Documents & compliance" onPress={() => navigation.navigate('Documents')} />
          <MenuRow icon="shield-checkmark-outline" label="Agreements accepted" onPress={() => navigation.navigate('Agreements')} />
        </Card>

        <Text style={[type.label, styles.group]}>Help</Text>
        <Card style={styles.menu}>
          <MenuRow icon="call-outline" label="NESAM office" value={SUPPORT_PHONE_DISPLAY} onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
          <MenuRow icon="log-out-outline" label="Sign out" onPress={confirmSignOut} danger />
        </Card>
        <Text style={[type.tiny, { textAlign: 'center' }]}>NESAM Vendor v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  group: { marginTop: space.sm, marginBottom: space.xs },
  menu: { padding: 0, overflow: 'hidden' },
});

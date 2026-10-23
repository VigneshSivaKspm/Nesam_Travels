import React, { createContext, useContext, useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList, TabParamList } from './types';
import { useVendorData } from '../context/VendorData';
import { DutiesScreen } from '../screens/DutiesScreen';
import { DriversScreen } from '../screens/DriversScreen';
import { VehiclesScreen } from '../screens/VehiclesScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { RequestsScreen } from '../screens/RequestsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { PenaltiesScreen } from '../screens/PenaltiesScreen';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AgreementsScreen } from '../screens/AgreementsScreen';
import { NotificationPopups } from '../components/NotificationPopups';
import { PenaltyAckModal } from '../components/PenaltyAckModal';
import { useInbox } from '../context/Inbox';
import { markNotificationRead } from '../services/partnerNotifications';
import { onPushOpened } from '../services/notificationService';
import { navigationRef } from './navigationRef';
import { AppHeader } from '../components/AppHeader';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const SignOutCtx = createContext<() => void>(() => undefined);
export const useSignOut = () => useContext(SignOutCtx);

const TAB_ICONS: Record<keyof TabParamList, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  Duties: { on: 'navigate', off: 'navigate-outline' },
  Drivers: { on: 'people', off: 'people-outline' },
  Vehicles: { on: 'car', off: 'car-outline' },
  Payouts: { on: 'wallet', off: 'wallet-outline' },
  Account: { on: 'person-circle', off: 'person-circle-outline' },
};

function Tabs() {
  const { awaitingDispatch, marketTrips, openLinks } = useVendorData();
  const { unacknowledged } = useInbox();
  const newDuties = marketTrips.length + awaitingDispatch.length;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarHideOnKeyboard: true,
        header: () => <AppHeader />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color, size, focused }) => <Ionicons name={TAB_ICONS[route.name][focused ? 'on' : 'off']} color={color} size={size} />,
      })}
    >
      <Tab.Screen name="Duties" component={DutiesScreen} options={{ tabBarBadge: newDuties || undefined }} />
      <Tab.Screen name="Drivers" component={DriversScreen} />
      <Tab.Screen name="Vehicles" component={VehiclesScreen} />
      <Tab.Screen name="Payouts" component={WalletScreen} />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          tabBarBadge: openLinks.length + unacknowledged.length || undefined,
        }}
      />
    </Tab.Navigator>
  );
}

/** Where a notification's call-to-action leads. */
function openPage(page: string) {
  if (!navigationRef.isReady()) return;
  switch (page) {
    case 'market':
    case 'trips':
    case 'booking-detail':
      return navigationRef.navigate('Tabs', { screen: 'Duties' });
    case 'wallet':
      return navigationRef.navigate('Tabs', { screen: 'Payouts' });
    case 'drivers':
      return navigationRef.navigate('Tabs', { screen: 'Drivers' });
    case 'fleet':
    case 'vehicles':
      return navigationRef.navigate('Tabs', { screen: 'Vehicles' });
    case 'requests':
    case 'partner-links':
      return navigationRef.navigate('Requests');
    case 'profile':
      return navigationRef.navigate('Profile');
    case 'penalties':
      return navigationRef.navigate('Penalties');
    default:
      return navigationRef.navigate('Alerts');
  }
}

/** Popups with tones for new events, the penalty acknowledgement that cannot be skipped, and push taps. */
function WorkspaceOverlays() {
  const { notifications, unacknowledged } = useInbox();
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const pending = unacknowledged.find((x) => !doneIds.includes(x.id));
  useEffect(() => onPushOpened((d) => openPage(d.page)), []);
  return (
    <>
      <NotificationPopups
        notifications={notifications}
        onOpen={(n) => openPage(n.ctaPage)}
        onRead={(n) => {
          if (!n.read) markNotificationRead(n.id).catch(() => undefined);
        }}
      />
      {pending ? <PenaltyAckModal key={pending.id} penalty={pending} onDone={() => setDoneIds((ids) => [...ids, pending.id])} /> : null}
    </>
  );
}

export function MainNavigator({ onSignOut }: { onSignOut: () => void }) {
  return (
    <SignOutCtx.Provider value={onSignOut}>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '800' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Requests" component={RequestsScreen} options={{ title: 'Linking requests' }} />
        <Stack.Screen name="Alerts" component={NotificationsScreen} options={{ title: 'Alerts' }} />
        <Stack.Screen name="Penalties" component={PenaltiesScreen} options={{ title: 'Penalties' }} />
        <Stack.Screen name="Documents" component={DocumentsScreen} options={{ title: 'Documents & compliance' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Business & contact' }} />
        <Stack.Screen name="Agreements" component={AgreementsScreen} options={{ title: 'Agreements accepted' }} />
      </Stack.Navigator>
      <WorkspaceOverlays />
    </SignOutCtx.Provider>
  );
}

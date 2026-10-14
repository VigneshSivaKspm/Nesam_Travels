import React from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, radius, shadows, space, type } from '../theme';
import { useDriverData } from '../context/DriverData';
import { useSignOut } from '../navigation/MainNavigator';
import { initials } from '../utils/format';
import { setDriverPresence } from '../services/driverService';

const LOGO = require('../../assets/logo.png') as number;

interface NavItemDef {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number | string;
}

export function DriverDesktopSidebar({ state, navigation }: BottomTabBarProps) {
  const { account, activeTrip } = useDriverData();
  const onSignOut = useSignOut();

  const driver = account.driver;
  const vehicle = account.vehicle;
  const isOnline = driver.presenceStatus === 'Online';

  const toggleDuty = async (val: boolean) => {
    try {
      await setDriverPresence(driver.id, val ? 'Online' : 'Offline');
    } catch {
      // Handled by service
    }
  };

  const navItems: NavItemDef[] = [
    { name: 'Home', label: 'Operations Board', icon: 'speedometer-outline' },
    { name: 'Trip', label: 'Trip Execution', icon: 'navigate-outline', badge: activeTrip ? 'Active' : undefined },
    { name: 'Earnings', label: 'Earnings & Payouts', icon: 'bar-chart-outline' },
    { name: 'Wallet', label: 'Driver Wallet', icon: 'wallet-outline' },
    { name: 'Profile', label: 'Vehicle & Documents', icon: 'person-circle-outline' },
  ];

  return (
    <View style={styles.sidebar}>
      {/* Brand Header */}
      <View style={styles.brandContainer}>
        <View style={styles.brandRow}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.brandTitle}>
              NESAM <Text style={{ color: colors.primary }}>DRIVER</Text>
            </Text>
            <Text style={styles.brandSub}>Partner Workspace</Text>
          </View>
        </View>
        <View style={styles.roleBadge}>
          <View style={[styles.dot, { backgroundColor: isOnline ? colors.success : '#94A3B8' }]} />
          <Text style={styles.roleText}>{isOnline ? 'On Duty • Online' : 'Off Duty • Offline'}</Text>
        </View>
      </View>

      {/* Duty Status Controller */}
      <View style={[styles.dutyCard, isOnline && styles.dutyCardOnline]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dutyTitle}>{isOnline ? 'ONLINE & READY' : 'CURRENTLY OFFLINE'}</Text>
          <Text style={styles.dutySub}>
            {isOnline ? 'Receiving trip requests' : 'Switch online to accept trips'}
          </Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={(val) => void toggleDuty(val)}
          trackColor={{ false: '#CBD5E1', true: colors.success }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* Navigation Links */}
      <View style={styles.navSection}>
        <Text style={styles.sectionHeader}>Operations</Text>
        {navItems.map((item) => {
          const routeIndex = state.routes.findIndex((r) => r.name === item.name);
          const active = state.index === routeIndex;

          return (
            <Pressable
              key={item.name}
              onPress={() => {
                if (routeIndex >= 0) {
                  navigation.navigate(item.name);
                }
              }}
              style={({ pressed, hovered }: any) => [
                styles.navItem,
                active && styles.navItemActive,
                hovered && !active && styles.navItemHovered,
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Ionicons
                name={active ? (item.icon.replace('-outline', '') as any) : item.icon}
                size={22}
                color={active ? colors.primary : colors.muted}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
              {item.badge !== undefined ? (
                <View style={[styles.badge, active && styles.badgeActive]}>
                  <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{item.badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Vehicle Summary Card */}
      <View style={styles.vehicleCard}>
        <Ionicons name="car" size={20} color={colors.ink} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.vehiclePlate} numberOfLines={1}>
            {vehicle.vehicleNumber || 'Unassigned vehicle'}
          </Text>
          <Text style={styles.vehicleType} numberOfLines={1}>
            {vehicle.vehicleType || 'Cab'} • Rating ★ {driver.rating ? driver.rating.toFixed(1) : '5.0'}
          </Text>
        </View>
      </View>

      {/* User Account Footer */}
      <View style={styles.footer}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(driver.name || 'Driver')}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {driver.name || 'Driver Partner'}
            </Text>
            <Text style={styles.userPhone} numberOfLines={1}>
              {driver.phone}
            </Text>
          </View>
          <Pressable
            onPress={() => onSignOut()}
            style={({ pressed, hovered }: any) => [
              styles.signOutBtn,
              hovered && { backgroundColor: '#FEE2E2' },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    flexDirection: 'column',
    height: '100%',
    paddingTop: space.lg,
    paddingBottom: space.md,
    paddingHorizontal: space.md,
  },
  brandContainer: {
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: space.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  logo: {
    width: 38,
    height: 38,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 0.3,
  },
  brandSub: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dutyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: space.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: space.md,
    gap: space.sm,
  },
  dutyCardOnline: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  dutyTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  dutySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  navSection: {
    flex: 1,
    gap: 4,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 10,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    gap: 12,
    cursor: 'pointer' as any,
  },
  navItemHovered: {
    backgroundColor: '#F8FAFC',
  },
  navItemActive: {
    backgroundColor: '#FEF2F2',
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  badge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeActive: {
    backgroundColor: colors.primary,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: space.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: space.sm,
  },
  vehiclePlate: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
  },
  vehicleType: {
    fontSize: 11,
    color: colors.muted,
  },
  footer: {
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  userName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  userPhone: {
    fontSize: 11,
    color: colors.muted,
  },
  signOutBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer' as any,
  },
});

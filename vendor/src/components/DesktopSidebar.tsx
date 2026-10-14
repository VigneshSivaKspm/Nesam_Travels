import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, radius, shadows, space, type } from '../theme';
import { useVendorData } from '../context/VendorData';
import { useSignOut } from '../navigation/MainNavigator';
import { initials } from '../utils/format';

const LOGO = require('../../assets/logo.png') as number;

interface NavItemDef {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number | string;
  stackScreen?: string;
}

export function VendorDesktopSidebar({ state, navigation }: BottomTabBarProps) {
  const { profile, record, vehicles, drivers, awaitingDispatch, marketTrips } = useVendorData();
  const onSignOut = useSignOut();

  const navItems: NavItemDef[] = [
    { name: 'Home', label: 'Fleet Dashboard', icon: 'grid-outline' },
    { name: 'Market', label: 'Marketplace', icon: 'pricetags-outline', badge: marketTrips.length || undefined },
    { name: 'Trips', label: 'Dispatch & Trips', icon: 'navigate-outline', badge: awaitingDispatch.length || undefined },
    { name: 'Fleet', label: 'Vehicles Fleet', icon: 'car-outline', badge: vehicles.length || undefined },
    { name: 'Drivers', label: 'Drivers Roster', icon: 'people-outline', stackScreen: 'Drivers', badge: drivers.length || undefined },
    { name: 'Wallet', label: 'Vendor Wallet', icon: 'wallet-outline', stackScreen: 'Wallet' },
    { name: 'More', label: 'More & Settings', icon: 'ellipsis-horizontal-circle-outline' },
  ];

  return (
    <View style={styles.sidebar}>
      {/* Brand Header */}
      <View style={styles.brandContainer}>
        <View style={styles.brandRow}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.brandTitle}>
              NESAM <Text style={{ color: colors.primary }}>FLEET</Text>
            </Text>
            <Text style={styles.brandSub}>Fleet Partner Console</Text>
          </View>
        </View>
        <View style={styles.roleBadge}>
          <View style={styles.dot} />
          <Text style={styles.roleText}>Verified Fleet Partner</Text>
        </View>
      </View>

      {/* Fleet Quick Status Card */}
      <View style={styles.fleetSummaryCard}>
        <View style={styles.fleetStatCol}>
          <Text style={styles.fleetStatNum}>{vehicles.length}</Text>
          <Text style={styles.fleetStatLabel}>Vehicles</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.fleetStatCol}>
          <Text style={styles.fleetStatNum}>{drivers.length}</Text>
          <Text style={styles.fleetStatLabel}>Drivers</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.fleetStatCol}>
          <Text style={[styles.fleetStatNum, { color: colors.primary }]}>{awaitingDispatch.length}</Text>
          <Text style={styles.fleetStatLabel}>Pending</Text>
        </View>
      </View>

      {/* Navigation Links */}
      <View style={styles.navSection}>
        <Text style={styles.sectionHeader}>Fleet Operations</Text>
        {navItems.map((item) => {
          const routeIndex = state.routes.findIndex((r) => r.name === item.name);
          const active = routeIndex >= 0 && state.index === routeIndex;

          return (
            <Pressable
              key={item.name}
              onPress={() => {
                if (item.stackScreen) {
                  // Navigate to stack screen
                  (navigation as any).navigate(item.stackScreen);
                } else if (routeIndex >= 0) {
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

      {/* User Account Footer */}
      <View style={styles.footer}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {initials(profile.companyName || record.business?.businessName || 'Vendor')}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {profile.companyName || record.business?.businessName || 'Fleet Partner'}
            </Text>
            <Text style={styles.userPhone} numberOfLines={1}>
              {profile.contactPerson || profile.phone || record.phone}
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
    backgroundColor: colors.primary,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fleetSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: space.md,
  },
  fleetStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  fleetStatNum: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  fleetStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
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
    paddingVertical: 10,
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

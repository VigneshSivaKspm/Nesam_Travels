// Brand pieces shared by the customer screens.
import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { colors, fonts, radius, space, type } from '../theme';

import { BRAND, VEHICLES, getVehicleImage } from '../assets/images';

export const LOGO = BRAND.logo;
export const VEHICLE_IMAGES = VEHICLES;
export { getVehicleImage };

/** World-class mobile brand top bar with official logo and company name. */
export function MobileBrandHeader({
  rightAction,
}: {
  showTrustBar?: boolean;
  rightAction?: React.ReactNode;
}) {
  return (
    <View style={styles.topContainer}>
      <View style={styles.headerRow}>
        <View style={styles.brandLeft}>
          <Image source={LOGO} style={styles.brandLogo} resizeMode="contain" />
          <View style={{ flexShrink: 1 }}>
            <View style={styles.brandNameRow}>
              <Text style={styles.brandWord} numberOfLines={1}>one_way_car_rental</Text>
            </View>
            <Text style={styles.brandTagline}>Outstation & Intercity Rides</Text>
          </View>
        </View>

        {rightAction ? <View style={styles.headerRight}>{rightAction}</View> : null}
      </View>
    </View>
  );
}

/** Legacy BrandHeader backward compatibility. */
export function BrandHeader({ right }: { right?: React.ReactNode }) {
  return <MobileBrandHeader rightAction={right} showTrustBar={false} />;
}

/** Round icon button used in headers. */
export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
    >
      <Ionicons name={icon} size={24} color={colors.ink} />
    </Pressable>
  );
}

/** Back arrow, title and "Step n of 3" for the booking steps. */
export function StepHeader({
  title,
  step,
  onBack,
}: {
  title: string;
  step: number;
  onBack: () => void;
}) {
  return (
    <View style={styles.stepRow}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
        <Ionicons name="arrow-back" size={24} color={colors.ink} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.stepSub}>Step {step} of 3</Text>
      </View>
      <View style={styles.stepPill}>
        <Text style={styles.stepPillText}>{step}/3</Text>
      </View>
    </View>
  );
}

/** Clean sub-page header with back button, title, and optional subtitle / right action. */
export function SubHeader({
  title,
  subtitle,
  onBack,
  right,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
  rightAction?: React.ReactNode;
}) {
  const r = rightAction ?? right;
  return (
    <View style={styles.subHeaderRoot}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
        <Ionicons name="arrow-back" size={24} color={colors.ink} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.subHeaderTitle} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subHeaderSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {r ? <View>{r}</View> : null}
    </View>
  );
}

/** "Need help booking?" banner with the real support number. */
export function SupportBanner() {
  return (
    <Pressable
      onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)}
      style={({ pressed }) => [styles.support, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`Need help booking? Call one_way_car_rental support on ${SUPPORT_PHONE_DISPLAY}`}
    >
      <View style={styles.supportIconWrap}>
        <Ionicons name="headset" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.supportTitle}>Need Help with Advance Booking?</Text>
        <Text style={styles.supportSub}>Call our 24/7 travel desk for customized routes</Text>
      </View>
      <View style={styles.callBadge}>
        <Ionicons name="call" size={13} color={colors.white} />
        <Text style={styles.callBadgeText}>Call</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  brandLogo: {
    width: 44,
    height: 44,
  },
  brandNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  brandWord: {
    fontFamily: fonts.black,
    fontSize: 17,
    color: colors.primary,
    letterSpacing: 0,
    flexShrink: 1,
  },
  brandWordTravels: {
    fontFamily: fonts.black,
    fontSize: 22,
    color: colors.ink,
    letterSpacing: 0.6,
  },
  brandTagline: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.slate,
    letterSpacing: 0.2,
    marginTop: -2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 12,
    paddingHorizontal: space.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  back: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
  },
  stepTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.ink,
  },
  stepSub: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.slate,
    marginTop: 1,
  },
  stepPill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  stepPillText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  support: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  supportIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  supportSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slate,
    marginTop: 2,
  },
  callBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  callBadgeText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    fontWeight: '800',
    color: colors.white,
  },
  subHeaderRoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  subHeaderTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  subHeaderSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slate,
    marginTop: 2,
  },
});

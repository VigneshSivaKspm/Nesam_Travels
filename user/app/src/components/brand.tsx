// Brand pieces shared by the customer screens: the reference header (emblem,
// NESAM wordmark, notification + support actions) and the five-item service
// navigation (Airport · Multicity · Outstation · Local Rental · Account).
import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { colors, fonts, radius, space } from '../theme';
import { BRAND, REFERENCE, VEHICLES, getVehicleImage } from '../assets/images';
import { Icon, TravelIcon, type IconName, type TravelGlyph } from './Icon';
import { useInbox } from '../context/Inbox';
import { useBookingDraft, type HomeService } from '../context/BookingDraft';
import { Steps } from './ui';

export const LOGO = REFERENCE.emblem;
export const APP_ICON = BRAND.logo;
export const VEHICLE_IMAGES = VEHICLES;
export { getVehicleImage };

/** Emblem + “NESAM / Cabs & Car Rentals”. */
export function BrandMark({ onPress }: { onPress?: () => void }) {
  const body = (
    <View style={styles.brand}>
      <View style={styles.logoWrap}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" accessible={false} />
      </View>
      <View>
        <Text style={styles.wordmark} maxFontSizeMultiplier={1.2}>
          NESAM
        </Text>
        <Text style={styles.submark} maxFontSizeMultiplier={1.3}>
          Cabs & Car Rentals
        </Text>
      </View>
    </View>
  );
  if (!onPress) return <View accessibilityRole="header" accessibilityLabel="NESAM Cabs and Car Rentals">{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="NESAM home" hitSlop={4}>
      {body}
    </Pressable>
  );
}

function HeaderAction({ icon, label, onPress, active, badge }: { icon: IconName; label: string; onPress: () => void; active?: boolean; badge?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
      hitSlop={4}
      style={({ pressed }) => [styles.action, active && styles.actionOn, pressed && { opacity: 0.6 }]}
    >
      <Icon name={icon} size={21} color={active ? colors.primary : '#626E80'} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} maxFontSizeMultiplier={1.1}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * The app header. Inside the signed-in app it shows the notification bell (with the unread
 * count) and the support action; `actions={false}` is for sign-in and account-state screens.
 */
export function AppHeader({ active, actions = true }: { active?: 'alerts' | 'support'; actions?: boolean }) {
  return <View style={styles.top}>{actions ? <SignedInHeader active={active} /> : <BrandMark />}</View>;
}

function SignedInHeader({ active }: { active?: 'alerts' | 'support' }) {
  const navigation = useNavigation();
  const { unreadCount } = useInbox();
  return (
    <>
      <BrandMark onPress={() => navigation.navigate('Tabs', { screen: 'Book' })} />
      <View style={styles.actions}>
        <HeaderAction icon="bell" label="Notifications" active={active === 'alerts'} badge={unreadCount} onPress={() => navigation.navigate('Tabs', { screen: 'Alerts' })} />
        <HeaderAction icon="headphones" label="Help and support" active={active === 'support'} onPress={() => navigation.navigate('Support')} />
      </View>
    </>
  );
}

/** Kept for screens that still pass a custom right-hand action. */
export function MobileBrandHeader({ rightAction }: { showTrustBar?: boolean; rightAction?: React.ReactNode }) {
  return (
    <View style={styles.top}>
      <BrandMark />
      {rightAction ? <View style={styles.actions}>{rightAction}</View> : null}
    </View>
  );
}

export function BrandHeader({ right }: { right?: React.ReactNode }) {
  return <MobileBrandHeader rightAction={right} />;
}

export type NavKey = HomeService | 'account';

const NAV_ITEMS: { key: NavKey; label: string; glyph: TravelGlyph }[] = [
  { key: 'airport', label: 'Airport', glyph: 'airport' },
  { key: 'multicity', label: 'Multicity', glyph: 'multicity' },
  { key: 'outstation', label: 'Outstation', glyph: 'outstation' },
  { key: 'rental', label: 'Local Rental', glyph: 'rental' },
  { key: 'account', label: 'Account', glyph: 'account' },
];

/** The reference bottom navigation. `active` defaults to the current service. */
export function BottomNav({ active }: { active?: NavKey }) {
  const navigation = useNavigation();
  const { service, setService } = useBookingDraft();
  const insets = useSafeAreaInsets();
  const selected = active ?? service;
  return (
    <View style={[styles.nav, { paddingBottom: 8 + insets.bottom }]} accessibilityRole="tablist" accessibilityLabel="Services and account">
      {NAV_ITEMS.map((item) => {
        const on = selected === item.key;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={item.label}
            onPress={() => {
              if (item.key === 'account') {
                navigation.navigate('Tabs', { screen: 'Account' });
                return;
              }
              setService(item.key);
              navigation.navigate('Tabs', { screen: 'Book' });
            }}
            style={({ pressed }) => [styles.navItem, pressed && { backgroundColor: colors.subtle }]}
          >
            <View style={styles.navSymbol}>
              <TravelIcon name={item.glyph} size={25} color={on ? colors.primaryActive : '#697586'} />
            </View>
            <Text style={[styles.navLabel, on && styles.navLabelOn]} numberOfLines={1} maxFontSizeMultiplier={1.15}>
              {item.label}
            </Text>
            <View style={[styles.navBar, on && styles.navBarOn]} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Round icon button used in headers. */
export function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return <HeaderAction icon={icon} label={label} onPress={onPress} />;
}

/** Back button, title and the three-step progress bars for the booking steps. */
export function StepHeader({ title, subtitle, step, onBack }: { title: string; subtitle?: string; step: number; onBack: () => void }) {
  return (
    <View>
      <SubHeader title={title} subtitle={subtitle} onBack={onBack} plain />
      <Steps step={step} />
    </View>
  );
}

/** Sub-page heading (square back button + title + description), as in the reference. */
export function SubHeader({
  title,
  subtitle,
  onBack,
  right,
  rightAction,
  plain,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
  rightAction?: React.ReactNode;
  /** Render without its own horizontal padding (inside an already padded page). */
  plain?: boolean;
}) {
  const r = rightAction ?? right;
  return (
    <View style={[styles.subHeader, !plain && styles.subHeaderPadded]}>
      <Pressable onPress={onBack} hitSlop={6} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}>
        <Icon name="arrow-left" size={17} color="#757880" />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.subTitle} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subSubtitle}>{subtitle}</Text> : null}
      </View>
      {r ? <View>{r}</View> : null}
    </View>
  );
}

/** “Booking support” card with the approved support number. */
export function SupportBanner() {
  return (
    <View style={styles.support}>
      <View style={styles.supportHead}>
        <View style={styles.supportIcon}>
          <Icon name="headphones" size={19} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.supportTitle}>Booking support</Text>
          <Text style={styles.supportSub}>NESAM Tours & Travels</Text>
        </View>
      </View>
      <Pressable
        onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)}
        style={({ pressed }) => [styles.supportCall, pressed && { backgroundColor: colors.primaryDark }]}
        accessibilityRole="button"
        accessibilityLabel={`Call our office on ${SUPPORT_PHONE_DISPLAY}`}
      >
        <Icon name="phone" size={18} color={colors.white} />
        <Text style={styles.supportCallText}>Call our office · {SUPPORT_PHONE_DISPLAY}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: space.xl,
    paddingVertical: 13,
    minHeight: 70,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F3',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoWrap: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  logo: { width: 46, height: 46 },
  wordmark: { fontFamily: fonts.heading, fontSize: 25, lineHeight: 27, color: colors.primary, letterSpacing: 1.3 },
  submark: { fontFamily: fonts.medium, fontSize: 9, lineHeight: 12.6, color: '#697587', marginTop: 3 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  action: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionOn: { backgroundColor: '#FFF1F1' },
  badge: {
    position: 'absolute',
    top: 3,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.semiBold, fontSize: 9, lineHeight: 11, color: colors.white },
  nav: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: '#E5E8ED',
    paddingTop: 9,
    paddingHorizontal: 6,
  },
  navItem: { flex: 1, alignItems: 'center', paddingTop: 6, paddingBottom: 2, borderRadius: 8, minHeight: 56 },
  navSymbol: { width: 36, height: 28, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontFamily: fonts.medium, fontSize: 10, lineHeight: 12.5, color: '#697586', letterSpacing: -0.1, marginTop: 6 },
  navLabelOn: { fontFamily: fonts.semiBold, color: colors.primaryActive },
  navBar: { width: 18, height: 2, borderRadius: 1, marginTop: 3, backgroundColor: 'transparent' },
  navBarOn: { backgroundColor: colors.primaryActive },
  back: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E3E7EC',
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xl },
  subHeaderPadded: { paddingHorizontal: space.xl, paddingTop: space.xl, marginBottom: space.lg, backgroundColor: colors.white },
  subTitle: { fontFamily: fonts.semiBold, fontSize: 23, lineHeight: 30, letterSpacing: -0.6, color: colors.ink },
  subSubtitle: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: '#6D7785', marginTop: 4 },
  support: { borderWidth: 1, borderColor: '#E3E7EC', borderRadius: radius.xl, padding: 18, marginBottom: space.md, backgroundColor: colors.white },
  supportHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  supportIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF1F1', alignItems: 'center', justifyContent: 'center' },
  supportTitle: { fontFamily: fonts.semiBold, fontSize: 13.5, color: colors.ink },
  supportSub: { fontFamily: fonts.regular, fontSize: 12, color: '#55606F', marginTop: 2 },
  supportCall: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.primary, paddingHorizontal: 12 },
  supportCallText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.white, flexShrink: 1, textAlign: 'center' },
});

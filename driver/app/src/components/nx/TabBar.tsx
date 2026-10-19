import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TabParamList } from '../../navigation/types';
import { nx } from '../../theme/nx';
import { NxIcon, NxIconName } from './Icon';
import { useLayout } from './layout';

const ITEMS: Record<keyof TabParamList, { label: string; icon: NxIconName }> = {
  Home: { label: 'Home', icon: 'home' },
  Trip: { label: 'My Trips', icon: 'trip' },
  Earnings: { label: 'Earnings', icon: 'chart' },
  Wallet: { label: 'Wallet', icon: 'wallet' },
  Profile: { label: 'Profile', icon: 'user' },
};

/** The reference's bottom navigation: icon over label, the active item red with a short bar on the top edge. */
export function NxTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { short } = useLayout();
  return (
    <View style={[styles.bar, { paddingBottom: (short ? 4 : 8) + insets.bottom, paddingLeft: 8 + insets.left, paddingRight: 8 + insets.right }]} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const item = ITEMS[route.name as keyof TabParamList];
        if (!item) return null;
        const focused = state.index === index;
        const color = focused ? nx.red : nx.muted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.label}
            style={[styles.item, short && styles.itemShort]}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
            }}
          >
            {focused ? <View style={[styles.indicator, short && { top: -5 }]} /> : null}
            <NxIcon name={item.icon} size={21} color={color} />
            <Text style={[styles.label, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.15}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: 1, borderTopColor: nx.line, paddingTop: 8, paddingHorizontal: 8 },
  item: { flex: 1, minHeight: 51, alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 6, paddingBottom: 4 },
  indicator: { position: 'absolute', top: -9, width: 24, height: 3, backgroundColor: nx.red, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  itemShort: { flexDirection: 'row', minHeight: 40, gap: 6, paddingTop: 2, paddingBottom: 2 },
  label: { fontSize: 11, fontWeight: '700' },
});

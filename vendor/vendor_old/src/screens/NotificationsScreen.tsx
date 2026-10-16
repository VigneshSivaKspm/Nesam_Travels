import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FlatList, ScrollView, Content } from '../components/layout';
import { useInbox } from '../context/Inbox';
import { EmptyState } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { markNotificationRead } from '../services/partnerNotifications';
import { CATEGORIES, CATEGORY_LABEL, TONE_COLORS, toneOf } from '../utils/notificationModel';
import type { NotificationCategory } from '../types/notifications';
import { colors, radius, space, type } from '../theme';
import { useResponsive } from '../theme/responsive';

export function NotificationsScreen() {
  const { isDesktop } = useResponsive();
  const navigation = useNavigation();
  const { notifications } = useInbox();
  const [filter, setFilter] = useState<NotificationCategory | 'all'>('all');
  const shown = filter === 'all' ? notifications : notifications.filter((n) => n.category === filter);

  return (
    <View style={styles.root}>
      <DesktopHeader
        title="Partner Alerts & Notifications"
        subtitle="Dispatch assignments, marketplace bidding updates, and wallet settlements"
        onBack={() => navigation.goBack()}
      />

      <View style={[styles.container, isDesktop && styles.desktopContainer]}>
        <View style={styles.tabsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {(['all', ...CATEGORIES] as const).map((c) => {
              const count = c === 'all' ? notifications.filter((n) => !n.read).length : notifications.filter((n) => n.category === c && !n.read).length;
              const active = filter === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setFilter(c)}
                  style={({ pressed, hovered }: any) => [
                    styles.tab,
                    active && styles.tabOn,
                    hovered && !active && styles.tabHovered,
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.tabText, active && { color: colors.white }]}>
                    {c === 'all' ? 'All Alerts' : CATEGORY_LABEL[c]}
                    {count ? ` (${count})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <FlatList
          data={shown}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: space.lg, paddingTop: space.xs }}
          ListEmptyComponent={<EmptyState title="No notifications" message="Trip, payment, penalty and approval updates from NESAM appear here." />}
          renderItem={({ item: n }) => {
            const tone = TONE_COLORS[toneOf(n)];
            return (
              <Pressable
                onPress={() => {
                  if (!n.read) markNotificationRead(n.id).catch(() => undefined);
                }}
                style={({ pressed, hovered }: any) => [
                  styles.item,
                  { borderColor: n.read ? colors.border : tone.border, backgroundColor: n.read ? '#FAFAFA' : tone.bg },
                  hovered && { borderColor: tone.bar },
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
              >
                <View style={[styles.dot, { backgroundColor: n.read ? colors.border : tone.bar }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cat, { color: n.read ? colors.muted : tone.text }]}>{CATEGORY_LABEL[n.category].toUpperCase()}</Text>
                  <Text style={styles.titleText}>{n.title}</Text>
                  <Text style={styles.messageText}>{n.message}</Text>
                  <Text style={styles.timeText}>{n.time}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  container: { flex: 1 },
  desktopContainer: { maxWidth: 960, width: '100%', alignSelf: 'center' },
  tabsWrap: { paddingHorizontal: space.lg, paddingVertical: space.md },
  tabs: { gap: space.sm },
  tab: {
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabHovered: { backgroundColor: '#F1F5F9', borderColor: colors.slate },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.text },
  item: {
    flexDirection: 'row',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: space.lg,
    marginBottom: space.sm,
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)' as any,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  cat: { fontSize: 10, fontWeight: '800', marginBottom: 2, letterSpacing: 0.5 },
  titleText: { fontSize: 16, fontWeight: '800', color: colors.ink },
  messageText: { fontSize: 14, color: colors.text, marginTop: 4, lineHeight: 20 },
  timeText: { fontSize: 12, color: colors.slate, marginTop: 6 },
});

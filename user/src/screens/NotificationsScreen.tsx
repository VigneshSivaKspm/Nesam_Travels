import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlatList, ScrollView, Content } from '../components/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInbox } from '../context/Inbox';
import { EmptyState, LinkText, Notice, Button } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { markAllNotificationsRead, markNotificationRead } from '../services/userService';
import { CATEGORIES, CATEGORY_LABEL, TONE_COLORS, toneOf } from '../utils/notificationModel';
import type { NotificationCategory } from '../types/notifications';
import { describeError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';
import { useResponsive } from '../theme/responsive';

export function NotificationsScreen() {
  const { isDesktop, isCompact } = useResponsive();
  const { notifications } = useInbox();
  const [filter, setFilter] = useState<NotificationCategory | 'all'>('all');
  const [error, setError] = useState('');
  const unread = notifications.filter((n) => !n.read);
  // Only categories that have something in them, so the bar stays short.
  const tabs = (['all', ...CATEGORIES] as const).filter((c) => c === 'all' || c === filter || notifications.some((n) => n.category === c));
  const shown = filter === 'all' ? notifications : notifications.filter((n) => n.category === filter);

  const markAll = async () => {
    setError('');
    try {
      await markAllNotificationsRead(unread.map((n) => n.id));
    } catch (e) {
      setError(describeError(e, 'Couldn’t update notifications.'));
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <DesktopHeader
        title="Alerts & Notifications"
        subtitle="Live trip progress, driver dispatch alerts, and promo notices"
        badge={unread.length > 0 ? `${unread.length} New` : undefined}
        actions={
          unread.length > 0 ? (
            <Button small variant="secondary" title="Mark All as Read" onPress={() => void markAll()} />
          ) : undefined
        }
      />

      <View style={[styles.container, isDesktop && styles.desktopContainer]}>
        {/* Mobile Header */}
        {isCompact ? (
          <Content kind="narrow" style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={type.h1}>Notifications</Text>
              <Text style={type.small}>Booking updates, driver alerts & offers</Text>
            </View>
            {unread.length > 0 ? <LinkText onPress={() => void markAll()}>Mark all read</LinkText> : null}
          </Content>
        ) : null}

        <View style={styles.tabsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {tabs.map((c) => {
              const count = (c === 'all' ? unread : unread.filter((n) => n.category === c)).length;
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
          contentContainerStyle={{ padding: space.lg, paddingTop: space.sm }}
          ListHeaderComponent={<Notice message={error} />}
          ListEmptyComponent={<EmptyState title="You’re all caught up" message="Ride updates and offers from NESAM appear here." />}
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
                accessibilityHint={n.read ? undefined : 'Marks as read'}
              >
                <View style={[styles.dot, { backgroundColor: n.read ? colors.border : tone.bar }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cat, { color: n.read ? colors.muted : tone.text }]}>{CATEGORY_LABEL[n.category].toUpperCase()}</Text>
                  <View style={styles.titleRow}>
                    <Text style={[type.h3, { flex: 1, color: colors.ink }]}>{n.title}</Text>
                    <Text style={styles.timeText}>{n.time}</Text>
                  </View>
                  <Text style={[type.body, { marginTop: 4, color: colors.text, fontSize: 14 }]}>{n.message}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  container: { flex: 1 },
  desktopContainer: { maxWidth: 960, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md },
  tabsWrap: { paddingHorizontal: space.lg, paddingBottom: space.sm, paddingTop: space.xs },
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
  tabText: { fontSize: 14, fontWeight: '700', color: colors.text },
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
  cat: { fontSize: 11, fontWeight: '800', marginBottom: 2, letterSpacing: 0.5 },
  titleRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  timeText: { fontSize: 12, color: colors.slate, fontWeight: '600' },
});

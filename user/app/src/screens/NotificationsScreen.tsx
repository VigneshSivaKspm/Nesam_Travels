import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlatList, ScrollView, Content } from '../components/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInbox } from '../context/Inbox';
import { EmptyState, LinkText, Notice, Button } from '../components/ui';
import { markAllNotificationsRead, markNotificationRead } from '../services/userService';
import { CATEGORIES, CATEGORY_LABEL, TONE_COLORS, toneOf } from '../utils/notificationModel';
import type { NotificationCategory } from '../types/notifications';
import { describeError } from '../utils/retry';
import { colors, fonts, radius, space, type } from '../theme';
import { ILLUSTRATIONS } from '../assets/images';

export function NotificationsScreen() {
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
      <View style={styles.mobileHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Alerts & Updates</Text>
          <Text style={styles.headerSubtitle}>Booking updates, chauffeur alerts & notices</Text>
        </View>
        {unread.length > 0 ? (
          <Pressable onPress={() => void markAll()} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.container}>

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
                  <Text style={[styles.tabText, active && styles.tabTextOn]}>
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
          contentContainerStyle={{ padding: space.md, paddingTop: space.xs, paddingBottom: space.xxl }}
          ListHeaderComponent={<Notice message={error} />}
          ListEmptyComponent={
            <EmptyState
              image={ILLUSTRATIONS.noNotifications}
              title="You’re all caught up"
              message="Ride updates and offers from NESAM appear here."
            />
          }
          renderItem={({ item: n }) => {
            const tone = TONE_COLORS[toneOf(n)];
            return (
              <Pressable
                onPress={() => {
                  if (!n.read) markNotificationRead(n.id).catch(() => undefined);
                }}
                style={({ pressed, hovered }: any) => [
                  styles.item,
                  { borderColor: n.read ? '#E2E8F0' : tone.border, backgroundColor: n.read ? colors.white : tone.bg },
                  hovered && { borderColor: tone.bar },
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityHint={n.read ? undefined : 'Marks as read'}
              >
                <View style={[styles.dot, { backgroundColor: n.read ? '#CBD5E1' : tone.bar }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cat, { color: n.read ? colors.slate : tone.text }]}>{CATEGORY_LABEL[n.category].toUpperCase()}</Text>
                  <View style={styles.titleRow}>
                    <Text style={styles.itemTitle}>{n.title}</Text>
                    <Text style={styles.timeText}>{n.time}</Text>
                  </View>
                  <Text style={styles.itemMessage}>{n.message}</Text>
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
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  tabsWrap: { paddingHorizontal: space.md, paddingBottom: space.sm, paddingTop: space.sm },
  tabs: { gap: space.sm },
  tab: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
  },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabHovered: { backgroundColor: '#F1F5F9', borderColor: colors.slate },
  tabText: { fontFamily: fonts.medium, fontSize: 13, color: colors.slate },
  tabTextOn: { fontFamily: fonts.bold, color: colors.white },
  item: {
    flexDirection: 'row',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: space.md,
    marginBottom: space.sm,
    backgroundColor: colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  cat: { fontFamily: fonts.bold, fontSize: 10, marginBottom: 2, letterSpacing: 0.5 },
  titleRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  itemTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, flex: 1 },
  timeText: { fontFamily: fonts.regular, fontSize: 11, color: colors.slate },
  itemMessage: { fontFamily: fonts.regular, marginTop: 4, color: colors.slate, fontSize: 13, lineHeight: 18 },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.ink,
  },
  headerSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slate,
    marginTop: 1,
  },
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: radius.full,
  },
  markAllText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
  },
});

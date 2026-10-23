import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useInbox } from '../context/Inbox';
import { colors, space } from '../theme';

export function AppHeader({ right }: { right?: React.ReactNode }) {
  const navigation = useNavigation<any>();
  const { unreadCount } = useInbox();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
      <Pressable style={styles.brand} onPress={() => navigation.navigate('Tabs', { screen: 'Duties' })}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} />
        <View style={styles.wordmark}>
          <Text style={styles.title}>NESAM</Text>
          <Text style={styles.label}>PARTNER</Text>
        </View>
      </Pressable>

      <View style={styles.rightRow}>
        {right}
        <Pressable
          style={styles.bell}
          onPress={() => navigation.navigate('Alerts')}
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={20} color={colors.ink} />
          {unreadCount > 0 && <View style={styles.dot} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  wordmark: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});


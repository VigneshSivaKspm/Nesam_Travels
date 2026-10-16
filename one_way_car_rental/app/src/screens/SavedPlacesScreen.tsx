// Home / Work / favourite places (port of user/web SavedPlacesScreen.tsx).
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCustomerData } from '../context/CustomerData';
import { Button, Card, EmptyState, Notice, Segmented, TextField } from '../components/ui';
import { SubHeader } from '../components/brand';
import { PlaceSearchModal } from '../components/PlaceSearchModal';
import { deleteSavedPlace, savePlace } from '../services/userService';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import type { GeoPlace, LocationItem } from '../types';
import { describeError } from '../utils/retry';
import { colors, fonts, radius, space } from '../theme';
import { ILLUSTRATIONS } from '../assets/images';

type SaveType = 'home' | 'work' | 'favorite';
const ICON: Record<string, keyof typeof Ionicons.glyphMap> = { home: 'home-outline', work: 'briefcase-outline', favorite: 'star-outline' };

export function SavedPlacesScreen() {
  const navigation = useNavigation();
  const { profile, savedPlaces } = useCustomerData();
  const { position } = useDeviceLocation(false);
  const [adding, setAdding] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [picked, setPicked] = useState<GeoPlace | null>(null);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<SaveType>('favorite');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const reset = () => {
    setAdding(false);
    setPicked(null);
    setLabel('');
    setKind('favorite');
  };

  const add = async () => {
    if (!picked) return setError('Search for the place to save.');
    const name = kind === 'home' ? 'Home' : kind === 'work' ? 'Work' : label.trim() || picked.name;
    const existing = kind !== 'favorite' ? savedPlaces.find((p) => p.type === kind) : undefined;
    setBusy(true);
    setError('');
    try {
      await savePlace({ ...picked, id: existing?.id ?? '', name, address: picked.address, type: kind }, profile.uid);
      reset();
    } catch (e) {
      setError(describeError(e, 'Couldn’t save this place.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const remove = (p: LocationItem) =>
    Alert.alert('Remove place?', `“${p.name}” will be removed from your saved places.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setDeleting(p.id);
          setError('');
          deleteSavedPlace(p.id)
            .catch((e: unknown) => setError(describeError(e, 'Couldn’t remove this place.')))
            .finally(() => setDeleting(null));
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SubHeader
        title="Saved Places"
        subtitle="Frequent destinations for one-tap booking"
        onBack={() => navigation.goBack()}
        rightAction={
          !adding ? (
            <Pressable onPress={() => setAdding(true)} style={styles.addBtn} accessibilityRole="button">
              <Ionicons name="add" size={16} color={colors.white} />
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          ) : null
        }
      />

      <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        <PlaceSearchModal visible={searchOpen} title="Find a place" onClose={() => setSearchOpen(false)} onSelect={setPicked} near={position} />
        <Notice message={error} />

        {adding ? (
          <Card style={styles.addCard}>
            <Text style={styles.cardHeader}>Add Saved Place</Text>
            <Segmented
              options={[
                { value: 'home', label: 'Home' },
                { value: 'work', label: 'Work' },
                { value: 'favorite', label: 'Favourite' },
              ]}
              value={kind}
              onChange={setKind}
            />
            <Pressable style={styles.pick} onPress={() => setSearchOpen(true)} accessibilityRole="button">
              <Ionicons name="search" size={20} color={colors.primary} />
              <Text style={styles.pickText} numberOfLines={2}>
                {picked ? `${picked.name} — ${picked.address}` : 'Search address, street or landmark…'}
              </Text>
            </Pressable>
            {kind === 'favorite' ? (
              <TextField label="Custom Label (optional)" value={label} onChangeText={(v) => setLabel(v.slice(0, 40))} placeholder="e.g. Vacation Home, Hospital, College" />
            ) : null}
            <View style={styles.row}>
              <Button title="Cancel" variant="secondary" onPress={reset} disabled={busy} style={{ flex: 1 }} />
              <Button title={busy ? 'Saving…' : 'Save Place'} loading={busy} disabled={!picked} onPress={() => void add()} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : null}

        {savedPlaces.length === 0 && !adding ? (
          <EmptyState
            image={ILLUSTRATIONS.noSavedPlaces}
            title="No saved places yet"
            message="Add Home and Work for seamless one-tap booking."
            action={<Button title="Add First Place" onPress={() => setAdding(true)} />}
          />
        ) : (
          <View style={styles.grid}>
            {savedPlaces.map((p) => (
              <Card key={p.id} style={styles.item}>
                <View style={styles.iconBox}>
                  <Ionicons name={ICON[p.type] ?? 'location-outline'} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.placeName}>{p.name}</Text>
                  <Text style={styles.placeAddr} numberOfLines={2}>
                    {p.address}
                  </Text>
                  {p.lat == null || p.lng == null ? <Text style={styles.warn}>No map coordinates — re-add it to use for booking.</Text> : null}
                </View>
                <Button small variant="ghost" title={deleting === p.id ? '…' : 'Remove'} disabled={deleting === p.id} onPress={() => remove(p)} />
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollPad: { padding: space.md, paddingBottom: space.xxl },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addBtnText: {
    fontFamily: fonts.bold,
    color: colors.white,
    fontSize: 12,
  },
  addCard: {
    marginBottom: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
    padding: space.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  cardHeader: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginBottom: space.sm },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: radius.md,
    padding: space.md,
    marginVertical: space.sm,
    minHeight: 48,
    backgroundColor: '#F8FAFC',
  },
  pickText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.ink,
    flex: 1,
  },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  grid: { gap: space.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
    padding: space.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  placeName: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  placeAddr: { fontFamily: fonts.regular, fontSize: 12, color: colors.slate, marginTop: 1 },
  warn: { fontFamily: fonts.medium, fontSize: 11, color: colors.warning, marginTop: 2 },
});

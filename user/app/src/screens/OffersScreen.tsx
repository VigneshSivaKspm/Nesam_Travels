import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Button, Card, EmptyState } from '../components/ui';
import { SubHeader } from '../components/brand';
import { isCouponLive, subscribeToCoupons } from '../services/pricingService';
import type { Coupon } from '../types';
import { colors, fonts, radius, space } from '../theme';
import { ILLUSTRATIONS } from '../assets/images';

export function OffersScreen() {
  const navigation = useNavigation();
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => subscribeToCoupons(setCoupons), []);
  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const live = useMemo(() => (coupons ?? []).filter((c) => isCouponLive(c)), [coupons]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SubHeader title="Promotions & Coupons" subtitle="Exclusive travel offers" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        <View style={styles.bannerBox}>
          <Text style={styles.bannerTitle}>Save on every journey</Text>
          <Text style={styles.bannerSubtitle}>
            Copy any promo code below and apply it during the booking confirmation step to save on your fare.
          </Text>
        </View>

        {coupons === null ? (
          <Text style={styles.loadingText}>Loading live offers…</Text>
        ) : live.length === 0 ? (
          <EmptyState
            image={ILLUSTRATIONS.noOffers}
            title="No active offers right now"
            message="Check back soon for festival discounts and promotional coupons."
          />
        ) : (
          <View style={styles.couponGrid}>
            {live.map((c) => (
              <Card key={c.id} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>
                      {c.discountType === 'PERCENTAGE'
                        ? `${c.discountValue}% OFF`
                        : `FLAT ₹${c.discountValue} OFF`}
                    </Text>
                  </View>
                  <Text style={styles.cardTitle}>
                    {c.discountType === 'PERCENTAGE'
                      ? `${c.discountValue}% off${c.maximumDiscount ? ` (up to ₹${c.maximumDiscount})` : ''}`
                      : `₹${c.discountValue} instant discount`}
                  </Text>
                  <Text style={styles.cardDesc}>{c.description || c.name}</Text>
                  <Text style={styles.cardTerms}>
                    {c.minimumBookingAmount ? `Min booking ₹${c.minimumBookingAmount} · ` : ''}
                    {c.firstBookingOnly ? 'First trip only · ' : ''}
                    {c.validUntil ? `Valid till ${c.validUntil}` : 'No expiration date'}
                  </Text>
                </View>
                <Button
                  small
                  variant={copied === c.code ? 'secondary' : 'dark'}
                  title={copied === c.code ? 'Copied!' : `Copy ${c.code}`}
                  onPress={() => {
                    void Clipboard.setStringAsync(c.code).then(() => setCopied(c.code));
                  }}
                  accessibilityLabel={`Copy code ${c.code}`}
                />
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
  bannerBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  bannerTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.primaryDark, marginBottom: 2 },
  bannerSubtitle: { fontFamily: fonts.regular, fontSize: 12, color: colors.slate, lineHeight: 18 },
  loadingText: { fontFamily: fonts.medium, textAlign: 'center', marginTop: space.xl, color: colors.slate, fontSize: 13 },
  couponGrid: { gap: space.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginBottom: 4,
  },
  tagText: { fontFamily: fonts.bold, color: colors.white, fontSize: 10, letterSpacing: 0.5 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  cardDesc: { fontFamily: fonts.regular, fontSize: 12, color: colors.slate, marginTop: 2 },
  cardTerms: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 4 },
});

// Live offers. The Web screen filtered on a non-existent `active` field
// (always empty); this uses the same isCouponLive() check as fare validation.
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Button, Card, EmptyState, Screen } from '../components/ui';
import { DesktopHeader } from '../components/DesktopHeader';
import { isCouponLive, subscribeToCoupons } from '../services/pricingService';
import type { Coupon } from '../types';
import { colors, radius, space, type } from '../theme';
import { useResponsive } from '../theme/responsive';

export function OffersScreen() {
  const { isDesktop } = useResponsive();
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
    <Screen edges={[]}>
      <DesktopHeader
        title="Promotions & Coupons"
        subtitle="Exclusive discounts on your outstation and city travels"
        onBack={() => navigation.goBack()}
      />

      <View style={[styles.container, isDesktop && styles.desktopContainer]}>
        <View style={styles.bannerBox}>
          <Text style={styles.bannerTitle}>Save on every journey</Text>
          <Text style={styles.bannerSubtitle}>
            Copy any promo code below and apply it during the booking confirmation step to save on your fare.
          </Text>
        </View>

        {coupons === null ? (
          <Text style={[type.small, { textAlign: 'center', marginTop: space.xl }]}>Loading live offers…</Text>
        ) : live.length === 0 ? (
          <EmptyState title="No active offers right now" message="Check back soon for festival discounts and promotional coupons." />
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  desktopContainer: { maxWidth: 880, alignSelf: 'center', width: '100%', marginTop: space.md },
  bannerBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.lg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: colors.primaryDark, marginBottom: 4 },
  bannerSubtitle: { fontSize: 14, color: colors.slate, lineHeight: 20 },
  couponGrid: { gap: space.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.lg,
    borderRadius: radius.lg,
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)' as any,
  },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginBottom: 6,
  },
  tagText: { color: colors.white, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  cardDesc: { fontSize: 14, color: colors.slate, marginTop: 4 },
  cardTerms: { fontSize: 12, color: colors.muted, marginTop: 6 },
});

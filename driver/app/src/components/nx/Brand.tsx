import React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from './Text';
import { useFonts } from 'expo-font';
import { WORDMARK_FONT, nx } from '../../theme/nx';

const EMBLEM = require('../../../assets/brand/nesam-emblem.jpg');
const WORDMARK = require('../../../assets/brand/nesam-wordmark.ttf');

// The emblem JPEG has padding; the reference crops it inside a square wrapper (width 127.45%, left −13.57%, top −11.95%).
const SOURCE = { width: 512, height: 497 };

/** Emblem and wordmark lockup used in the top bar. Falls back to the system font until the wordmark face has loaded. */
export function NxBrand() {
  const [loaded] = useFonts({ [WORDMARK_FONT]: WORDMARK });
  const { width } = useWindowDimensions();
  const narrow = width <= 360;
  const symbol = narrow ? 40 : 44;
  const imgW = symbol * 1.2745;
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="NESAM Driver">
      <View style={{ width: symbol, height: symbol, overflow: 'hidden' }}>
        <Image
          source={EMBLEM}
          accessible={false}
          style={{ position: 'absolute', width: imgW, height: imgW * (SOURCE.height / SOURCE.width), left: -symbol * 0.1357, top: -symbol * 0.1195 }}
          resizeMode="contain"
        />
      </View>
      <View style={styles.text}>
        <Text
          style={[styles.name, { fontSize: narrow ? 22 : 23, letterSpacing: narrow ? 1.1 : 1.35 }, loaded ? { fontFamily: WORDMARK_FONT } : { fontWeight: '900' }]}
          numberOfLines={1}
        >
          NESAM
        </Text>
        <Text style={[styles.label, { letterSpacing: narrow ? 2.8 : 3 }]}>DRIVER</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  text: { justifyContent: 'center' },
  name: { color: nx.wordmark, lineHeight: 24 },
  label: { color: nx.label, fontSize: 9, fontWeight: '700', marginTop: 5, paddingLeft: 1 },
});

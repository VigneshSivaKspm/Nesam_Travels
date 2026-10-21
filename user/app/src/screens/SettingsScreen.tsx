// Settings / About NESAM.
import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useCustomerData } from '../context/CustomerData';
import { Card, MenuGroup, MenuRow, Row, TextButton } from '../components/ui';
import { ScrollView } from '../components/layout';
import { AppHeader } from '../components/brand';
import { isConfirmationSoundOn, playConfirmationSound, setConfirmationSound } from '../services/confirmationSound';
import { COMPANY_LEGAL_NAME, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { colors, fonts, space } from '../theme';

export function SettingsScreen() {
  const navigation = useNavigation();
  const { profile } = useCustomerData();
  const [sound, setSound] = useState(true);
  useEffect(() => {
    void isConfirmationSoundOn().then(setSound);
  }, []);
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AppHeader title="Settings" onBack={() => navigation.goBack()} />
      <ScrollView kind="narrow" contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <Card>
          <Row label="Language" value={profile.language || 'English'} />
        </Card>
        <Card>
          <View style={styles.soundRow}>
            <Text style={styles.head}>Booking confirmation sound</Text>
            <Switch
              value={sound}
              onValueChange={(v) => {
                setSound(v);
                void setConfirmationSound(v);
              }}
              trackColor={{ true: '#E59A9A', false: '#D5DAE1' }}
              thumbColor={sound ? colors.primary : '#F4F5F7'}
              accessibilityLabel="Booking confirmation sound"
            />
          </View>
          <Text style={styles.text}>A soft chime after a new booking. Turn it off anytime.</Text>
          <TextButton title="Preview sound" icon="volume-2" size={12} onPress={() => void playConfirmationSound(true)} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
        </Card>
        <Card>
          <Text style={styles.head}>About NESAM</Text>
          <Text style={styles.text}>{COMPANY_LEGAL_NAME}. Cabs & car rentals for outstation, airport and local rental journeys across Tamil Nadu.</Text>
          <View style={{ height: space.md }} />
          <Row label="Office phone" value={SUPPORT_PHONE_DISPLAY} />
          <Row label="App version" value={Constants.expoConfig?.version ?? '1.0.0'} />
        </Card>
        <MenuGroup>
          <MenuRow icon="phone" title="Call NESAM" subtitle={SUPPORT_PHONE_DISPLAY} onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
          <MenuRow icon="headphones" title="Help & Support" subtitle="Get help with your journey" onPress={() => navigation.navigate('Support')} />
          <MenuRow icon="file-text" title="Terms, privacy & cancellation" subtitle="Agreements and policies" onPress={() => navigation.navigate('LegalDocuments')} />
        </MenuGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  page: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xxl },
  soundRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  head: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.ink, marginBottom: 6 },
  text: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: '#55606F' },
});

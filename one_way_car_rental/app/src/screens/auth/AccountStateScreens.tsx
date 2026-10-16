import React from 'react';
import { Image, Linking, StyleSheet, Text } from 'react-native';
import { Button, Card, Notice, Screen } from '../../components/ui';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../../config/constants';
import { space, type } from '../../theme';
import { ILLUSTRATIONS } from '../../assets/images';

export function AccountHoldScreen({ status, onSignOut }: { status: string; onSignOut: () => void }) {
  return (
    <Screen>
      <Card style={styles.card}>
        <Image
          source={ILLUSTRATIONS.accountReview}
          style={styles.illustration}
          resizeMode="contain"
          accessible={false}
          importantForAccessibility="no"
        />
        <Text style={[type.h2, { textAlign: 'center' }]}>Account on hold</Text>
        <Text style={[type.body, styles.msg, { textAlign: 'center' }]}>
          {status ? `Your account is currently ${status.toLowerCase()}.` : 'Your account is not active yet.'} Please call {SUPPORT_PHONE_DISPLAY} for help.
        </Text>
        <Button title={`Call ${SUPPORT_PHONE_DISPLAY}`} onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
        <Button title="Sign out" variant="secondary" onPress={onSignOut} style={styles.gap} />
      </Card>
    </Screen>
  );
}

export function LoadErrorScreen({ message, onRetry, onSignOut }: { message: string; onRetry: () => void; onSignOut: () => void }) {
  return (
    <Screen>
      <Card style={styles.card}>
        <Image
          source={ILLUSTRATIONS.error}
          style={styles.illustration}
          resizeMode="contain"
          accessible={false}
          importantForAccessibility="no"
        />
        <Text style={[type.h2, { textAlign: 'center' }]}>Couldn’t load your account</Text>
        <Notice message={message} style={styles.gap} />
        <Button title="Try again" onPress={onRetry} />
        <Button title="Sign out" variant="secondary" onPress={onSignOut} style={styles.gap} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.xxl, alignItems: 'center' },
  illustration: { width: 160, height: 120, marginBottom: space.sm },
  msg: { marginVertical: space.md },
  gap: { marginTop: space.md, width: '100%' },
});

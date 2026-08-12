// MVP login: pick a username, start playing. Real Firebase
// phone/email auth plugs in here later (see config/firebaseConfig.js).

import React, { useState } from 'react';
import { Text, StyleSheet, Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Stage from '../components/Stage';
import { Panel, BigButton, CartoonInput } from '../components/ui';
import { COLORS, FONTS } from '../utils/theme';
import * as sfx from '../utils/sfx';

export default function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('');

  const handleLogin = () => {
    const name = username.trim();
    if (!name) {
      Alert.alert('Hold on', 'Please enter a username');
      return;
    }
    sfx.play('click');
    onLoginSuccess({ uid: `user_${Date.now()}`, username: name });
  };

  return (
    <Stage>
      <SafeAreaView style={styles.center}>
        <Panel>
          <Text style={styles.title}>🪽 Flyer</Text>
          <Text style={styles.subtitle}>pick a name to play</Text>
          <CartoonInput
            placeholder="e.g. Harsh"
            value={username}
            onChangeText={setUsername}
            maxLength={16}
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
          <View style={{ height: 18 }} />
          <BigButton label="Continue" onPress={handleLogin} />
          <Text style={styles.footer}>(phone/email login coming soon)</Text>
        </Panel>
      </SafeAreaView>
    </Stage>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 40,
    color: COLORS.ink,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.ink,
    opacity: 0.7,
    marginBottom: 18,
  },
  footer: {
    fontFamily: FONTS.regular,
    marginTop: 14,
    fontSize: 12,
    color: COLORS.ink,
    opacity: 0.55,
  },
});

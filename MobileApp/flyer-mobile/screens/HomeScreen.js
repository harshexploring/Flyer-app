// Home — the landing screen: Play Solo / Play with Friends.

import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Stage from '../components/Stage';
import { Panel, BigButton, SmallButton } from '../components/ui';
import { COLORS, FONTS } from '../utils/theme';
import * as sfx from '../utils/sfx';

export default function HomeScreen({ user, best, onPlaySolo, onPlayFriends, onLogout }) {
  return (
    <Stage>
      <SafeAreaView style={styles.center}>
        <Panel>
          <Text style={styles.title}>🪽 Flyer</Text>
          <Text style={styles.subtitle}>chidiya udd… tota udd… ✨</Text>

          <View style={styles.howTo}>
            <Text style={styles.howRow}>🦅  If it can fly — hit FLY</Text>
            <Text style={styles.howRow}>🐘  If it can't — hit SIT</Text>
            <Text style={styles.howRow}>⏱️  Be quick! The timer keeps shrinking…</Text>
            <Text style={styles.howRow}>💥  One mistake and you're out!</Text>
          </View>

          <BigButton
            label="Play Solo"
            onPress={() => { sfx.play('click'); onPlaySolo(); }}
          />
          <View style={{ height: 12 }} />
          <BigButton
            label="Play with Friends"
            color={COLORS.flyBlue}
            shadow={COLORS.flyBlueDark}
            onPress={() => { sfx.play('click'); onPlayFriends(); }}
          />

          <View style={styles.metaRow}>
            <Text style={styles.meta}>hi {user.username}! · best: {best}</Text>
            <SmallButton label="switch name" onPress={onLogout} />
          </View>
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
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.ink,
    opacity: 0.7,
    marginBottom: 16,
  },
  howTo: {
    backgroundColor: COLORS.panelInner,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    alignSelf: 'stretch',
    marginBottom: 20,
  },
  howRow: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.ink,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  meta: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.ink,
    opacity: 0.7,
  },
});

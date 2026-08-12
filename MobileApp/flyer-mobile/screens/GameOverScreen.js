// Solo game-over — stats panel over the stage, same wording as web.

import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Stage from '../components/Stage';
import { Panel, BigButton, SmallButton } from '../components/ui';
import { COLORS, FONTS } from '../utils/theme';
import * as sfx from '../utils/sfx';

export default function GameOverScreen({ stats, word, action, best, onPlayAgain, onHome }) {
  const why =
    action === 'timeout'
      ? `Too slow! "${word?.text}" ${word?.flies ? 'flew away' : 'just sat there'}…`
      : word?.flies
        ? `Oops — a ${word.text.toLowerCase()} does fly!`
        : `Oops — a ${word?.text.toLowerCase()} can't fly!`;

  const isNewBest = stats.survived > 0 && stats.survived >= best;

  return (
    <Stage>
      <SafeAreaView style={styles.center}>
        <Panel>
          <Text style={styles.title}>💥 Udd gaya!</Text>
          <Text style={styles.subtitle}>{why}</Text>

          <View style={styles.stats}>
            <Stat num={String(stats.survived)} label="words survived" />
            <Stat num={stats.avgMs != null ? `${stats.avgMs} ms` : '–'} label="avg reaction" />
            <Stat num={stats.bestMs != null ? `${stats.bestMs} ms` : '–'} label="fastest" />
          </View>

          {isNewBest && <Text style={styles.newBest}>🎉 New best score!</Text>}

          <BigButton
            label="Play again"
            onPress={() => { sfx.play('click'); onPlayAgain(); }}
          />
          <View style={{ height: 12 }} />
          <SmallButton
            label="Back to Home"
            onPress={() => { sfx.play('click'); onHome(); }}
          />
        </Panel>
      </SafeAreaView>
    </Stage>
  );
}

function Stat({ num, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
    fontSize: 34,
    color: COLORS.ink,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.ink,
    opacity: 0.7,
    marginTop: 4,
    marginBottom: 18,
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  stat: {
    flex: 1,
    backgroundColor: COLORS.panelInner,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statNum: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.ink,
  },
  statLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.ink,
    opacity: 0.65,
    marginTop: 2,
    textAlign: 'center',
  },
  newBest: {
    fontFamily: FONTS.bold,
    color: '#d98a00',
    marginBottom: 14,
  },
});

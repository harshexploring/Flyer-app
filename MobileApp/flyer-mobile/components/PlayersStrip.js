// Multiplayer status strip — green chips for alive players (with
// each round's reaction time), red for the eliminated. Same idea
// as the web app's players-strip.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../utils/theme';

export default function PlayersStrip({ players, myId }) {
  return (
    <View style={styles.strip}>
      {players.map((p) => (
        <View
          key={p.id}
          style={[
            styles.chip,
            p.alive ? styles.alive : styles.dead,
            p.id === myId && styles.me,
          ]}
        >
          <Text style={[styles.name, { color: p.alive ? COLORS.goodDark : COLORS.bad }]}>
            {p.name}
          </Text>
          {p.badge != null && (
            <Text style={styles.badge}>{p.badge}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 6,
    zIndex: 15,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.cardBg,
    borderWidth: 3,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  alive: {
    borderColor: COLORS.goodDark,
  },
  dead: {
    borderColor: COLORS.bad,
    opacity: 0.75,
  },
  me: {
    backgroundColor: '#fff3d6',
  },
  name: {
    fontFamily: FONTS.bold,
    fontSize: 12,
  },
  badge: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.ink,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 6,
    paddingHorizontal: 5,
    overflow: 'hidden',
  },
});

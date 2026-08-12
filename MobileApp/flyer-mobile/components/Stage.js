// The game's backdrop — sky on top, ground below, sun and clouds.
// Mirrors the web app's stage. Children render over it.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../utils/theme';

export const HORIZON = 0.56; // sky takes the top 56%, like the web app

export default function Stage({ children }) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[COLORS.skyTop, COLORS.skyBottom]}
        style={[styles.sky, { height: `${HORIZON * 100}%` }]}
      >
        <View style={styles.sun} />
        <View style={[styles.cloud, { top: '18%', left: '10%' }]} />
        <View style={[styles.cloud, styles.cloudSmall, { top: '38%', right: '18%' }]} />
        <View style={[styles.cloud, styles.cloudSmall, { top: '8%', right: '38%' }]} />
      </LinearGradient>
      <LinearGradient
        colors={[COLORS.groundTop, COLORS.groundBottom]}
        style={[styles.ground, { top: `${HORIZON * 100}%` }]}
      >
        <View style={styles.hill} />
      </LinearGradient>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.skyTop,
  },
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 4,
    borderTopColor: COLORS.groundBorder,
    overflow: 'hidden',
  },
  sun: {
    position: 'absolute',
    top: 24,
    right: 28,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffe27a',
    shadowColor: '#ffe27a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 6,
  },
  cloud: {
    position: 'absolute',
    width: 96,
    height: 30,
    borderRadius: 20,
    backgroundColor: '#fff',
    opacity: 0.95,
  },
  cloudSmall: {
    width: 64,
    height: 22,
    opacity: 0.8,
  },
  hill: {
    position: 'absolute',
    top: -60,
    left: -80,
    width: 380,
    height: 200,
    borderRadius: 190,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
});

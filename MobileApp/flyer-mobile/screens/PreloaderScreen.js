// Animated preloader — same idea as the web app: a tiny scene that
// teaches the game. The bird takes off (flies), the elephant settles
// down (sits). Plays 2 full loops (~5s), then hands over to the app.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../utils/theme';

const LOOP_MS = 2500;
const LOOPS = 2;

export default function PreloaderScreen({ onDone }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: LOOP_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      { iterations: LOOPS },
    );
    anim.start(() => onDone());
    const safety = setTimeout(onDone, LOOP_MS * LOOPS + 2000);
    return () => { anim.stop(); clearTimeout(safety); };
  }, []);

  // Bird: idle → takes off up-right → fades → back on the ground.
  const birdY = t.interpolate({
    inputRange: [0, 0.18, 0.62, 0.75, 0.76, 1],
    outputRange: [0, 0, -95, -120, 0, 0],
  });
  const birdX = t.interpolate({
    inputRange: [0, 0.18, 0.62, 0.75, 0.76, 1],
    outputRange: [0, 0, 34, 46, 0, 0],
  });
  const birdOpacity = t.interpolate({
    inputRange: [0, 0.62, 0.75, 0.76, 0.86, 1],
    outputRange: [1, 1, 0, 0, 1, 1],
  });

  // Elephant: idle → settles into a comfy squash → back up.
  const eleY = t.interpolate({
    inputRange: [0, 0.18, 0.32, 0.68, 0.84, 1],
    outputRange: [0, 0, 9, 9, 0, 0],
  });
  const eleScaleY = t.interpolate({
    inputRange: [0, 0.18, 0.32, 0.68, 0.84, 1],
    outputRange: [1, 1, 0.8, 0.8, 1, 1],
  });

  return (
    <LinearGradient
      colors={[COLORS.skyTop, COLORS.skyBottom, COLORS.groundTop]}
      locations={[0, 0.55, 0.58]}
      style={styles.root}
    >
      <Text style={styles.logo}>🪽 Flyer</Text>

      <View style={styles.scene}>
        <LinearGradient
          colors={['#c9ebff', '#c9ebff', '#a3d977']}
          locations={[0, 0.63, 0.64]}
          style={StyleSheet.absoluteFill}
        />
        <Animated.Text
          style={[
            styles.char,
            { left: 46, transform: [{ translateY: birdY }, { translateX: birdX }], opacity: birdOpacity },
          ]}
        >
          🐦
        </Animated.Text>
        <Animated.Text
          style={[
            styles.char,
            { right: 46, fontSize: 40, transform: [{ translateY: eleY }, { scaleY: eleScaleY }] },
          ]}
        >
          🐘
        </Animated.Text>
      </View>

      <View style={styles.hints}>
        <View style={styles.hint}><Text style={styles.hintTxt}>flies → up!</Text></View>
        <View style={styles.hint}><Text style={styles.hintTxt}>sits → down!</Text></View>
      </View>

      <Text style={styles.credit}>made with ❤️ @Harsh Jha</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  logo: {
    fontFamily: FONTS.bold,
    fontSize: 34,
    color: COLORS.ink,
  },
  scene: {
    width: 250,
    height: 150,
    borderWidth: 4,
    borderColor: COLORS.ink,
    borderRadius: 26,
    overflow: 'hidden',
  },
  char: {
    position: 'absolute',
    bottom: 26,
    fontSize: 36,
  },
  hints: {
    flexDirection: 'row',
    gap: 14,
  },
  hint: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 3,
    borderColor: COLORS.ink,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  hintTxt: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.ink,
  },
  credit: {
    position: 'absolute',
    bottom: 34,
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.ink,
    opacity: 0.8,
  },
});

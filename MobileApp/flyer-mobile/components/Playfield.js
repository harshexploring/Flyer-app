// The interactive game surface: word card at the horizon, FLY/SIT
// buttons, draining timer bar and full-screen flash. Owns all the
// word animations; screens drive it through a ref:
//
//   ref.current.showWord('Bird', windowMs)   word pops in, timer runs
//   ref.current.stopTimer()
//   await ref.current.resolve('flyUp' | 'settleDown' | 'burstUp'
//                             | 'burstDown' | 'shakeBurst')
//   ref.current.setEnabled(false)
//   ref.current.hideWord()

import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { COLORS, FONTS } from '../utils/theme';
import { HORIZON } from './Stage';

const Playfield = forwardRef(function Playfield({ onAnswer }, ref) {
  const [word, setWord] = useState('');
  const [enabled, setEnabled] = useState(false);

  const wordScale = useRef(new Animated.Value(0)).current;
  const wordY = useRef(new Animated.Value(0)).current;
  const wordX = useRef(new Animated.Value(0)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const timer = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const [flashColor, setFlashColor] = useState(COLORS.good);

  const runFlash = (color) => {
    setFlashColor(color);
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, { toValue: 0.55, duration: 80, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  };

  useImperativeHandle(ref, () => ({
    showWord(text, windowMs) {
      setWord(text);
      setEnabled(true);
      wordY.setValue(0);
      wordX.setValue(0);
      wordOpacity.setValue(1);
      wordScale.setValue(0);
      Animated.spring(wordScale, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }).start();

      timer.setValue(1);
      Animated.timing(timer, {
        toValue: 0,
        duration: windowMs,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    },

    stopTimer() {
      timer.stopAnimation();
    },

    setEnabled,

    hideWord() {
      wordOpacity.setValue(0);
    },

    // Play a result animation; resolves when it finishes.
    resolve(kind) {
      return new Promise((done) => {
        const finish = () => done();
        if (kind === 'flyUp') {
          runFlash(COLORS.good);
          Animated.parallel([
            Animated.timing(wordY, { toValue: -260, duration: 550, easing: Easing.back(1), useNativeDriver: true }),
            Animated.timing(wordOpacity, { toValue: 0, duration: 550, useNativeDriver: true }),
          ]).start(finish);
        } else if (kind === 'settleDown') {
          runFlash(COLORS.good);
          Animated.parallel([
            Animated.timing(wordY, { toValue: 150, duration: 480, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.timing(wordOpacity, { toValue: 0, duration: 480, useNativeDriver: true }),
          ]).start(finish);
        } else if (kind === 'burstUp') {
          runFlash(COLORS.bad);
          Animated.sequence([
            Animated.timing(wordY, { toValue: -90, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.parallel([
              Animated.timing(wordScale, { toValue: 1.6, duration: 180, useNativeDriver: true }),
              Animated.timing(wordOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
            ]),
          ]).start(finish);
        } else if (kind === 'burstDown') {
          runFlash(COLORS.bad);
          Animated.sequence([
            Animated.timing(wordY, { toValue: 100, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.parallel([
              Animated.timing(wordScale, { toValue: 1.6, duration: 180, useNativeDriver: true }),
              Animated.timing(wordOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
            ]),
          ]).start(finish);
        } else {
          // shakeBurst — timeout
          runFlash(COLORS.bad);
          Animated.sequence([
            Animated.timing(wordX, { toValue: -12, duration: 55, useNativeDriver: true }),
            Animated.timing(wordX, { toValue: 12, duration: 55, useNativeDriver: true }),
            Animated.timing(wordX, { toValue: -8, duration: 55, useNativeDriver: true }),
            Animated.timing(wordX, { toValue: 8, duration: 55, useNativeDriver: true }),
            Animated.timing(wordX, { toValue: 0, duration: 55, useNativeDriver: true }),
            Animated.parallel([
              Animated.timing(wordScale, { toValue: 1.6, duration: 180, useNativeDriver: true }),
              Animated.timing(wordOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
            ]),
          ]).start(finish);
        }
      });
    },
  }));

  return (
    <>
      {/* Word card pinned at the horizon */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.wordWrap,
          {
            opacity: wordOpacity,
            transform: [
              { translateY: wordY },
              { translateX: wordX },
              { scale: wordScale },
            ],
          },
        ]}
      >
        <View style={styles.wordCard}>
          <Text style={styles.wordTxt}>{word}</Text>
        </View>
      </Animated.View>

      {/* Buttons + timer at the bottom, well above the Android nav bar */}
      <View style={styles.controls}>
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.flyBtn, !enabled && styles.disabled]}
            onPress={() => enabled && onAnswer('fly')}
            disabled={!enabled}
            activeOpacity={0.8}
          >
            <Text style={styles.btnEmoji}>🪽</Text>
            <Text style={styles.btnLabel}>FLY</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.sitBtn, !enabled && styles.disabled]}
            onPress={() => enabled && onAnswer('ground')}
            disabled={!enabled}
            activeOpacity={0.8}
          >
            <Text style={styles.btnEmoji}>⬇️</Text>
            <Text style={styles.btnLabel}>SIT</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.timerTrack}>
          <Animated.View
            style={[
              styles.timerFill,
              {
                width: timer.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </View>

      {/* Flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: flashColor, opacity: flash },
        ]}
      />
    </>
  );
});

export default Playfield;

const styles = StyleSheet.create({
  wordWrap: {
    position: 'absolute',
    top: `${HORIZON * 100}%`,
    left: 0,
    right: 0,
    alignItems: 'center',
    marginTop: -32,
    zIndex: 5,
  },
  wordCard: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 4,
    borderColor: COLORS.ink,
    borderRadius: 999,
    paddingHorizontal: 36,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 5,
  },
  wordTxt: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    color: COLORS.ink,
    letterSpacing: 1,
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  buttons: {
    flexDirection: 'row',
    gap: 22,
  },
  actionBtn: {
    width: 130,
    borderWidth: 3,
    borderColor: COLORS.ink,
    borderBottomWidth: 7,
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
  },
  flyBtn: {
    backgroundColor: COLORS.flyBlue,
    borderBottomColor: COLORS.flyBlueDark,
  },
  sitBtn: {
    backgroundColor: COLORS.groundBrown,
    borderBottomColor: COLORS.groundBrownDark,
  },
  disabled: {
    opacity: 0.75,
  },
  btnEmoji: {
    fontSize: 26,
    marginBottom: 4,
  },
  btnLabel: {
    fontFamily: FONTS.bold,
    color: '#fff',
    fontSize: 15,
    letterSpacing: 1.5,
  },
  timerTrack: {
    width: '90%',
    height: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.25)',
    backgroundColor: 'rgba(0,0,0,0.22)',
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
});

// Small shared building blocks: top bar with back button, cartoon
// panel, chunky buttons, text input — all matching the web look.

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { COLORS, FONTS } from '../utils/theme';

// Back button lives HERE, top-left — never near the Android nav bar.
export function TopBar({ onBack, right }) {
  return (
    <View style={styles.topBar}>
      {onBack ? (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={12}>
          <Text style={styles.backTxt}>‹ Back</Text>
        </TouchableOpacity>
      ) : (
        <View />
      )}
      <View style={styles.topRight}>{right}</View>
    </View>
  );
}

export function Pill({ children, gold }) {
  return (
    <View style={[styles.pill, gold && { backgroundColor: COLORS.gold }]}>
      <Text style={styles.pillTxt}>{children}</Text>
    </View>
  );
}

export function Panel({ children, style }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function BigButton({ label, onPress, color = COLORS.accent, shadow = COLORS.accentDark, disabled, style }) {
  return (
    <TouchableOpacity
      style={[styles.bigBtn, { backgroundColor: color, borderBottomColor: shadow }, disabled && { opacity: 0.6 }, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={styles.bigBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SmallButton({ label, onPress, style }) {
  return (
    <TouchableOpacity style={[styles.smallBtn, style]} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.smallBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

export function CartoonInput(props) {
  return (
    <TextInput
      placeholderTextColor="#b8b0a4"
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
    zIndex: 20,
  },
  backBtn: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 3,
    borderColor: COLORS.ink,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  backTxt: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.ink,
  },
  topRight: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 3,
    borderColor: COLORS.ink,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillTxt: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.ink,
  },
  panel: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 4,
    borderColor: COLORS.ink,
    borderRadius: 26,
    padding: 22,
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 0,
    elevation: 6,
  },
  bigBtn: {
    borderWidth: 3,
    borderColor: COLORS.ink,
    borderBottomWidth: 7,
    borderRadius: 999,
    paddingHorizontal: 34,
    paddingVertical: 11,
    alignItems: 'center',
  },
  bigBtnTxt: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: '#fff',
    letterSpacing: 0.5,
  },
  smallBtn: {
    backgroundColor: COLORS.gold,
    borderWidth: 3,
    borderColor: COLORS.ink,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  smallBtnTxt: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.ink,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: COLORS.ink,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 17,
    fontFamily: FONTS.regular,
    color: COLORS.ink,
    width: '100%',
    textAlign: 'center',
  },
});

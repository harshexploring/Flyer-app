// Multiplayer entry: create a room or join with a 6-char code,
// then wait in the lobby until the host starts. Talks to the same
// Node server as the web app, so web and mobile players can even
// share a room.

import React, { useState, useEffect, useRef } from 'react';
import { Text, StyleSheet, View, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import Stage from '../components/Stage';
import { TopBar, Panel, BigButton, SmallButton, CartoonInput } from '../components/ui';
import { COLORS, FONTS } from '../utils/theme';
import { connectToServer, emitAck } from '../utils/net';
import * as sfx from '../utils/sfx';

export default function MultiplayerLobbyScreen({ user, onStartGame, onBack }) {
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [lobby, setLobby] = useState(null); // { code, players, maxPlayers }
  const [copied, setCopied] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    return () => {
      // Leaving this screen without a game starting → drop the socket.
      if (socketRef.current && !socketRef.current.__handedOff) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const attachLobbyEvents = (socket) => {
    socket.on('lobby:update', (data) => setLobby(data));
    socket.on('room:closed', ({ reason }) => {
      Alert.alert('Room closed', reason || 'This room no longer exists.');
      socket.disconnect();
      onBack();
    });
    socket.on('game:start', ({ players }) => {
      socket.off('lobby:update');
      socket.off('room:closed');
      socket.off('game:start');
      socket.__handedOff = true;
      onStartGame({ socket, players, myId: socket.id });
    });
    socket.on('disconnect', () => {
      if (!socket.__handedOff) setLobby(null);
    });
  };

  const enterRoom = async (mode) => {
    const joinCode = code.trim().toUpperCase();
    if (mode === 'join' && joinCode.length !== 6) {
      Alert.alert('Hmm', 'Room codes are 6 characters, like Q428HZ.');
      return;
    }
    setBusy(true);
    sfx.play('click');
    try {
      const socket = socketRef.current?.connected
        ? socketRef.current
        : await connectToServer();
      socketRef.current = socket;

      const resp = await emitAck(
        socket,
        mode === 'create' ? 'room:create' : 'room:join',
        { code: joinCode, name: user.username },
      );
      if (!resp.ok) {
        Alert.alert('Could not enter room', resp.error);
        return;
      }
      attachLobbyEvents(socket);
      setLobby({ code: resp.code, players: resp.players, maxPlayers: resp.maxPlayers });
    } catch (err) {
      Alert.alert('Connection failed', err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    try {
      await Clipboard.setStringAsync(lobby.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  // ---------------- Lobby view ----------------
  if (lobby) {
    const me = lobby.players.find((p) => p.id === socketRef.current?.id);
    const isHost = !!me?.isHost;
    return (
      <Stage>
        <SafeAreaView style={styles.fill}>
          <TopBar onBack={() => { socketRef.current?.disconnect(); onBack(); }} />
          <View style={styles.center}>
            <Panel>
              <Text style={styles.title}>🛖 Room</Text>
              <View style={styles.codeRow}>
                <View style={styles.codeBox}>
                  <Text style={styles.codeTxt}>{lobby.code}</Text>
                </View>
                <SmallButton label={copied ? 'Copied!' : 'Copy'} onPress={copyCode} />
              </View>
              <Text style={styles.hint}>
                friends: open the app → Play with Friends → enter this code
              </Text>

              <View style={styles.playerList}>
                {lobby.players.map((p) => (
                  <View key={p.id} style={styles.playerRow}>
                    <Text style={styles.playerTxt}>
                      {p.id === socketRef.current?.id ? '🫵' : '🙂'} {p.name}
                      {p.id === socketRef.current?.id ? ' (you)' : ''}
                    </Text>
                    {p.isHost && <Text style={styles.hostBadge}>HOST</Text>}
                  </View>
                ))}
              </View>
              <Text style={styles.hint}>{lobby.players.length}/{lobby.maxPlayers} players</Text>

              {isHost ? (
                <BigButton
                  label="Start game"
                  onPress={() => { sfx.play('click'); socketRef.current.emit('game:start'); }}
                />
              ) : (
                <Text style={styles.hint}>Waiting for the host to start…</Text>
              )}
            </Panel>
          </View>
        </SafeAreaView>
      </Stage>
    );
  }

  // ---------------- Create / join chooser ----------------
  return (
    <Stage>
      <SafeAreaView style={styles.fill}>
        <TopBar onBack={onBack} />
        <View style={styles.center}>
          <Panel>
            <Text style={styles.title}>👥 Play with Friends</Text>
            <Text style={styles.hint}>start a room, or join your friend's</Text>
            <View style={{ height: 12 }} />
            {busy ? (
              <ActivityIndicator size="large" color={COLORS.accent} />
            ) : (
              <>
                <BigButton label="Create a room" onPress={() => enterRoom('create')} />
                <Text style={[styles.hint, { marginVertical: 14 }]}>— or join with a code —</Text>
                <CartoonInput
                  placeholder="ABC123"
                  value={code}
                  onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  maxLength={6}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.codeInput}
                />
                <View style={{ height: 12 }} />
                <BigButton
                  label="Join"
                  color={COLORS.flyBlue}
                  shadow={COLORS.flyBlueDark}
                  onPress={() => enterRoom('join')}
                />
              </>
            )}
          </Panel>
        </View>
      </SafeAreaView>
    </Stage>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.ink,
    marginBottom: 4,
  },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.ink,
    opacity: 0.65,
    textAlign: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  codeBox: {
    backgroundColor: COLORS.panelInner,
    borderWidth: 3,
    borderColor: COLORS.ink,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  codeTxt: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    letterSpacing: 5,
    color: COLORS.ink,
  },
  codeInput: {
    letterSpacing: 5,
    fontFamily: FONTS.bold,
  },
  playerList: {
    alignSelf: 'stretch',
    gap: 8,
    marginVertical: 14,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.panelInner,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  playerTxt: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.ink,
  },
  hostBadge: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    backgroundColor: COLORS.gold,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    color: COLORS.ink,
    overflow: 'hidden',
  },
});

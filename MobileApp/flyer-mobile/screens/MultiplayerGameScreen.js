// Multiplayer game — the SERVER deals the words and judges. This
// screen mirrors the web app's multiplayer.js: it renders rounds,
// measures reaction time locally, sends answers, and shows instant
// feedback while the server stays authoritative.

import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Stage from '../components/Stage';
import Playfield from '../components/Playfield';
import PlayersStrip from '../components/PlayersStrip';
import { TopBar, Pill, Panel, BigButton, SmallButton } from '../components/ui';
import { COLORS, FONTS } from '../utils/theme';
import * as sfx from '../utils/sfx';

export default function MultiplayerGameScreen({ socket, initialPlayers, myId, onExit }) {
  const pf = useRef(null);
  const aliveRef = useRef(true);
  const answeredRef = useRef(false);
  const roundRef = useRef({ round: 0, flies: null, shownAt: 0 });
  const timeoutRef = useRef(null);
  const exitingRef = useRef(false);

  const [players, setPlayers] = useState(
    initialPlayers.map((p) => ({ ...p, alive: true, badge: null })),
  );
  const [round, setRound] = useState(0);
  const [spectator, setSpectator] = useState(false);
  const [report, setReport] = useState(null); // { report, winnerIds }

  const leave = () => {
    exitingRef.current = true;
    clearTimeout(timeoutRef.current);
    onExit();
  };

  useEffect(() => {
    sfx.play('start');

    const onRoundStart = ({ round: r, word, windowMs }) => {
      answeredRef.current = false;
      roundRef.current = { round: r, flies: word.flies, shownAt: Date.now() };
      setRound(r);
      setPlayers((ps) => ps.map((p) => (p.alive ? { ...p, badge: null } : p)));

      pf.current?.showWord(word.text, windowMs);
      pf.current?.setEnabled(aliveRef.current);
      sfx.play('appear');

      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        if (aliveRef.current && !answeredRef.current) {
          pf.current?.stopTimer();
          pf.current?.setEnabled(false);
          sfx.play('wrong');
          await pf.current?.resolve('shakeBurst');
        } else if (!aliveRef.current) {
          pf.current?.hideWord(); // spectators: word just fades
        }
      }, windowMs);
    };

    const onRoundResult = ({ outcomes, aliveIds }) => {
      setPlayers((ps) =>
        ps.map((p) => {
          const o = outcomes.find((x) => x.id === p.id);
          if (!o) return p;
          return {
            ...p,
            alive: aliveIds.includes(p.id),
            badge: o.correct
              ? `${o.reactionMs} ms`
              : o.action === 'timeout' ? '⏰' : '✗',
          };
        }),
      );
      if (aliveRef.current && !aliveIds.includes(myId)) {
        aliveRef.current = false;
        setSpectator(true);
        pf.current?.setEnabled(false);
      }
    };

    const onGameOver = ({ report: rep, winnerIds }) => {
      clearTimeout(timeoutRef.current);
      pf.current?.stopTimer();
      pf.current?.hideWord();
      sfx.play(winnerIds.includes(myId) ? 'start' : 'over');
      setReport({ report: rep, winnerIds });
    };

    const onGameStart = ({ players: fresh }) => {
      // rematch
      aliveRef.current = true;
      setSpectator(false);
      setReport(null);
      setRound(0);
      setPlayers(fresh.map((p) => ({ ...p, alive: true, badge: null })));
      sfx.play('start');
    };

    const onPlayerLeft = ({ id }) => {
      setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, alive: false, badge: '🔌' } : p)));
    };

    const onRoomClosed = ({ reason }) => {
      if (exitingRef.current) return;
      Alert.alert('Room closed', reason || 'This room no longer exists.');
      leave();
    };

    const onDisconnect = () => {
      if (exitingRef.current) return;
      Alert.alert('Disconnected', 'Lost connection to the game server.');
      leave();
    };

    socket.on('round:start', onRoundStart);
    socket.on('round:result', onRoundResult);
    socket.on('game:over', onGameOver);
    socket.on('game:start', onGameStart);
    socket.on('player:left', onPlayerLeft);
    socket.on('room:closed', onRoomClosed);
    socket.on('disconnect', onDisconnect);

    return () => {
      clearTimeout(timeoutRef.current);
      socket.off('round:start', onRoundStart);
      socket.off('round:result', onRoundResult);
      socket.off('game:over', onGameOver);
      socket.off('game:start', onGameStart);
      socket.off('player:left', onPlayerLeft);
      socket.off('room:closed', onRoomClosed);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const answer = async (action) => {
    if (!aliveRef.current || answeredRef.current) return;
    answeredRef.current = true;
    clearTimeout(timeoutRef.current);

    const { round: r, flies, shownAt } = roundRef.current;
    socket.emit('round:answer', {
      round: r,
      action,
      reactionMs: Math.round(Date.now() - shownAt),
    });

    pf.current?.stopTimer();
    pf.current?.setEnabled(false);

    // Instant local feedback; the server confirms eliminations.
    const correct = (action === 'fly') === flies;
    if (correct) {
      sfx.play(action === 'fly' ? 'fly' : 'sit');
      await pf.current?.resolve(action === 'fly' ? 'flyUp' : 'settleDown');
    } else {
      sfx.play('wrong');
      await pf.current?.resolve(action === 'fly' ? 'burstUp' : 'burstDown');
    }
  };

  // ---------------- Final report ----------------
  if (report) {
    const iWon = report.winnerIds.includes(myId);
    const isHost = !!players.find((p) => p.id === myId)?.isHost;
    const winnerName = report.report.find((r) => r.winner)?.name;
    return (
      <Stage>
        <SafeAreaView style={styles.fill}>
          <View style={styles.center}>
            <Panel style={{ maxWidth: 420 }}>
              <Text style={styles.title}>
                {report.winnerIds.length === 0 ? '💥 Everyone udd gaya!' : iWon ? '🏆 You win!' : '🏁 Game over!'}
              </Text>
              <Text style={styles.hint}>
                {report.winnerIds.length ? `${winnerName} is the last one standing` : "it's a draw"}
              </Text>

              <View style={styles.table}>
                <View style={[styles.row, styles.headRow]}>
                  <Text style={[styles.cellName, styles.headTxt]}>Player</Text>
                  <Text style={[styles.cell, styles.headTxt]}>Result</Text>
                  <Text style={[styles.cellSm, styles.headTxt]}>✓</Text>
                  <Text style={[styles.cell, styles.headTxt]}>Avg</Text>
                </View>
                {report.report.map((r) => (
                  <View key={r.id} style={[styles.row, r.winner && styles.winnerRow]}>
                    <Text style={styles.cellName} numberOfLines={1}>
                      {r.winner ? '🏆 ' : ''}{r.name}{r.id === myId ? ' (you)' : ''}
                    </Text>
                    <Text style={styles.cell}>
                      {r.winner ? 'Winner' : r.left ? 'Left' : `Out·${r.eliminatedRound}`}
                    </Text>
                    <Text style={styles.cellSm}>{r.correct}</Text>
                    <Text style={styles.cell}>{r.avgMs != null ? `${r.avgMs}ms` : '–'}</Text>
                  </View>
                ))}
              </View>

              {isHost ? (
                <BigButton
                  label="Play again"
                  onPress={() => { sfx.play('click'); socket.emit('game:start'); }}
                />
              ) : (
                <Text style={styles.hint}>Waiting for the host to restart…</Text>
              )}
              <View style={{ height: 12 }} />
              <SmallButton label="Leave" onPress={leave} />
            </Panel>
          </View>
        </SafeAreaView>
      </Stage>
    );
  }

  // ---------------- Live game ----------------
  return (
    <Stage>
      <SafeAreaView style={styles.fill}>
        <TopBar onBack={leave} right={<Pill>Word {Math.max(0, round - 1)}</Pill>} />
        <PlayersStrip players={players} myId={myId} />
        {spectator && (
          <View style={styles.spectator}>
            <Text style={styles.spectatorTxt}>💥 You're out! Watching the others…</Text>
          </View>
        )}
        <Playfield ref={pf} onAnswer={answer} />
      </SafeAreaView>
    </Stage>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.ink,
  },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.ink,
    opacity: 0.65,
    textAlign: 'center',
    marginTop: 4,
  },
  spectator: {
    alignSelf: 'center',
    backgroundColor: COLORS.cardBg,
    borderWidth: 3,
    borderColor: COLORS.bad,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 5,
    marginTop: 6,
    zIndex: 15,
  },
  spectatorTxt: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.bad,
  },
  table: {
    alignSelf: 'stretch',
    marginVertical: 16,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.panelInner,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  headRow: {
    backgroundColor: 'transparent',
    paddingVertical: 2,
  },
  headTxt: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    opacity: 0.55,
    textTransform: 'uppercase',
  },
  cellName: {
    flex: 2.2,
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.ink,
  },
  cell: {
    flex: 1.3,
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.ink,
    textAlign: 'center',
  },
  cellSm: {
    flex: 0.5,
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.ink,
    textAlign: 'center',
  },
  winnerRow: {
    backgroundColor: COLORS.gold,
  },
});

// Solo game — sudden death, shrinking window. Drives the shared
// Playfield exactly like the web app's main.js drives its UI.

import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import Stage from '../components/Stage';
import Playfield from '../components/Playfield';
import { TopBar, Pill } from '../components/ui';
import { Game } from '../utils/gameLogic';
import { WORDS } from '../utils/words';
import * as sfx from '../utils/sfx';
import GameOverScreen from './GameOverScreen';

const BREATHER_MS = 180; // tiny pause between words

export default function GameScreen({ onBack, onScore, best }) {
  const gameRef = useRef(null);
  if (!gameRef.current) gameRef.current = new Game(WORDS);
  const game = gameRef.current;

  const pf = useRef(null);
  const deadlineRef = useRef(null);
  const [round, setRound] = useState(0);
  const [over, setOver] = useState(null); // { stats, word, action }

  const showRound = () => {
    setRound(game.round);
    pf.current?.showWord(game.currentWord.text, game.windowMs());
    sfx.play('appear');
    clearTimeout(deadlineRef.current);
    deadlineRef.current = setTimeout(() => resolveAnswer('timeout'), game.windowMs());
  };

  const resolveAnswer = async (action) => {
    if (!game.awaitingAnswer) return;
    clearTimeout(deadlineRef.current);
    pf.current?.stopTimer();
    pf.current?.setEnabled(false);

    const result = game.answer(action);

    let kind;
    if (result.correct) {
      sfx.play(action === 'fly' ? 'fly' : 'sit');
      kind = action === 'fly' ? 'flyUp' : 'settleDown';
    } else {
      sfx.play('wrong');
      kind = action === 'timeout' ? 'shakeBurst' : action === 'fly' ? 'burstUp' : 'burstDown';
    }
    await pf.current?.resolve(kind);

    if (game.playing) {
      setTimeout(() => {
        game.nextRound();
        showRound();
      }, BREATHER_MS);
    } else {
      const stats = game.stats();
      onScore?.(stats.survived);
      sfx.play('over');
      setOver({ stats, word: result.word, action: result.action });
    }
  };

  const startGame = () => {
    setOver(null);
    sfx.play('start');
    game.start();
    setTimeout(showRound, 420); // let the jingle breathe
  };

  useEffect(() => {
    startGame();
    return () => clearTimeout(deadlineRef.current);
  }, []);

  if (over) {
    return (
      <GameOverScreen
        stats={over.stats}
        word={over.word}
        action={over.action}
        best={best}
        onPlayAgain={startGame}
        onHome={onBack}
      />
    );
  }

  return (
    <Stage>
      <SafeAreaView style={{ flex: 1 }}>
        <TopBar
          onBack={onBack}
          right={<Pill>Word {Math.max(0, round - 1)}</Pill>}
        />
        <Playfield ref={pf} onAnswer={resolveAnswer} />
      </SafeAreaView>
    </Stage>
  );
}

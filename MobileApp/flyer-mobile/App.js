// App entry — loads the Fredoka font + sounds, plays the preloader,
// then simple state-based navigation:
//   preloader → login → home → solo game
//                            → multiplayer lobby → multiplayer game

import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Fredoka_500Medium,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';

import PreloaderScreen from './screens/PreloaderScreen';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import GameScreen from './screens/GameScreen';
import MultiplayerLobbyScreen from './screens/MultiplayerLobbyScreen';
import MultiplayerGameScreen from './screens/MultiplayerGameScreen';
import * as sfx from './utils/sfx';
import { COLORS } from './utils/theme';

export default function App() {
  const [fontsLoaded] = useFonts({
    Fredoka_500Medium,
    Fredoka_700Bold,
  });

  const [phase, setPhase] = useState('preload'); // 'preload' → app
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('home'); // 'home' | 'solo' | 'lobby' | 'mp'
  const [mpSession, setMpSession] = useState(null); // { socket, players, myId }
  const [best, setBest] = useState(0);

  useEffect(() => {
    sfx.initSfx();
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: COLORS.skyTop }} />;
  }

  if (phase === 'preload') {
    return <PreloaderScreen onDone={() => setPhase('app')} />;
  }

  const goHome = () => {
    if (mpSession?.socket) {
      mpSession.socket.disconnect();
      setMpSession(null);
    }
    setScreen('home');
  };

  if (!user) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <LoginScreen onLoginSuccess={(u) => { setUser(u); setScreen('home'); }} />
      </SafeAreaProvider>
    );
  }

  let content;
  if (screen === 'solo') {
    content = (
      <GameScreen
        onBack={goHome}
        best={best}
        onScore={(s) => setBest((b) => Math.max(b, s))}
      />
    );
  } else if (screen === 'lobby') {
    content = (
      <MultiplayerLobbyScreen
        user={user}
        onStartGame={(session) => { setMpSession(session); setScreen('mp'); }}
        onBack={goHome}
      />
    );
  } else if (screen === 'mp' && mpSession) {
    content = (
      <MultiplayerGameScreen
        socket={mpSession.socket}
        initialPlayers={mpSession.players}
        myId={mpSession.myId}
        onExit={goHome}
      />
    );
  } else {
    content = (
      <HomeScreen
        user={user}
        best={best}
        onPlaySolo={() => setScreen('solo')}
        onPlayFriends={() => setScreen('lobby')}
        onLogout={() => setUser(null)}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {content}
    </SafeAreaProvider>
  );
}

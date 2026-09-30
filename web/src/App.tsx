import { useState } from 'react';
import type { CollectSpec } from '@children-games/shared';
import Home from './pages/Home';
import Game from './pages/Game';
import Converse from './pages/Converse';
import { GAMES } from './game/specs';

type Route =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'modify'; sessionId: string }
  | { name: 'game'; spec: CollectSpec; sessionId?: string };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });

  if (route.name === 'create') {
    return (
      <Converse
        onBack={() => setRoute({ name: 'home' })}
        onSpec={(spec, sessionId) => setRoute({ name: 'game', spec, sessionId })}
      />
    );
  }
  if (route.name === 'modify') {
    return (
      <Converse
        sessionId={route.sessionId}
        onBack={() => setRoute({ name: 'home' })}
        onSpec={(spec, sessionId) => setRoute({ name: 'game', spec, sessionId })}
      />
    );
  }
  if (route.name === 'game') {
    return (
      <Game
        spec={route.spec}
        sessionId={route.sessionId}
        onBack={() => setRoute({ name: 'home' })}
        onModify={(sessionId) => setRoute({ name: 'modify', sessionId })}
      />
    );
  }
  return (
    <Home
      onPlay={(id) => {
        const g = GAMES.find((x) => x.id === id);
        if (g) setRoute({ name: 'game', spec: g.spec });
      }}
      onCreate={() => setRoute({ name: 'create' })}
    />
  );
}

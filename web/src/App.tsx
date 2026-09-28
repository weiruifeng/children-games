import { useState } from 'react';
import type { CollectSpec } from '@children-games/shared';
import Home from './pages/Home';
import Game from './pages/Game';
import Create from './pages/Create';
import { GAMES } from './game/specs';

type Route =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'game'; spec: CollectSpec };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });

  if (route.name === 'create') {
    return (
      <Create
        onBack={() => setRoute({ name: 'home' })}
        onCreated={(spec) => setRoute({ name: 'game', spec })}
      />
    );
  }
  if (route.name === 'game') {
    return <Game spec={route.spec} onBack={() => setRoute({ name: 'home' })} />;
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

import { useState } from 'react';
import Home from './pages/Home';
import Game from './pages/Game';

type Route = { name: 'home' } | { name: 'game'; id: string };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  if (route.name === 'game') {
    return <Game id={route.id} onBack={() => setRoute({ name: 'home' })} />;
  }
  return <Home onPlay={(id) => setRoute({ name: 'game', id })} />;
}

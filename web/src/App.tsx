import { useEffect, useState } from 'react';
import type { CollectSpec } from '@children-games/shared';
import Home from './pages/Home';
import Game from './pages/Game';
import Converse from './pages/Converse';
import { GAMES } from './game/specs';
import { createSavedGame, listSavedGames, restoreGameVersion, saveGameVersion, type SavedGame } from './service/game-api';

type Route =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'modify'; sessionId: string; spec: CollectSpec }
  | { name: 'game'; spec: CollectSpec; sessionId?: string; gameId?: string };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);

  const refreshSavedGames = async () => setSavedGames(await listSavedGames());
  useEffect(() => { void refreshSavedGames().catch(() => setSavedGames([])); }, []);

  const saveCurrentGame = async (spec: CollectSpec, gameId?: string, sessionId?: string) => {
    const saved = gameId ? await saveGameVersion(gameId, spec) : await createSavedGame(spec);
    setRoute({ name: 'game', spec: saved.spec, gameId: saved.gameId, sessionId });
    await refreshSavedGames();
  };

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
        mode="modify"
        onBack={() => setRoute({ name: 'game', spec: route.spec, sessionId: route.sessionId })}
        onSpec={(spec, sessionId) => setRoute({ name: 'game', spec, sessionId })}
      />
    );
  }
  if (route.name === 'game') {
    return (
      <Game
        spec={route.spec}
        sessionId={route.sessionId}
        gameId={route.gameId}
        onBack={() => setRoute({ name: 'home' })}
        onModify={(sessionId) => setRoute({ name: 'modify', sessionId, spec: route.spec })}
        onSave={() => saveCurrentGame(route.spec, route.gameId, route.sessionId)}
        onRestore={async (versionId) => {
          if (!route.gameId) return;
          const saved = await restoreGameVersion(route.gameId, versionId);
          setRoute({ name: 'game', spec: saved.spec, gameId: saved.gameId, sessionId: route.sessionId });
          await refreshSavedGames();
        }}
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
      savedGames={savedGames}
      onPlaySaved={(saved) => setRoute({ name: 'game', spec: saved.spec, gameId: saved.gameId })}
    />
  );
}

import { useRef, useState, type KeyboardEvent } from 'react';
import { BOARD, LEVELS, PLANTS, type GardenState, type PlantKind } from '@children-games/shared';
import { canDropPlant } from './touchBoard';
import { GardenModal } from './GardenModal';
import './deployment-board.css';

export function DeploymentBoard({
  kind,
  state,
  onDeploy,
  onCancel,
}: {
  kind: PlantKind;
  state: GardenState;
  onDeploy: (row: number, col: number) => void;
  onCancel: () => void;
}) {
  const rows = LEVELS[state.level - 1].rows;
  const [position, setPosition] = useState({ row: rows[0], col: 0 });
  const [message, setMessage] = useState('');
  const cells = useRef(new Map<string, HTMLButtonElement>());
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    const index = rows.indexOf(position.row);
    const next = {
      row: rows[Math.max(0, Math.min(rows.length - 1, index + move[0]))],
      col: Math.max(0, Math.min(BOARD.columns - 1, position.col + move[1])),
    };
    setPosition(next);
    cells.current.get(`${next.row}:${next.col}`)?.focus();
  }
  return (
    <GardenModal label="选择部署位置" className="deployment-dialog">
      <h2>部署{PLANTS[kind].name}</h2>
      <p>方向键选择小路和空地，回车放置，Esc 取消。</p>
      <div
        role="grid"
        tabIndex={-1}
        aria-label="可部署空地"
        className="deployment-grid"
        onKeyDown={keyDown}
      >
        {rows.map((row) => (
          <div role="row" key={row}>
            {Array.from({ length: BOARD.columns }, (_, col) => {
              const valid = canDropPlant(state, kind, row, col);
              return (
                <div role="gridcell" key={col}>
                  <button
                    ref={(node) => {
                      const key = `${row}:${col}`;
                      if (node) cells.current.set(key, node);
                      else cells.current.delete(key);
                    }}
                    tabIndex={position.row === row && position.col === col ? 0 : -1}
                    aria-label={`第${row + 1}路第${col + 1}格${valid ? '，可以部署' : '，暂不可部署'}`}
                    aria-disabled={!valid}
                    onFocus={() => setPosition({ row, col })}
                    onClick={() => {
                      if (valid) onDeploy(row, col);
                      else setMessage('这里暂时不能部署，请选择空地并确认露珠和伙伴准备状态。');
                    }}
                  >
                    {row + 1} · {col + 1}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p role="status">{message}</p>
      <button onClick={onCancel}>取消部署</button>
    </GardenModal>
  );
}

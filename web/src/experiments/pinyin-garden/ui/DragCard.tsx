import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
type Size = { width: number; height: number };
/** The ghost is a board-sized character, not a second copy of the shop card. */
export function DragCard({
  children,
  disabled,
  chosen,
  onPlace,
  className,
  onDrop,
  onDragMove,
  onDragEnd,
  dragContent,
  getDragSize,
  blockedReason,
  onBlocked,
}: {
  children: ReactNode;
  disabled?: boolean;
  chosen?: boolean;
  onPlace: () => void;
  className?: string;
  onDrop?: (x: number, y: number) => void;
  onDragMove?: (x: number, y: number) => void;
  onDragEnd?: () => void;
  dragContent?: ReactNode;
  getDragSize?: () => Size;
  blockedReason?: string;
  onBlocked?: (reason: string) => void;
}) {
  const gesture = useRef<{ id: number; x: number; y: number; moved: boolean; size: Size } | null>(
    null,
  );
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<({ x: number; y: number } & Size) | null>(null);
  const clear = () => {
    gesture.current = null;
    setGhost(null);
    onDragEnd?.();
  };
  return (
    <>
      <button
        className={`${className ?? 'ammo-chip'} ${chosen ? 'chosen' : ''} ${blockedReason ? 'unavailable' : ''}`}
        disabled={disabled}
        aria-disabled={disabled || !!blockedReason}
        onPointerDown={(e) => {
          if (disabled || blockedReason) return;
          suppressClick.current = false;
          gesture.current = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            moved: false,
            size: getDragSize?.() ?? { width: 86, height: 86 },
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g || g.id !== e.pointerId) return;
          if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 7) g.moved = true;
          if (g.moved) {
            const y = e.clientY - g.size.height / 2 - 12;
            setGhost({ x: e.clientX, y, ...g.size });
            onDragMove?.(e.clientX, y);
          }
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          if (!g || g.id !== e.pointerId) return;
          suppressClick.current = g.moved;
          if (g.moved && !disabled && !blockedReason)
            onDrop?.(e.clientX, e.clientY - g.size.height / 2 - 12);
          clear();
        }}
        onPointerCancel={() => {
          suppressClick.current = true;
          clear();
        }}
        onLostPointerCapture={() => {
          if (gesture.current) {
            suppressClick.current = gesture.current.moved;
            clear();
          }
        }}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          if (blockedReason) {
            onBlocked?.(blockedReason);
            return;
          }
          onPlace();
        }}
      >
        {children}
      </button>
      {ghost &&
        createPortal(
          <div
            aria-hidden="true"
            className="drag-card-ghost"
            style={{ left: ghost.x, top: ghost.y, width: ghost.width, height: ghost.height }}
          >
            {dragContent ?? children}
          </div>,
          document.body,
        )}
    </>
  );
}

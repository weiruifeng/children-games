import {useRef, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';

/** Pointer events support mouse, pen and touch without native HTML drag limitations. */
export function DragCard({children, disabled, chosen, onPlace, className, onDrop, onDragMove, onDragEnd}: {
 children: ReactNode; disabled?: boolean; chosen?: boolean; onPlace: () => void; className?:string; onDrop?:(x:number,y:number)=>void; onDragMove?:(x:number,y:number)=>void; onDragEnd?:()=>void;
}) {
 const ghostElement=useRef<HTMLDivElement>(null);
 const visualY=(y:number)=>y-(ghostElement.current?.getBoundingClientRect().height??86)*.55;
 const gesture = useRef<{id:number;x:number;y:number;moved:boolean}|null>(null);
 const suppressClick = useRef(false);
 const [ghost,setGhost] = useState<{x:number;y:number}|null>(null);
 return <><button className={`${className??'ammo-chip'} ${chosen?'chosen':''}`} disabled={disabled}
  onPointerDown={e=>{if(disabled)return;suppressClick.current=false;gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}}
  onPointerMove={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>7)g.moved=true;if(g.moved){setGhost({x:e.clientX,y:e.clientY});onDragMove?.(e.clientX,visualY(e.clientY));}}}
  onPointerUp={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;gesture.current=null;setGhost(null);suppressClick.current=g.moved;
   if(g.moved&&!disabled){if(onDrop){onDrop(e.clientX,visualY(e.clientY));}else {const zones=[...document.querySelectorAll('[data-ammo-pocket], .game-canvas canvas')];if(zones.some(zone=>{const r=zone.getBoundingClientRect();const tolerance=zone.tagName==='CANVAS'?0:16;return e.clientX>=r.left-tolerance&&e.clientX<=r.right+tolerance&&e.clientY>=r.top-tolerance&&e.clientY<=r.bottom+tolerance;}))onPlace();}}onDragEnd?.();
  }}
  onPointerCancel={()=>{gesture.current=null;setGhost(null);suppressClick.current=true;onDragEnd?.();}}
  onLostPointerCapture={()=>{gesture.current=null;setGhost(null);onDragEnd?.();}}
  onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}onPlace();}}>{children}</button>
  {ghost&&createPortal(<div ref={ghostElement} aria-hidden="true" className="drag-card-ghost" style={{left:ghost.x,top:ghost.y}}>{children}</div>,document.body)}
 </>;
}

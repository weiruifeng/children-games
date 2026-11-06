import {useEffect,useRef,type ReactNode} from 'react';
/** No backdrop dismissal: a stray touch must not resume a child's battle. */
export function GardenModal({children,label,className=''}:{children:ReactNode;label:string;className?:string}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const root=ref.current;root?.focus();const trap=(e:KeyboardEvent)=>{if(e.key!=='Tab')return;const elements=[...root!.querySelectorAll<HTMLElement>('button:not(:disabled),input,a[href],[tabindex="0"]')];const first=elements[0],last=elements.at(-1);if(!first){e.preventDefault();return;}if(e.shiftKey&&(document.activeElement===first||document.activeElement===root)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===root)){e.preventDefault();first.focus();}};root?.addEventListener('keydown',trap);return()=>{root?.removeEventListener('keydown',trap);if(previous?.isConnected)previous.focus();};},[]);
 return <div className={`modal-shade ${className}`}><div className="garden-panel" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>{children}</div></div>;
}

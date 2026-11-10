import {useEffect,useRef,useState,type ReactNode} from 'react';
import {WajiIcon} from '../ui/Waji';
import {assetUrl} from '../experiments/pinyin-garden/assets/assetUrl';
export const gardenBackdrop={get backgroundImage(){return `linear-gradient(110deg, #f7f4dd80, #e9efd326), url("${assetUrl('backgrounds/bg_battle_day.png')}")`;}};
export function SiteIcon({name='leaf'}:{name?:'leaf'|'key'|'people'|'book'|'check'|'arrow'|'close'|'copy'|'shield'}){
 const paths={leaf:'M19 3C9 2 3 6 4 13s11 9 15-10ZM5 19l9-10',key:'M14 3a6 6 0 1 0 4 10l3-3-3-3-2 2M9 14l-6 6m2-2 2 2',people:'M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9v-2a6 6 0 0 1 12 0v2m2-17a4 4 0 0 1 0 8m2 3a5 5 0 0 1 4 5',book:'M12 6v15M3 4v15c3-1 6-1 9 2 3-3 6-3 9-2V4c-3-1-6-1-9 2-3-3-6-3-9-2Z',check:'m5 12 4 4L19 6',arrow:'M4 12h15m-6-6 6 6-6 6',close:'m6 6 12 12M6 18 18 6',copy:'M8 8h12v13H8ZM4 16H2V2h13v2',shield:'m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Zm-4 9 3 3 5-6'};
 return <svg className="site-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
export function useSiteMotion(){
 const [reduced,setReduced]=useState(()=>{try{return localStorage.getItem('waji-reduced-motion')==='true';}catch{return false;}});
 useEffect(()=>{const read=()=>{try{setReduced(localStorage.getItem('waji-reduced-motion')==='true');}catch{}};window.addEventListener('storage',read);window.addEventListener('garden-motion',read);return()=>{window.removeEventListener('storage',read);window.removeEventListener('garden-motion',read);};},[]);
 const toggle=()=>{const next=!reduced;setReduced(next);try{localStorage.setItem('waji-reduced-motion',String(next));window.dispatchEvent(new Event('garden-motion'));}catch{}};
 return {reduced,toggle};
}
export function SiteHeader({children,onToggleMotion,reduced}:{children?:ReactNode;onToggleMotion?:()=>void;reduced?:boolean}){
 return <header className="site-ui site-topbar"><a href="/" className="site-brand"><WajiIcon/><span>挖机的学习小世界<small>一起照顾每一颗拼音种子</small></span></a><nav aria-label="账号导航" className="site-top-actions">{children}{onToggleMotion&&<button className="site-button site-quiet" aria-pressed={reduced} onClick={onToggleMotion}>减少动态：{reduced?'开':'关'}</button>}</nav></header>;
}
export function SiteNotice({children,kind='info'}:{children:ReactNode;kind?:'info'|'success'|'error'}){return <div className={`site-ui site-notice notice-${kind}`} role={kind==='error'?'alert':'status'}><span className="notice-symbol" aria-hidden="true">{kind==='success'?'✓':kind==='error'?'!':'i'}</span><span>{children}</span></div>;}
export function SiteDialog({title,children,onClose,locked=false,className=''}:{title:string;children:ReactNode;onClose:()=>void;locked?:boolean;className?:string}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=ref.current,previous=document.activeElement as HTMLElement|null;el?.showModal();return()=>{el?.close();if(previous?.isConnected)previous.focus();};},[]);
 return <dialog ref={ref} className={`site-dialog site-ui ${className}`} aria-label={title} onCancel={e=>{e.preventDefault();if(!locked)onClose();}}><header className="site-dialog-heading"><div><span className="site-eyebrow"><SiteIcon/> 拼音花园</span><h2>{title}</h2></div><button type="button" className="site-button site-icon-button" aria-label="关闭" disabled={locked} onClick={onClose}><SiteIcon name="close"/></button></header>{children}</dialog>;
}
export type Confirmation={title:string;description:string;confirmLabel?:string;run:()=>Promise<unknown>};
export function ConfirmDialog({value,onCancel,onConfirm,busy=false}:{value:Confirmation;onCancel:()=>void;onConfirm:()=>void;busy?:boolean}){return <SiteDialog title={value.title} onClose={onCancel} locked={busy} className="site-confirm"><p className="confirm-description">{value.description}</p><div className="site-button-row"><button className="site-button" onClick={onCancel} disabled={busy}>先不操作</button><button className="site-button site-danger" onClick={onConfirm} disabled={busy}>{busy?'正在处理…':value.confirmLabel??'确认操作'}</button></div></SiteDialog>;}

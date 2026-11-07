import {useState} from 'react';
import './waji.css';

type Mood = 'welcome' | 'happy' | 'think' | 'encourage' | 'victory';
const crops: Record<Mood,string> = {
  welcome:'135 10 325 615', victory:'135 10 325 615', happy:'735 90 380 465',
  think:'110 685 410 490', encourage:'710 685 410 490',
};
const labels: Record<Mood,string> = {victory:'挖机全身庆祝',welcome:'挖机挥手欢迎',happy:'挖机开心庆祝',think:'挖机一起思考',encourage:'挖机为你加油'};

/** Transparent artwork. Animation is decorative and never controls game timing. */
export function Waji({mood='welcome',animate=false,className=''}:{mood?:Mood;animate?:boolean;className?:string}) {
  return <svg className={`waji waji-${mood} ${animate?'waji-motion':''} ${className}`} viewBox={crops[mood]} role="img" aria-label={labels[mood]}>
    <image href="/assets/waji/characters.png" width="1280" height="1280"/>
  </svg>;
}
export function WajiIcon({className=''}:{className?:string}) {
  return <svg className={`waji-icon ${className}`} viewBox="496 574 303 286" role="img" aria-label="拼音花园">
    <image href="/assets/waji/reference.png" width="1536" height="1024"/>
  </svg>;
}
const greetings=['点点我，打个招呼','嗨！今天也一起发现新东西吧！','准备好了，我们一起出发！'];
export function WajiGreeting({className=''}:{className?:string}) {
  const [greeting,setGreeting]=useState(0);
  return <div className={`waji-greeting ${className}`}>
    <button type="button" className="waji-greet-button" aria-label="和挖机打招呼" onClick={()=>setGreeting(n=>n+1)}>
      <Waji key={greeting} animate/>
    </button>
    <div className="waji-greeting-messages">{greetings.map(text=><span key={text} className="waji-greeting-copy waji-greeting-reserve" aria-hidden="true">{text}</span>)}<span className="waji-greeting-copy" aria-live="polite">{greetings[greeting===0?0:greeting%2?1:2]}</span></div>
  </div>;
}

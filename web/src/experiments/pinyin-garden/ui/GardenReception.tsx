import {useState} from 'react';
import {Waji} from '../../../ui/Waji';
import './garden-reception.css';
const tips=[
  '我把伙伴叫来啦，选一个花园就出发！',
  '遇到不会的也没关系，我们可以一起慢慢拼。',
  '准备好了吗？今天也勇敢地试一次！',
];
const moods=['happy','think','encourage'] as const;
const partnerTips=['豆荚伙伴准备好啦！','露珠伙伴准备好啦！','藤蔓伙伴准备好啦！'];
export function GardenReception({partner}:{partner:number|null}){
  const [turn,setTurn]=useState(0);
  const mood=partner===null?moods[turn%3]:'encourage';
  const message=partner===null?tips[turn%3]:partnerTips[partner];
  return <div className="garden-reception">
    <div className="reception-stage">
      <div className="reception-arch" aria-hidden="true"/>
      <button type="button" className="reception-guide" aria-label="和挖机聊聊" onClick={()=>setTurn(n=>n+1)}>
        <Waji key={`${turn}:${partner}`} mood={mood} animate/>
      </button>
      <i className="reception-leaf leaf-one" aria-hidden="true"/><i className="reception-leaf leaf-two" aria-hidden="true"/><i className="reception-leaf leaf-three" aria-hidden="true"/>
      <div className="reception-flowerbed">挖机的小苗圃</div>
    </div>
    <div className="reception-bubble">{[...tips,...partnerTips].map(text=><span key={text} aria-hidden="true" className="reception-reserve">{text}</span>)}<span aria-live="polite">{message}</span></div>
    <span className="reception-hint">点点挖机，看看他的出发提示</span>
  </div>;
}

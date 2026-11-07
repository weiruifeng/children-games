import {useState} from 'react';
import {WajiGreeting,WajiIcon} from '../ui/Waji';
import './learning-home.css';
const gardenUrl='/experiments/pinyin-garden/';
export default function LearningHome(){
  const [reduced,setReduced]=useState(()=>{try{return localStorage.getItem('waji-reduced-motion')==='true';}catch{return false;}});
  const toggleMotion=()=>{const next=!reduced;setReduced(next);try{localStorage.setItem('waji-reduced-motion',String(next));}catch{}};
  return <div className={`learning-world ${reduced?'reduced-motion':''}`}>
    <header className="world-header"><a className="world-brand" href="/" aria-label="挖机的学习小世界首页"><WajiIcon/><span>挖机的学习小世界</span></a><button className="world-motion-toggle" aria-pressed={reduced} onClick={toggleMotion}>减少动态{reduced?'：开':'：关'}</button></header>
    <main className="world-main" aria-labelledby="world-title">
      <div className="world-heading"><span className="world-pennant">今天的冒险，从这里开始</span><h1 id="world-title">挖机的<span>学习小世界</span></h1><p>选一个小世界，和伙伴一起出发！</p></div>
      <div className="world-playfield">
        <div className="world-character"><div className="world-character-label">小小园丁 · 挖机</div><WajiGreeting/><div className="world-ground" aria-hidden="true"/></div>
        <a className="world-portal" href={gardenUrl} aria-label="进入拼音花园"><span className="portal-ribbon">现在出发</span><div className="portal-window"><div className="portal-letters" aria-hidden="true"><span>a</span><span>o</span><span>e</span></div><div className="portal-partners" aria-hidden="true"><img src="/assets/pinyin-garden/characters/plant_dew_collector.png" alt=""/><img src="/assets/pinyin-garden/characters/plant_pod_slinger.png" alt=""/><img src="/assets/pinyin-garden/characters/plant_vine_guard.png" alt=""/></div></div><div className="portal-sign"><h2>拼音花园</h2><p>拼好音节，守护小苗圃</p></div><span className="world-primary">进入花园 <span aria-hidden="true">▶</span></span></a>
      </div>
      <footer className="world-coming"><span className="future-sign"><b>识字乐园</b><small>正在种下新种子</small></span><span className="future-sign"><b>数学乐园</b><small>正在搭建小世界</small></span></footer>
    </main>
  </div>;
}

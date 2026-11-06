import Phaser from 'phaser';
import {cellX,rowY,type GardenState} from '@children-games/shared';
type View={image:Phaser.GameObjects.Image;hp:number;kind:string;hit:number;fire:number;exit:number|null;exitScaleX:number;exitScaleY:number;seen:boolean};
/** Visuals follow simulation events; they never apply damage or award points. */
export class EntityViews {
 private props=new Map<string,Phaser.GameObjects.Image>();
 private views=new Map<string,View>();private eventId=0;private run:GardenState|null=null;
 private sparks:{type:string;x:number;y:number;at:number}[]=[];
 constructor(private scene:Phaser.Scene,private fx:Phaser.GameObjects.Graphics,private actorSize:()=>number){}
 update(s:GardenState,time:number,reduced:boolean){
  if(this.run!==s){for(const v of this.views.values())v.image.destroy();this.views.clear();this.sparks=[];this.run=s;this.eventId=s.eventId;}
  for(const v of this.views.values())v.seen=false;
  for(const p of s.plants)this.entity(`p${p.id}`,p.kind,cellX(p.col),rowY(p.row),p.hp,time,reduced,false,0,p.timer,p.firing,s.stage==='won');
  for(const e of s.enemies)this.entity(`e${e.id}`,e.kind==='enemy_paper_blob'&&!e.armor?'enemy_ink_blob':e.kind,e.x,rowY(e.row),e.hp+e.armor,time,reduced,true,e.attackTimer,0,false,false);
  for(const e of s.events.filter(e=>e.id>this.eventId)){
   if(['slinger_fire','cone_launch','dew_spawn','ammo_shared','armor_break','projectile_hit','cone_impact','enemy_exit','base_hit','plant_place','dew_collect','victory'].includes(e.type))this.sparks.push({type:e.type,x:e.x,y:e.y,at:time});
   if(e.type==='slinger_fire'||e.type==='cone_launch')for(const v of this.views.values())if(v.kind.startsWith('plant_')&&Math.abs(v.image.x-e.x)<5&&Math.abs(v.image.y-(e.y+35))<8)v.fire=time;
  }
  this.eventId=s.eventId;
  for(const [key,v] of this.views){
   if(!v.seen&&v.exit===null){v.exit=time;v.exitScaleX=v.image.scaleX;v.exitScaleY=v.image.scaleY;}
   if(v.exit!==null){const age=time-v.exit;if(age>.45){v.image.destroy();this.views.delete(key);}else{v.image.setAlpha(1-age/.45);if(!reduced)v.image.setScale(v.exitScaleX*(1-age/.45),v.exitScaleY*(1-age/.45));}}
  }
  const active=new Set<string>();
  const prop=(key:string,texture:string,x:number,y:number,width:number,height:number,alpha=1)=>{
   active.add(key);let image=this.props.get(key);if(!image){image=this.scene.add.image(x,y,texture).setDepth(2);this.props.set(key,image);}
   image.setTexture(texture).setPosition(x,y).setDisplaySize(width,height).setAlpha(alpha);
  };
  prop('gate','garden_gate',100,375,145,220);
  const dewSource=this.scene.textures.get('pickup_dew').getSourceImage();const dewSize=52*1280/Math.max(1,this.scene.game.canvas.getBoundingClientRect().width);const dewScale=Math.min(dewSize/dewSource.width,dewSize/dewSource.height);
  for(const d of s.drops)prop(`drop${d.id}`,'pickup_dew',d.x,d.y-5,dewSource.width*dewScale,dewSource.height*dewScale);
  for(const b of s.projectiles)prop(`bullet${b.id}`,b.heavy?'projectile_cone':'projectile_seed',b.x,b.y,b.heavy?44:28,b.heavy?44:23);
  for(const [i,e] of this.sparks.entries())if(e.type==='armor_break'&&time-e.at<.65)prop(`shell${i}`,'paper_shell',e.x+(time-e.at)*30,e.y-30+(time-e.at)*50,130,130,1-(time-e.at)/.65);
  for(const [key,image] of this.props)if(!active.has(key)){image.destroy();this.props.delete(key);}
  this.drawEffects(time,reduced);
 }
 private entity(key:string,kind:string,x:number,y:number,hp:number,time:number,reduced:boolean,enemy:boolean,attack:number,timer:number,firing:boolean,won:boolean){
  let v=this.views.get(key);
  if(!v){const image=this.scene.add.image(x,y+35,kind).setOrigin(.5,.9).setDepth(1);v={image,hp,kind,hit:-10,fire:-10,exit:null,exitScaleX:1,exitScaleY:1,seen:true};this.views.set(key,v);}
  if(hp<v.hp)v.hit=time;
  v.hp=hp;v.seen=true;if(kind!==v.kind){v.kind=kind;v.image.setTexture(kind);}
  const image=v.image;const texture=kind==='plant_vine_guard'&&hp<=300?(hp<=150?'vine_damage_heavy':'vine_damage_medium'):kind;if(image.texture.key!==texture)image.setTexture(texture);const source=image.texture.getSourceImage();const size=enemy?132:this.actorSize();const base=Math.min(size/source.width,size/source.height);
  const hit=Math.max(0,1-(time-v.hit)/.25);const fire=Math.max(0,1-(time-v.fire)/.3);
  const walk=enemy&&!attack&&!reduced?Math.sin(time*8+x*.01):0;
  const idle=!enemy&&!reduced?Math.sin(time*2+x*.01)*.015:0;
  const ready=firing&&!reduced?Math.min(timer/(kind==='plant_cone_launcher'?3:.8),1):0;
  const production=kind==='plant_dew_collector'&&timer>7&&!reduced?Math.sin((timer-7)*Math.PI):0;
  image.setPosition(x,y+35-(enemy&&!reduced?Math.max(0,walk)*7:0));
  image.setScale(base*(1+(reduced?0:hit*.15+walk*.04+production*.04)),base*(1+(reduced?0:-hit*.12-walk*.04+idle)));
  image.setAngle(reduced?0:hit*-7+fire*9-ready*3+(attack?Math.sin(attack*5)*-7:0)+production*9+(won?Math.sin(time*5)*4:0));
  image.setAlpha(1);image.clearTint();if(hit>0)image.setTint(0xffd5b3);

 }
 private drawEffects(time:number,reduced:boolean){
  const g=this.fx;g.clear();this.sparks=this.sparks.filter(e=>time-e.at<.65).slice(-60);
  for(const e of this.sparks){const t=(time-e.at)/.65,alpha=1-t;const heavy=e.type==='cone_impact';
   const color=e.type==='base_hit'?0xd78065:e.type==='dew_collect'||e.type==='dew_spawn'?0x76d6df:e.type==='armor_break'?0xe4c28b:e.type==='enemy_exit'?0xa49acb:0xffe6a0;
   g.lineStyle(heavy?5:3,color,alpha);g.strokeCircle(e.x,e.y-15,reduced?24:10+t*(heavy?85:35));
   if(!reduced)for(let i=0;i<6;i++){const angle=i*Math.PI/3,r=12+t*(heavy?100:45);g.fillStyle(color,alpha);g.fillCircle(e.x+Math.cos(angle)*r,e.y-15+Math.sin(angle)*r,heavy?5:3);}
  }
 }
}

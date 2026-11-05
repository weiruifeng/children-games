import Phaser from 'phaser';
import {BOARD,cellX,rowY,ENTRY_MAP,hasSharedAmmo,PLANTS,tickGarden,type GardenState,type PlantKind,type EnemyKind} from '@children-games/shared';
export interface GardenBridge {placement?:()=>{kind:PlantKind;row:number;col:number;valid:boolean}|null;state:()=>GardenState;change:()=>void;cell:(row:number,col:number)=>void;plant:(id:number)=>void;enemy:(id:number)=>void;drop:(id:number)=>void;}
const C={ink:0x264751,green:0x3c8868,leaf:0x6aaa6f,wood:0x9c6944,cream:0xfff4d9,blue:0x70bdcb,purple:0x52507e};
export function drawPlant(g:Phaser.GameObjects.Graphics,kind:PlantKind,x:number,y:number,scale=1,phase=0,damaged=false){
 g.save();g.translateCanvas(x,y);g.scaleCanvas(scale,scale);g.lineStyle(3,C.ink,1);
 g.fillStyle(0x173e32,0.12);g.fillEllipse(0,27,83,17);
 if(kind==='plant_pod_slinger'){
  g.lineStyle(12,C.wood);g.beginPath();g.moveTo(0,24);g.lineTo(0,-13);g.lineTo(-28,-42);g.moveTo(0,-13);g.lineTo(27,-42);g.strokePath();
  g.lineStyle(3,C.green);g.beginPath();g.moveTo(-28,-42);g.lineTo(-15-Math.sin(phase)*4,-13);g.lineTo(27,-42);g.strokePath();
  g.fillStyle(C.green);g.fillEllipse(-17,-13,30,17);g.fillEllipse(20,15,30,12);
  g.fillStyle(C.cream);g.fillCircle(-5,0,5);g.fillCircle(8,0,5);g.fillStyle(C.ink);g.fillCircle(-3,0,2);g.fillCircle(10,0,2);
 }else if(kind==='plant_dew_collector'){
  g.lineStyle(7,C.green);g.lineBetween(0,25,0,-28);g.fillStyle(C.leaf);g.fillEllipse(-18,-34,42,18);g.fillEllipse(20,-42,42,18);
  g.fillStyle(C.blue,0.8);g.fillRoundedRect(-24,-25,48,34,12);g.lineStyle(2,0xdef6f0);g.strokeRoundedRect(-24,-25,48,34,12);
  g.fillStyle(0xffffff,0.7);g.fillEllipse(-12,-14,5,12);g.fillStyle(C.ink);g.fillCircle(-6,18,2);g.fillCircle(6,18,2);
 }else if(kind==='plant_vine_guard'){
  g.fillStyle(0x63965c);g.fillTriangle(0,-48,-40,0,0,32);g.fillTriangle(0,-48,40,0,0,32);
  g.lineStyle(5,damaged?0x9caa68:C.green);for(let i=-2;i<=2;i++){g.lineBetween(-28,i*11-10,28,i*11+3);}g.lineBetween(-20,-29,11,22);g.lineBetween(0,-42,30,4);
  g.fillStyle(C.cream);g.fillEllipse(-10,-2,10,7);g.fillEllipse(10,-2,10,7);g.fillStyle(C.ink);g.fillCircle(-8,-2,2);g.fillCircle(12,-2,2);
 }else{
  g.fillStyle(C.wood);g.fillRoundedRect(-28,-12,56,38,12);g.lineStyle(7,C.wood);g.lineBetween(0,-5,-30,-52);g.lineBetween(-30,-52,-48,-46);
  g.fillStyle(C.green);g.fillEllipse(-46,-43,40,16);g.lineStyle(3,C.ink);g.lineBetween(-15,27,-31,32);g.lineBetween(17,26,33,31);
  g.fillStyle(C.cream);g.fillCircle(-8,2,5);g.fillCircle(9,2,5);g.fillStyle(C.ink);g.fillCircle(-6,2,2);g.fillCircle(11,2,2);
 }
 g.restore();
}
function drawEnemy(g:Phaser.GameObjects.Graphics,kind:EnemyKind,x:number,y:number,time:number,armor:number,reduced:boolean){
 const bounce=reduced?0:Math.abs(Math.sin(time*4+x/100))*8;
 g.fillStyle(0x173e32,0.13);g.fillEllipse(x,y+28,72,14);
 if(kind==='enemy_scroll'){
  g.fillStyle(0xe9d5a8);g.fillRoundedRect(x-42,y-35,84,62,12);g.lineStyle(4,0xb6a17a);g.strokeRoundedRect(x-42,y-35,84,62,12);
  g.fillStyle(0xfdf4d9);g.fillEllipse(x-33,y-4,22,60);g.fillEllipse(x+33,y-4,22,60);g.fillStyle(C.purple);g.fillEllipse(x,y-4,45,42);
 }else{
  g.fillStyle(C.purple);g.fillEllipse(x,y-bounce-2,58+bounce,65-bounce);g.fillTriangle(x-15,y-24-bounce,x+2,y-53-bounce,x+17,y-23-bounce);
  if(armor){g.fillStyle(0xdfccaa);g.fillTriangle(x-42,y+17,x-32,y-43,x-10,y+27);g.fillTriangle(x+42,y+17,x+32,y-43,x+10,y+27);g.lineStyle(2,0xa79980);g.lineBetween(x-32,y-43,x-10,y+27);g.lineBetween(x+32,y-43,x+10,y+27);}
 }
 g.fillStyle(0xfff7df);g.fillEllipse(x-12,y-11-bounce,12,15);g.fillEllipse(x+8,y-11-bounce,12,15);g.fillStyle(C.ink);g.fillCircle(x-14,y-10-bounce,2);g.fillCircle(x+6,y-10-bounce,2);
}
export function createGardenGame(parent:HTMLElement,bridge:GardenBridge,reduced:()=>boolean):Phaser.Game {
 class GardenScene extends Phaser.Scene {
  private g!:Phaser.GameObjects.Graphics;
  private textMap=new Map<string,Phaser.GameObjects.Text>();
  private pulse=0;private accumulator=0;private refresh=0;
  create(){this.g=this.add.graphics();this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{
   const s=bridge.state();if(s.paused||s.helpOpen)return;
   const {x,y}=pointer;
   const drop=s.drops.find(d=>Math.hypot(d.x-x,d.y-y)<28);if(drop){bridge.drop(drop.id);return;}
   const enemy=s.enemies.find(e=>Math.abs(e.x-x)<48&&y>rowY(e.row)-115&&y<rowY(e.row)+36);if(enemy){bridge.enemy(enemy.id);return;}
   const row=Math.floor((y-BOARD.top)/BOARD.cellH),col=Math.floor((x-BOARD.left)/BOARD.cellW);
   if(row<0||row>2||col<0||col>5)return;
   const plant=s.plants.find(p=>p.row===row&&p.col===col);if(plant)bridge.plant(plant.id);else bridge.cell(row,col);
  });}
  label(key:string,text:string,x:number,y:number,size:number,color:string,bg?:string){
   let label=this.textMap.get(key);if(!label){label=this.add.text(x,y,text,{fontFamily:'"PingFang SC", "Microsoft YaHei", sans-serif',fontSize:size,color,backgroundColor:bg,padding:{x:8,y:5},fontStyle:'bold'}).setOrigin(.5);this.textMap.set(key,label);}
   label.setText(text).setPosition(x,y).setVisible(true);
  }
  update(_time:number,delta:number){
   const s=bridge.state();this.accumulator+=Math.min(delta,100)/1000;while(this.accumulator>=1/60){tickGarden(s,1/60);this.accumulator-=1/60;}
   this.refresh+=delta;if(this.refresh>100){this.refresh=0;bridge.change();}
   if(!s.paused&&!s.helpOpen)this.pulse+=delta/1000;
   for(const label of this.textMap.values())label.setVisible(false);
   const g=this.g;g.clear();g.fillStyle(0xe5edcf);g.fillRect(0,0,1280,640);
   g.fillStyle(0xd2e3c0);g.fillEllipse(330,90,950,220);g.fillStyle(0xbdd5b0);g.fillEllipse(1080,90,650,170);
   g.fillStyle(0xa9ccbf);g.fillEllipse(700,110,1300,85);g.fillStyle(0xeaf0d6);g.fillRect(0,120,1280,520);
   // Paper nursery framing leaves the readable play field clear.
   g.fillStyle(0xf7edce);g.fillTriangle(40,150,110,90,190,150);g.fillRoundedRect(60,150,105,180,8);g.fillStyle(0x9db8a1);g.fillRoundedRect(91,215,45,115,20);
   this.label('nursery','苗圃',110,178,18,'#53675a');
   const levelRows=s.level===1?[1]:s.level===2?[0,1]:[0,1,2];
   for(let row=0;row<3;row++){
    g.fillStyle(levelRows.includes(row)?0xd0dfb5:0xdde5ce);g.fillRoundedRect(BOARD.left-8,BOARD.top+row*140-6,916,134,16);
    for(let col=0;col<6;col++){g.fillStyle((row+col)%2?0xbed39b:0xc9dca7,levelRows.includes(row)?1:.35);g.fillRoundedRect(BOARD.left+col*150+3,BOARD.top+row*140+2,142,120,10);}
    g.lineStyle(3,s.rescues[row]?0x619e95:0xb4b9a1);g.lineBetween(182,rowY(row)-25,182,rowY(row)+20);g.fillStyle(s.rescues[row]?0x76bdb1:0xb4b9a1);g.fillTriangle(168,rowY(row),196,rowY(row),182,rowY(row)+22);
    if(!levelRows.includes(row))this.label(`closed${row}`,'这条小路还在休息',670,rowY(row),20,'#8b9b7e');
   }
   const preview=bridge.placement?.();if(preview&&preview.row>=0&&preview.row<3&&preview.col>=0&&preview.col<6){const x=cellX(preview.col),y=rowY(preview.row);g.fillStyle(preview.valid?0xf9e49a:0xd77865,.65);g.fillRoundedRect(x-70,y-65,140,125,12);drawPlant(g,preview.kind,x,y,.85,0);this.label('dropHint',preview.valid?'松手种下':'换一块空地',x,y-85,22,'#38543b','#fff8d8');}
   for(const p of s.plants){const x=cellX(p.col),y=rowY(p.row);if(s.selectedPlant===p.id){g.lineStyle(4,0xfdf8cf);g.strokeRoundedRect(x-65,y-58,130,105,16);}drawPlant(g,p.kind,x,y,1.1,p.firing?this.pulse*5:this.pulse,p.hp<PLANTS[p.kind].hp*.6);
    g.fillStyle(0x416852,.2);g.fillRoundedRect(x-30,y+45,60,5,2);g.fillStyle(0x538e63);g.fillRoundedRect(x-30,y+45,60*p.hp/PLANTS[p.kind].hp,5,2);
    if(p.firing){g.lineStyle(4,0xffefac,.9);g.strokeEllipse(x,y+31,100,24);this.label(`auto${p.id}`,'∞',x+43,y-35,22,'#557c3d','#f6f8d4');}
    if(p.ammo)this.label(`ammo${p.id}`,`${p.signature} · ${p.ammo}`,x,y-78,19,'#325849','#fff9de');
   }
   for(const e of s.enemies){drawEnemy(g,e.kind,e.x,rowY(e.row),this.pulse,e.armor,reduced());
    const t=s.task?.entryId===e.entryId;this.label(`enemy${e.id}`,`${ENTRY_MAP[e.entryId].text}${hasSharedAmmo(s,e.entryId)?'':' ◌'}`,e.x,rowY(e.row)-85,32,t?'#b66a2a':'#34434f',t?'#fff0bb':'#fff9e8');
    g.fillStyle(0x423f62,.2);g.fillRoundedRect(e.x-28,rowY(e.row)+40,56,5,2);g.fillStyle(e.armor?0xc19d62:0x6c6688);g.fillRoundedRect(e.x-28,rowY(e.row)+40,56*(e.hp+e.armor)/(e.kind==='enemy_scroll'?240:e.kind==='enemy_paper_blob'?160:80),5,2);
   }
   for(const p of s.projectiles){this.label(`bullet${p.id}`,p.signature,p.x,p.y-30,24,'#356641','#fff5bc');g.lineStyle(5,0xf4cf63,.65);g.lineBetween(p.x-35,p.y,p.x-10,p.y);g.fillStyle(p.heavy?0xa57143:0x5e9e55);g.fillEllipse(p.x,p.y,p.heavy?27:15,p.heavy?34:10);if(p.heavy){g.lineStyle(2,0xd3af75);g.lineBetween(p.x-8,p.y-8,p.x+8,p.y+8);}}
   for(const d of s.drops){g.fillStyle(0x5cb4c5);g.fillCircle(d.x,d.y,14);g.fillTriangle(d.x-12,d.y-6,d.x,d.y-27,d.x+12,d.y-6);g.fillStyle(0xe6ffff);g.fillEllipse(d.x-4,d.y-5,4,10);}
   this.label('path','墨团从这里来 ←',1165,140,15,'#708274');
  }
 }
 return new Phaser.Game({type:Phaser.AUTO,parent,width:1280,height:640,backgroundColor:'#e5edcf',scene:GardenScene,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true},audio:{noAudio:true}});
}

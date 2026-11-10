import {test,expect,type Page} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const root='/experiments/pinyin-garden/';
const sharedUrl=`/@fs/${fileURLToPath(new URL('../../shared/src/index.ts',import.meta.url))}`;
async function fixture(page:Page,collectors=0,reduced=false){
 await page.setViewportSize({width:1280,height:900});
 await page.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true}}));
 await page.goto(root);await expect(page.locator('.slot-card').first()).toBeEnabled();
 await page.evaluate(async({sharedUrl,collectors,reduced})=>{
  const {newProfile,createCharacterGarden,startWave,placePlant,resumeSnapshot,snapshot}=await import(/* @vite-ignore */ sharedUrl);
  const {saveProfile}=await import(/* @vite-ignore */ '/src/experiments/pinyin-garden/services/saveStore.ts');
  const p=newProfile('露珠回归'),s=createCharacterGarden('foundation-01',1,[],'dew-test');startWave(s);s.nextSpawn=1e6;
  for(let col=0;col<collectors;col++){s.cooldowns.plant_dew_collector=0;placePlant(s,'plant_dew_collector',1,col);}
  s.drops.push({id:s.nextId++,x:700,y:350,age:0,value:25});p.checkpoint=resumeSnapshot(s);p.waveStart=snapshot(s);p.settings.speech=false;p.settings.reducedMotion=reduced;await saveProfile(0,p);
 },{sharedUrl,collectors,reduced});
 await page.goto('about:blank');
 await page.goto(`${root}#/garden/1/battle/foundation-01`);
 await page.getByRole('button',{name:'继续玩',exact:true}).click();
 await expect(page.locator('.game-canvas canvas')).toBeVisible();
}
async function point(page:Page,x:number,y:number){const r=await page.locator('.game-canvas canvas').boundingBox();if(!r)throw Error('Missing canvas');return {x:r.x+x*r.width/1280,y:r.y+y*r.height/640};}
async function click(page:Page,x:number,y:number){const p=await point(page,x,y);await page.mouse.click(p.x,p.y);}
async function balance(page:Page){return Number((await page.locator('.dew-count').getAttribute('aria-label'))!.replace('露珠 ',''));}
for(const reduced of [false,true])test(`no collector blocks repeated clicks, planting enables collection (${reduced?'reduced':'normal'} motion)`,async({page},info)=>{
 await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});await fixture(page,0,reduced);const before=await balance(page);
 for(let i=0;i<3;i++)await click(page,700,350);
 await expect(page.locator('.launch-notice')).toHaveText('先种露珠收集器，才能收集露珠');expect(await balance(page)).toBe(before);await expect(page.locator('.dew-flight')).toHaveCount(0);
 await page.screenshot({path:info.outputPath('blocked.png')});
 const card=page.locator('.partner-card').filter({hasText:'露珠收集器'});const r=await card.boundingBox();if(!r)throw Error('Missing collector card');const target=await point(page,295,380);
 await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(target.x,target.y+50,{steps:12});await page.mouse.up();
 await expect(page.locator('.dew-count')).toHaveAttribute('aria-label',`露珠 ${before-50}`);
 await click(page,700,350);await expect(page.locator('.dew-count')).toHaveAttribute('aria-label',`露珠 ${before-25}`);
 if(reduced)await expect(page.locator('.dew-flight')).toHaveCount(0);else{await expect(page.locator('.dew-flight')).toBeVisible();await expect(page.locator('.dew-flight')).toHaveCount(0);}
 await click(page,700,350);expect(await balance(page)).toBe(before-25);
});
for(const collectors of [1,2])test(`shoveling with ${collectors} collectors respects the remaining living collectors`,async({page})=>{
 await fixture(page,collectors);const before=await balance(page);await page.getByRole('button',{name:'铲除：挖走伙伴'}).click();await click(page,295,380);
 await expect(page.locator('.dew-count')).toHaveAttribute('aria-label',`露珠 ${before+25}`);
 await click(page,700,350);await click(page,700,350);
 await expect(page.locator('.dew-count')).toHaveAttribute('aria-label',`露珠 ${before+(collectors===1?25:50)}`);
 if(collectors===1){await expect(page.locator('.launch-notice')).toHaveText('先种露珠收集器，才能收集露珠');await expect(page.locator('.dew-flight')).toHaveCount(0);}
 else{await expect(page.locator('.dew-flight')).toBeVisible();await expect(page.locator('.dew-flight')).toHaveCount(0);}
});

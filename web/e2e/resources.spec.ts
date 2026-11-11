import {createHash} from 'node:crypto';
import {test,expect,type Page} from '@playwright/test';
const root='/experiments/pinyin-garden/';
test.beforeEach(async({page})=>{page.on('pageerror',e=>console.log('BROWSER ERROR:',e.message));page.on('console',m=>{if(m.type()==='error')console.log('BROWSER CONSOLE:',m.text());});});
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus)console.log(JSON.stringify(await page.evaluate(async()=>{const path='/src/resources/manager.ts';return (await import(path)).resources.diagnostics();}).catch(()=>({})),null,2));});
async function manager(page:Page){return page.evaluate(async()=>{const path='/src/resources/manager.ts';return (await import(path)).resources.catalog;});}
async function garden(page:Page){await page.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true}}));await page.goto(root);await page.locator('.slot-card').first().click();await expect(page.locator('.adventure-home')).toBeVisible();}
async function depart(page:Page){await page.getByRole('button',{name:/出发守护|继续守护/}).click();await expect(page.getByRole('button',{name:'开始第一波',exact:true})).toBeVisible();}
test('cold image requests gate both the UI and play; cached return reuses validated media',async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await garden(page);const c=await manager(page),url=c.resources['/assets/pinyin-garden/characters/enemy_scroll.png'].url;
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);let requests=0;
 await page.route('**'+url,async route=>{requests++;await gate;await route.continue();});
 await page.getByRole('button',{name:/出发守护|继续守护/}).click();
 await expect(page.getByRole('progressbar',{name:'素材准备进度'})).toBeVisible();await page.screenshot({path:testInfo.outputPath('loading.png')});await expect(page.getByRole('button',{name:'开始第一波',exact:true})).toHaveCount(0);
 await page.keyboard.press('Enter');await expect(page.locator('.deployment-countdown')).toHaveCount(0);await expect(page.locator('.battle-coach')).toHaveCount(0);
 release();await expect(page.getByRole('button',{name:'开始第一波',exact:true})).toBeVisible();await expect(page.locator('.game-canvas canvas')).toHaveCount(1);expect(await page.locator('.garden-app').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');await page.screenshot({path:testInfo.outputPath('ready.png')});
 await page.getByRole('button',{name:'开始第一波',exact:true}).click();await expect(page.locator('.battle-coach')).toBeVisible();await page.getByRole('button',{name:'保存并返回花园'}).click();await page.getByRole('button',{name:/出发守护|继续守护/}).click();await expect(page.getByRole('button',{name:'继续玩',exact:true})).toBeVisible();expect(requests).toBe(1);expect(errors).toEqual([]);
});
test('failed file retries only the missing resource and recovers after repeated taps',async({page})=>{
 await garden(page);const c=await manager(page),url=c.resources['/assets/pinyin-garden/characters/enemy_scroll.png'].url;let failed=true,count=0;
 await page.route('**'+url,route=>{count++;return failed?route.fulfill({status:404,contentType:'text/html',body:'missing'}):route.continue();});
 await page.getByRole('button',{name:/出发守护|继续守护/}).click();await expect(page.getByRole('heading',{name:'花园还没准备好'})).toBeVisible();expect(count).toBe(1);
 failed=false;await page.getByRole('button',{name:'重新准备',exact:true}).dblclick();await expect(page.getByRole('button',{name:'开始第一波',exact:true})).toBeVisible();expect(count).toBe(2);await expect(page.locator('canvas')).toHaveCount(1);
});
test('leaving a pending load cancels it; stale callbacks cannot restore the battle',async({page})=>{
 await garden(page);const c=await manager(page),url=c.resources['/assets/pinyin-garden/characters/enemy_scroll.png'].url;let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 await page.route('**'+url,async route=>{await gate;await route.continue().catch(()=>{});});await page.getByRole('button',{name:/出发守护|继续守护/}).click();await expect(page.locator('.resource-loader')).toBeVisible();await page.getByRole('button',{name:'回花园',exact:true}).click();release();await expect(page.locator('.adventure-home')).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);
});
test('corrupt cache is repaired, storage denial remains playable, assets never clear player data',async({page})=>{
 await garden(page);const c=await manager(page),url=c.resources['/assets/pinyin-garden/characters/enemy_scroll.png'].url;
 await page.evaluate(async url=>{localStorage.setItem('resource-test-player-data','keep');const c=await caches.open('garden-resources-v1');await c.put(url,new Response('invalid',{headers:{'Content-Type':'image/webp'}}));},url);
 await depart(page);await page.getByRole('button',{name:'回花园',exact:true}).click();await page.evaluate(async()=>{const path='/src/resources/manager.ts';await (await import(path)).resources.clear();});expect(await page.evaluate(()=>localStorage.getItem('resource-test-player-data'))).toBe('keep');
 const other=await page.context().browser()!.newContext();try{await other.addInitScript(()=>{Object.defineProperty(window,'caches',{get(){throw Error('storage disabled');}});Object.defineProperty(navigator,'connection',{value:{saveData:true}});});const p=await other.newPage();await p.goto(new URL(root,page.url()).href);await p.locator('.slot-card').first().click();await depart(p);}finally{await other.close();}
});
test('image group includes every wave; speech failures hold play until explicitly disabled',async({page})=>{
 await garden(page);let attempts=0;await page.route('**/assets/garden/files/*.mp3',route=>{attempts++;return route.fulfill({status:404,contentType:'text/plain',body:'missing'});});await page.getByRole('button',{name:/出发守护|继续守护/}).click();await expect(page.getByRole('heading',{name:'花园还没准备好'})).toBeVisible();expect(attempts).toBeGreaterThan(0);await expect(page.getByRole('button',{name:'开始第一波',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'暂时关闭朗读',exact:true}).click();await expect(page.getByRole('button',{name:'开始第一波',exact:true})).toBeVisible();await page.waitForTimeout(250);await expect(page.getByRole('button',{name:'开始第一波',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'休息一下',exact:true})).toHaveCount(0);
});
test('narrow-screen resource settings and repeated error animations respect reduced motion',async({page})=>{
 await page.setViewportSize({width:390,height:844});await garden(page);await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:'更多游戏设置'}).click();await expect(page.getByRole('heading',{name:'游戏素材与更新'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'缓存全部游戏素材'}).click();await expect(page.getByRole('progressbar',{name:'全部素材缓存进度'})).toBeVisible();await page.getByRole('button',{name:'暂停下载'}).click();await expect(page.getByText(/缓存已暂停/)).toBeVisible();
 await page.getByRole('button',{name:'我的花园',exact:true}).click();const c=await manager(page),url=c.resources['/assets/pinyin-garden/characters/enemy_scroll.png'].url;await page.evaluate(async url=>{const c=await caches.open('garden-resources-v1');await c.delete(url);},url);await page.route('**'+url,r=>r.fulfill({status:404,body:'missing'}));await page.getByRole('button',{name:/出发守护|继续守护/}).click();await expect(page.locator('.resource-failed')).toBeVisible();expect(await page.locator('.resource-failed').evaluate(e=>getComputedStyle(e).animationName)).toBe('resource-error');await page.locator('.resource-failed').evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished));});expect(await page.locator('.resource-failed').evaluate(e=>getComputedStyle(e).opacity)).toBe('1');
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'重新准备',exact:true}).click();await expect(page.locator('.resource-failed')).toBeVisible();expect(await page.locator('.resource-failed').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');await page.emulateMedia({reducedMotion:'no-preference'});await page.getByRole('button',{name:'回花园',exact:true}).click();await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:'更多游戏设置'}).click();await page.getByLabel('减少动态效果',{exact:true}).check();await page.getByRole('button',{name:'我的花园',exact:true}).click();await page.getByRole('button',{name:/出发守护|继续守护/}).click();await expect(page.locator('.resource-failed')).toBeVisible();expect(await page.locator('.resource-failed').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
});
test('production worker stores a complete public shell and never authenticates offline',async({page,context})=>{
 const origin=process.env.RESOURCE_PRODUCTION_ORIGIN;test.skip(!origin,'Set production preview origin for built-worker validation');
 await page.route('**/api/auth/me',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{message:'请登录'}})}));
 await page.goto(origin+'/garden/');await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration('/garden/');return reg?.active?.state;}),{timeout:20000}).toBe('activated');
 await expect.poll(()=>page.evaluate(async()=>{const c=await caches.open('garden-shell-v1');return (await c.keys()).some(r=>r.url.includes('/__complete/'));}),{timeout:20000}).toBe(true);
 const keys=await page.evaluate(async()=>{const c=await caches.open('garden-shell-v1');return (await c.keys()).map(r=>r.url);});expect(keys.some(k=>k.includes('/api/')||k.includes('/admin/'))).toBe(false);
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();await expect(page.locator('.slot-card')).toHaveCount(0);await context.setOffline(false);
});

test('a one-file update reuses cached files and never mutates the running release',async({page})=>{
 await garden(page);await page.evaluate(async()=>{const p='/src/resources/manager.ts';await (await import(p)).resources.prefetchAll(true);});
 const current=await manager(page),next=JSON.parse(JSON.stringify(current));next.releaseId='f'.repeat(24);next.appBuildId='next-build';
 const id='/assets/pinyin-garden/characters/enemy_scroll.png',old=next.resources[id],response=await page.request.get(old.url),bytes=Buffer.concat([await response.body(),Buffer.from('resource-test')]);
 const hash=createHash('sha256').update(bytes).digest('hex');next.resources[id]={...old,bytes:bytes.length,sha256:hash,url:'/assets/garden/files/'+hash+'.webp'};
 const json=JSON.stringify(next),manifestUrl='/assets/garden/manifests/'+next.releaseId+'.json';let downloads=0;
 await page.route('**/resource-release.json',r=>r.fulfill({json:{schemaVersion:1,releaseId:next.releaseId,appBuildId:next.appBuildId,url:manifestUrl,sha256:createHash('sha256').update(json).digest('hex')}}));
 await page.route('**'+manifestUrl,r=>r.fulfill({contentType:'application/json',body:json}));await page.route('**'+next.resources[id].url,r=>{downloads++;return r.fulfill({contentType:'image/webp',body:bytes});});
 await page.evaluate(async()=>{const p='/src/resources/manager.ts';const m=(await import(p)).resources;await m.checkUpdate(true);await m.stageUpdate();});
 expect(downloads).toBe(1);expect((await manager(page)).releaseId).toBe(current.releaseId);await depart(page);await expect(page.locator('canvas')).toHaveCount(1);
});
test('twenty entry/exit cycles release canvases, handles and decoded images',async({page})=>{
 test.setTimeout(120000);await garden(page);
 const memory=()=>page.evaluate(async()=>{const p='/src/resources/manager.ts';return (await import(p)).resources.diagnostics().memory;});const before=await memory();
 for(let i=0;i<20;i++){
  await page.getByRole('button',{name:/出发守护|继续守护/}).click();
  const start=page.getByRole('button',{name:'开始第一波',exact:true}),unlock=page.getByRole('button',{name:'点一下开启声音',exact:true});
  // A browser may suspend a newly created audio context between scene cycles.
  // Exercise the real unlock gesture before checking scene/memory cleanup.
  await expect(start.or(unlock)).toBeVisible();if(await unlock.isVisible())await unlock.click();
  await expect(start).toBeVisible();await expect(page.locator('canvas')).toHaveCount(1);await page.getByRole('button',{name:'回花园',exact:true}).click();await expect(page.locator('.adventure-home')).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);}
 const after=await memory();expect(after.blobs).toBe(before.blobs);expect(after.entries).toBeLessThanOrEqual(before.entries+1);
});
test('another tab can clear unused media without evicting an active battle',async({page,context})=>{
 await garden(page);await depart(page);const c=await manager(page),url=c.resources['/assets/pinyin-garden/characters/enemy_scroll.png'].url;
 const other=await context.newPage();await other.goto(new URL('/',page.url()).href);await expect(other.getByRole('link',{name:'进入拼音花园'})).toBeVisible();
 await other.evaluate(async()=>{const p='/src/resources/manager.ts';await (await import(p)).resources.clear();});
 expect(await other.evaluate(async url=>!!await (await caches.open('garden-resources-v1')).match(url),url)).toBe(true);await other.close();await page.bringToFront();await expect(page.locator('canvas')).toHaveCount(1);
});
test('WebGL loss holds gameplay and rebuilding the scene recovers',async({page})=>{
 await garden(page);await depart(page);const lost=await page.locator('canvas').evaluate(element=>{const gl=(element as HTMLCanvasElement).getContext('webgl');const extension=gl?.getExtension('WEBGL_lose_context');if(!extension)return false;extension.loseContext();return true;});
 expect(lost).toBe(true);await expect(page.getByRole('heading',{name:'花园还没准备好'})).toBeVisible();await expect(page.getByRole('button',{name:'开始第一波',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'重新准备',exact:true}).click();await expect(page.getByRole('button',{name:'开始第一波',exact:true})).toBeVisible();await expect(page.locator('canvas')).toHaveCount(1);
});

test('missing optional music does not block an unlocked voice or the start button',async({page})=>{await page.route('**/assets/garden/files/*.wav',r=>r.fulfill({status:404,body:'missing'}));await garden(page);await depart(page);await page.getByRole('button',{name:'开始第一波',exact:true}).click();await expect(page.locator('.battle-coach')).toBeVisible();});

test('an interrupted audio context pauses the lesson until unlocked and explicitly resumed',async({page})=>{
 await page.addInitScript(()=>{const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(){super();Object.defineProperty(window,'__resourceTestAudio',{value:this,configurable:true});}};});
 await garden(page);await depart(page);await page.getByRole('button',{name:'开始第一波',exact:true}).click();await page.evaluate(()=>(window as unknown as {__resourceTestAudio:AudioContext}).__resourceTestAudio.suspend());await expect(page.getByRole('button',{name:'点一下开启声音',exact:true})).toBeVisible();await page.getByRole('button',{name:'点一下开启声音',exact:true}).click();await expect(page.getByRole('heading',{name:'休息一下'})).toBeVisible();await page.getByRole('button',{name:'继续玩',exact:true}).click();await expect(page.locator('.battle-coach')).toBeVisible();
});

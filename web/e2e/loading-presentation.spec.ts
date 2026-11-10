import {test,expect,type Page} from '@playwright/test';
const root='/experiments/pinyin-garden/';
async function garden(page:Page){await page.addInitScript(()=>{Object.defineProperty(navigator,'connection',{value:{saveData:true}});const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(){super();Object.defineProperty(window,'__loadingAudio',{value:this,configurable:true});}};});await page.goto(root);await page.locator('.slot-card').first().click();await page.getByRole('button',{name:/出发守护|继续守护/}).click();await expect(page.getByRole('button',{name:'开始第一波',exact:true})).toBeVisible();}
test('scene loading fits phone, landscape and tablet without clipping its actions',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await garden(page);await page.evaluate(()=>(window as unknown as {__loadingAudio:AudioContext}).__loadingAudio.suspend());await expect(page.locator('.resource-loader')).toBeVisible();
 for(const size of [{width:390,height:844},{width:844,height:390},{width:768,height:1024}]){
  await page.setViewportSize(size);const geometry=await page.locator('.resource-loader').evaluate(e=>{const r=e.getBoundingClientRect(),parent=e.parentElement!.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,parentHeight:parent.height,parentWidth:parent.width};});
  expect(geometry.height).toBeLessThanOrEqual(geometry.parentHeight);expect(geometry.width).toBeLessThanOrEqual(geometry.parentWidth);expect(geometry.y).toBeGreaterThanOrEqual(8);expect(geometry.bottom).toBeLessThanOrEqual(size.height-8);expect(geometry.x).toBeGreaterThanOrEqual(8);expect(geometry.right).toBeLessThanOrEqual(size.width-8);
  await expect(page.getByRole('button',{name:'点一下开启声音',exact:true})).toBeInViewport();await page.screenshot({path:info.outputPath(`loading-${size.width}.png`)});
 }
 await page.getByRole('button',{name:'点一下开启声音',exact:true}).click();await expect(page.getByRole('button',{name:'开始第一波',exact:true})).toBeVisible();
});
test('cached page refresh does not paint a transient loader or replay a full-page fade',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'connection',{value:{saveData:true}});const samples:Array<{loader:boolean;boot:boolean;entrance:boolean}>=[];Object.defineProperty(window,'__loadingFrames',{value:samples});function frame(){const loader=document.querySelector('.resource-loader'),boot=document.querySelector('#root > main,.app-boot'),ready=document.querySelector('.resource-ready');const visible=(e:Element|null)=>!!e&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});samples.push({loader:visible(loader),boot:visible(boot),entrance:!!ready&&getComputedStyle(ready).animationName!=='none'});if(samples.length<90)requestAnimationFrame(frame);}requestAnimationFrame(frame);});
 await page.goto('/');await expect(page.getByRole('link',{name:'进入拼音花园'})).toBeVisible();
 for(let attempt=0;attempt<3;attempt++){
  await page.reload();await expect(page.getByRole('link',{name:'进入拼音花园'})).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as unknown as {__loadingFrames:unknown[]}).__loadingFrames.length)).toBeGreaterThanOrEqual(20);
  const samples=await page.evaluate(()=>(window as unknown as {__loadingFrames:Array<{loader:boolean;boot:boolean;entrance:boolean}>}).__loadingFrames);expect(samples.filter(s=>s.loader)).toHaveLength(0);expect(samples.filter(s=>s.boot)).toHaveLength(0);expect(samples.filter(s=>s.entrance)).toHaveLength(0);
 }
});
test('cached account refresh keeps resource and identity checks visually quiet',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'connection',{value:{saveData:true}});const samples:boolean[]=[];Object.defineProperty(window,'__accountLoadingFrames',{value:samples});function frame(){const nodes=document.querySelectorAll('.resource-loader,.app-boot');samples.push([...nodes].some(e=>e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))||[...document.querySelectorAll('.site-panel')].some(e=>e.textContent?.includes('正在打开花园')));if(samples.length<90)requestAnimationFrame(frame);}requestAnimationFrame(frame);});
 // Playwright routing disables the HTTP cache. Stub only the identity fetch so this stays a real warm-cache test.
 await page.addInitScript(()=>{const native=window.fetch.bind(window);window.fetch=(input,init)=>{const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;if(new URL(url,location.origin).pathname==='/api/auth/me')return new Promise(resolve=>setTimeout(()=>resolve(Response.json({error:{message:'请登录'}},{status:401})),400));return native(input,init);};});
 await page.goto('/garden/');await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();
 for(let i=0;i<3;i++){await page.reload();await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as unknown as {__accountLoadingFrames:boolean[]}).__accountLoadingFrames.length)).toBeGreaterThanOrEqual(20);expect(await page.evaluate(()=>(window as unknown as {__accountLoadingFrames:boolean[]}).__accountLoadingFrames.some(Boolean))).toBe(false);}
});

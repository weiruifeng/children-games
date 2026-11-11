import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const credentials=()=>{if(process.env.GARDEN_E2E_ADMIN_FILE)return JSON.parse(readFileSync(process.env.GARDEN_E2E_ADMIN_FILE,'utf8'));return {username:process.env.GARDEN_E2E_ADMIN_USER,password:process.env.GARDEN_E2E_ADMIN_PASSWORD};};
async function login(page:Page,user:{username:string;password:string}){await page.getByLabel('用户名',{exact:true}).fill(user.username);await page.getByLabel('密码',{exact:true}).fill(user.password);await page.getByRole('button',{name:'登录',exact:true}).click();}
test('invitation, account isolation, cloud reload and animation feedback',async({browser,page})=>{
 test.setTimeout(120000);const admin=credentials();test.skip(!admin.username,'Set dedicated test administrator credentials');
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('link',{name:/拼音花园/}).first()).toBeVisible();
 await page.goto('/admin/');await login(page,admin);await expect(page.getByRole('heading',{name:'花园管理'})).toBeVisible();
 await page.getByRole('button',{name:'生成邀请码',exact:true}).click();await expect(page.locator('.secret-row code').first()).toBeVisible();const code=await page.locator('.secret-row code').first().innerText();
 const user={username:'小小园丁'+Date.now(),password:'garden-browser-password-2026'};
 const device=await browser.newContext(),p=await device.newPage();await p.goto('/garden/');await p.getByRole('button',{name:'邀请码注册'}).click();await p.getByLabel('用户名',{exact:true}).fill(user.username);await p.getByLabel('邀请码',{exact:true}).fill(code);await p.getByLabel('密码',{exact:true}).fill(user.password);await p.getByLabel('确认密码').fill(user.password);await p.getByRole('button',{name:'注册',exact:true}).click();await expect(p.getByRole('status')).toContainText('注册成功');await login(p,user);
 await expect(p.locator('.garden-app')).toBeVisible();
 // Admin authorization is checked on the server, even in a logged-in ordinary account.
 expect(await p.evaluate(async()=> (await fetch('/api/admin/users')).status)).toBe(401);
 await p.getByRole('button',{name:/苔芽的小花园/}).first().click();
 await p.getByRole('button',{name:'设置',exact:true}).click();await p.getByRole('button',{name:'账号与进度',exact:true}).click();await p.getByRole('button',{name:'花园存档',exact:true}).click();await p.getByRole('button',{name:'重试同步'}).click();await expect(p.locator('.account-panel [role=status]').first()).toContainText('已同步云端');
 const before=await p.evaluate(async()=> (await (await fetch('/api/garden/profiles/1')).json()).profile);expect(before).toBeTruthy();
 for(let i=0;i<2;i++){await p.getByRole('button',{name:'关闭',exact:true}).click();await p.getByRole('button',{name:'设置',exact:true}).click();await p.getByRole('button',{name:'账号与进度',exact:true}).click();const panel=p.locator('.account-panel');expect(await panel.evaluate(e=>getComputedStyle(e).animationName)).toBe('site-enter');await panel.evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished));});expect(await panel.evaluate(e=>getComputedStyle(e).opacity)).toBe('1');}
 const button=p.getByRole('button',{name:'关闭',exact:true});await button.hover();await p.mouse.down();await p.waitForTimeout(150);expect(await button.evaluate(e=>getComputedStyle(e).transform)).not.toBe('none');await p.mouse.up();
 await p.emulateMedia({reducedMotion:'reduce'});await p.getByRole('button',{name:'设置',exact:true}).click();await p.getByRole('button',{name:'账号与进度',exact:true}).click();expect(await p.locator('.account-panel').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');await p.getByRole('button',{name:'关闭',exact:true}).click();
 await p.getByRole('button',{name:'出发守护',exact:true}).click();await p.getByRole('button',{name:'开始第一波'}).click();await p.getByRole('button',{name:'暂停',exact:true}).click();await expect.poll(async()=>p.evaluate(async()=> (await (await fetch('/api/garden/profiles/1')).json()).profile?.checkpoint?.stage),{timeout:20000}).toBe('playing');
 await p.reload();
 const paused=p.getByRole('heading',{name:'休息一下'}),unlock=p.getByRole('button',{name:'点一下开启声音',exact:true});
 await expect(paused.or(unlock)).toBeVisible();if(await unlock.isVisible())await unlock.click();
 await expect(paused).toBeVisible();
 const second=await browser.newContext(),p2=await second.newPage();await p2.goto('/garden/');await login(p2,user);await expect(p2.locator('.garden-app')).toBeVisible();const after=await p2.evaluate(async()=> (await (await fetch('/api/garden/profiles/1')).json()).profile);expect(after.name).toBe(before.name);
 await second.close();await device.close();
 const capacity=await browser.newContext(),large=await capacity.newPage();await large.goto('/');
 const metrics=await large.evaluate(async user=>{
  await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(user)});
  const apiPath='/src/site/api.ts',repositoryPath='/src/site/repository.ts';
  const api=await import(apiPath);const identity=await api.me();const {GardenRepository}=await import(repositoryPath);
  // The test uses a real three-slot record as the template, avoiding a build-machine-specific import.
  const template=(await api.api('/garden/profiles/1')).profile;const {cloudVersion,...local}=template;const p={...local,name:'容量测试',checkpoint:null,waveStart:null,attempts:Array.from({length:45000},(_,i)=>({eventId:'browser-'+i,taskId:'task-'+i,entryId:'symbol-a',syllable:0,at:i,correct:true,assisted:false,repeated:false}))};
  const r=new GardenRepository(identity.id);await r.start();await r.loadProfileSlots();const start=performance.now();await r.saveProfile(2,p);const localMs=performance.now()-start;const backup=await r.createBackupBlob(2);const beforeFlush=performance.now();await r.flush();const uploadMs=performance.now()-beforeFlush;const summary=await api.api('/garden/profiles/3/summary');const status=r.status;await r.dispose();return {events:summary.summary.total,status,localMs:Math.round(localMs),uploadMs:Math.round(uploadMs),backupBytes:backup.blob.size};
 },user);console.log('Browser capacity metrics',JSON.stringify(metrics));expect(metrics.status).toBe('synced');expect(metrics.events).toBe(45000);await capacity.close();expect(errors).toEqual([]);
});

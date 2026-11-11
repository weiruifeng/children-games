import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const config='.env.garden.local';
if(!existsSync(config))throw Error('缺少 .env.garden.local，请按 deploy/garden-site/local.env.example 配置本地数据库');
process.loadEnvFile(config);
if(process.env.NODE_ENV==='production')throw Error('本命令只用于本地开发');
for(const key of ['MYSQL_HOST','MYSQL_USER','MYSQL_DATABASE'])if(!process.env[key])throw Error('缺少 '+key);
if(process.env.MYSQL_PASSWORD===undefined)throw Error('必须显式设置 MYSQL_PASSWORD，本机空密码可留空值');
const port=Number(process.env.GARDEN_WEB_PORT??5191),apiPort=Number(process.env.GARDEN_API_PORT??3010);
if(![port,apiPort].every(p=>Number.isInteger(p)&&p>1024&&p<=65535)||port===apiPort)throw Error('端口配置无效');
const origin=`http://localhost:${port}`;
const env={...process.env,NODE_ENV:'development',PUBLIC_ORIGIN:origin,HOST:'127.0.0.1',PORT:String(apiPort),GARDEN_API_TARGET:`http://127.0.0.1:${apiPort}`};
const children=new Set();let stopping=false;
function run(command,args){const child=spawn(command,args,{cwd:root,env,stdio:'inherit'});children.add(child);child.on('exit',()=>children.delete(child));return child;}
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');process.exitCode=code;}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
function done(child){return new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`命令退出: ${code}`)));});}
try{
 for(const usedPort of [port,apiPort])await new Promise((resolve,reject)=>{const probe=createServer();probe.once('error',()=>reject(Error(`端口 ${usedPort} 已被占用，请停止旧服务或调整 .env.garden.local`)));probe.listen(usedPort,'127.0.0.1',()=>probe.close(resolve));});
 await done(run(process.execPath,['node_modules/typescript/bin/tsc','-p','server/tsconfig.json']));
 if(stopping)process.exit(0);
 await done(run(process.execPath,['server/scripts/migrate-garden.mjs']));
 if(stopping)process.exit(0);
 const api=run(process.execPath,['server/dist/server/src/garden-main.js']);
 api.on('error',e=>{console.error(e.message);stop(1);});api.on('exit',code=>{if(!stopping)stop(code||1);});
 let ready=false;for(let i=0;i<40&&!stopping;i++){try{const r=await fetch(env.GARDEN_API_TARGET+'/api/ready',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
 if(stopping)process.exit(process.exitCode??0);
 if(!ready)throw Error('本地API未能就绪，请检查数据库和端口');
 const web=run(process.execPath,['node_modules/vite/bin/vite.js','--config','web/vite.config.ts','--host','127.0.0.1','--port',String(port),'--strictPort','web']);
 web.on('error',e=>{console.error(e.message);stop(1);});web.on('exit',code=>{if(!stopping)stop(code||1);});
 console.log(`\n花园本地入口：${origin}/\n管理后台：${origin}/admin/\n按 Ctrl+C 停止前后端。\n`);
}catch(e){console.error(e.message);stop(1);}

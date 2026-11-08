import readline from 'node:readline/promises';
import {Writable} from 'node:stream';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
require('dotenv/config');require('reflect-metadata');
const {DatabaseService}=require('../dist/server/src/modules/database/database.service.js');
const {AuthService}=require('../dist/server/src/modules/garden-site/auth.service.js');
let hidden=false;const output=new Writable({write(chunk,encoding,callback){if(!hidden)process.stdout.write(chunk,encoding);callback();}});
if(!process.stdin.isTTY)throw Error('管理员初始化需要交互终端，密码不能放在命令行参数中');
const rl=readline.createInterface({input:process.stdin,output,terminal:true});
const db=new DatabaseService();try{const user=await rl.question('管理员用户名: ');process.stdout.write('密码（至少15字符，不显示）: ');hidden=true;const pass=await rl.question('');hidden=false;process.stdout.write('\n');if(process.argv.includes('--recover')){const confirm=await rl.question('再次输入管理员用户名以确认重置并撤销全部会话: ');if(confirm!==user)throw Error('确认不匹配');await new AuthService(db).recoverAdmin(user,pass);console.log('管理员密码已恢复，全部会话已撤销');}else{await new AuthService(db).createAdmin(user,pass);console.log('管理员已创建');}}finally{rl.close();await db.onModuleDestroy();}

import {spawn} from 'node:child_process';
import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,writeFile,readFile,rename,stat} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {createGzip,createGunzip} from 'node:zlib';
import path from 'node:path';
const mode=process.argv[2]??'backup';const database=process.env.MYSQL_DATABASE;
if(!database||!/^[a-z0-9_]+$/.test(database))throw Error('Explicit MYSQL_DATABASE required');
const key=Buffer.from(process.env.GARDEN_BACKUP_KEY??'','base64');if(key.length!==32)throw Error('GARDEN_BACKUP_KEY must be a 32-byte base64 encryption key');
const args=['--host='+ (process.env.MYSQL_HOST??'127.0.0.1'),'--port='+(process.env.MYSQL_PORT??'3306'),'--user='+(process.env.MYSQL_USER??'children_games_app')];
function processDone(child){return new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`Database tool exited ${code}`)));});}
if(mode==='backup'){
 const directory=process.env.GARDEN_BACKUP_DIR;if(!directory)throw Error('GARDEN_BACKUP_DIR must point to a private backup destination');await mkdir(directory,{recursive:true,mode:0o700});
 const file=path.join(directory,`${database}-${new Date().toISOString().replace(/[:.]/g,'-')}.sql.gz.enc`),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const child=spawn(process.env.MYSQLDUMP_BIN??'mysqldump',[...args,'--single-transaction','--no-tablespaces','--set-gtid-purged=OFF',database],{env:{...process.env,MYSQL_PWD:process.env.MYSQL_PASSWORD??''},stdio:['ignore','pipe','inherit']});
 await Promise.all([processDone(child),pipeline(child.stdout,createGzip(),cipher,createWriteStream(file+'.partial',{mode:0o600}))]);await rename(file+'.partial',file);
 const digest=createHash('sha256');for await(const b of createReadStream(file))digest.update(b);await writeFile(file+'.json',JSON.stringify({format:1,database,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),sha256:digest.digest('hex'),createdAt:new Date().toISOString()}),{mode:0o600});
 await writeFile(path.join(directory,'last-success.json'),JSON.stringify({file,at:new Date().toISOString(),size:(await stat(file)).size}),{mode:0o600});console.log('Encrypted backup completed:',file);
}else if(mode==='restore'){
 const file=process.argv[3];if(!file)throw Error('Encrypted backup path required');
 if(!database.endsWith('_restore_test')&&process.env.GARDEN_RESTORE_CONFIRM!==database)throw Error('Restore only into *_restore_test unless exact database confirmation is supplied');
 const metadata=JSON.parse(await readFile(file+'.json','utf8'));const hash=createHash('sha256');for await(const b of createReadStream(file))hash.update(b);if(hash.digest('hex')!==metadata.sha256)throw Error('Backup checksum mismatch');
 // Authenticate the entire ciphertext before piping SQL into MySQL.
 const verifier=createDecipheriv('aes-256-gcm',key,Buffer.from(metadata.iv,'base64'));verifier.setAuthTag(Buffer.from(metadata.tag,'base64'));for await(const chunk of createReadStream(file))verifier.update(chunk);verifier.final();
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(metadata.iv,'base64'));decipher.setAuthTag(Buffer.from(metadata.tag,'base64'));
 const child=spawn(process.env.MYSQL_BIN??'mysql',[...args,database],{env:{...process.env,MYSQL_PWD:process.env.MYSQL_PASSWORD??''},stdio:['pipe','inherit','inherit']});await Promise.all([processDone(child),pipeline(createReadStream(file),decipher,createGunzip(),child.stdin)]);
 const mysql=await import('mysql2/promise');const c=await mysql.createConnection({host:process.env.MYSQL_HOST??'127.0.0.1',port:Number(process.env.MYSQL_PORT??3306),user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD??'',database});
 try{await c.query('UPDATE garden_session SET revoked_at=UTC_TIMESTAMP(3)');await c.query('UPDATE garden_password_reset SET revoked_at=UTC_TIMESTAMP(3)');await c.query('UPDATE garden_invitation SET revoked_at=UTC_TIMESTAMP(3) WHERE used_at IS NULL');console.log('Restore complete; sessions/reset tokens and unused invitations revoked. Issue fresh invitations after review.');}finally{await c.end();}
}else if(mode==='check'){
 const latest=JSON.parse(await readFile(path.join(process.env.GARDEN_BACKUP_DIR??'','last-success.json'),'utf8'));if(Date.now()-new Date(latest.at).getTime()>26*3600000)throw Error('No successful backup in the last 26 hours');await stat(latest.file);console.log('Backup freshness OK');
}else throw Error('Unknown backup command');

// Only for isolated browser/CI fixtures; production uses the interactive bootstrap command.
import {createRequire} from 'node:module';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);require('reflect-metadata');
if(!process.env.MYSQL_DATABASE?.endsWith('_test')||!process.env.GARDEN_E2E_ADMIN_FILE)throw Error('Explicit *_test database and private fixture file required');
const {DatabaseService}=require('../dist/server/src/modules/database/database.service.js');const argon=require('argon2');
const db=new DatabaseService(),username='e2eadmin'+randomBytes(6).toString('hex'),password=randomBytes(24).toString('hex'),uid=randomUUID();
try{await db.withTransaction(async c=>{await c.execute("INSERT INTO garden_user (id,username_normalized,password_hash,user_role) VALUES (?,?,?,'admin')",[uid,username,await argon.hash(password,{type:argon.argon2id,memoryCost:19456,timeCost:2,parallelism:1})]);for(let slot=1;slot<=3;slot++)await c.execute('INSERT INTO garden_profile (id,user_id,slot_number) VALUES (?,?,?)',[randomUUID(),uid,slot]);});await mkdir(path.dirname(process.env.GARDEN_E2E_ADMIN_FILE),{recursive:true});await writeFile(process.env.GARDEN_E2E_ADMIN_FILE,JSON.stringify({username,password}),{mode:0o600});console.log('Dedicated test administrator created; credentials stored in the private fixture file.');}finally{await db.onModuleDestroy();}

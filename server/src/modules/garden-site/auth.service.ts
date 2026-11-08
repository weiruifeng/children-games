import {Injectable,Inject} from '@nestjs/common';
import * as argon from 'argon2';
import {z} from 'zod';
import {DatabaseService,type SqlConnection,type RowDataPacket} from '../database/database.service';
import {code,digest,fail,id,normalizeCode,token,userView,type Actor} from './core';
export const username=z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/).transform(v=>v.toLowerCase());
export const password=z.string().refine(v=>[...v].length>=15&&[...v].length<=128,'密码需要15至128个字符');
const hash=(p:string)=>argon.hash(p,{type:argon.argon2id,memoryCost:19456,timeCost:2,parallelism:1});
export async function audit(c:SqlConnection,actor:string,action:string,target:string){await c.execute('INSERT INTO garden_admin_audit (id,actor_id,action_name,target_id) VALUES (?,?,?,?)',[id(),actor,action,target]);}
@Injectable()
export class AuthService {
 constructor(@Inject(DatabaseService) private db:DatabaseService){}
 async rows(sql:string,args:any[]=[]):Promise<any[]>{return this.db.query<RowDataPacket[]>(sql,args);}
 async rate(key:string,max:number,seconds:number){
  const start=Math.floor(Date.now()/1000/seconds)*seconds,bucket=digest(key);
  await this.db.withTransaction(async c=>{
   await c.execute('INSERT INTO garden_rate_limit (bucket_key,window_start,request_count,expires_at) VALUES (?,?,1,?) ON DUPLICATE KEY UPDATE request_count=request_count+1',[bucket,start,new Date((start+seconds*2)*1000)]);
   const [rows]=await c.execute<RowDataPacket[]>('SELECT request_count FROM garden_rate_limit WHERE bucket_key=? AND window_start=?',[bucket,start]);
   // Commit the count, including denied requests.
  });
  const [row]=await this.rows('SELECT request_count FROM garden_rate_limit WHERE bucket_key=? AND window_start=?',[bucket,start]);
  if(row.request_count>max)fail(429,'RATE_LIMITED','操作太频繁，请稍后重试',{retryAfter:Math.max(1,start+seconds-Math.floor(Date.now()/1000))});
 }
 async register(body:unknown){
  const b=z.object({username,password,invitationCode:z.string().max(100)}).strict().parse(body),uid=id(),ph=await hash(b.password);
  try{await this.db.withTransaction(async c=>{
   const [rows]=await c.execute<RowDataPacket[]>('SELECT * FROM garden_invitation WHERE code_hash=? FOR UPDATE',[digest(normalizeCode(b.invitationCode))]);const invite=rows[0];
   if(!invite||invite.revoked_at||invite.used_at||new Date(invite.expires_at).getTime()<=Date.now())fail(400,'INVALID_INVITATION','邀请码无效或已经使用');
   await c.execute('INSERT INTO garden_user (id,username_normalized,password_hash) VALUES (?,?,?)',[uid,b.username,ph]);
   for(let slot=1;slot<=3;slot++)await c.execute('INSERT INTO garden_profile (id,user_id,slot_number) VALUES (?,?,?)',[id(),uid,slot]);
   await c.execute('UPDATE garden_invitation SET used_by=?,used_at=? WHERE id=?',[uid,new Date(),invite.id]);
  });}catch(e:any){if(e.code==='ER_DUP_ENTRY')fail(409,'USERNAME_TAKEN','用户名已被使用');throw e;}
  return {userId:uid};
 }
 async login(body:unknown){
  const b=z.object({username,password:z.string().max(512)}).strict().parse(body);await this.rate('login-user:'+b.username,10,900);
  const [u]=await this.rows('SELECT * FROM garden_user WHERE username_normalized=?',[b.username]);
  if(!u||u.user_status!=='active'||!await argon.verify(u.password_hash,b.password))fail(401,'INVALID_CREDENTIALS','账号或密码不正确');
  const raw=token(),csrf=token(),sid=id(),now=new Date(),expires=new Date(Date.now()+(u.user_role==='admin'?12*3600:30*86400)*1000);
  await this.db.withTransaction(async c=>{
   const [current]=await c.execute<RowDataPacket[]>('SELECT user_status,password_hash FROM garden_user WHERE id=? FOR UPDATE',[u.id]);
   if(current[0]?.user_status!=='active'||!await argon.verify(current[0].password_hash,b.password))fail(401,'INVALID_CREDENTIALS','账号或密码不正确');
   if(argon.needsRehash(current[0].password_hash,{memoryCost:19456,timeCost:2,parallelism:1}))await c.execute('UPDATE garden_user SET password_hash=? WHERE id=?',[await hash(b.password),u.id]);
   await c.execute('INSERT INTO garden_session (id,token_hash,user_id,csrf_secret,last_seen_at,expires_at) VALUES (?,?,?,?,?,?)',[sid,digest(raw),u.id,csrf,now,expires]);
  });return {raw,expires,user:userView(u)};
 }
 async authenticate(raw?:string):Promise<Actor>{
  if(!raw||!/^[a-f0-9]{64}$/.test(raw))fail(401,'AUTH_REQUIRED','请登录');
  const [u]=await this.rows('SELECT u.*,s.id AS session_id,s.csrf_secret,s.last_seen_at,s.expires_at,s.revoked_at FROM garden_session s JOIN garden_user u ON u.id=s.user_id WHERE s.token_hash=?',[digest(raw)]);
  if(!u||u.user_status!=='active'||u.revoked_at||new Date(u.expires_at).getTime()<=Date.now()||Date.now()-new Date(u.last_seen_at).getTime()>(u.user_role==='admin'?1800:604800)*1000)fail(401,'AUTH_REQUIRED','登录已过期，请重新登录');
  if(Date.now()-new Date(u.last_seen_at).getTime()>300000)await this.db.withTransaction(async c=>{await c.execute('UPDATE garden_session SET last_seen_at=? WHERE id=?',[new Date(),u.session_id]);});
  return {id:u.id,username:u.username_normalized,role:u.user_role,sessionId:u.session_id,csrf:u.csrf_secret};
 }
 async logout(a:Actor){await this.db.withTransaction(async c=>{await c.execute('UPDATE garden_session SET revoked_at=? WHERE id=?',[new Date(),a.sessionId]);});}
 async change(a:Actor,body:unknown){const b=z.object({currentPassword:z.string().max(512),newPassword:password}).strict().parse(body);const ph=await hash(b.newPassword);
  await this.db.withTransaction(async c=>{const [r]=await c.execute<RowDataPacket[]>('SELECT password_hash FROM garden_user WHERE id=? FOR UPDATE',[a.id]);if(!await argon.verify(r[0].password_hash,b.currentPassword))fail(400,'INVALID_PASSWORD','当前密码不正确');await this.setPassword(c,a.id,ph);});
 }
 private async setPassword(c:SqlConnection,uid:string,ph:string){await c.execute('UPDATE garden_user SET password_hash=? WHERE id=?',[ph,uid]);await c.execute('UPDATE garden_session SET revoked_at=? WHERE user_id=?',[new Date(),uid]);await c.execute('UPDATE garden_password_reset SET revoked_at=? WHERE user_id=?',[new Date(),uid]);}
 async reset(body:unknown){const b=z.object({resetCode:z.string().max(100),newPassword:password}).strict().parse(body),ph=await hash(b.newPassword);
  // User lock precedes token lock in all password operations.
  const [candidate]=await this.rows('SELECT user_id FROM garden_password_reset WHERE token_hash=?',[digest(normalizeCode(b.resetCode))]);if(!candidate)fail(400,'INVALID_RESET','重置码无效');
  await this.db.withTransaction(async c=>{await c.execute('SELECT id FROM garden_user WHERE id=? FOR UPDATE',[candidate.user_id]);const [r]=await c.execute<RowDataPacket[]>('SELECT * FROM garden_password_reset WHERE token_hash=? FOR UPDATE',[digest(normalizeCode(b.resetCode))]);const t=r[0];if(!t||t.revoked_at||t.consumed_at||new Date(t.expires_at).getTime()<=Date.now())fail(400,'INVALID_RESET','重置码无效或过期');await this.setPassword(c,t.user_id,ph);await c.execute('UPDATE garden_password_reset SET consumed_at=? WHERE id=?',[new Date(),t.id]);});
 }
 async createAdmin(name:string,pass:string){const n=username.parse(name),ph=await hash(password.parse(pass));await this.db.withTransaction(async c=>{
  const guard=digest('bootstrap-admin');await c.execute("INSERT INTO garden_rate_limit (bucket_key,window_start,request_count,expires_at) VALUES (?,0,0,'9999-01-01') ON DUPLICATE KEY UPDATE request_count=request_count",[guard]);
  await c.execute('SELECT bucket_key FROM garden_rate_limit WHERE bucket_key=? AND window_start=0 FOR UPDATE',[guard]);
  const [r]=await c.execute<RowDataPacket[]>("SELECT id FROM garden_user WHERE user_role='admin'");if(r.length)throw Error('管理员已经存在');const uid=id();await c.execute("INSERT INTO garden_user (id,username_normalized,password_hash,user_role) VALUES (?,?,?,'admin')",[uid,n,ph]);for(let slot=1;slot<=3;slot++)await c.execute('INSERT INTO garden_profile (id,user_id,slot_number) VALUES (?,?,?)',[id(),uid,slot]);await audit(c,uid,'bootstrap',uid);
 });}
 async recoverAdmin(name:string,pass:string){const n=username.parse(name),ph=await hash(password.parse(pass));await this.db.withTransaction(async c=>{const [r]=await c.execute<RowDataPacket[]>("SELECT id FROM garden_user WHERE username_normalized=? AND user_role='admin' FOR UPDATE",[n]);if(!r[0])throw Error('管理员不存在');await this.setPassword(c,r[0].id,ph);await audit(c,r[0].id,'admin.password-recovery',r[0].id);});}
 async adminList(kind:'users'|'invitations'|'audit',query:Record<string,unknown>){
  const q=z.object({cursor:z.string().max(36).optional(),limit:z.coerce.number().int().min(1).max(100).default(20),status:z.string().max(16).optional(),username:z.string().max(32).optional()}).strict().parse(query);
  const params:any[]=[];const where=['1=1'];if(q.cursor){where.push('id>?');params.push(q.cursor);}
  if(kind==='users'){if(q.status){where.push('user_status=?');params.push(q.status);}if(q.username){where.push('username_normalized LIKE ?');params.push('%'+q.username.toLowerCase()+'%');}}
  if(kind==='invitations'&&q.status){const predicates:Record<string,string>={used:'used_at IS NOT NULL',revoked:'used_at IS NULL AND revoked_at IS NOT NULL',expired:'used_at IS NULL AND revoked_at IS NULL AND expires_at<=UTC_TIMESTAMP(3)',unused:'used_at IS NULL AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP(3)'};if(!predicates[q.status])fail(400,'INVALID_INPUT','无效状态');where.push(predicates[q.status]);}
  const select=kind==='users'?'id,username_normalized,user_role,user_status,created_at':kind==='invitations'?'id,code_prefix,note,created_at,expires_at,revoked_at,used_by,used_at':'id,actor_id,action_name,target_id,created_at';
  const table={users:'garden_user',invitations:'garden_invitation',audit:'garden_admin_audit'}[kind];
  const rows=await this.rows(`SELECT ${select} FROM ${table} WHERE ${where.join(' AND ')} ORDER BY id LIMIT ${q.limit+1}`,params);return {items:rows.slice(0,q.limit),nextCursor:rows.length>q.limit?rows[q.limit-1].id:null};
 }
 async invites(a:Actor,body:unknown){const b=z.object({count:z.number().int().min(1).max(100),validDays:z.union([z.literal(1),z.literal(7),z.literal(30)]),note:z.string().max(100).default('')}).strict().parse(body);const items=Array.from({length:b.count},()=>({id:id(),code:code(),expiresAt:new Date(Date.now()+b.validDays*86400000).toISOString()}));await this.db.withTransaction(async c=>{for(const item of items){await c.execute('INSERT INTO garden_invitation (id,code_hash,code_prefix,note,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?,?)',[item.id,digest(item.code),item.code.slice(0,6),b.note,a.id,new Date(),new Date(item.expiresAt)]);await audit(c,a.id,'invite.create',item.id);}});return {items};}
 async revoke(a:Actor,inviteId:string){await this.db.withTransaction(async c=>{const [r]=await c.execute<RowDataPacket[]>('SELECT * FROM garden_invitation WHERE id=? FOR UPDATE',[inviteId]);if(!r[0])fail(404,'NOT_FOUND','邀请码不存在');if(r[0].used_at)fail(409,'INVITATION_USED','邀请码已使用');await c.execute('UPDATE garden_invitation SET revoked_at=? WHERE id=?',[new Date(),inviteId]);await audit(c,a.id,'invite.revoke',inviteId);});}
 async userStatus(a:Actor,uid:string,body:unknown){const b=z.object({status:z.enum(['active','disabled'])}).strict().parse(body);await this.db.withTransaction(async c=>{const [r]=await c.execute<RowDataPacket[]>('SELECT user_role FROM garden_user WHERE id=? FOR UPDATE',[uid]);if(!r[0])fail(404,'NOT_FOUND','用户不存在');if(r[0].user_role==='admin')fail(403,'FORBIDDEN','不能禁用管理员');await c.execute('UPDATE garden_user SET user_status=? WHERE id=?',[b.status,uid]);if(b.status==='disabled')await c.execute('UPDATE garden_session SET revoked_at=? WHERE user_id=?',[new Date(),uid]);await audit(c,a.id,'user.'+b.status,uid);});return {status:b.status};}
 async issueReset(a:Actor,uid:string){const raw=code(),expiresAt=new Date(Date.now()+1800000);await this.db.withTransaction(async c=>{const [r]=await c.execute<RowDataPacket[]>('SELECT id,user_role FROM garden_user WHERE id=? FOR UPDATE',[uid]);if(!r[0])fail(404,'NOT_FOUND','用户不存在');if(r[0].user_role==='admin')fail(403,'FORBIDDEN','管理员密码通过运维恢复');await c.execute('UPDATE garden_password_reset SET revoked_at=? WHERE user_id=?',[new Date(),uid]);await c.execute('INSERT INTO garden_password_reset (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)',[id(),uid,digest(raw),expiresAt]);await audit(c,a.id,'password.reset-code',uid);});return {resetCode:raw,expiresAt:expiresAt.toISOString()};}
}

import {historySummary,recentEvidence} from '../../../../shared/src/pinyin-garden/cloud-history';
import {Injectable,Inject} from '@nestjs/common';
import {z} from 'zod';
import {DatabaseService,type SqlConnection,type RowDataPacket} from '../database/database.service';
import {CLOUD_LIMITS,parseCloudProfile,eventSchema,revisionSchema,uuidSchema} from '../../../../shared/src/pinyin-garden/cloud';
import {CHARACTER_PACK} from '../../../../shared/src/pinyin-garden/characterCatalog';
import {fail,id,json,requestHash,type Actor} from './core';
@Injectable()
export class GardenService {
 constructor(@Inject(DatabaseService) private db:DatabaseService){}
 private async owned(c:SqlConnection,a:Actor,slot:number){if(!Number.isInteger(slot)||slot<1||slot>3)fail(400,'INVALID_INPUT','无效槽位');const [r]=await c.execute<RowDataPacket[]>('SELECT * FROM garden_profile WHERE user_id=? AND slot_number=? FOR UPDATE',[a.id,slot]);if(!r[0])fail(404,'NOT_FOUND','花园不存在');return r[0];}
 private view(r:any){return {slot:r.slot_number,profileId:r.id,revision:Number(r.revision),generation:r.generation,updatedAt:new Date(r.updated_at).toISOString(),profile:json(r.profile_json)};}
 async list(a:Actor){const rows=await this.db.query<RowDataPacket[]>('SELECT id,slot_number,revision,generation,updated_at,JSON_UNQUOTE(JSON_EXTRACT(profile_json,\'$.name\')) AS garden_name FROM garden_profile WHERE user_id=? ORDER BY slot_number',[a.id]);return {slots:rows.map(r=>({slot:r.slot_number,profileId:r.id,revision:Number(r.revision),generation:r.generation,updatedAt:new Date(r.updated_at).toISOString(),empty:r.garden_name===null,name:r.garden_name}))};}
 async get(a:Actor,slot:number){return this.db.withTransaction(async c=>this.view(await this.owned(c,a,slot)));}
 async mutate(a:Actor,slot:number,input:unknown,operation:'save'|'clear'|'delete-history'){
  const base=z.object({baseRevision:revisionSchema,mutationId:uuidSchema,generation:revisionSchema});
  const b=(operation==='save'?base.extend({profile:z.unknown()}):base).strict().parse(input) as {baseRevision:number;mutationId:string;generation:number;profile?:unknown};
  if(operation==='save'&&(b.profile as any)?.packVersion!==CHARACTER_PACK)fail(422,'UNSUPPORTED_PROFILE_VERSION','请更新客户端或导出旧存档');
  if(operation==='save'&&Buffer.byteLength(JSON.stringify(b.profile))>CLOUD_LIMITS.snapshot)fail(413,'PROFILE_TOO_LARGE','快照超过1MiB，请先导出备份');
  let profile=null;try{profile=operation==='save'?parseCloudProfile(b.profile):null;}catch{fail(422,'INVALID_PROFILE','存档格式或战斗内容不兼容，请导出后恢复');}
  const h=requestHash({slot,operation,...b,profile});
  try{return await this.db.withTransaction(async c=>{
   const r=await this.owned(c,a,slot);
   const [prior]=await c.execute<RowDataPacket[]>('SELECT * FROM garden_mutation WHERE user_id=? AND id=?',[a.id,b.mutationId]);
   if(prior[0]){if(prior[0].request_hash!==h)fail(409,'IDEMPOTENCY_KEY_REUSED','操作编号已被其他内容使用');return json(prior[0].result_json);}
   if(Number(r.revision)!==b.baseRevision||r.generation!==b.generation)fail(409,'REVISION_CONFLICT','云端已有其他设备保存的进度',{currentRevision:Number(r.revision),generation:r.generation});
   const revision=Number(r.revision)+1,generation=r.generation+(operation==='save'?0:1);
   await c.execute('UPDATE garden_profile SET profile_json=?,revision=?,generation=?,updated_at=? WHERE id=?',[profile?JSON.stringify(profile):null,revision,generation,new Date(),r.id]);
   if(operation==='delete-history'){await c.execute('DELETE FROM garden_learning_event WHERE profile_id=?',[r.id]);await c.execute('UPDATE garden_profile SET history_floor=? WHERE id=?',[generation,r.id]);}
   const result={slot,revision,generation,mutationId:b.mutationId,updatedAt:new Date().toISOString()};
   await c.execute('INSERT INTO garden_mutation (id,user_id,request_hash,result_json) VALUES (?,?,?,?)',[b.mutationId,a.id,h,JSON.stringify(result)]);return result;
  });}catch(e){if((e as any).code==='ER_DUP_ENTRY'){const prior=await this.db.query<RowDataPacket[]>('SELECT request_hash,result_json FROM garden_mutation WHERE user_id=? AND id=?',[a.id,b.mutationId]);if(prior[0]){if(prior[0].request_hash!==h)fail(409,'IDEMPOTENCY_KEY_REUSED','操作编号已被其他内容使用');return json(prior[0].result_json);}}throw e;}
 }
 async events(a:Actor,slot:number,input:unknown){const b=z.object({generation:revisionSchema,events:z.array(eventSchema).min(1).max(CLOUD_LIMITS.events)}).strict().parse(input);if(Buffer.byteLength(JSON.stringify(b))>CLOUD_LIMITS.eventBatch)fail(413,'EVENT_BATCH_TOO_LARGE','请减少每批记录数');return this.db.withTransaction(async c=>{const r=await this.owned(c,a,slot);if(b.generation>r.generation||b.generation<r.history_floor)fail(409,'GENERATION_RETIRED','这份学习历史已被清除，请先导出本机记录');for(const event of b.events){const h=requestHash(event);const [old]=await c.execute<RowDataPacket[]>('SELECT request_hash FROM garden_learning_event WHERE profile_id=? AND generation=? AND event_id=?',[r.id,b.generation,event.eventId]);if(old[0]){if(old[0].request_hash!==h)fail(409,'EVENT_ID_REUSED','同一记录编号对应不同内容');continue;}await c.execute('INSERT INTO garden_learning_event (profile_id,event_id,generation,pack_version,event_json,request_hash) VALUES (?,?,?,?,?,?)',[r.id,event.eventId,b.generation,event.packVersion,JSON.stringify(event),h]);}return {accepted:b.events.map(e=>e.eventId)};});}
 async readEvents(a:Actor,slot:number,query:unknown){const q=z.object({cursor:z.coerce.number().int().min(0).default(0),generation:z.coerce.number().int().min(0).optional(),all:z.enum(['true']).optional(),limit:z.coerce.number().int().min(1).max(1000).default(500)}).strict().parse(query);return this.db.withTransaction(async c=>{const r=await this.owned(c,a,slot);const [rows]=await c.execute<RowDataPacket[]>(`SELECT id,generation,event_json FROM garden_learning_event WHERE profile_id=? AND id>? ${q.all?'':'AND generation=?'} ORDER BY id LIMIT ${q.limit+1}`,q.all?[r.id,q.cursor]:[r.id,q.cursor,q.generation??r.generation]);return {items:rows.slice(0,q.limit).map(row=>({sequence:Number(row.id),generation:row.generation,...json(row.event_json)})),nextCursor:rows.length>q.limit?Number(rows[q.limit-1].id):null};});}
 async summary(a:Actor,slot:number){return this.db.withTransaction(async c=>{const r=await this.owned(c,a,slot);const [rows]=await c.execute<RowDataPacket[]>('SELECT event_json FROM garden_learning_event WHERE profile_id=? AND generation=? ORDER BY id',[r.id,r.generation]);const attempts=rows.map(row=>json(row.event_json).attempt).sort((a,b)=>a.at-b.at);return {generation:r.generation,timeZone:'Asia/Shanghai',summary:historySummary(attempts),evidence:recentEvidence(attempts,json(r.profile_json)?.checkpoint?.runId)};});}
 async archive(a:Actor,input:unknown){const b=z.object({data:z.unknown()}).strict().parse(input);const size=Buffer.byteLength(JSON.stringify(b));if(size>CLOUD_LIMITS.archive)fail(413,'ARCHIVE_TOO_LARGE','请分段归档');const aid=id();await this.db.withTransaction(async c=>{await c.execute('INSERT INTO garden_archive (id,user_id,archive_json) VALUES (?,?,?)',[aid,a.id,JSON.stringify(b.data)]);});return {archiveId:aid};}
 async archives(a:Actor,archiveId?:string){const r=await this.db.query<RowDataPacket[]>(archiveId?'SELECT id,archive_json,created_at FROM garden_archive WHERE user_id=? AND id=?':'SELECT id,created_at FROM garden_archive WHERE user_id=? ORDER BY created_at',[a.id,...archiveId?[archiveId]:[]]);if(archiveId&&!r[0])fail(404,'NOT_FOUND','归档不存在');return {items:r.map(row=>({id:row.id,createdAt:row.created_at,...archiveId?{data:json(row.archive_json)}:{}}))};}
}

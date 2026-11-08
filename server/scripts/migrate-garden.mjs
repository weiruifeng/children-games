import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function migrate(){
 for(const k of ['MYSQL_DATABASE','MYSQL_USER'])if(!process.env[k])throw Error(`Missing ${k}`);
 const c=await mysql.createConnection({host:process.env.MYSQL_HOST??'127.0.0.1',port:Number(process.env.MYSQL_PORT??3306),user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD??'',database:process.env.MYSQL_DATABASE,multipleStatements:false});
 try{
 const [lock]=await c.query("SELECT GET_LOCK(CONCAT(DATABASE(),':garden-migrate'),10) AS acquired");if(lock[0].acquired!==1)throw Error('Migration lock unavailable');
 await c.query("CREATE TABLE IF NOT EXISTS garden_schema_migration (migration_id VARCHAR(100) NOT NULL COMMENT '迁移名', checksum CHAR(64) NOT NULL COMMENT '校验和', applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '执行时间', PRIMARY KEY(migration_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='花园迁移记录'");
 const name='002_garden_site.sql',sql=await readFile(new URL('../database/migrations/'+name,import.meta.url),'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
 const [rows]=await c.execute('SELECT checksum FROM garden_schema_migration WHERE migration_id=?',[name]);
 if(rows.length){if(rows[0].checksum!==checksum)throw Error('Applied migration checksum differs');return;}
 // Each CREATE is restartable. DDL is not transactional: an interrupted run is retried, never advertised as rolled back.
 for(const statement of sql.split(';').map(v=>v.trim()).filter(Boolean))await c.query(statement);
 await c.execute('INSERT INTO garden_schema_migration (migration_id,checksum) VALUES (?,?)',[name,checksum]);
 }finally{await c.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(),':garden-migrate'))").catch(()=>{});await c.end();}
}
if(process.argv[1]===new URL(import.meta.url).pathname)await migrate();

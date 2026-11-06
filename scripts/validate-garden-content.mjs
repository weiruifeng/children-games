import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=(name)=>JSON.parse(fs.readFileSync(new URL(`../shared/src/pinyin-garden/data/${name}`,import.meta.url),'utf8').split(' = ')[1].replace(/;\s*$/,''));
const readings=read('candidate-ledger.ts'),levels=read('level-ledger.ts');
assert.equal(readings.length,1294);assert.equal(levels.length,241);
assert.equal(new Set(readings.map(r=>r.id)).size,readings.length);
assert.equal(new Set(levels.map(l=>l.id)).size,levels.length);
const byId=new Map(readings.map(r=>[r.id,r]));const assigned=new Set();
for(const level of levels){
 assert(level.targets.length>0&&level.targets.length<=6,level.id);
 if(level.track==='foundation')continue;
 for(const id of level.targets){const r=byId.get(id);assert(r,`Missing ${id}`);assert.equal(r.track,level.track);assert(!assigned.has(id),`Duplicate ${id}`);assigned.add(id);}
}
assert.equal(assigned.size,1294);
const adventures=read('adventure-levels.ts');const active=new Set(readings.filter(r=>r.textValidation.status==='source-verified').map(r=>r.id));const used=new Set();
for(const level of adventures){assert(level.targets.length>0&&level.targets.length<=6);if(level.track==='foundation')continue;if(level.track==='main')assert(level.targets.length>=4);for(const id of level.targets){assert(active.has(id));assert(!used.has(id));used.add(id);assert.equal(byId.get(id).track==='challenge'?'challenge':'main',level.track);}}
assert.equal(used.size,active.size);
const report={adventureLevels:adventures.length,total:readings.length,published:0,pending:0,excluded:0,baseSpellings:0,tracks:{},audioReviewed:0};
for(const r of readings){
 assert(['main','supplement','challenge'].includes(r.track));assert(r.sourceScope);assert(r.sourceId||r.sourceScope!=='教学清单1110项');assert.equal(r.id,`reading-${r.key}`);
 assert(['draft','reviewed','excluded'].includes(r.review.status));
 const released=r.textValidation.status==='source-verified'&&r.entries.some(e=>e.verification.status==='source-verified');
 assert(['source-verified','excluded','pending'].includes(r.textValidation.status));
 if(r.textValidation.status==='excluded')assert(r.textValidation.reason.length>10);
 if(r.review.status==='reviewed')assert(r.review.by&&r.review.date&&r.splitAudit.by&&r.hintAudit.by);
 for(const e of r.entries){if(e.verification.status!=='source-verified'&&e.review.status!=='reviewed')continue;assert(e.verification.sources.length>0||e.review.by&&e.review.date&&e.review.note);assert(!e.contextRequired||e.context);assert(e.context.includes(e.text),`${r.id}: context`);assert(r.track==='challenge'||e.common&&e.evidence.length>0);}
 if(r.track==='supplement')assert.equal(r.audio.status,'missing');
 if(r.audio.status==='reviewed'){assert(r.audio.note&&r.audio.file&&r.audio.reviewer&&r.audio.reviewedAt);const manifest=JSON.parse(fs.readFileSync(new URL('../web/src/experiments/pinyin-garden/assets/pronunciation-manifest.json',import.meta.url)));const asset=manifest[r.key];assert(asset,`Missing manifest ${r.key}`);assert.equal(asset.sha256,r.audio.sha256);const bytes=fs.readFileSync(new URL('../web/public'+asset.url,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),r.audio.sha256);report.audioReviewed++;}
 if(released)report.published++;else if(r.textValidation.status==='excluded')report.excluded++;else report.pending++;
 report.tracks[r.track]??={total:0,published:0};report.tracks[r.track].total++;if(released)report.tracks[r.track].published++;
}
report.baseSpellings=new Set(readings.filter(r=>r.textValidation.status==='source-verified').map(r=>r.base)).size;
assert.equal(report.baseSpellings,new Set(readings.map(r=>r.base)).size,'Missing base spelling');
assert.equal(report.published+report.pending+report.excluded,report.total);
assert.equal(report.pending,0,'Unresolved text candidates');
console.log(JSON.stringify(report,null,2));

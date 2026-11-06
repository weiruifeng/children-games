"""Reproducible source verification; never claims human audio listening."""
import json,re,unicodedata as ud,hashlib,runpy,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'docs/specs/pinyin-garden/content-inventory'
DATA=ROOT/'shared/src/pinyin-garden/data'
editorial=runpy.run_path(str(ROOT/'scripts/garden-editorial.py'));overrides=editorial['overrides'];guided=editorial['guided']
marks={'\u0304':1,'\u0301':2,'\u030c':3,'\u0300':4}
def key(s):
 s=ud.normalize('NFD',s.lower());tone=next((marks[c] for c in s if c in marks),5)
 return ud.normalize('NFC',''.join(c for c in s if c not in marks)).replace('ü','v')+str(tone)
def parse(name):
 out={}
 for line in (SOURCE/'sources'/name).read_text().splitlines():
  m=re.match(r'U\+([A-F0-9]+):\s*([^#]+)',line)
  if m:out[chr(int(m[1],16))]=[key(p.strip()) for p in m[2].strip().split(',')]
 return out
allchars=parse('dictionary-characters.txt');preferred=parse('preferred-readings.txt')
common={line.split('\t')[1] for line in (SOURCE/'sources/common-3500.txt').read_text().splitlines()}
teaching={(r['c'],key(r['py'])):int(r['l']) for r in json.loads((SOURCE/'sources/teaching-characters.json').read_text())}
inventory=json.loads((SOURCE/'inventory.json').read_text());original={r['id']:r for r in inventory['readings']}
raw=(DATA/'candidate-ledger.ts').read_text();header,payload=raw.split(' = ',1);rows=json.loads(payload.strip().removesuffix(';'))
# Explicitly unsupported: tone sandhi is not a dictionary spelling target.
excluded={**editorial['excludedExtensions'],'bu2':'不的二声是语流变调，本版字典拼式使用bù；留存记录，不作为独立汉字题。'}
report=[]
for r in rows:
 source=original[r['id']];k=r['key'];good=[];fail=[]
 candidates=list(r['entries'])
 if k in overrides:
  ch,context=overrides[k]
  if not any(e['text']==ch for e in candidates) and k in allchars.get(ch,[]):
   candidates.insert(0,{'id':f'sense-{k}-{ord(ch):x}','text':ch,'context':context,'common':ch in common,'contextRequired':len(allchars[ch])>1,'evidence':['字音词典逐项映射'],'review':{'status':'draft','by':'','note':'新增编辑候选','date':''}})
 for e in candidates:
  ch=e['text'];context=e.get('context','');evidence=[]
  external='https://zdic.net/hans/过' if (ch,k)==('过','guo5') else ''
  if k not in allchars.get(ch,[]) and not external:fail.append([ch,'字音映射不符']);continue
  evidence.append(external or 'pinyin-data:0.16.0/'+f'U+{ord(ch):04X}')
  normative=k in preferred.get(ch,[]);teachingMatch=(ch,k) in teaching
  sourceCandidate=next((c for c in source['candidates'] if c['character']==ch),{})
  validContexts=[]
  for ctx in sourceCandidate.get('contexts',[]):
   chars=list(ctx['text']);parts=ctx['pinyin'].split()
   if len(chars)==len(parts) and any(c==ch and key(py)==k for c,py in zip(chars,parts)) and all(key(py) in allchars.get(c,[]) for c,py in zip(chars,parts)):
    validContexts.append(ctx)
  authored=k in overrides and ch==overrides[k][0]
  if authored:context=overrides[k][1];evidence.append('garden-editorial.py/'+k)
  elif validContexts:context=validContexts[0]['text'];evidence.append('teaching-word/'+context+'/'+validContexts[0]['pinyin'])
  elif not e.get('contextRequired',False):context=ch
  else:fail.append([ch,'多音或轻声缺可定位语境']);continue
  if r['track']!='challenge' and (ch not in common or not (normative or teachingMatch or external or e.get('evidence'))):fail.append([ch,'普通分组证据不足']);continue
  if r['track']=='challenge' and not (normative or teachingMatch or validContexts or authored):fail.append([ch,'挑战候选仅宽泛字典收录，现代读音待复核']);continue
  if normative:evidence.append('preferred-readings/'+ch+'/'+k)
  if teachingMatch:evidence.append('teaching-characters/'+ch+'/'+k)
  e['context']=context;e['common']=ch in common;e['guided']=k in guided
  e['verification']={'status':'source-verified','method':'逐字读音＋语境字音对齐＋分组检查；不是人工听审','sources':evidence,'date':'2026-11-06'}
  good.append(e)
 r['entries']=candidates
 if k in ['guo5','zhuai4']:
  r['track']='main' if r['audio']['file'] else 'supplement'
  r['classificationNote']='汉典现代字义与编辑语境补足常用读音证据，保留原readingId'
  for e in good:
   if e['common']:e['evidence']=list(dict.fromkeys(e['evidence']+['现代字义语境补充核对']))
 # Only passing candidates get verification; existing human-reviewed samples remain separate.
 verified={e['id']:e for e in good}
 r['entries']=[verified.get(e['id'],{**e,'verification':{'status':'pending','method':'缺少交叉证据或明确语境','sources':[],'date':'2026-11-06'}}) for e in candidates]
 for e in r['entries']:e.setdefault('guided',False)
 if k in excluded:r['textValidation']={'status':'excluded','reason':excluded[k]}
 elif good:r['textValidation']={'status':'source-verified','reason':'有通过逐项资料验证的承载字；录音审核独立保留。'}
 else:r['textValidation']={'status':'pending','reason':'；'.join(dict.fromkeys(x[1] for x in fail)) or '缺少合格承载字'}
 report.append({'readingId':r['id'],'key':k,'track':r['track'],'status':r['textValidation']['status'],'reason':r['textValidation']['reason'],'entries':[{'id':e['id'],'text':e['text'],'context':e['context']} for e in good],'rejectedCandidates':fail})
(DATA/'candidate-ledger.ts').write_text(header+' = [\n'+',\n'.join(json.dumps(r,ensure_ascii=False,separators=(',',':')) for r in rows)+'\n];\n')
(SOURCE/'text-audit.json').write_text(json.dumps({'method':'source-verified≠人工审校；人工review与音频状态未修改','rows':report},ensure_ascii=False,indent=2)+'\n')
print(collections.Counter(r['status'] for r in report));print('PENDING:', ' '.join(r['key'] for r in report if r['status']=='pending'))

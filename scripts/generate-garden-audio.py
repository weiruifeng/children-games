#!/usr/bin/env python3
"""Reproducible original synthesized preview audio; not AI-generated final recordings.
Standard library only. Writes WAV masters, manifest and optional macOS AAC music.
"""
from pathlib import Path
import array, json, math, random, re, wave, subprocess, shutil
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'web/public/assets/pinyin-garden'
RATE=22050

def write(path,samples):
    path.parent.mkdir(parents=True,exist_ok=True)
    data=array.array('h',(int(max(-.95,min(.95,v))*32767) for v in samples))
    with wave.open(str(path),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(data.tobytes())

def pluck(buf,start,duration,freq,gain):
    offset=int(start*RATE)
    for i in range(min(int(duration*RATE),len(buf)-offset)):
        t=i/RATE;envelope=(1-math.exp(-t*240))*math.exp(-t*5/duration)
        sound=math.sin(2*math.pi*freq*t)+.22*math.sin(2*math.pi*freq*2*t)+.08*math.sin(2*math.pi*freq*3*t)
        buf[offset+i]+=gain*envelope*sound

manifest={'version':1,'status':'preview','source':'original deterministic procedural synthesis','music':{},'sfx':{}}
# Original note arrangements, no imported melodies or reference recordings.
for idx,(name,length,bpm) in enumerate([('bgm_home',75,90),('bgm_battle',90,104),('bgm_final_wave',75,112),('bgm_result',20,90)]):
    count=int(RATE*length);buf=array.array('f',[0])*count;beat=60/bpm
    notes=[60,64,67,69,72,76,79]
    pattern=[[0,2,4,1,3,2,5,4],[0,3,2,4,1,5,2,3],[0,2,3,5,4,2,6,3],[0,2,4,6,5,4,2,0]][idx]
    for k in range(int(length/beat)-3):
        at=k*beat;note=notes[pattern[k%len(pattern)]]
        pluck(buf,at,beat*1.8,440*2**((note-69)/12),.08)
        if k%2==0:pluck(buf,at,beat*2,440*2**((notes[(k//8)%3]-81)/12),.06)
        if idx in [1,2] and k%2:pluck(buf,at+beat*.5,.12,150,.035)
    fade=int(RATE*.15)
    for i in range(fade):buf[i]*=i/fade;buf[-1-i]*=i/fade
    wav=OUT/'music'/f'{name}.wav';write(wav,buf)
    # WAV fallback is portable; compress when Apple's encoder is available.
    file=wav
    if shutil.which('afconvert'):
        dest=wav.with_suffix('.m4a')
        result=subprocess.run(['afconvert','-f','m4af','-d','aac','-b','128000',str(wav),str(dest)],capture_output=True)
        if result.returncode==0:file=dest
    manifest['music'][name]={'url':f'/assets/pinyin-garden/music/{file.name}','duration':length,'loop':idx!=3,'status':'preview'}
rows=re.findall(r'^\| (\d\d) \| `([^`]+)`(\*)? \| ([\d.]+)s \|', (ROOT/'docs/specs/pinyin-garden/audio-assets.md').read_text(),re.M)
for num,name,variants,duration in rows:
    files=[]
    for variant in range(3 if variants else 1):
        dur=float(duration);rng=random.Random(int(num)*31+variant);buf=[]
        base=180+(int(num)%9)*48+variant*9
        for i in range(int(RATE*dur)):
            t=i/RATE;env=(1-math.exp(-t*400))*math.exp(-t*6/dur)
            noise=rng.uniform(-1,1)
            tone=math.sin(2*math.pi*(base*t+(60 if 'ready' in name or 'collect' in name else -40)*t*t))
            ratio=.58 if any(k in name for k in ['hit','break','fray','step','load','remove']) else .08
            buf.append(env*((1-ratio)*tone*.18+ratio*noise*.16))
        path=OUT/'sfx'/f'{name}_{variant+1:02}.wav';write(path,buf);files.append(f'/assets/pinyin-garden/sfx/{path.name}')
    manifest['sfx'][name]={'urls':files,'duration':float(duration),'status':'preview'}
(OUT/'audio-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(f"Generated {len(manifest['music'])} music previews and {sum(len(x['urls']) for x in manifest['sfx'].values())} sound previews")

# Importable runtime index; keep the public copy for existing static consumers.
(OUT.parents[2]/'src/experiments/pinyin-garden/assets/audio-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

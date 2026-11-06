import {describe,it,expect} from 'vitest';
import {partsFor,composeParts,ENTRIES} from './content';
describe('pinyin component boundaries',()=>{
 it.each([
  ['mǎ',['m','','a','']],['huā',['h','u','a','']],['zhuàng',['zh','u','ang','']],
  ['fēng',['f','','eng','']],['xīng',['x','','ing','']],['shuǐ',['sh','','ui','']],
  ['yuè',['','','','yue']],['ā',['','','a','']],
 ])('round trips %s without splitting multi-letter components',(pinyin,components)=>{
  const p=partsFor(pinyin);expect([p.initial,p.medial,p.final,p.whole]).toEqual(components);expect(composeParts(p)).toBe(pinyin);
 });
 it('round trips every currently shipped syllable',()=>{for(const entry of ENTRIES)entry.parts.forEach((p,i)=>expect(composeParts(p)).toBe(entry.pinyin[i]));});
});

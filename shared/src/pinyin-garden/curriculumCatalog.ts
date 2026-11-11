/** Authored wave scopes. A sample is never permission to introduce its components. */
export interface LessonWaveSpec {
  introduce: string[];
  targets: string[];
  note: string;
}
export interface LessonSpec {
  id: number;
  area: string;
  name: string;
  waves: [LessonWaveSpec, LessonWaveSpec, LessonWaveSpec];
}
const w = (introduce: string, targets: string, note: string): LessonWaveSpec => ({
  introduce: introduce.split(' ').filter(Boolean),
  targets: targets.split(' ').filter(Boolean),
  note,
});
export const LESSON_SPECS: LessonSpec[] = [
  {
    id: 1,
    area: '单韵母花圃',
    name: 'a o e',
    waves: [
      w('final:a final:o', 'a o', '看目标，找相同的字母。选好一次，全队共享弹药。'),
      w('final:e', 'e a o', '认识 e，再找找熟悉的 a 和 o。'),
      w('', 'a o e', '三个朋友一起守护花园。'),
    ],
  },
  {
    id: 2,
    area: '单韵母花圃',
    name: 'i u ü',
    waves: [
      w('final:i final:u', 'i u a o', 'i 上有一点，u 像小杯子。'),
      w('final:ü', 'ü u i e', 'ü 比 u 多两点，看清再选。'),
      w(
        'tone:1 tone:2 tone:3 tone:4 rule:i-dot',
        'ā á ǎ à ǐ ǜ',
        '看目标上的标记：ˉ ˊ ˇ ˋ。i 标调时去掉原来的点。',
      ),
    ],
  },
  {
    id: 3,
    area: '初步组合园',
    name: 'b p m f',
    waves: [
      w('initial:b initial:p rule:two', 'b p bā pī', '先看 b、p，再照样板把声母和韵母合起来。'),
      w('initial:m initial:f', 'm f mā fā bǎ', 'm 和 f 来了。目标拼音一直在上面。'),
      w('', 'mǎ mǐ mù bà pī fǎ', '照着完整拼音，选部件和声调。'),
    ],
  },
  {
    id: 4,
    area: '初步组合园',
    name: 'd t n l',
    waves: [
      w('initial:d initial:t', 'd t dà tǔ dì', 'd、t 和已经认识的韵母一起组成卡片。'),
      w('initial:n initial:l rule:nl-umlaut', 'n l nǚ lǜ nǐ', 'n、l 和 ü 组合时，两点要保留。'),
      w('', 'tù ná lù mǎ dà tǔ', '复习新伙伴，也带上熟悉的卡片。'),
    ],
  },
  {
    id: 5,
    area: '声母探索园',
    name: 'g k h',
    waves: [
      w('initial:g initial:k initial:h', 'g k h gǔ kē hé', '先认识 g、k、h，再照样板组合。'),
      w('rule:three-u', 'guā guǒ kuā huā mǎ', '三块按顺序放：g — u — a → gua。'),
      w('', 'huǒ guā kuò duǒ gǔ tǔ', '有的卡需要三块，目标会告诉你顺序。'),
    ],
  },
  {
    id: 6,
    area: '声母探索园',
    name: 'j q x',
    waves: [
      w('initial:j initial:q initial:x', 'j q x jī qǐ xī', '认识 j、q、x，先和 i 组合。'),
      w('rule:jqx-umlaut', 'jū qǔ xū jǐ', 'j、q、x 和 ü 组合，写成 ju、qu、xu，两点省去。'),
      w('rule:three-i', 'jiā qià xià jū huā', 'j — i — a → jia。仍然按样板选部件。'),
    ],
  },
  {
    id: 7,
    area: '声母探索园',
    name: 'z c s',
    waves: [
      w('initial:z initial:c initial:s', 'z c s zǔ cā sù', '认识 z、c、s，再和已学韵母组合。'),
      w('whole:zi whole:ci whole:si', 'zī cí sì zǔ', 'zi、ci、si 使用整张音节卡，不拆开。'),
      w('', 'zuò cuō suō zǐ cā', '三部件与完整卡交替练习。'),
    ],
  },
  {
    id: 8,
    area: '声母探索园',
    name: 'zh ch sh r',
    waves: [
      w(
        'initial:zh initial:ch initial:sh initial:r',
        'zh ch sh r shū rè',
        'zh、ch、sh 带着 h，r 单独一张卡。',
      ),
      w(
        'whole:zhi whole:chi whole:shi whole:ri',
        'zhī chǐ shí rì',
        'zhi、chi、shi、ri 使用整张音节卡。',
      ),
      w('', 'zhuō chuō shuō shù zǔ', '看清有没有 h，按目标拼好。'),
    ],
  },
  {
    id: 9,
    area: '声母探索园',
    name: 'y w',
    waves: [
      w('initial:y initial:w rule:yw', 'y w yā wā wǒ', 'y、w 有自己的拼写用法，先照样板认识。'),
      w('whole:yi whole:wu whole:yu', 'yī wǔ yǔ yú', 'yi、wu、yu 是整张卡，yu 里的 u 对应 ü。'),
      w('', 'yá wō yǔ wǔ shū', '复习完整卡和已经看过的拼式。'),
    ],
  },
  {
    id: 10,
    area: '复韵母花园',
    name: 'ai ei ui',
    waves: [
      w(
        'final:ai final:ei rule:compound-tone',
        'ai ei bái méi dài',
        'ai、ei 都是一整块韵母。照目标放好声调。',
      ),
      w('final:ui rule:ui', 'ui shuǐ huí zuì', 'ui 是省写形式，作为整块选择；声调放在 i 上。'),
      w('', 'bēi fēi mǎi shuǐ yǔ', '比较完整韵母，不把它们拆成单字母来选。'),
    ],
  },
  {
    id: 11,
    area: '复韵母花园',
    name: 'ao ou iu',
    waves: [
      w('final:ao final:ou', 'ao ou māo hǎo tóu', 'ao、ou 是新韵母，按样板合起来。'),
      w('final:iu rule:iu', 'iu niú liú jiǔ shuǐ', 'iu 和 ui 顺序不同，标调都在后面的元音上。'),
      w('', 'niǎo xiǎo cǎo niú mǎ', '三部件里的 ao 仍是一整块。'),
    ],
  },
  {
    id: 12,
    area: '复韵母花园',
    name: 'ie üe er',
    waves: [
      w(
        'final:ie final:üe rule:jqx-ue',
        'ie üe xiě nüè jué',
        'j、q、x 和 üe 组合写成 jue、que、xue；n、l 保留两点。',
      ),
      w('final:er whole:ye whole:yue', 'er ér ěr yè yuè', 'er 独立使用；ye、yue 用完整卡。'),
      w('', 'tiě lüè xué què yuè', '对照样板练习省点和标调。'),
    ],
  },
  {
    id: 13,
    area: '鼻韵母树林',
    name: 'an en in un ün',
    waves: [
      w(
        'final:an final:en final:in',
        'an en in shān mén lín',
        '先看 an、en、in 的字形，n 不能漏掉。',
      ),
      w(
        'final:un final:ün rule:un rule:jqx-un',
        'un ün gǔn jūn tián qún',
        'gun 的 un 与 jun 的 ü 相关拼式不同，按样板和规则选择。',
      ),
      w('whole:yuan whole:yin whole:yun', 'yuán yīn yún shān mén', 'yuan、yin、yun 用整张卡。'),
    ],
  },
  {
    id: 14,
    area: '鼻韵母树林',
    name: 'ang eng ing ong',
    waves: [
      w(
        'final:ang final:eng',
        'ang eng máng fēng děng',
        '看清后面的 ng；现在可以和 an、en 比较字形。',
      ),
      w(
        'final:ing final:ong whole:ying',
        'ing ong xīng hóng yīng',
        'ing、ong 是整块韵母；ying 用整张卡。',
      ),
      w('rule:iong', 'xióng qióng chuáng zhuàng fēng', 'iong 结构先看 i — ong；再复习已学三部件。'),
    ],
  },
];
export const WHOLE_SYLLABLES = [
  'zi',
  'ci',
  'si',
  'zhi',
  'chi',
  'shi',
  'ri',
  'yi',
  'wu',
  'yu',
  'ye',
  'yue',
  'yuan',
  'yin',
  'yun',
  'ying',
];
export const CURRICULUM_SYLLABLES = [
  ...new Set(
    LESSON_SPECS.flatMap((l) => l.waves.flatMap((w) => w.targets)).filter((s) =>
      /[āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ]/u.test(s),
    ),
  ),
];
export const CURRICULUM_SYMBOLS = [
  ...new Set(
    LESSON_SPECS.flatMap((l) => l.waves.flatMap((w) => w.introduce))
      .filter((k) => k.startsWith('initial:') || k.startsWith('final:'))
      .map((k) => k.split(':')[1]),
  ),
];

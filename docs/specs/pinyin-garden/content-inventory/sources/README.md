# 文字核对来源快照

这些文件支持 `python3 scripts/audit-garden-content.py` 的离线复验；逐文件哈希见 checksums.json。

- dictionary-characters.txt：pinyin-data 0.16.0 的 pinyin.txt，逐字读音映射。
- preferred-readings.txt：同项目 kMandarin_8105.txt，规范字常用读音映射。
- 两份 pinyin-data 数据适用父目录 pinyin-data-LICENSE.txt（MIT），上游 https://github.com/mozillazg/pinyin-data 。
- common-3500.txt：lqfeng/ChineseCharacters 的一级3500字转录，只使用字集成员关系。上游 https://github.com/lqfeng/ChineseCharacters ，许可证 Apache-2.0：https://github.com/lqfeng/ChineseCharacters/blob/master/LICENSE 。来源与原始哈希见父目录 common-character-policy.json。
- teaching-characters.json：GF0025-2021 查询转录中的字音事实，来源 https://dict.sinologyinstitute.com/ ，原 char.json 哈希见父目录 source-checksums.json。只作字音/级别交叉证据，不把该标准视为小学课序。

字音资料验证不等于低龄儿童熟悉度评测或专业人工审校。编辑语境由 scripts/garden-editorial.py 明确列出；外部核对的轻声“过”保留汉典链接。语气读音采用示范而不计独立拼写；排除项原因保留在原始分母内。录音听审不在此脚本中完成。

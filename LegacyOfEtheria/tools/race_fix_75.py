"""7.5: a cauda antiga do corpo Etheria sai do MODELO (não depende da animação) nas raças que usam a cauda do mod,
e as asas do corpo Etheria batem mais quando paradas/andando (antes ~6°, quase imóveis)."""
import json, glob, os, re
RP = os.path.join(os.path.dirname(__file__), '..', 'LegacyOfEtheria_RP')
BODIES = ['demon', 'demon_lord', 'dragonoid', 'dragonoid_lord', 'dragonewt', 'dragonewt_lord', 'dragonewt_w', 'dragonewt_w_lord',
          'lizardman', 'lizardman_lord'] + [f'lin_{l}_{f}' for l in ('veldora', 'velzard', 'velgrynd', 'veldanava') for f in ('base', 'draconic', 'true')]
TAIL = re.compile(r'^tail\d+$')
n = 0
for b in BODIES:
    p = f'{RP}/models/entity/etheria_race_{b}.geo.json'
    d = json.load(open(p))
    for g in d['minecraft:geometry']:
        for bone in g['bones']:
            if TAIL.match(bone['name']) and bone.get('cubes'):
                n += len(bone['cubes']); bone['cubes'] = []
    json.dump(d, open(p, 'w'), indent=1, ensure_ascii=False)
print('cubos de cauda removidos:', n)
p = os.path.join(os.path.dirname(__file__), 'race_src', 'etheria_race_parts.animation.json')
s = open(p, encoding='utf-8').read()
s = s.replace('query.is_on_ground ? 6 : 5', 'query.is_on_ground ? 14 : 5').replace('(17 + 15 * ', '(32 + 14 * ')
open(p, 'w', encoding='utf-8').write(s)

# Regrava as paletas dos .mcstructure no esquema EXATO de blocos do Bedrock 1.21.80 (metadados oficiais da Mojang):
# nomes inválidos -> equivalentes Bedrock; estados antigos -> atuais (mesmo mapeamento do atualizador do jogo); estados ausentes -> padrão; extras -> removidos.
import sys,os,glob,json,collections
sys.path.insert(0,os.path.dirname(__file__)); import tnbt
SRC,DST,META=sys.argv[1],sys.argv[2],sys.argv[3]
V=json.load(open(META)); B={b['name']:b for b in V['data_items']}; P={p['name']:p for p in V['block_properties']}
VERSION=18173952   # 1.21.80.0: o esquema usado aqui
RENAME={'minecraft:cobblestones':'minecraft:cobblestone','minecraft:dark_oaks':'minecraft:dark_oak_planks','minecraft:polished_andesites':'minecraft:polished_andesite',
 'minecraft:polished_deepslates':'minecraft:polished_deepslate','minecraft:sandstones':'minecraft:sandstone','minecraft:cobweb':'minecraft:web',
 'minecraft:dark_oak_wall_sign':'minecraft:darkoak_wall_sign','minecraft:flowering_azalea_leaves':'minecraft:azalea_leaves_flowered','minecraft:oak_door':'minecraft:wooden_door',
 'minecraft:oak_trapdoor':'minecraft:trapdoor','minecraft:potted_azure_bluet':'minecraft:flower_pot','minecraft:potted_bamboo':'minecraft:flower_pot','minecraft:potted_blue_orchid':'minecraft:flower_pot',
 'minecraft:red_bed':'minecraft:bed','minecraft:spawner':'minecraft:mob_spawner','minecraft:stone_slab':'minecraft:normal_stone_slab','minecraft:wall_torch':'minecraft:torch',
 'minecraft:white_banner':'minecraft:standing_banner','minecraft:white_wall_banner':'minecraft:wall_banner','minecraft:black_wall_banner':'minecraft:wall_banner','minecraft:orange_wall_banner':'minecraft:wall_banner'}
DOOR={0:'east',1:'south',2:'west',3:'north'}; GATE={0:'south',1:'west',2:'north',3:'east'}
FACE=['down','up','north','south','west','east']
DEF={'persistent_bit':1,'update_bit':0,'pillar_axis':'y','minecraft:vertical_half':'bottom','wall_post_bit':1,'liquid_depth':0,'deprecated':0,'hanging':0,
 'huge_mushroom_bits':15,'torch_facing_direction':'top','minecraft:cardinal_direction':'south','upper_block_bit':0,'open_bit':0,'in_wall_bit':0,'age':0}
stats=collections.Counter()
def fix_entry(comp):
    name=tnbt.get(comp,'name')[1]; st=dict((k,v) for k,v in (tnbt.get(comp,'states') or (10,[]))[1])
    n2=RENAME.get(name,name)
    if n2!=name: stats['rename '+name+'->'+n2]+=1
    if n2 not in B: raise SystemExit('nome sem equivalente: '+name)
    props=[p['name'] for p in B[n2].get('properties',[])]
    old={k:v[1] for k,v in st.items()}
    new=[]
    for pn in props:
        meta=P[pn]; typ=meta['type']; vals=[x['value'] for x in meta['values']]
        val=None
        if pn in old: val=old[pn]
        elif pn=='minecraft:cardinal_direction' and 'direction' in old:
            val=(GATE if 'fence_gate' in n2 else DOOR).get(old['direction']); stats['direction->cardinal '+n2]+=1
        elif pn=='minecraft:block_face' and 'facing_direction' in old: val=FACE[old['facing_direction']]; stats['facing->block_face']+=1
        elif pn=='minecraft:vertical_half' and 'top_slot_bit' in old: val='top' if old['top_slot_bit'] else 'bottom'; stats['top_slot->vertical_half']+=1
        if typ=='bool' and val is not None: val=1 if val else 0
        okvals=[1 if x is True else 0 if x is False else x for x in vals]
        if val is None or val not in okvals:
            d=DEF.get(pn); val=d if d is not None and d in okvals else okvals[0]; stats['default '+pn]+=1
        tag={'bool':1,'int':3,'string':8}[typ]
        new.append((pn,(tag,val)))
    dropped=set(old)-set(props)
    for k in dropped: stats['drop '+k]+=1
    out=[]
    for k,v in comp:
        if k=='name': out.append((k,(8,n2)))
        elif k=='states': out.append((k,(10,new)))
        elif k=='version': out.append((k,(3,VERSION)))
        else: out.append((k,v))
    if tnbt.get(comp,'states') is None: out.append(('states',(10,new)))
    return out
os.makedirs(DST,exist_ok=True)
for f in sorted(glob.glob(SRC+'/*.mcstructure')):
    name,(t,root)=tnbt.read(f)
    s=tnbt.get(root,'structure')[1]; pal=tnbt.get(tnbt.get(s,'palette')[1],'default')[1]; bp=tnbt.get(pal,'block_palette')
    et,items=bp[1]; items[:]=[fix_entry(c) for c in items]
    tnbt.write(os.path.join(DST,os.path.basename(f)),name,(t,root))
for k,v in sorted(stats.items()): print(v,k)

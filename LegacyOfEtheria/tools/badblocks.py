import sys,os,json,glob,collections
sys.path.insert(0,os.path.dirname(__file__)); import nbt
V=json.load(open(sys.argv[2]))
blocks={b['name']:b for b in V['data_items']}
props={p['name']:p for p in V['block_properties']}
bad=collections.defaultdict(set); badst=collections.defaultdict(set)
for f in sorted(glob.glob(sys.argv[1]+'/*.mcstructure')):
    v,_,_,_=nbt.load(f); pal=v['structure']['palette']['default']['block_palette']
    for e in pal:
        n=e['name']
        if n not in blocks: bad[n].add(os.path.basename(f)[:-12]); continue
        allowed={p['name'] for p in blocks[n].get('properties',[])}
        for k,val in e.get('states',{}).items():
            if k not in allowed: badst[(n,k)].add(os.path.basename(f)[:-12])
for n,fs in sorted(bad.items()): print('BADNAME',n,len(fs),sorted(fs)[:6])
for (n,k),fs in sorted(badst.items()): print('BADSTATE',n,k,len(fs),sorted(fs)[:4])

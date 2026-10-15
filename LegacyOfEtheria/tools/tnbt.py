# NBT little-endian (Bedrock) com tipos preservados: leitura e escrita byte a byte.
import struct
def _rs(b,p):
    n=struct.unpack_from('<H',b,p)[0]; return b[p+2:p+2+n].decode('utf8'), p+2+n
def _rp(b,p,t):
    if t==1: return struct.unpack_from('<b',b,p)[0],p+1
    if t==2: return struct.unpack_from('<h',b,p)[0],p+2
    if t==3: return struct.unpack_from('<i',b,p)[0],p+4
    if t==4: return struct.unpack_from('<q',b,p)[0],p+8
    if t==5: return struct.unpack_from('<f',b,p)[0],p+4
    if t==6: return struct.unpack_from('<d',b,p)[0],p+8
    if t==7: n=struct.unpack_from('<i',b,p)[0]; return bytes(b[p+4:p+4+n]),p+4+n
    if t==8: return _rs(b,p)
    if t==9:
        et=b[p]; n=struct.unpack_from('<i',b,p+1)[0]; p+=5
        if et==3:
            import array; a=array.array('i'); a.frombytes(b[p:p+4*n]); return (et,list(a)),p+4*n
        out=[]
        for _ in range(n): v,p=_rp(b,p,et); out.append(v)
        return (et,out),p
    if t==10:
        out=[]
        while True:
            tt=b[p]; p+=1
            if tt==0: return out,p
            k,p=_rs(b,p); v,p=_rp(b,p,tt); out.append((k,(tt,v)))
    if t==11:
        n=struct.unpack_from('<i',b,p)[0]; import array; a=array.array('i'); a.frombytes(b[p+4:p+4+4*n]); return list(a),p+4+4*n
    if t==12:
        n=struct.unpack_from('<i',b,p)[0]; return list(struct.unpack_from('<%dq'%n,b,p+4)),p+4+8*n
    raise ValueError(t)
def read(path):
    b=open(path,'rb').read(); t=b[0]; name,p=_rs(b,1); v,p=_rp(b,p,t)
    assert p==len(b),(p,len(b)); return name,(t,v)
def _ws(o,s):
    e=s.encode('utf8'); o.append(struct.pack('<H',len(e))); o.append(e)
def _wp(o,t,v):
    if t==1: o.append(struct.pack('<b',v))
    elif t==2: o.append(struct.pack('<h',v))
    elif t==3: o.append(struct.pack('<i',v))
    elif t==4: o.append(struct.pack('<q',v))
    elif t==5: o.append(struct.pack('<f',v))
    elif t==6: o.append(struct.pack('<d',v))
    elif t==7: o.append(struct.pack('<i',len(v))); o.append(v)
    elif t==8: _ws(o,v)
    elif t==9:
        et,items=v; o.append(struct.pack('<bi',et,len(items)))
        if et==3:
            import array; o.append(array.array('i',items).tobytes())
        else:
            for x in items: _wp(o,et,x)
    elif t==10:
        for k,(tt,vv) in v: o.append(bytes([tt])); _ws(o,k); _wp(o,tt,vv)
        o.append(b'\x00')
    elif t==11:
        import array; o.append(struct.pack('<i',len(v))); o.append(array.array('i',v).tobytes())
    elif t==12: o.append(struct.pack('<i',len(v))); o.append(struct.pack('<%dq'%len(v),*v))
def write(path,name,node):
    o=[bytes([node[0]])]; _ws(o,name); _wp(o,node[0],node[1]); open(path,'wb').write(b''.join(o))
def get(comp,key):
    for k,v in comp:
        if k==key: return v
    return None

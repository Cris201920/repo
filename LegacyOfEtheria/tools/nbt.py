import struct
class R:
    def __init__(s,b): s.b=b; s.p=0
    def r(s,f,n):
        v=struct.unpack_from('<'+f,s.b,s.p); s.p+=n; return v[0]
    def str(s):
        n=s.r('H',2); v=s.b[s.p:s.p+n].decode('utf8','replace'); s.p+=n; return v
def payload(rd,t):
    if t==1: return rd.r('b',1)
    if t==2: return rd.r('h',2)
    if t==3: return rd.r('i',4)
    if t==4: return rd.r('q',8)
    if t==5: return rd.r('f',4)
    if t==6: return rd.r('d',8)
    if t==7:
        n=rd.r('i',4); v=rd.b[rd.p:rd.p+n]; rd.p+=n; return ('bytes',v)
    if t==8: return rd.str()
    if t==9:
        et=rd.r('b',1); n=rd.r('i',4)
        if et==3:
            import array
            a=array.array('i'); a.frombytes(rd.b[rd.p:rd.p+4*n]); rd.p+=4*n; return list(a)
        return [payload(rd,et) for _ in range(n)]
    if t==10:
        d={}
        while True:
            tt=rd.r('b',1)
            if tt==0: return d
            k=rd.str(); d[k]=payload(rd,tt)
    if t==11:
        n=rd.r('i',4); import array; a=array.array('i'); a.frombytes(rd.b[rd.p:rd.p+4*n]); rd.p+=4*n; return list(a)
    if t==12:
        n=rd.r('i',4); rd.p+=8*n; return ('longs',n)
    raise ValueError('tag %d at %d'%(t,rd.p))
def load(path):
    b=open(path,'rb').read()
    rd=R(b); t=rd.r('b',1); name=rd.str(); v=payload(rd,t)
    return v, rd.p, len(b), b[:4]

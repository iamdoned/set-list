#!/usr/bin/env python3
"""iPhone HEIC -> JPEG without extra libraries (needs ffmpeg + Pillow).
usage: python3 tools/heic2jpg.py IMG_1234.HEIC out.jpg"""
import struct,sys,subprocess,os
from PIL import Image
d=open(sys.argv[1],'rb').read()
def boxes(b,s,e):
    while s<e:
        sz,t=struct.unpack('>I4s',b[s:s+8]);h=8
        if sz==1: sz=struct.unpack('>Q',b[s+8:s+16])[0];h=16
        if sz==0: sz=e-s
        yield t.decode('latin1'),s+h,s+sz; s+=sz
top={t:(a,z) for t,a,z in boxes(d,0,len(d))}
ma,mz=top['meta']; ma+=4
meta={t:(a,z) for t,a,z in boxes(d,ma,mz)}
pitm=struct.unpack('>H',d[meta['pitm'][0]+4:meta['pitm'][0]+6])[0]
# iinf
a,z=meta['iinf'];v=d[a];cnt=struct.unpack('>H',d[a+4:a+6])[0];p=a+6
types={}
for t,s,e in boxes(d,p,z):
    ver=d[s]; iid=struct.unpack('>H',d[s+4:s+6])[0]; it=d[s+8:s+12].decode('latin1'); types[iid]=it
# iloc
a,z=meta['iloc'];ver=d[a];p=a+4
os_,ls=d[p]>>4,d[p]&15;bs,isz=d[p+1]>>4,d[p+1]&15;p+=2
rd=lambda n:(int.from_bytes(d[p:p+n],'big') if n else 0)
n=struct.unpack('>H',d[p:p+2])[0] if ver<2 else struct.unpack('>I',d[p:p+4])[0];p+=2 if ver<2 else 4
loc={}
for _ in range(n):
    iid=struct.unpack('>H',d[p:p+2])[0];p+=2
    cm=0
    if ver in(1,2): cm=struct.unpack('>H',d[p:p+2])[0]&15;p+=2
    p+=2
    base=rd(bs);p+=bs
    ec=struct.unpack('>H',d[p:p+2])[0];p+=2;ex=[]
    for _ in range(ec):
        if ver in(1,2) and isz: p+=isz
        off=rd(os_);p+=os_;ln=rd(ls);p+=ls;ex.append((base+off,ln))
    loc[iid]=(cm,ex)
def data(iid):
    cm,ex=loc[iid]
    src=d if cm==0 else None
    if cm==1: ia,iz=meta['idat'];src=d[ia:iz]
    return b''.join(src[o:o+l] for o,l in ex)
# iref
refs={}
a,z=meta['iref'];rv=d[a]
for t,s,e in boxes(d,a+4,z):
    fid=struct.unpack('>H',d[s:s+2])[0];c=struct.unpack('>H',d[s+2:s+4])[0]
    refs.setdefault((t,fid),[struct.unpack('>H',d[s+4+2*i:s+6+2*i])[0] for i in range(c)])
# iprp
a,z=meta['iprp'];ip={t:(s,e) for t,s,e in boxes(d,a,z)}
props=[(t,s,e) for t,s,e in boxes(d,*ip['ipco'])]
s,e=ip['ipma'];ver=d[s];fl=int.from_bytes(d[s+1:s+4],'big');p=s+4
ec=struct.unpack('>I',d[p:p+4])[0];p+=4;assoc={}
for _ in range(ec):
    iid=struct.unpack('>H',d[p:p+2])[0];p+=2;k=d[p];p+=1;L=[]
    for _ in range(k):
        if fl&1: x=struct.unpack('>H',d[p:p+2])[0]&0x7fff;p+=2
        else: x=d[p]&0x7f;p+=1
        L.append(x)
    assoc[iid]=L
def prop(iid,typ):
    for x in assoc.get(iid,[]):
        if x and props[x-1][0]==typ: return props[x-1]
def annexb(iid):
    t,s,e=prop(iid,'hvcC');p=s+22;na=d[p];p+=1;out=b''
    for _ in range(na):
        p+=1;nn=struct.unpack('>H',d[p:p+2])[0];p+=2
        for _ in range(nn):
            l=struct.unpack('>H',d[p:p+2])[0];p+=2;out+=b'\0\0\0\1'+d[p:p+l];p+=l
    b=data(iid);q=0
    while q<len(b):
        l=struct.unpack('>I',b[q:q+4])[0];out+=b'\0\0\0\1'+b[q+4:q+4+l];q+=4+l
    return out
def dec(iid,i):
    fn=f'/tmp/t{i}.hevc';open(fn,'wb').write(annexb(iid))
    subprocess.run(['ffmpeg','-loglevel','error','-y','-f','hevc','-i',fn,'-frames:v','1',f'/tmp/t{i}.png'],check=True)
    return Image.open(f'/tmp/t{i}.png').convert('RGB')
print('primary',pitm,types[pitm])
if types[pitm]=='grid':
    g=data(pitm);rows,cols=g[2]+1,g[3]+1;fl=g[1]
    W,H=(struct.unpack('>II',g[4:12]) if fl&1 else struct.unpack('>HH',g[4:8]))
    tiles=refs[('dimg',pitm)];im=None
    for i,tid in enumerate(tiles):
        t=dec(tid,i)
        if im is None: tw,th=t.size;im=Image.new('RGB',(tw*cols,th*rows))
        im.paste(t,((i%cols)*tw,(i//cols)*th))
    im=im.crop((0,0,W,H))
else: im=dec(pitm,0)
r=prop(pitm,'irot')
if r: im=im.rotate(90*(d[r[1]]&3),expand=True)
m=prop(pitm,'imir')
if m: im=im.transpose(Image.FLIP_TOP_BOTTOM if d[m[1]]&1==0 else Image.FLIP_LEFT_RIGHT)
print(im.size);im.save(sys.argv[2],quality=92)

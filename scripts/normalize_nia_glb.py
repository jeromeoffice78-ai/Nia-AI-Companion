"""Fix legacy Nia GLB numeric scalar accessor bounds for strict Blender glTF importer.
Preserves all binary geometry, skin weights, morph targets and animation buffers.
"""
from pathlib import Path
import json
import struct
import sys
def normalize(src,dst):
    raw=Path(src).read_bytes()
    if raw[:4]!=b'glTF' or len(raw)<20:raise ValueError('Not a GLB')
    _,v,n=struct.unpack_from('<III',raw)
    if v!=2 or n!=len(raw):raise ValueError('Invalid GLB length')
    cursor=12;chunks=[]
    while cursor<len(raw):
        length,kind=struct.unpack_from('<II',raw,cursor)
        cursor+=8
        payload=raw[cursor:cursor+length];cursor+=length
        chunks.append((kind,payload))
    if chunks[0][0]!=0x4e4f534a:raise ValueError('GLB JSON missing')
    document=json.loads(chunks[0][1].decode('utf8'))
    count=0
    for accessor in document.get('accessors',[]):
        for field in ['min','max']:
            if field in accessor and accessor[field] is None:
                del accessor[field];count+=1
            elif field in accessor and isinstance(accessor[field],(int,float)):
                accessor[field]=[float(accessor[field])];count+=1
    js=json.dumps(document,ensure_ascii=False,separators=(',',':')).encode()
    js+=b' ' * (-len(js)%4)
    chunks[0]=(0x4e4f534a,js)
    out=bytearray(b'glTF'+struct.pack('<II',2,0))
    for kind,payload in chunks:
        if len(payload)%4:payload+=b'\x00'*(-len(payload)%4)
        out+=struct.pack('<II',len(payload),kind)+payload
    struct.pack_into('<I',out,8,len(out))
    Path(dst).parent.mkdir(parents=True,exist_ok=True)
    Path(dst).write_bytes(out)
    print('Fixed',count,'invalid accessor bounds without changing mesh data')
if __name__=='__main__':
    normalize(sys.argv[1],sys.argv[2])

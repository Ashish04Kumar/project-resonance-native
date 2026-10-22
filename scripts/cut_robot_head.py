"""Keep only the robot head (screen, bezel, ears, antennae) from a single-mesh GLB.

Usage: python cut_robot_head.py gg2-mobile.glb gg2-head.glb -0.065   (needs numpy)
"""
import json, struct, sys
import numpy as np

src, dst, cut_y = sys.argv[1], sys.argv[2], float(sys.argv[3])
data = open(src, 'rb').read()
jlen = struct.unpack('<I', data[12:16])[0]
gltf = json.loads(data[20:20 + jlen])
bin_ = data[20 + jlen + 8:]
prim = gltf['meshes'][0]['primitives'][0]
def acc(i):
    a = gltf['accessors'][i]; v = gltf['bufferViews'][a['bufferView']]
    dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]
    n = 3 if a['type'] == 'VEC3' else 1
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    arr = np.frombuffer(bin_, dt, a['count'] * n, off)
    return arr.reshape(-1, 3) if n == 3 else arr
P = acc(prim['attributes']['POSITION']).astype(np.float32)
I = acc(prim['indices']).reshape(-1, 3).astype(np.int64)
x, y = P[:, 0], P[:, 1]
# Head box (x around the screen) or ear/antenna height; the raised right claw stays out.
keep_v = (y > cut_y) & ((np.abs(x - 0.153) < 0.585) | (y > 0.16))
keep_t = keep_v[I].all(axis=1)
T = I[keep_t]
# Drop small loose pieces (bits of the claw or shoulder that reach above the cut):
# group triangles that share vertices and keep only large groups.
parent = list(range(len(P)))
def find(a):
    while parent[a] != a:
        parent[a] = parent[parent[a]]; a = parent[a]
    return a
for a, b, c in T.tolist():
    ra, rb, rc = find(a), find(b), find(c)
    parent[rb] = ra; parent[find(c)] = ra
roots = np.array([find(t[0]) for t in T.tolist()])
ids, counts = np.unique(roots, return_counts=True)
big = set(ids[counts >= 0.02 * len(T)].tolist())
for r, n in sorted(zip(ids.tolist(), counts.tolist()), key=lambda z: -z[1])[:8]:
    print('piece', n, 'kept' if r in big else 'dropped')
T = T[np.array([r in big for r in roots])]
used = np.unique(T)
remap = np.full(len(P), -1, np.int64); remap[used] = np.arange(len(used))
NP = P[used]; NI = remap[T].astype(np.uint32 if len(used) > 65535 else np.uint16)
print('kept verts', len(NP), 'tris', len(NI), 'min', NP.min(0).round(3), 'max', NP.max(0).round(3))
pos_bytes = NP.tobytes(); idx_bytes = NI.tobytes()
pad = lambda b: b + b'\x00' * (-len(b) % 4)
binary = pad(idx_bytes) + pos_bytes
out = {
  'asset': {'version': '2.0', 'generator': 'resonance cut_head.py'},
  'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'head'}],
  'meshes': [{'name': 'head', 'primitives': [{'attributes': {'POSITION': 1}, 'indices': 0, 'mode': 4}]}],
  'buffers': [{'byteLength': len(binary)}],
  'bufferViews': [
    {'buffer': 0, 'byteOffset': 0, 'byteLength': len(idx_bytes), 'target': 34963},
    {'buffer': 0, 'byteOffset': len(pad(idx_bytes)), 'byteLength': len(pos_bytes), 'target': 34962}],
  'accessors': [
    {'bufferView': 0, 'componentType': 5125 if NI.dtype == np.uint32 else 5123, 'count': int(NI.size), 'type': 'SCALAR'},
    {'bufferView': 1, 'componentType': 5126, 'count': len(NP), 'type': 'VEC3', 'min': NP.min(0).tolist(), 'max': NP.max(0).tolist()}],
}
js = json.dumps(out, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
total = 12 + 8 + len(js) + 8 + len(binary)
with open(dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, total))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(binary), 0x004E4942)); f.write(binary)

#!/usr/bin/env python3
"""Build publicly served, styled GLB with two exact hopper powder inserts from the supplied revised GLB.
The main CAD body is the already-published optimized repository mesh, not a byte-identical copy of the newly attached model.
"""
from pathlib import Path
import trimesh, numpy as np, gzip, zlib, base64, struct, json
from trimesh.visual.material import PBRMaterial
SRC=Path("steel-assembly/industrial_steel_optimized.glb")
OUT=Path("steel-assembly/assembly_styled.glb.gz")
REPORT=Path("steel-assembly/assembly_styled_report.json")
powder64="eNrtlolPlWcWh88FoSgCIi4UF5BdlGJdiuDCvS4sso7tVCu4UoGLRUBw1LqAWwVEQVCkiFgVtUynQSuxOpmKJh3HjGRCSU0dl9FZzMTUsWC0VAS+ec7N/BUT8uU8ge897+8s33lvXjv5rQSbuo2Ka/VtYy1dRu61bsPNYs47HdVl/GQ2jMZed/ccIwU+787ou2Bq7HnVd8X+ce/k/hzHgt5HfXcdb3Q5GSlGo/F34/fPa/pfG+///LjXMKpeNfb0GdG9z7t/MpL6O19cNg4ZOUa+8ezZKOMvRvVzj/5OY8jPBb2vjIBXcT0vjW9eX+x+aFzoa39x3Ph3/42uUMMwIlyVLk6q4GWvmmHOulpur7uemlShSjS3J2Lu+8jlZcuOmXsT7xVtOdcsly/eioyOu1f09HOR2OZns0rOv2wZN+dKU3tLw9w5X6xtqY368neXL4r5ly87vvouamjz1QuuUfea95+/NiftfGGyUkRrT5XKvoUuVtPQ/qbBXvZadaqDdsDFSbvh5pzWu14iXK/0iMQkqFpdvCoPiddMwuLbIkwJnUWzvC5FuxUrY5vN71yK3n/ee+Y/ot2ctSepDtolq0n7liraQ5FKunT1QllEekzHV/mRU2PXtlRHHlrU3qJqX6doLZYkzTY0UTMPi9eKDEN3DYnXGuvi1T8mQTsQmqgKliRVK0zWuF+naA7hIU8uh4zvfKH51/RrdY2GVvo06PgftoxvDVjemu7tX6zd8y/Wft7oyuxpllt+o67f82l/4dTrabrYPbIvyS6u54u+eYM8+lv7Xg4eZehXCPFtvd7u2+nz3vXggB+9r/2p7btQn5w/7//+lt/utsJ7rQFht/5zPzzk2B8D/9bx8E7rt0FuD9Vz+n1VNt/VuB53NIebtzXDMcVHM0LG/6tIGeGqkxbqo7sSnHRaLjno5DwRnagfvRd/syek08e3LfiHEN/bbUV/fRr04OYPDzzuKM13Ne70+5pDlegc3n5g8zFp5uX2OsmXHLSWBCetK8xZa4xw1ardHqpmx0OtYsQjrejmbc3/9gOtdMQjjXujS2fgYKXI8HWT4FXrzYMijmX65vG+3XBFyWrYUaKrEaX/rBCpKD0A20tD4avSjjzl97m62pCrnvm5qrYN1ma/LhLpyhpUrFTlrizd1Z+lCkFWVcu0qn5AtsaqzQ7P1+gb8lR/bJ7GUp0VNs3H+1Q/IFtjXbXqaqZVPYOsmkN/lu7tyhom7jJEhmGDZbh4yFA4VJwlRlzEFbrKG+Il+TIHzpHZMkOmyxF4RGrY4473EMxZUsVBBsFBYi87pEimwCkSJnayjLd2mL1Mk6lSDavlsHzAeztoJyniJG5k4IQNliyxSgSMkCjJEU+JhJEyUsbKVpkMJ8sk2Sbb5S34loRKJr5RMErMZLlF5sK5ZLqd+GEwDK80WS6L4WL5lbxJHbPhbBktH8oemQAnyHx5X5bIPrhPfk32xfI2fJsKTPQhBsaIsH85fy3GRNZKhligReYRdYyEwBAir5F0WQAXyEK0llDhPiwFj7FkPgYLkVWyWqJhtMTKClkpcTBOFkmu5MksOEtGyS7ZLb7QV/zwLqBrq7FoWYrvIrhI4sn+NxIMg6mgkJgL4UJ6/B7r8TBeEmQnGn7QT/zJbKNMhBPJ7l3WE2CCJKKySYJgEEob6cd8OB+vZNYTYaIk4bFZAmEgXhvIPRbGMguD+O5pMI3e7uU7mKFZvOVjYvpDfwmgwvVMzEosjq7tZTUDs6D4MaubsUA8NqC2Hpshn9DXeXCejKPyQioqwKbJR+SSBJPkHbrzCau7MV8mJltmwplMTR7fdjQcTRezZZ2Ew3BWvHhfCAvR2srshMJQpmkM320VXEX8JXz/dXAde3LEkc7mYB/ylwfdccT2cB7cmFRX7A3oQgau2C4mNQdPT2wj01NE54qxZE7IMKp0xzZzBpYxralYJh47+AJF2Lt8cU925WLpKJqozAXbLePRSIbJ1DyMuDvhTpSWMVFWaEVpBzO+FC5FycR8roVr2T2cmJvhZr7ZB9SUDbPZ8Sa9WQPX0Imx1L0BbqDvaXzHvXAv38aDfZvgJireTq9WwBVE2Irverieb5lHvukwHaV8+loAC5jR5WhkwAyycKDWTJiJ6hbWV8PVdNqNnu2Cu6hmG3or4UoiDCWmI3SUEXQkl1PgiUWKDyexGBbTC0f6PBKOxMebSauH9VLKl58pn8JPpY7pSJIm2CRH+V2I4E0UdoyJ88bTgh1nZxRvzFg9O8OlFtayexxT1wAbpITJGmdjieznrYVd87AGzpIvb/ywcs7JBCmDZXKCv4LlEDzEf7Gc1VPwlJzmTC6Qz+BncpLz4Mcuf+wAHtP4JYzGTnGe46QRNsoZVIKkElaiNJV9J+FJfjUXcCarYBVK8fiegWfkLN6BUgEr2DGRXE7AE3glsH4WnpVznDF/IgZgBzljsWQ1HTvC2U5gNRH7HJUAVgOxCrKZwS98HNZINxNZTcKaqOwQUSrxOMhzgDrK6UMJTwO9OU5v63mO0e86ulnLc5RdTew9x3OWfM+gWMNzhPinqfwwTzX1naSqKp4TxCgjguqX25SP2zTrbGpNNp0zNoXTtr0nbbvKbP4lNs9am0+NbbXK9r6e/w9ih2334NQpt64XTBpnaf821vLL/+7BnQP34IF78MA9eOAePHAPHrgHD9yDB+7BA/fggXvw//E9+L80z4UO"
scene=trimesh.load(SRC,force="scene")
steel=PBRMaterial(name="Bright polished stainless steel",baseColorFactor=[219,233,241,255],metallicFactor=1,roughnessFactor=.18)
rail=PBRMaterial(name="Mirror finished rail stainless",baseColorFactor=[235,244,249,255],metallicFactor=1,roughnessFactor=.1)
plastic=PBRMaterial(name="Original transparent process plastic",baseColorFactor=[213,238,250,60],metallicFactor=0,roughnessFactor=.07,alphaMode="BLEND",doubleSided=True)
orange=PBRMaterial(name="Proval orange painted ends",baseColorFactor=[250,117,28,255],metallicFactor=.35,roughnessFactor=.25)
black=PBRMaterial(name="Proval black powder coat",baseColorFactor=[27,32,39,255],metallicFactor=.32,roughnessFactor=.35)
brushed=PBRMaterial(name="Proval brushed stainless",baseColorFactor=[213,223,231,255],metallicFactor=1,roughnessFactor=.21)
floor=PBRMaterial(name="Original floor for web diamond normal",baseColorFactor=[194,207,214,255],metallicFactor=.84,roughnessFactor=.4)
powder=PBRMaterial(name="Milk powder matte white",baseColorFactor=[250,248,240,255],metallicFactor=0,roughnessFactor=.96,doubleSided=True)
counts={}
for name,geo in scene.geometry.items():
 n=name.lower().replace('_','')
 if n.startswith("st - pshm - hf - 04") or n.startswith("st - pshm - hf - 02"):mat=plastic;cat="plastic"
 elif name=="New object.010":mat=floor;cat="floor"
 elif "mirrorproval" in n or "proval" in n and "-m2" in n:mat=orange;cat="orange"
 elif "proval" in n and ("-m11" in n or "-p" in n or "-l" in n):mat=brushed;cat="brushed_valve"
 elif "proval" in n:mat=black;cat="black_valve"
 elif name.startswith("New object") or name=="Untitled":mat=rail;cat="rail"
 else:mat=steel;cat="steel"
 geo.visual=trimesh.visual.TextureVisuals(material=mat)
 counts[cat]=counts.get(cat,0)+1
raw=zlib.decompress(base64.b64decode(powder64));p=0
def u16():
 global p
 v=struct.unpack_from('<H',raw,p)[0];p+=2;return v
def fl():
 global p
 v=struct.unpack_from('<f',raw,p)[0];p+=4;return v
added=u16()
for z in range(added):
 nv=u16();nf=u16();low=np.array([fl(),fl(),fl()]);span=np.array([fl(),fl(),fl()])
 verts=np.array([[low[a]+span[a]*u16()/65535 for a in range(3)] for k in range(nv)],dtype=np.float32)
 faces=np.array([[u16(),u16(),u16()] for k in range(nf)],dtype=np.int32)
 mesh=trimesh.Trimesh(vertices=verts,faces=faces,process=False,validate=False)
 mesh.visual=trimesh.visual.TextureVisuals(material=powder)
 scene.add_geometry(mesh,node_name="UserMilkPowder"+str(z),geom_name="UserMilkPowder"+str(z))
blob=trimesh.exchange.gltf.export_glb(scene,include_normals=True)
OUT.write_bytes(gzip.compress(blob,compresslevel=9,mtime=0))
check=trimesh.load(trimesh.util.wrap_as_stream(gzip.decompress(OUT.read_bytes())),file_type='glb',force='scene')
assert len(check.graph.nodes_geometry)==186 and len(check.geometry)==186
assert np.isfinite(check.bounds).all()
report={"total_meshes":len(check.graph.nodes_geometry),"triangles":sum(len(g.faces) for g in check.geometry.values()),"gzipped_bytes":OUT.stat().st_size,"counts":counts,"powder_inserts_from_user_model":added,"geometry_source":"optimized CAD already hosted in repository plus original uploaded upper hopper powder geometries"}
REPORT.write_text(json.dumps(report,indent=2))
print("Styled public model ready",report)

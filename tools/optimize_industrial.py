#!/usr/bin/env python3
"""Build a lightweight display-only GLB from the repository's original CAD mesh."""
from pathlib import Path
import numpy as np, trimesh, vtk, gzip, re, json, warnings
from vtk.util.numpy_support import numpy_to_vtk,numpy_to_vtkIdTypeArray,vtk_to_numpy
warnings.filterwarnings('ignore',category=DeprecationWarning)
SRC=Path("steel-assembly/assembly.glb.gz")
OUT=Path("steel-assembly/industrial_steel_optimized.glb")
REPORT=Path("steel-assembly/industrial_steel_optimized_report.json")
def poly(m):
    pts=vtk.vtkPoints();pts.SetData(numpy_to_vtk(np.asarray(m.vertices,dtype=np.float64),deep=True))
    p=vtk.vtkPolyData();p.SetPoints(pts)
    fs=np.hstack([np.full((len(m.faces),1),3,dtype=np.int64),np.asarray(m.faces,dtype=np.int64)]).ravel()
    cells=vtk.vtkCellArray();cells.SetCells(len(m.faces),numpy_to_vtkIdTypeArray(fs,deep=True));p.SetPolys(cells)
    return p
def trimesh_from(p,normals=True):
    a=vtk_to_numpy(p.GetPoints().GetData()).astype('float64').copy()
    b=vtk_to_numpy(p.GetPolys().GetData()).reshape(-1,4)[:,1:].astype('int64').copy()
    n=p.GetPointData().GetNormals()
    return trimesh.Trimesh(vertices=a,faces=b,vertex_normals=vtk_to_numpy(n).copy() if n is not None and normals else None,process=False,validate=False)
def renormal(m,angle=41):
    clean=vtk.vtkCleanPolyData();clean.SetInputData(poly(m));clean.SetTolerance(0);clean.PointMergingOn();clean.Update()
    n=vtk.vtkPolyDataNormals();n.SetInputConnection(clean.GetOutputPort());n.SetFeatureAngle(angle)
    n.SplittingOn();n.ConsistencyOff();n.AutoOrientNormalsOff();n.ComputePointNormalsOn()
    n.ComputeCellNormalsOff();n.NonManifoldTraversalOff();n.Update()
    return trimesh_from(n.GetOutput())
def decimate(m,frac):
    clean=vtk.vtkCleanPolyData();clean.SetInputData(poly(m));clean.SetTolerance(0);clean.PointMergingOn();clean.Update()
    d=vtk.vtkQuadricDecimation();d.SetInputConnection(clean.GetOutputPort());d.SetTargetReduction(frac)
    d.SetVolumePreservation(True);d.SetBoundaryWeightFactor(2.5);d.SetWeighBoundaryConstraintsByLength(True);d.Update()
    if d.GetOutput().GetNumberOfPolys()<4:raise ValueError('empty decimation')
    out=trimesh_from(d.GetOutput(),False)
    extent=max(float(np.ptp(m.bounds,axis=0).max()),1e-6)
    if np.abs(out.bounds-m.bounds).max()/extent>.008:raise ValueError('bounds changed')
    return renormal(out)
def cyl(center,axis,height,radius,sides):
    mesh=trimesh.creation.cylinder(radius=radius,height=height,sections=sides)
    if axis==0:mesh.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2,[0,1,0]))
    elif axis==1:mesh.apply_transform(trimesh.transformations.rotation_matrix(-np.pi/2,[1,0,0]))
    mesh.apply_translation(center);return mesh
def bolt(m,name):
    b=m.bounds;ex=b[1]-b[0];major=int(np.argmax(ex));minor=[i for i in range(3) if i!=major]
    length=ex[major];ctr=b.mean(axis=0);v=m.vertices
    r=np.linalg.norm(v[:,minor]-ctr[minor],axis=1);t=(v[:,major]-b[0,major])/length
    core=r[(t>.32)&(t<.75)]
    if len(core)<4:core=r
    sr=float(np.percentile(core,65))
    if 'gradeb_din' in name.lower() and sr<min(ex[minor])*.2:sr=.27*min(ex[minor])
    sr=max(.12*min(ex[minor]),min(sr,.35*min(ex[minor])))
    hr=float(np.max(ex[minor])*.49)
    r0=float(np.percentile(r[t<.19],80)) if np.any(t<.19) else 0
    r1=float(np.percentile(r[t>.81],80)) if np.any(t>.81) else 0
    head_min=True if ('pilot cap screw' in name.lower() or 'gradeab_din' in name.lower()) else (r0>=r1)
    hl=min(length*.27,max(length*.12,2.4*sr));hl=min(hl,length*.32);sl=length-hl
    sc=ctr.copy();hc=ctr.copy()
    if head_min:sc[major]=b[0,major]+hl+sl/2;hc[major]=b[0,major]+hl/2
    else:sc[major]=b[0,major]+sl/2;hc[major]=b[1,major]-hl/2
    shaft=cyl(sc,major,sl,sr,14);head=cyl(hc,major,hl,hr,6 if 'hex bolt' in name.lower() else 16)
    for k in minor:
        val=head.vertices[:,k]-hc[k];span=max(np.abs(val).max(),1e-9)
        head.vertices[:,k]=hc[k]+val*(ex[k]*.5/span)
    return renormal(trimesh.util.concatenate([shaft,head]),38)
def remove_skin(m):
    b=m.bounds;axis=int(np.argmax(b[1]-b[0]));minor=[i for i in range(3) if i!=axis]
    center=b.mean(axis=0);faces=m.triangles_center;fn=m.face_normals
    rv=faces[:,minor]-center[minor];rl=np.linalg.norm(rv,axis=1)
    cos=np.einsum('ij,ij->i',rv,fn[:,minor])/np.maximum(rl,1e-6)
    remove=cos<-.91
    if np.count_nonzero(remove)<10 or np.mean(remove)>.45:raise ValueError('unsafe pipe surface')
    return trimesh.Trimesh(vertices=m.vertices,faces=m.faces[~remove],process=False,validate=False)
def remove_profile_cavity(m):
    """Drop internal longitudinal wall faces; preserve outward profile walls/end rims."""
    b=m.bounds;ext=b[1]-b[0];axis=int(np.argmax(ext));side=[i for i in range(3) if i!=axis]
    if ext[axis]/max(ext[side])<3.0:raise ValueError('not slender')
    center=b.mean(axis=0);facepos=m.triangles_center;normal=m.face_normals
    radial=facepos[:,side]-center[side];length=np.linalg.norm(radial,axis=1)
    inward=np.einsum('ij,ij->i',radial,normal[:,side])/np.maximum(length,1e-8)
    remove=(inward<-.72)&(np.abs(normal[:,axis])<.6)
    outer=(inward>.72)&(np.abs(normal[:,axis])<.6)
    if remove.sum()<8 or outer.sum()<8 or remove.sum()>len(remove)*.46:raise ValueError('unsafe cavity')
    if m.area_faces[remove].sum()>=m.area_faces[outer].sum():raise ValueError('uncertain winding')
    return trimesh.Trimesh(vertices=m.vertices,faces=m.faces[~remove],process=False,validate=False)
def remove_thin_sheet_surfaces(m,remove_rim=False):
    """Strip hidden underside and, on floor only, thin edge thickness walls."""
    b=m.bounds;ext=b[1]-b[0];short=int(np.argmin(ext));lengths=np.sort(ext)
    if lengths[0]/max(lengths[1],1e-8)>.065:raise ValueError('not thin sheet')
    centers=m.triangles_center;normals=m.face_normals
    bottom=(normals[:,short]<-.96)&(centers[:,short]<(b[0,short]+b[1,short])*.5)
    rim=(np.abs(normals[:,short])<.75) if remove_rim else np.zeros(len(bottom),dtype=bool)
    remove=bottom|rim
    if bottom.sum()<3 or remove.sum()>len(remove)*.85:raise ValueError('unsafe sheet selection')
    return trimesh.Trimesh(vertices=m.vertices,faces=m.faces[~remove],process=False,validate=False)
data=gzip.decompress(SRC.read_bytes())
scene=trimesh.load(trimesh.util.wrap_as_stream(data),file_type='glb',force='scene')
original_faces=sum(len(g.faces) for g in scene.geometry.values())
original_bounds=scene.bounds.copy()
records=[]
for i,(name,g) in enumerate(list(scene.geometry.items())):
    n0=len(g.faces);f=g;actions=[]
    try:
        if 'bolt' in name.lower() or 'pilot cap screw' in name.lower():
            f=bolt(g,name);actions.append('threadless low-poly bolt')
        else:
            if re.match(r'ST - PSHM - HF - (04|12)(\.\d+)?$',name):
                f=remove_skin(f);actions.append('remove inner cylindrical faces')
            if re.fullmatch(r'New object(?:\.\d+)?',name) and name!='New object.010':
                ext=np.ptp(f.bounds,axis=0);axis=int(np.argmax(ext));side=[j for j in range(3) if j!=axis]
                if ext[axis]/max(ext[side])>=3.0:
                    try:
                        f=remove_profile_cavity(f)
                        actions.append('remove interior hollow profile walls')
                    except ValueError as err:
                        actions.append('profile retained: '+str(err))
            if name=='New object.010' or re.match(r'^ST - PSHM - HF - (09|11)(\.\d+)?$',name):
                f=remove_thin_sheet_surfaces(f,remove_rim=(name=='New object.010'))
                actions.append('strip hidden sheet underside'+(' and floor thickness walls' if name=='New object.010' else ''))
            red=.53 if n0>=6000 else .43 if n0>=2500 else .30 if n0>=1000 else .21 if n0>=600 else .13 if n0>=360 else 0
            if name=='New object.010' or (name.startswith('New object') or name=='Untitled') and n0<1200:red=0
            if n0>=200 and red:
                before=len(f.faces)
                try:
                    d=decimate(f,red)
                    if len(d.faces)<before:f=d;actions.append('quadric simplification')
                except Exception:pass
            if len(f.faces)!=n0 and 'quadric simplification' not in actions:f=renormal(f)
        if not np.isfinite(f.vertices).all() or len(f.faces)<4 or not np.isfinite(f.vertex_normals).all():
            raise ValueError('invalid result')
        scene.geometry[name]=f
    except Exception as e:
        scene.geometry[name]=g;actions.append('kept original: '+str(e)[:80])
    records.append([name,n0,len(scene.geometry[name].faces),actions])
    if i%40==0:print("Processed",i,"/",len(scene.geometry),flush=True)
OUT.write_bytes(trimesh.exchange.gltf.export_glb(scene,include_normals=True))
validation=trimesh.load(OUT,force='scene')
faces=sum(len(g.faces) for g in validation.geometry.values())
assert faces<original_faces,(faces,original_faces)
assert len(validation.graph.nodes_geometry)==len(scene.graph.nodes_geometry)
assert np.isfinite(validation.bounds).all()
assert np.abs(validation.bounds-original_bounds).max()<.025
REPORT.write_text(json.dumps({"triangles_before":original_faces,"triangles_after":faces,"reduction_pct":round(100*(1-faces/original_faces),2),"file_size_bytes":OUT.stat().st_size,"meshes":len(records),"hollow_profiles":sum('remove interior hollow profile walls' in a for _,_,_,acts in records for a in acts),"thin_sheets":sum('strip hidden sheet underside' in a for _,_,_,acts in records for a in acts),"parts":records},ensure_ascii=False,indent=2))
print("PUBLIC GLB READY",OUT,faces,flush=True)

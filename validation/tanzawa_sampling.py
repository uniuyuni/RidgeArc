"""Offline sampling benchmark using the original Tanzawa GSI GML archive.
Usage: python validation/tanzawa_sampling.py /path/to/DEM.zip
Requires numpy, scipy, pyproj. No network or uploads. Fixed extent for this archive.
Same 5m grid/Geod for both calculations; not an end-to-end browser or field validation.
"""
import io,zipfile,re,sys
import numpy as np
from scipy.ndimage import map_coordinates
from pyproj import Geod
LAT,LON=35.416459,139.048985
S,N,W,E=35+1/3,35.5,139,139.125
H,WID=3000,2250
A=np.full((H,WID),np.nan,dtype=np.float32)
def tag(b,t):return re.search(rb'<gml:'+t+rb'(?:\s[^>]*)?>(.*?)</gml:'+t+rb'>',b,re.S).group(1)
with zipfile.ZipFile(sys.argv[1]) as z:
 for n in sorted(z.namelist(),key=lambda n: ('DEM5A' in n,'DEM5B' in n)):
  if 'DEM5' not in n or not n.endswith('.zip'):continue
  with zipfile.ZipFile(io.BytesIO(z.read(n))) as inner:
   for f in inner.namelist():
    if not f.lower().endswith('.xml'):continue
    b=inner.read(f)
    south,west=map(float,tag(b,b'lowerCorner').split())
    north,east=map(float,tag(b,b'upperCorner').split())
    nx,ny=np.array(list(map(int,tag(b,b'high').split())))+1
    vals=np.array([float(line.rsplit(b',',1)[-1]) for line in tag(b,b'tupleList').strip().splitlines()],dtype=np.float32)
    ix,iy=map(int,tag(b,b'startPoint').split()); offset=iy*nx+ix
    grid=np.full(nx*ny,np.nan,np.float32)
    grid[offset:offset+len(vals)]=vals
    grid[grid==-9999]=np.nan;grid=grid.reshape(ny,nx)
    x=round((west-139)/.125*WID);y=round((N-north)/(N-S)*H)
    dest=A[y:y+ny,x:x+nx];np.copyto(dest,grid,where=np.isfinite(grid))
def elev(lat,lon):
 return map_coordinates(A,[(N-np.asarray(lat))/(N-S)*H-.5,(np.asarray(lon)-139)/.125*WID-.5],order=1,mode='constant',cval=np.nan,prefilter=False)
g=Geod(ellps='WGS84');eye=float(elev([LAT],[LON])[0])+1.6
az=np.arange(0,360,.25);dense=np.arange(2,8001,2)
sparse=np.concatenate([np.arange(2,81,2),np.arange(85,301,5),np.arange(310,2001,10),np.arange(2025,8001,40)])
def profile(a,d):
 aa,dd=np.broadcast_arrays(a[:,None],d[None,:])
 lon,lat,_=g.fwd(np.full(aa.shape,LON),np.full(aa.shape,LAT),aa,dd)
 h=elev(lat,lon)
 return np.degrees(np.arctan2(h-eye-dd**2/(2*6371000),dd))
print('eye',eye,'grid coverage',np.isfinite(A).mean())
for limit in [2000,8000]:
 ref=[];approx=[];cov=[];distance=[]
 for a in np.array_split(az,24):
  d=dense[dense<=limit];r=profile(a,d);p=profile(a,sparse[sparse<=limit])
  ref.extend(np.nanmax(r,axis=1));approx.extend(np.nanmax(p,axis=1))
  cov.extend(np.isfinite(r).mean(axis=1));distance.extend(d[np.argmax(np.where(np.isfinite(r),r,-np.inf),axis=1)])
 ref,approx,cov,distance=map(np.array,(ref,approx,cov,distance))
 mask=(cov==1)&np.isfinite(ref)&np.isfinite(approx);err=abs(approx-ref)
 print('limit',limit,'complete',mask.sum(),'of',len(az))
 if mask.any():print('MAE',np.mean(err[mask]),'p95',np.quantile(err[mask],.95),'max',np.max(err[mask]))
 if limit==8000:
  for a in [110,120,180,230,235.5,240,250]:
   i=round(a/.25);print(a,ref[i],approx[i],cov[i],distance[i])

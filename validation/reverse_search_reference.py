"""Synthetic algorithm checks; no real terrain, ephemeris or GPU benchmark."""
import numpy as np
from time import perf_counter

rng = np.random.default_rng(20261126)
# G3/G5: constant-declination full rotation in an Earth-fixed frame.
N = 4096
v = rng.normal(size=(N, 3)); v /= np.linalg.norm(v, axis=1)[:, None]
dec = np.deg2rad(12.0); tol = np.deg2rad(0.27)
phases = np.linspace(0, 2*np.pi, 14400, endpoint=False)
s = np.column_stack((np.cos(dec)*np.cos(phases), np.cos(dec)*np.sin(phases), np.full(len(phases), np.sin(dec))))
t = perf_counter(); err = np.abs(np.arcsin(v[:, 2]) - dec); cand = err <= tol; t_fast = perf_counter()-t
t = perf_counter(); best = np.concatenate([np.max(v[i:i+128] @ s.T, axis=1) for i in range(0, N, 128)]); t_ref = perf_counter()-t
err_ref = np.arccos(np.clip(best,-1,1)); ref = err_ref <= tol
print('G3/G5 directions',N,'time samples',len(s),'continuous candidates',cand.sum(),'discrete candidates',ref.sum(),'discrete positive missed',np.count_nonzero(ref & ~cand),'continuous only',np.count_nonzero(cand & ~ref),'max min-angle difference deg',np.rad2deg(np.max(err_ref-err)),'seconds',t_fast,t_ref)
assert not np.any(ref & ~cand)
# G4: exact fixed-direction clearance for grid sample centers along +x, flat frame.
Y,X=128,512
xx=np.arange(X)*5.; yy=np.arange(Y)*5.
z=25*np.sin(xx[None,:]/84)+20*np.cos(yy[:,None]/53)+9*rng.normal(size=(Y,X))
z[:,300]+=70
slope=np.tan(np.deg2rad(1.0)); eye=1.6
q=z-slope*xx
t=perf_counter(); suffix=np.maximum.accumulate(q[:,::-1],axis=1)[:,::-1]; ahead=np.column_stack((suffix[:,1:],np.full(Y,-np.inf))); fast=ahead<q+eye; tf=perf_counter()-t
t=perf_counter(); brute=np.ones((Y,X),dtype=bool)
for i in range(X-1): brute[:,i]=np.all(q[:,i+1:]<q[:,i,None]+eye,axis=1)
tb=perf_counter()-t
print('G4 modeled cells',Y*X,'clear cells',fast.sum(),'mismatches',np.count_nonzero(fast!=brute),'seconds',tf,tb)
assert np.array_equal(fast,brute)
missing=np.zeros_like(z,dtype=bool); missing[5:25,400]=True
qm=np.where(missing,-np.inf,q); mx=np.maximum.accumulate(qm[:,::-1],axis=1)[:,::-1]; mx=np.column_stack((mx[:,1:],np.full(Y,-np.inf)))
unknown=np.logical_or.accumulate(missing[:,::-1],axis=1)[:,::-1]; unknown=np.column_stack((unknown[:,1:],np.zeros(Y,dtype=bool)))
state=np.where(mx>=q+eye,0,np.where(unknown,-1,1)); state[missing]=-1
print('G4 missing test: blocked, unknown, clear within range',[(state==i).sum() for i in (0,-1,1)])

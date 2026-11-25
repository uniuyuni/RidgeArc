"""Council 04: synthetic checks only; numpy, no real DEM or GPU."""
import numpy as np
from time import perf_counter

# A: circular disk clipped by a straight horizon in a tangent plane.
# u is center clearance divided by angular radius.
u = np.linspace(-1.2, 1.2, 241)
c = np.clip(u, -1, 1)
frac = (np.arccos(-c) + c*np.sqrt(1-c*c))/np.pi
# Independent midpoint quadrature of disk cross sections.
y = -1 + (np.arange(20000)+0.5)*2/20000
w = 2*np.sqrt(1-y*y)
ref = ((y[None,:]+u[:,None])>0) @ w / w.sum()
print('disk fraction: max abs error', np.max(np.abs(frac-ref)))
assert np.max(np.abs(frac-ref)) < 1e-4
# B: horizontal plane with solar center at its horizon. In the same
# small-angle disk model, positive elevation contributes flux even when
# center-cosine times visible fraction is zero. Uniform radiance, normalized.
r = np.deg2rad(0.266)
weighted = np.sum(w*np.maximum(0,np.sin(r*y)))/w.sum()
print('grazing flux / normal irradiance:', weighted, 'center approximation:', 0.)
assert weighted > 0
# C: multi-angle directional sweep on piecewise-linear row profiles.
# Flat world, +x, strict tangency treated as blocked, complete finite domain.
# At ground vertices, all farther vertices below ray iff each linear segment
# is below ray (excluding the starting intersection). Missing test is separate.
rng = np.random.default_rng(20261126)
Y,X=128,512
x=np.arange(X)*5.
z=25*np.sin(x[None,:]/84)+20*np.cos(np.arange(Y)[:,None]/13)+9*rng.normal(size=(Y,X))
z[:,300]+=70
angles=np.deg2rad([0.05,0.1,0.25,0.5,1,2,5,10,20,45])
def sweep(z,a):
    q=z-np.tan(a)*x
    ahead=np.maximum.accumulate(q[:,::-1],axis=1)[:,::-1]
    return np.column_stack((ahead[:,1:]<q[:,:-1],np.ones(Y,dtype=bool)))
def brute(z,a):
    out=np.ones(z.shape,dtype=bool)
    for i in range(X-1):
        out[:,i]=np.all(z[:,i+1:]-z[:,i,None] < np.tan(a)*(x[i+1:]-x[i]),axis=1)
    return out
start=perf_counter(); fast=np.stack([sweep(z,a) for a in angles]); tf=perf_counter()-start
start=perf_counter(); slow=np.stack([brute(z,a) for a in angles]); tb=perf_counter()-start
print('sweep comparisons',fast.size,'mismatches',np.count_nonzero(fast!=slow),'seconds',tf,tb)
assert np.array_equal(fast,slow)
# D: known blocking ridge dominates unknown; no blocker + missing is unknown.
# This is the discrete node model only, not missing continuous-cell coverage.
missing=np.zeros(z.shape,dtype=bool); missing[5:25,400]=True
q=z-np.tan(angles[4])*x
q_valid=np.where(missing,-np.inf,q)
mx=np.maximum.accumulate(q_valid[:,::-1],axis=1)[:,::-1]
mx=np.column_stack((mx[:,1:],np.full(Y,-np.inf)))
unknown=np.logical_or.accumulate(missing[:,::-1],axis=1)[:,::-1]
unknown=np.column_stack((unknown[:,1:],np.zeros(Y,dtype=bool)))
state=np.where(mx>=q,0,np.where(unknown,-1,1)); state[missing]=-1
print('missing: blocked/unknown/clear within domain',[(state==i).sum() for i in (0,-1,1)])
for j,i in [(5,399),(5,401),(5,400)]:
    assert state[j,i] in (-1,0,1)
# Independent all-node tri-state reference.
ref_state=np.ones(z.shape,dtype=np.int8)
for i in range(X):
    blocked=np.any((~missing[:,i+1:]) & (z[:,i+1:]-z[:,i,None]>=np.tan(angles[4])*(x[i+1:]-x[i])),axis=1)
    absent=np.any(missing[:,i+1:],axis=1)
    ref_state[:,i]=np.where(missing[:,i],-1,np.where(blocked,0,np.where(absent,-1,1)))
assert np.array_equal(state,ref_state)
# E: counterexample: ignoring curvature may predict a distant obstacle.
R=6371000.; d=50000.; h=250.; alpha=np.deg2rad(.1)
flat=h-d*np.tan(alpha); curved=flat-d*d/(2*R)
print('curvature example clearance excess m (flat, approx curved)',flat,curved)
assert flat>0 and curved<0

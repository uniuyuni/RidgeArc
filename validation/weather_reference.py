"""Council 05 synthetic geometry/optics checks; not forecast validation."""
import math
R=6371000.
def sun_clear(h,alpha):
    a=math.radians(alpha); r=R+h
    return a>=0 or r*math.cos(a)>=R
for a in [-1,-2,-3,-4]:
    h=R*(1/math.cos(math.radians(a))-1)
    assert sun_clear(h+1,a) and not sun_clear(h-1,a)
    print('solar depression',a,'deg, minimum lit height m',round(h,2))
def transmission(segments):
    return math.exp(-sum(beta*length for beta,length in segments))
clear=transmission([(0.01,80)])
blocked=transmission([(0.01,75),(1.01,5)])
print('same local cloud, incoming clear / blocked',clear,blocked,'ratio',clear/blocked)
assert math.isclose(clear/blocked,math.exp(5))
tau=.2
low=transmission([(tau/1,40)])
high=transmission([(0,40)])
print('equal AOD, horizontal transmission lower vs elevated aerosol',low,high)
a=transmission([(0.02,40)])
b=transmission([(0.02,5),(0.2,35)])
print('same observer extinction, path transmissions',a,b)
for layers in [([1,0],[1,0]),([1,0],[0,1])]:
    print('cloud fractions',[sum(l)/2 for l in layers], 'joint clear',sum(not(x or y) for x,y in zip(*layers))/2)

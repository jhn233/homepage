import test from 'node:test';
import assert from 'node:assert/strict';
import {fit,predictAt,residualPoints,markOutliers} from '../experimentlab/engine.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)));
test('predicts in range and flags both directions of extrapolation',()=>{
  const p=[{x:0,y:2},{x:1,y:5},{x:2,y:8}],f=fit(p);
  const middle=predictAt(f,p,.5);near(middle.y,3.5);assert.equal(middle.extrapolated,false);
  assert.equal(predictAt(f,p,-1).extrapolated,true);assert.equal(predictAt(f,p,3).extrapolated,true);
  assert.equal(predictAt(f,p,0).extrapolated,false);assert.equal(predictAt(f,p,2).extrapolated,false);
});
test('model domain and nonfinite predictions are rejected',()=>{
  const p=[{x:1,y:2},{x:2,y:4},{x:3,y:6}],f=fit(p,'power');
  assert.throws(()=>predictAt(f,p,0),/X > 0/);assert.throws(()=>predictAt(f,p,NaN),/有限/);
  const reciprocal=fit(p,'reciprocal');assert.throws(()=>predictAt(reciprocal,p,0),/X ≠ 0/);
  assert.throws(()=>predictAt(null,p,1),/有效拟合/);
  assert.throws(()=>predictAt({kind:'linear',predict:()=>Infinity},p,1),/计算范围/);
});
test('reciprocal range is assessed separately on each side of zero',()=>{
  const p=[-4,-2,-1,1,2,4].map(x=>({x,y:2+12/x})),f=fit(p,'reciprocal');
  assert.equal(predictAt(f,p,-2).extrapolated,false);assert.equal(predictAt(f,p,2).extrapolated,false);
  assert.equal(predictAt(f,p,.5).extrapolated,true);assert.equal(predictAt(f,p,-.5).extrapolated,true);
  assert.equal(predictAt(f,p,5).extrapolated,true);near(predictAt(f,p,-2).y,-4);
});
test('a reciprocal prediction on an unobserved branch is flagged',()=>{
  const p=[1,2,4].map(x=>({x,y:2+12/x})),f=fit(p,'reciprocal');assert.equal(predictAt(f,p,-2).extrapolated,true);
});
test('residuals equal observed minus fitted and retain row identities',()=>{
  const p=[{x:0,y:1,index:3},{x:1,y:3,index:4},{x:2,y:6,index:8}],f=fit(p);
  const a=residualPoints(f,p);assert.deepEqual(a.map(x=>x.index),[3,4,8]);
  for(const r of a)near(r.residual,r.y-f.predict(r.x));assert.deepEqual(residualPoints(null,p),[]);
});
test('excluded outliers do not enter the residual sample',()=>{
  const p=[1,2,2,3,3,4,4,50].map((y,index)=>({x:index,y,index}));
  const used=markOutliers(p,'iqr').filter(p=>!p.outlier),f=fit(used);
  assert.equal(residualPoints(f,used).length,7);assert.ok(residualPoints(f,used).every(p=>p.index!==7));
});

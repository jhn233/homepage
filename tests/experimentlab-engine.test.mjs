import test from 'node:test';
import assert from 'node:assert/strict';
import {fit,parseTable,parseNumber,markOutliers,curveSegments,DEMOS} from '../experimentlab/engine.js';
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} ≉ ${b}`);
for(const [kind,equation,domain,coefficients] of [
  ['linear',x=>2+3*x,[-2,-1,0,1,2],[2,3]],
  ['polynomial',x=>2+3*x-.4*x*x,[-2,-1,0,1,2],[2,3,-.4]],
  ['exponential',x=>5*Math.exp(-.6*x),[0,.5,1,2,3],[Math.log(5),-.6]],
  ['logarithmic',x=>2+1.5*Math.log(x),[.1,.5,1,2,5],[2,1.5]],
  ['power',x=>2.5*x**1.5,[.1,.5,1,2,5],[Math.log(2.5),1.5]],
  ['reciprocal',x=>2+12/x,[-4,-2,-1,1,2,4],[2,12]],
]) test(`${kind}: known parameters and original-scale diagnostics`,()=>{
  const points=domain.map(x=>({x,y:equation(x)})),result=fit(points,kind);
  coefficients.forEach((v,i)=>near(result.coefficients[i],v));
  domain.forEach(x=>near(result.predict(x),equation(x)));
  near(result.r2,1);near(result.std,0);
});
test('normalization preserves predictions with a large X offset',()=>{
  const points=Array.from({length:8},(_,i)=>({x:1e12+i,y:2+3*i+.25*i*i}));
  const f=fit(points,'polynomial');points.forEach(p=>near(f.predict(p.x),p.y));
});
test('log-linear exponential metrics are on the original Y scale',()=>{
  const points=[1,3,5,7,11].map((y,x)=>({x,y})),f=fit(points,'exponential');
  const mean=points.reduce((s,p)=>s+p.y,0)/points.length;
  const residual=points.reduce((s,p)=>s+(p.y-f.predict(p.x))**2,0);
  const total=points.reduce((s,p)=>s+(p.y-mean)**2,0);
  near(f.r2,1-residual/total);near(f.std,Math.sqrt(residual/3));
});
test('large exponential offset does not overflow the internal amplitude',()=>{
  const points=Array.from({length:6},(_,i)=>({x:1e6+i,y:Math.exp(.2*i)}));
  const f=fit(points,'exponential');points.forEach(p=>near(f.predict(p.x),p.y,1e-8));
});
test('constant Y and zero residual degrees of freedom stay undefined',()=>{
  const constant=fit([{x:0,y:3},{x:1,y:3},{x:2,y:3}]);assert.ok(Number.isNaN(constant.r2));
  const exact=fit([{x:0,y:1},{x:1,y:2}]);assert.ok(Number.isNaN(exact.std));assert.equal(exact.df,0);
});
test('tiny nonconstant Y retains R squared',()=>{
  const points=[1,2,3,4].map(x=>({x,y:x*1e-150}));near(fit(points).r2,1);
});
test('model domain constraints reject unsupported points',()=>{
  assert.throws(()=>fit([{x:0,y:2},{x:1,y:3}],'logarithmic'),/X > 0/);
  assert.throws(()=>fit([{x:1,y:0},{x:2,y:3}],'exponential'),/Y > 0/);
  assert.throws(()=>fit([{x:-1,y:2},{x:1,y:3}],'power'),/X > 0/);
  assert.throws(()=>fit([{x:0,y:2},{x:1,y:3}],'reciprocal'),/X ≠ 0/);
  assert.throws(()=>fit([{x:1,y:2},{x:1,y:3}]),/不同/);
});
test('reciprocal branches do not bridge zero',()=>{
  const points=DEMOS.at(-1).rows.map(([x,y])=>({x,y})),segments=curveSegments(points,fit(points,'reciprocal'));
  assert.equal(segments.length,2);assert.ok(segments[0].every(p=>p.x<0));assert.ok(segments[1].every(p=>p.x>0));
});
test('CSV preserves cell positions and skips incomplete rows',()=>{
  const p=parseTable('X,Y,Z\n1,2,3\n4,,6\n7,8,9\n10,NaN,11');
  assert.deepEqual(p.names,['X','Y','Z']);assert.deepEqual(p.rows,[[1,2,3],[7,8,9]]);assert.equal(p.skipped,2);
});
test('quoted names, escaped quotes, BOM and CRLF parse correctly',()=>{
  const p=parseTable('\uFEFF"电流, I","电压 ""U"""\r\n0.1,5\r\n0.2,10');
  assert.deepEqual(p.names,['电流, I','电压 "U"']);assert.equal(p.rows.length,2);
});
test('whitespace, tab, semicolon and decimal commas are supported',()=>{
  assert.deepEqual(parseTable('1 2\n3 4').rows,[[1,2],[3,4]]);
  assert.deepEqual(parseTable('X\tY\n1\t2\n3\t4').rows,[[1,2],[3,4]]);
  assert.deepEqual(parseTable('X;Y\n0,5;1,5\n1,0;2,0').rows,[[.5,1.5],[1,2]]);
});
test('invalid input cannot turn blanks or infinity into usable numbers',()=>{
  for(const v of ['',' ','NaN','Infinity','1x','0x11'])assert.ok(!Number.isFinite(parseNumber(v)));
  assert.equal(parseNumber('−1.2e-3'),-.0012);
  assert.throws(()=>parseTable('X,Y\n1,"2'),/引号/);assert.throws(()=>parseTable(''),/粘贴/);
});
test('IQR marks outliers while retaining original row identities',()=>{
  const points=[1,2,2,3,3,4,4,50].map((y,index)=>({x:index,y,index}));
  const marked=markOutliers(points,'iqr');assert.equal(marked.length,points.length);
  assert.deepEqual(marked.map(p=>p.index),points.map(p=>p.index));assert.equal(marked.at(-1).outlier,true);assert.ok(!('outlier' in points[0]));
});
test('all nine shipped demos produce valid fits and finite curves',()=>{
  assert.equal(DEMOS.length,9);
  for(const demo of DEMOS){const points=demo.rows.map(([x,y])=>({x,y})),f=fit(points,demo.kind);assert.ok(Number.isFinite(f.r2),demo.name);assert.ok(curveSegments(points,f).flat().every(p=>Number.isFinite(p.y)),demo.name);}
});

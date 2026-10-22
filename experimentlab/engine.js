export const MODELS = [
  {id:'linear', name:'线性', formula:'y = a + bx', detail:'探索两个变量的线性关系', domain:'X、Y 可为任意有限数值'},
  {id:'polynomial', name:'多项式', formula:'y = a₀ + a₁x + … + aₙxⁿ', detail:'描述弯曲趋势，支持 2–5 次', domain:'至少需要 n + 1 个不同的 X'},
  {id:'exponential', name:'指数', formula:'y = a · eᵇˣ', detail:'增长、衰减与 RC 放电', domain:'要求所有 Y > 0'},
  {id:'logarithmic', name:'对数', formula:'y = a + b · ln(x)', detail:'变化逐渐趋缓的响应', domain:'要求所有 X > 0'},
  {id:'power', name:'幂函数', formula:'y = a · xᵇ', detail:'幂律与比例尺度关系', domain:'要求所有 X > 0、Y > 0'},
  {id:'reciprocal', name:'倒数', formula:'y = a + b/x', detail:'包含偏置的反比例关系', domain:'要求所有 X ≠ 0'}
];
export const fmt = (x, digits=6) => !Number.isFinite(x) ? '—' : Math.abs(x) < 1e-12 && x === 0 ? '0' : Number(x.toPrecision(digits)).toString();
const sum = a => a.reduce((s,x)=>s+x,0);
const evalPoly = (c,x) => c.reduceRight((s,v)=>s*x+v,0);
const transform = (x,kind) => ['logarithmic','power'].includes(kind) ? (x>0?Math.log(x):NaN) : kind==='reciprocal' ? (x!==0?1/x:NaN) : x;

export function polynomial(xs, ys, degree) {
  const n=xs.length,m=degree+1;
  if(n!==ys.length || n<m || !xs.every(Number.isFinite) || !ys.every(Number.isFinite) || new Set(xs).size<m) throw Error(`至少需要 ${m} 个不同的 X 值，请补充或修改数据。`);
  const lo=Math.min(...xs),hi=Math.max(...xs),center=lo/2+hi/2,scale=Math.max(Math.abs(hi-center),Math.abs(lo-center));
  if(!Number.isFinite(scale)||scale<=0) throw Error('X 的变化范围无法用于拟合。');
  const tx=xs.map(x=>(x-center)/scale),yscale=Math.max(...ys.map(Math.abs))||1,ty=ys.map(y=>y/yscale);
  const q=[],r=Array.from({length:m},()=>Array(m).fill(0));
  for(let col=0;col<m;col++) {
    const v=tx.map(x=>x**col);
    for(let pass=0;pass<2;pass++) for(let j=0;j<col;j++) {
      const p=sum(v.map((x,i)=>x*q[j][i]));r[j][col]+=p;
      for(let i=0;i<n;i++)v[i]-=p*q[j][i];
    }
    const norm=Math.sqrt(sum(v.map(x=>x*x)));
    if(norm<=1e-12*Math.sqrt(n))throw Error('数据接近退化，请增加不同的 X 值或降低多项式次数。');
    r[col][col]=norm;q.push(v.map(x=>x/norm));
  }
  const normalized=q.map(c=>sum(c.map((x,i)=>x*ty[i])));
  for(let i=m-1;i>=0;i--){for(let j=i+1;j<m;j++)normalized[i]-=r[i][j]*normalized[j];normalized[i]/=r[i][i];}
  for(let i=0;i<m;i++)normalized[i]*=yscale;
  let coefficients=[normalized.at(-1)];
  for(let k=m-2;k>=0;k--){const next=Array(coefficients.length+1).fill(0);coefficients.forEach((c,j)=>{next[j]-=c*(center/scale);next[j+1]+=c/scale;});next[0]+=normalized[k];coefficients=next;}
  if(![...normalized,...coefficients].every(Number.isFinite))throw Error('数据量级过大，无法得到有限系数，请调整单位。');
  return {coefficients,normalized,center,scale,predict:x=>evalPoly(normalized,(x-center)/scale)};
}

export function fit(points,kind='linear',degree=2) {
  if(!MODELS.some(m=>m.id===kind))throw Error('请选择有效的拟合模型。');
  if(points.length<2)throw Error('至少添加两行数据，开始第一次分析。');
  const logarithmicY=['exponential','power'].includes(kind);
  if(['logarithmic','power'].includes(kind)&&points.some(p=>p.x<=0))throw Error(`${kind==='power'?'幂函数':'对数'}拟合要求所有 X > 0。`);
  if(logarithmicY&&points.some(p=>p.y<=0))throw Error(`${kind==='power'?'幂函数':'指数'}拟合要求所有 Y > 0。`);
  if(kind==='reciprocal'&&points.some(p=>p.x===0))throw Error('倒数拟合要求所有 X ≠ 0，请检查零值。');
  const d=kind==='polynomial'?Math.max(2,Math.min(5,Number(degree))):1;
  const solution=polynomial(points.map(p=>transform(p.x,kind)),points.map(p=>logarithmicY?Math.log(p.y):p.y),d);
  const predict=x=>{const v=solution.predict(transform(x,kind));return logarithmicY?Math.exp(v):v;};
  const predictions=points.map(p=>predict(p.x));
  if(!predictions.every(Number.isFinite))throw Error('预测值超出可计算范围，请调整数据单位。');
  const sc=Math.max(...points.map(p=>Math.abs(p.y)))||1,ty=points.map(p=>p.y/sc),mean=sum(ty)/ty.length;
  const sse=sum(ty.map((y,i)=>(y-predictions[i]/sc)**2)),sst=sum(ty.map(y=>(y-mean)**2)),df=points.length-d-1;
  const constant=points.every(p=>p.y===points[0].y);
  const r2=constant||sst===0?NaN:1-sse/sst,std=df>0?Math.sqrt(sse/df)*sc:NaN;
  const c=solution.coefficients;
  let equation;
  if(['linear','polynomial'].includes(kind)) {
    equation='y = '+c.map((v,i)=>`${v<0?'−':i?'+':''}${i?' ':''}${fmt(Math.abs(v))}${i===0?'':i===1?'x':`x^${i}`}`).join(' ');
  } else if(logarithmicY) {
    const amp=Math.exp(c[0]),a=Number.isFinite(amp)&&amp>0?fmt(amp):`exp(${fmt(c[0])})`;
    equation=kind==='power'?`y = ${a} · x^(${fmt(c[1])})`:`y = ${a} · exp(${fmt(c[1])}x)`;
  } else equation=`y = ${fmt(c[0])} ${c[1]<0?'−':'+'} ${fmt(Math.abs(c[1]))}${kind==='logarithmic'?' · ln(x)':'/x'}`;
  return {...solution,predict,predictions,kind,degree:d,parameters:d+1,df,r2,std,equation,n:points.length,method:logarithmicY?'对 ln(Y) 做最小二乘；以下指标按原始 Y 计算。':'在归一化坐标中使用 QR 最小二乘。'};
}

export function markOutliers(points,method) {
  const flags=points.map(()=>false);
  if(method==='iqr'&&points.length>=4){
    const ys=points.map(p=>p.y).sort((a,b)=>a-b),quant=p=>{const t=(ys.length-1)*p,i=Math.floor(t);return ys[i]+(ys[Math.ceil(t)]-ys[i])*(t-i);};
    const q1=quant(.25),q3=quant(.75),iqr=q3-q1;
    points.forEach((p,i)=>flags[i]=p.y<q1-1.5*iqr||p.y>q3+1.5*iqr);
  }
  if(method==='sigma')try{const f=fit(points);if(Number.isFinite(f.std)){points.forEach((p,i)=>flags[i]=Math.abs(p.y-f.predict(p.x))>3*Math.max(f.std,1e-12));}}catch{}
  return points.map((p,i)=>({...p,outlier:flags[i]}));
}

function splitDelimited(text, delimiter) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&c===delimiter){row.push(cell.trim());cell='';}
    else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(x=>x!==''))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw Error('CSV 引号没有闭合，请检查文件。');
  row.push(cell.trim());if(row.some(x=>x!==''))rows.push(row);return rows;
}
export function parseNumber(value) {
  const raw=String(value).trim().replaceAll('−','-');
  if(!raw)return NaN;
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw))return NaN;
  return Number(raw);
}
export function parseTable(text) {
  text=text.replace(/^\uFEFF/,'').trim();if(!text)throw Error('请先粘贴或导入实验数据。');
  const first=text.split(/\r?\n/).find(x=>x.trim());
  const delimiter=['\t',';',','].find(d=>first.includes(d));
  let rows=delimiter?splitDelimited(text,delimiter):text.split(/\r?\n/).filter(x=>x.trim()).map(x=>x.trim().split(/\s+/));
  const count=rows[0].length;if(count<2)throw Error('至少需要两列，以逗号、分号、Tab 或空白分隔。');
  const num=s=>parseNumber(delimiter!==','&&/^[-+]?\d+,\d+(?:e[-+]?\d+)?$/i.test(s)?s.replace(',','.'):s);
  const firstNumbers=rows[0].map(num),hasHeader=rows[0].every(s=>s!=='')&&firstNumbers.every(x=>!Number.isFinite(x));
  const names=hasHeader?rows.shift():Array.from({length:count},(_,i)=>i===0?'X':i===1?'Y':`列 ${i+1}`);
  const valid=[],invalid=[];
  rows.forEach((row,i)=>{const nums=row.map(num);if(row.length===count&&nums.every(Number.isFinite))valid.push(nums);else invalid.push(i+1+(hasHeader?1:0));});
  if(!valid.length)throw Error('没有找到完整的数值行。空值或非数字不会自动补为零。');
  if(valid.length>10000)throw Error('一次最多导入 10,000 行，请拆分文件。');
  return {names,rows:valid,skipped:invalid.length,invalid};
}

export const DEMOS=[
  {name:'伏安特性',tag:'欧姆定律',kind:'linear',names:['电流 I (A)','电压 U (V)'],rows:Array.from({length:10},(_,i)=>[(i+1)*.02,50*(i+1)*.02+[.04,-.07,.1,-.03,.06,-.09,.05,.08,-.04,-.02][i]])},
  {name:'弹簧伸长',tag:'胡克定律',kind:'linear',names:['力 F (N)','伸长 ΔL (mm)'],rows:Array.from({length:10},(_,i)=>[i+1,5*(i+1)+[.2,-.3,.1,.4,-.2,.15,-.4,.3,-.1,.2][i]])},
  {name:'单摆周期',tag:'线性关系',kind:'linear',names:['摆长 L (m)','周期平方 T² (s²)'],rows:Array.from({length:10},(_,i)=>[.2+i*.1,4*Math.PI**2*(.2+i*.1)/9.8])},
  {name:'自由落体',tag:'二次曲线',kind:'polynomial',names:['时间 t (s)','位移 h (m)'],rows:Array.from({length:10},(_,i)=>[(i+1)/10,4.9*((i+1)/10)**2])},
  {name:'含噪多项式',tag:'异常值演示',kind:'polynomial',names:['X','Y'],rows:Array.from({length:14},(_,i)=>[i,i===7?130:.5+2*i+.3*i*i+Math.sin(i)*.4])},
  {name:'RC 放电',tag:'指数衰减',kind:'exponential',names:['时间 t (s)','电压 U (V)'],rows:Array.from({length:9},(_,i)=>[i*.5,5*Math.exp(-.6*i*.5)])},
  {name:'对数响应',tag:'对数函数',kind:'logarithmic',names:['X','Y'],rows:[.1,.2,.5,1,2,5,10].map(x=>[x,2+1.5*Math.log(x)])},
  {name:'幂律关系',tag:'幂函数',kind:'power',names:['X','Y'],rows:[.5,1,1.5,2,3,4,5].map(x=>[x,2.5*x**1.5])},
  {name:'倒数关系',tag:'含偏置',kind:'reciprocal',names:['X','Y'],rows:[-4,-2,-1,1,2,4].map(x=>[x,2+12/x])}
];

export function curveSegments(points,result,count=180) {
  let ranges=[points.map(p=>p.x)];
  if(result.kind==='reciprocal')ranges=[points.filter(p=>p.x<0).map(p=>p.x),points.filter(p=>p.x>0).map(p=>p.x)];
  return ranges.filter(a=>a.length).map(xs=>{const lo=Math.min(...xs),hi=Math.max(...xs);return Array.from({length:count},(_,i)=>{const x=lo+(hi-lo)*i/(count-1);return{x,y:result.predict(x)};}).filter(p=>Number.isFinite(p.y));});
}

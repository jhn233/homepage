import {MODELS,DEMOS,fit,fmt,parseTable,parseNumber,markOutliers,curveSegments} from './engine.js';

const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='experimentlab.web.v1', clone=v=>JSON.parse(JSON.stringify(v));
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const demo=DEMOS[0];
let state={version:1,names:[...demo.names],rows:clone(demo.rows),x:0,y:1,kind:demo.kind,degree:2,outlier:'off',source:`示例 · ${demo.name}`,notice:'',report:{title:'伏安特性实验报告',author:'',date:today(),context:'',discussion:''}};
let page='workspace',analysis,undo=[],toastTimer,saveTimer,reportTimer,editSession=null;
let loadNotice='';
try{
  const raw=localStorage.getItem(KEY);
  if(raw){const saved=JSON.parse(raw);if(saved.version!==1||!Array.isArray(saved.names)||saved.names.length<2||saved.names.length>20||saved.names.some(n=>typeof n!=='string')||!Array.isArray(saved.rows)||saved.rows.length>10000||!saved.rows.every(r=>Array.isArray(r)&&r.length===saved.names.length&&r.every(Number.isFinite))||!Number.isInteger(saved.x)||!Number.isInteger(saved.y)||saved.x<0||saved.y<0||saved.x>=saved.names.length||saved.y>=saved.names.length||saved.x===saved.y||!MODELS.some(m=>m.id===saved.kind)||![2,3,4,5].includes(saved.degree)||!['off','iqr','sigma'].includes(saved.outlier))throw Error();
    state={...state,...saved,source:String(saved.source||'本地数据'),notice:String(saved.notice||''),report:{...state.report,...Object.fromEntries(Object.entries(saved.report||{}).filter(([k,v])=>['title','author','date','context','discussion'].includes(k)&&typeof v==='string'))}};
  }
}catch{loadNotice='上次的本地数据无法读取，已打开示例。你可以重新导入 CSV。';}

function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4200);}
function remember(){undo.push(clone(state));if(undo.length>15)undo.shift();}
function persist(){clearTimeout(saveTimer);$('save-status').innerHTML='<span></span>正在保存';saveTimer=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(state));$('save-status').innerHTML='<span></span>本地已保存';}catch{$('save-status').textContent='保存失败，请导出 CSV';toast('浏览器本地保存失败，请导出 CSV 保留记录。');}},180);}
function analyze(){
  const all=state.rows.map((r,i)=>({x:r[state.x],y:r[state.y],index:i})),points=markOutliers(all,state.outlier),used=points.filter(p=>!p.outlier);
  let result=null,error='';try{result=fit(used,state.kind,state.degree);}catch(e){error=e.message;}
  return {points,used,result,error,outliers:points.length-used.length};
}
function setPage(next){
  page=['workspace','data','report'].includes(next)?next:'workspace';
  for(const p of ['workspace','data','report'])$(p+'-page').hidden=p!==page;
  document.querySelectorAll('[data-page]').forEach(el=>{el.classList.toggle('active',el.dataset.page===page);if(el.closest('nav'))el.setAttribute('aria-current',el.dataset.page===page?'page':'false');});
  const labels={workspace:['从数据，找到规律','记录每一次观察，让实验结论有迹可循。'],data:['认真对待，每次记录','核对原始数值，保留实验中每一个细节。'],report:['把发现，写成结论','带着数据、图表与思考，完成你的实验报告。']};
  $('page-title').innerHTML=labels[page][0]+'<span>。</span>';$('page-subtitle').textContent=labels[page][1];
  if(page==='report')renderReport();
  if(page==='workspace'&&analysis)renderResults();
  window.scrollTo({top:0,behavior:'auto'});
}
function options(){
  const html=state.names.map((n,i)=>`<option value="${i}">${esc(n)}</option>`).join('');
  $('x-column').innerHTML=html;$('y-column').innerHTML=html;$('x-column').value=state.x;$('y-column').value=state.y;
  $('outlier-method').value=state.outlier;$('degree').value=state.degree;
  $('model-options').innerHTML=MODELS.map(m=>`<button class="model-option ${state.kind===m.id?'active':''}" data-model="${m.id}" aria-pressed="${state.kind===m.id}" title="${esc(m.detail+'；'+m.domain)}"><span class="model-name">${m.name}${state.kind===m.id?'<svg><use href="#i-check"/></svg>':''}</span><span class="model-formula">${m.formula}</span></button>`).join('');
  $('degree-control').hidden=state.kind!=='polynomial';
}
function tableHTML(full=false){
  const indices=full?state.names.map((_,i)=>i):[state.x,state.y];
  return `<table><thead><tr><th>#</th>${indices.map(i=>`<th>${full?`<input aria-label="第 ${i+1} 列名称" data-name="${i}" value="${esc(state.names[i])}" maxlength="80">`:esc(state.names[i])}</th>`).join('')}<th><span class="sr-only">删除</span></th></tr></thead><tbody>${state.rows.map((r,i)=>`<tr class="${analysis.points[i]?.outlier?'outlier':''}"><td title="${analysis.points[i]?.outlier?'已标记为异常点':'有效数据'}">${String(i+1).padStart(2,'0')}</td>${indices.map(j=>`<td><input type="text" inputmode="decimal" autocomplete="off" aria-label="第 ${i+1} 行 ${esc(state.names[j])}" data-cell="${i},${j}" value="${esc(fmt(r[j],15))}"></td>`).join('')}<td><button class="row-delete" data-delete="${i}" aria-label="删除第 ${i+1} 行"><svg><use href="#i-close"/></svg></button></td></tr>`).join('')||`<tr><td colspan="${indices.length+2}" style="text-align:center;padding:35px;color:#91a58c">还没有数据，添加一行或导入 CSV。</td></tr>`}</tbody></table>`;
}

function chartSVG(width,height){
  width=width||Math.max(320,Math.min(960,($('chart-container').clientWidth||780)-20));
  height=height||(width<500?280:340);
  const {points,used,result}=analysis;
  if(!points.length)return '';
  const margin={left:70,right:28,top:28,bottom:58},w=width-margin.left-margin.right,h=height-margin.top-margin.bottom;
  const segments=result?curveSegments(used,result):[],valid=segments.flat();
  const xs=points.map(p=>p.x),ys=[...points.map(p=>p.y),...valid.map(p=>p.y)];
  let xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const xpad=(xmax-xmin)*.08||Math.max(Math.abs(xmin)*.1,1),ypad=(ymax-ymin)*.12||Math.max(Math.abs(ymin)*.1,1);
  xmin-=xpad;xmax+=xpad;ymin-=ypad;ymax+=ypad;
  if(![xmin,xmax,ymin,ymax,xmax-xmin,ymax-ymin].every(Number.isFinite))return '';
  const X=x=>margin.left+(x-xmin)/(xmax-xmin)*w,Y=y=>margin.top+h-(y-ymin)/(ymax-ymin)*h;
  const tick=x=>fmt(x,4),grid=Array.from({length:5},(_,i)=>{const x=xmin+(xmax-xmin)*i/4,y=ymin+(ymax-ymin)*i/4;return `<line class="grid" x1="${margin.left}" x2="${width-margin.right}" y1="${Y(y)}" y2="${Y(y)}"/><line class="grid" x1="${X(x)}" x2="${X(x)}" y1="${margin.top}" y2="${margin.top+h}"/><text x="${margin.left-12}" y="${Y(y)+3}" text-anchor="end">${tick(y)}</text><text x="${X(x)}" y="${height-34}" text-anchor="middle">${tick(x)}</text>`;}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(state.names[state.x])} 与 ${esc(state.names[state.y])} 的散点与拟合曲线"><title>${esc(state.names[state.x])} 与 ${esc(state.names[state.y])}</title><rect width="100%" height="100%" fill="white"/>${grid}<line class="tick" x1="${margin.left}" x2="${width-margin.right}" y1="${margin.top+h}" y2="${margin.top+h}"/>${segments.map(seg=>`<path d="${seg.map((p,i)=>`${i?'L':'M'}${X(p.x).toFixed(2)},${Y(p.y).toFixed(2)}`).join(' ')}" fill="none" stroke="#0071e3" stroke-width="2" stroke-linecap="round"/>`).join('')}${points.map(p=>`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.outlier?4:3.7}" fill="${p.outlier?'#d39357':'#1d1d1f'}" stroke="white" stroke-width="1.4"><title>第 ${p.index+1} 行 · X: ${fmt(p.x,10)} / Y: ${fmt(p.y,10)}${p.outlier?' · 异常点':''}</title></circle>`).join('')}<text class="axis-name" x="${margin.left+w/2}" y="${height-7}" text-anchor="middle">${esc(state.names[state.x])}</text><text class="axis-name" transform="translate(17 ${margin.top+h/2}) rotate(-90)" text-anchor="middle">${esc(state.names[state.y])}</text></svg>`;
}
function renderResults(){
  const {result:r,error,points,outliers}=analysis;
  const names={linear:'LINEAR REGRESSION',polynomial:'POLYNOMIAL',exponential:'EXPONENTIAL',logarithmic:'LOGARITHMIC',power:'POWER LAW',reciprocal:'RECIPROCAL'};
  const model=MODELS.find(m=>m.id===state.kind);
  $('chart-subtitle').textContent=`${model.name}拟合 / ${names[state.kind]}`;
  $('chart-container').innerHTML=points.length?chartSVG():`<div class="chart-empty"><svg><use href="#i-chart"/></svg><div>还没有观测数据<br>导入 CSV，或从一组示例开始。</div></div>`;
  if(points.length&&!$('chart-container').innerHTML)$('chart-container').innerHTML='<div class="chart-empty">数据量级超出图表显示范围，请调整单位。</div>';
  $('outlier-legend').hidden=outliers===0;
  $('metrics').innerHTML=[['决定系数 R²',r?fmt(r.r2,6):'—',r&&!Number.isFinite(r.r2)?'常量 Y，R² 无定义':'按原始 Y 尺度计算'],['残差标准偏差',r?fmt(r.std,5):'—',r&&r.df<=0?'无剩余自由度':r?`残差自由度 ${r.df}`:'需要有效的拟合结果'],['参与拟合',r?String(r.n):'—',`${points.length} 个观测 · ${outliers} 个标记`]].map(([label,value,note],i)=>`<div class="metric"><div class="metric-label">${label}</div><div class="metric-value ${String(value).length>8?'long':''}">${esc(value)}${i===2?'<small>组</small>':''}</div><div class="metric-foot">${esc(note)}</div></div>`).join('');
  $('equation').textContent=r?r.equation:error;
  const notes=[model.domain];if(r)notes.push(r.method);else notes.push(error);
  if(state.outlier==='sigma')notes.push('3σ 基于线性残差，非线性模型请谨慎使用。');
  if(state.outlier==='iqr')notes.push('IQR 根据 Y 值分布标记，异常点不参与拟合。');
  if(r&&!Number.isFinite(r.r2))notes.push('Y 为常量，R² 无定义。');
  if(r&&r.df<=0)notes.push('样本数恰好等于参数个数，无法估计残差标准偏差。');
  $('fit-note').textContent=notes.join('　');$('fit-note').classList.toggle('warning',!r||state.outlier!=='off');
  document.querySelector('[data-action="export-chart"]').disabled=!points.length;
}
function renderReport(){
  const r=analysis.result,meta=state.report;
  $('report-preview').innerHTML=`<div class="report-kicker">EXPERIMENTLAB / EXPERIMENT REPORT</div><h2>${esc(meta.title||'实验数据分析报告')}</h2><div class="report-meta"><span>实验者：${esc(meta.author||'待补充')}</span><span>日期：${esc(meta.date||'待补充')}</span><span>数据来源：${esc(state.source)}</span></div><h3>01 · 实验目的与条件</h3><p class="${meta.context?'':'report-placeholder'}">${esc(meta.context||'请补充实验目的、仪器与环境条件。')}</p><h3>02 · 数据处理与拟合</h3><p>X：${esc(state.names[state.x])}　 Y：${esc(state.names[state.y])}\n模型：${MODELS.find(m=>m.id===state.kind).name}${state.kind==='polynomial'?`（${state.degree} 次）`:''}；异常值处理：${{off:'保留全部数据',iqr:'Y 值 IQR 标记',sigma:'3σ 线性残差标记'}[state.outlier]}。原始 ${state.rows.length} 行，标记 ${analysis.outliers} 行。</p>${r?`<div class="report-equation">${esc(r.equation)}</div><div class="report-stats"><span>R² = ${fmt(r.r2)}</span><span>残差标准偏差 = ${fmt(r.std)}</span><span>n = ${r.n}</span><span>自由度 = ${r.df}</span></div><p>${esc(r.method)}${!Number.isFinite(r.r2)?' 常量 Y 的 R² 无定义。':''}${r.df<=0?' 无剩余自由度，残差标准偏差无法估计。':''}</p>`:`<p>暂时无法拟合：${esc(analysis.error)}</p>`}${chartSVG()}<h3>03 · 原始数据与异常标记</h3><p>原始数据全部保留。标记为异常的观测未参与拟合。</p><table><thead><tr><th style="width:7%">序号</th>${state.names.map(n=>`<th>${esc(n)}</th>`).join('')}<th style="width:13%">状态</th></tr></thead><tbody>${state.rows.map((row,i)=>`<tr><td>${i+1}</td>${row.map(n=>`<td>${fmt(n,10)}</td>`).join('')}<td>${analysis.points[i]?.outlier?'异常标记':'保留'}</td></tr>`).join('')}</tbody></table><h3>04 · 讨论与结论</h3><p class="${meta.discussion?'':'report-placeholder'}">${esc(meta.discussion||'请结合理论值、实验条件和误差来源补充结论。')}</p><p class="report-disclaimer">本报告为分析初稿。R² 与残差不能单独证明物理规律，也不能代替完整的测量不确定度分析。指数与幂函数采用对数空间最小二乘，指标按原始 Y 计算；异常值标记须结合实验判断。所有数值均为浏览器本地计算结果。</p>`;
}
function render(){
  analysis=analyze();options();
  $('source-name').textContent=state.source;$('row-count').textContent=state.rows.length;$('full-count').textContent=state.rows.length;
  $('full-source').textContent=state.source;$('compact-table').innerHTML=tableHTML();$('full-table').innerHTML=tableHTML(true);
  $('import-tip').textContent=state.notice||'点击数值即可修改，结果会自动更新。';
  renderResults();if(page==='report')renderReport();
  for(const key of ['title','author','date','context','discussion']){const input=$('report-'+key);if(document.activeElement!==input)input.value=state.report[key]||'';}
  document.querySelector('[data-action="undo"]').disabled=!undo.length;
}
function update(){render();persist();}
function replaceDataset(data,source,kind='linear'){
  if(data.names.length>20)throw Error('一次最多支持 20 列，请精简表格。');
  remember();state.names=data.names.map(n=>String(n).slice(0,80));state.rows=clone(data.rows);state.x=0;state.y=1;state.source=source;state.kind=kind;state.outlier='off';state.degree=2;
  state.notice=data.skipped?`已跳过 ${data.skipped} 行不完整或无效数据，请核对原始文件。`:'';
  state.report={title:source.replace(/^示例 · /,'').replace(/\.(csv|txt|tsv)$/i,'')+'实验报告',author:'',date:today(),context:'',discussion:''};
  update();setPage('workspace');
}
function downloadFile(content,name,type){
  const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function exportChart(){
  if(!analysis.points.length)return toast('请先添加数据。');
  const svg=chartSVG(1000,500).replace('<svg ',`<svg style="font-family:-apple-system,Arial,sans-serif" `).replace('</svg>',`<style>text{fill:#82977f;font-size:12px}.axis-name{fill:#56764f;font-size:14px}.grid{stroke:#e4ecdf;stroke-width:1;stroke-dasharray:3 5}.tick{stroke:#cfdcc9;stroke-width:1}</style></svg>`);
  if(!svg)return toast('当前数据量级无法导出图表，请调整单位。');
  downloadFile(svg,'实验解析-拟合图.svg','image/svg+xml;charset=utf-8');toast('图表已导出为 SVG，可插入文档并保持清晰。');
}
function exportCSV(){
  const csv=s=>`"${String(s).replaceAll('"','""')}"`;
  downloadFile('\uFEFF'+[state.names.map(csv).join(','),...state.rows.map(r=>r.join(','))].join('\r\n'),'实验解析-原始数据.csv','text/csv;charset=utf-8');toast('原始数据已导出。');
}
async function exportReport(){
  renderReport();
  try{
    const response=await fetch('./style.css?v=3');if(!response.ok)throw Error();const css=await response.text();
    downloadFile(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(state.report.title||'实验报告')}</title><style>${css}\nbody{padding:25px;background:#f5f7f4}.report-paper{max-width:900px;margin:0 auto}@media print{body{padding:0}}</style><article class="report-paper">${$('report-preview').innerHTML}</article></html>`,'实验解析-实验报告.html','text/html;charset=utf-8');toast('报告已下载，打开文件即可阅读或打印成 PDF。');
  }catch{toast('报告样式读取失败，请使用“打印 / 保存 PDF”。');}
}
const actions={
  import:()=>$('file-input').click(),paste:()=>{$('paste-error').textContent='';$('paste-dialog').showModal();},demos:()=>$('demo-dialog').showModal(),help:()=>$('help-dialog').showModal(),
  add:()=>{if(state.rows.length>=10000)return toast('最多支持 10,000 行。');remember();const row=Array(state.names.length).fill(0),max=state.rows.length?Math.max(...state.rows.map(r=>r[state.x])):-1;row[state.x]=max+1;state.rows.push(row);state.notice='';update();const container=page==='data'?$('full-table'):$('compact-table');container.scrollTop=container.scrollHeight;const input=container.querySelector(`input[data-cell="${state.rows.length-1},${state.y}"]`);input?.focus();input?.select();},
  undo:()=>{if(!undo.length)return toast('还没有可撤销的操作。');state=undo.pop();update();toast('已撤销上一步。');},
  manual:()=>{replaceDataset({names:['X','Y'],rows:[]},'手动录入');setPage('data');toast('空白数据表已准备好，点击“添加一行”开始。');},
  'export-chart':exportChart,'export-csv':exportCSV,'export-report':exportReport,
  print:()=>{if(!state.rows.length)return toast('请先添加数据。');setPage('report');renderReport();window.print();}
};
document.addEventListener('click',e=>{
  const close=e.target.closest('[data-close]');if(close){close.closest('dialog').close();return;}
  const nav=e.target.closest('[data-page]');if(nav){setPage(nav.dataset.page);return;}
  const action=e.target.closest('[data-action]');if(action){actions[action.dataset.action]?.();return;}
  const model=e.target.closest('[data-model]');if(model&&model.dataset.model!==state.kind){remember();state.kind=model.dataset.model;update();return;}
  const del=e.target.closest('[data-delete]');if(del){remember();state.rows.splice(Number(del.dataset.delete),1);update();toast('已删除一行，可在数据表中撤销。');return;}
  const demoButton=e.target.closest('[data-demo]');if(demoButton){const d=DEMOS[Number(demoButton.dataset.demo)];replaceDataset(d,'示例 · '+d.name,d.kind);$('demo-dialog').close();toast('已载入示例；原数据可在数据表中撤销恢复。');}
});
document.querySelector('.brand-symbol').addEventListener('click',e=>{e.preventDefault();setPage('workspace');});
document.querySelector('.wordmark').addEventListener('click',e=>{e.preventDefault();setPage('workspace');});
document.addEventListener('focusin',e=>{if(e.target.matches('[data-cell],[data-name]'))editSession={element:e.target,saved:false};});
document.addEventListener('input',e=>{
  const input=e.target;
  if(!input.matches('[data-cell],[data-name]'))return;
  const isCell=input.matches('[data-cell]'),value=isCell?parseNumber(input.value):input.value.trim();
  const valid=isCell?Number.isFinite(value):value.length>0;
  input.setAttribute('aria-invalid',String(!valid));
  if(!valid)return;
  if(!editSession||editSession.element!==input)editSession={element:input,saved:false};
  if(!editSession.saved){remember();editSession.saved=true;}
  if(isCell){const [i,j]=input.dataset.cell.split(',').map(Number);state.rows[i][j]=value;document.querySelectorAll(`input[data-cell="${i},${j}"]`).forEach(other=>{if(other!==input)other.value=input.value;});}
  else{state.names[+input.dataset.name]=value;options();}
  state.notice='';analysis=analyze();renderResults();
  for(const container of [$('compact-table'),$('full-table')]){container.querySelectorAll('tbody tr').forEach((row,i)=>row.classList.toggle('outlier',!!analysis.points[i]?.outlier));}
  if(!isCell)$('compact-table').innerHTML=tableHTML();
  document.querySelector('[data-action="undo"]').disabled=false;
  persist();
});
document.addEventListener('change',e=>{
  const input=e.target;
  if(input.matches('[data-cell]')){
    const [i,j]=input.dataset.cell.split(',').map(Number),num=parseNumber(input.value);
    if(!Number.isFinite(num)){input.value=fmt(state.rows[i][j],15);input.setAttribute('aria-invalid','false');toast('请输入有限数值，例如 0.25、-3 或 1.2e-4。');return;}
    if(num===state.rows[i][j])return;remember();state.rows[i][j]=num;state.notice='';update();
  }
  if(input.matches('[data-name]')){const n=input.value.trim();if(!n){input.value=state.names[+input.dataset.name];input.setAttribute('aria-invalid','false');return toast('列名不能为空。');}if(n===state.names[+input.dataset.name])return;remember();state.names[+input.dataset.name]=n;update();}
});
for(const axis of ['x','y'])$(axis+'-column').addEventListener('change',e=>{remember();const value=Number(e.target.value),other=axis==='x'?'y':'x';if(value===state[other])state[other]=state[axis];state[axis]=value;update();});
$('outlier-method').addEventListener('change',e=>{remember();state.outlier=e.target.value;update();});
$('degree').addEventListener('change',e=>{remember();state.degree=Number(e.target.value);update();});
for(const key of ['title','author','date','context','discussion'])$('report-'+key).addEventListener('input',e=>{state.report[key]=e.target.value;clearTimeout(reportTimer);reportTimer=setTimeout(renderReport,180);persist();});
$('paste-form').addEventListener('submit',e=>{e.preventDefault();try{const data=parseTable($('paste-input').value);replaceDataset(data,'粘贴数据');$('paste-dialog').close();$('paste-input').value='';toast(`已导入 ${data.rows.length} 行${data.skipped?`，跳过 ${data.skipped} 行`:''}。`);}catch(error){$('paste-error').textContent=error.message;}});
$('file-input').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    if(!/\.(csv|txt|tsv)$/i.test(file.name))throw Error('请导入 CSV、TXT 或 TSV。Excel 文件请先另存为 CSV。');
    if(file.size>5*1024*1024)throw Error('文件不能超过 5 MB，请拆分后导入。');
    const bytes=new Uint8Array(await file.arrayBuffer());let text;
    if(bytes[0]===255&&bytes[1]===254)text=new TextDecoder('utf-16le').decode(bytes);
    else if(bytes[0]===254&&bytes[1]===255)text=new TextDecoder('utf-16be').decode(bytes);
    else{try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('gb18030').decode(bytes);}}
    const data=parseTable(text);replaceDataset(data,file.name);toast(`已导入 ${data.rows.length} 行${data.skipped?`，跳过 ${data.skipped} 行`:''}。`);
  }catch(error){toast(error.message);}finally{e.target.value='';}
});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
const symbols=['U ∝ I','F = kx','T² ∝ L','h = ½gt²','a + bx²','e⁻ᵗ','ln(x)','xᵇ','1/x'];
$('demo-options').innerHTML=DEMOS.map((d,i)=>`<button class="demo-option" data-demo="${i}"><span class="demo-symbol">${symbols[i]}</span><strong>${d.name}</strong><small>${d.rows.length} 组数据 · ${d.tag} ↗</small></button>`).join('');
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.target.matches('input,textarea')){e.preventDefault();actions.undo();}});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(page==='workspace')renderResults();},100);});
window.addEventListener('pagehide',()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}});
render();persist();if(loadNotice)toast(loadNotice);

/* ====== 个人工作台 逻辑 ====== */
const STORE_KEY='workbench_v1';
const START_DATE=new Date('2026-07-26'); // 27秋招备战起点（正计时）

// 日期工具
const pad=n=>String(n).padStart(2,'0');
const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
function dateKey(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}

// 数据
let db=load();
function load(){
  try{return JSON.parse(localStorage.getItem(STORE_KEY))||fresh()}catch(e){return fresh()}
}
function fresh(){
  return {todos:[],applications:[],workouts:{},mood:{},reflect:{},weeks:{},jobs:[],meta:{created:Date.now()}}
}
function save(){localStorage.setItem(STORE_KEY,JSON.stringify(db))}

// ====== 渲染 ======
function renderAll(){
  renderHeader();
  renderOverview();
  renderTodo();
  renderApply();
  renderBoard();
  renderJobs();
  renderSport();
  renderMood();
  renderCalendar();
  renderReflect();
  renderWeek();
}

function renderHeader(){
  const d=new Date();
  const wd=['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
  document.getElementById('dateText').textContent=`${d.getMonth()+1}月${d.getDate()}日 ${wd}`;
  const h=d.getHours();
  let g='你好';
  if(h<6)g='夜深了';else if(h<11)g='早安';else if(h<14)g='午安';else if(h<18)g='下午好';else if(h<22)g='晚上好';else g='夜深了';
  document.getElementById('greetText').textContent=g;
  // 正计时：以 2026-07-26 为备战第1天
  const days=Math.floor((new Date(d.getFullYear(),d.getMonth(),d.getDate())-new Date(2026,6,26))/86400000)+1;
  document.getElementById('cdNum').textContent='第'+Math.max(1,days)+'天';
}

function completionPct(){
  // 综合: 待办完成率(40) + 今日投递是否有(10) + 运动(25) + 心情打卡(25)
  let p=0;
  const todos=db.todos.filter(t=>isToday(t.createdAt));
  if(todos.length){p+=Math.round(todos.filter(t=>t.done).length/todos.length*40)}
  const apps=db.applications.filter(applyToday);
  if(apps.length)p+=10;
  const w=db.workouts[todayKey()]||{};
  if(w.aerobic)p+=12;if(w.anaerobic)p+=13;
  const m=db.mood[todayKey()];
  if(m)p+=25;
  return Math.min(100,p);
}

function renderOverview(){
  const pct=completionPct();
  const C=2*Math.PI*52;
  const off=C*(1-pct/100);
  document.getElementById('ringFg').style.strokeDashoffset=off;
  document.getElementById('ringPct').textContent=pct+'%';
  const todos=db.todos.filter(t=>isToday(t.createdAt));
  document.getElementById('miniTodo').textContent=`${todos.filter(t=>t.done).length}/${todos.length}`;
  const apps=db.applications.filter(applyToday);
  document.getElementById('miniApply').textContent=apps.length;
  const w=db.workouts[todayKey()]||{};
  let sportTxt='休';
  if(w.aerobic&&w.anaerobic)sportTxt='全';else if(w.aerobic||w.anaerobic)sportTxt='半';
  document.getElementById('miniSport').textContent=sportTxt;
}

function isToday(ts){const d=new Date(ts);return dateKey(d)===todayKey()}

// ===== To-Do =====
function renderTodo(){
  const list=document.getElementById('todoList');
  const empty=document.getElementById('todoEmpty');
  const todos=db.todos.filter(t=>isToday(t.createdAt));
  list.innerHTML='';
  todos.forEach(t=>{
    const li=document.createElement('li');
    li.className='todo-item'+(t.done?' done':'');
    li.innerHTML=`<div class="todo-check ${t.done?'done':''}">${t.done?'✓':''}</div><div class="todo-text"></div><div class="todo-del">×</div>`;
    li.querySelector('.todo-text').textContent=t.text;
    li.querySelector('.todo-check').onclick=()=>{t.done=!t.done;save();renderTodo();renderOverview()};
    li.querySelector('.todo-del').onclick=()=>{db.todos=db.todos.filter(x=>x.id!==t.id);save();renderTodo();renderOverview()};
    list.appendChild(li);
  });
  const done=todos.filter(t=>t.done).length;
  document.getElementById('todoSub').textContent=`${done} / ${todos.length}`;
  document.getElementById('todoBar').style.width=(todos.length?done/todos.length*100:0)+'%';
  empty.style.display=todos.length?'none':'block';
}
document.getElementById('todoAdd').onclick=addTodo;
document.getElementById('todoInput').addEventListener('keydown',e=>{if(e.key==='Enter')addTodo()});
function addTodo(){
  const inp=document.getElementById('todoInput');
  const v=inp.value.trim();if(!v)return;
  db.todos.push({id:Date.now(),text:v,done:false,createdAt:Date.now()});
  save();inp.value='';renderTodo();renderOverview();
}

// ===== 投递（数据源：腾讯文档《2027秋招fighting》快照 data.json）=====
const APPLY_STATUSES=['是否投递？','意向投递','已投递','测评','笔试','ai面','约一面','约二面','已offer','再接再厉'];
const applyToday=a=>a.date===todayKey();
// 拉取腾讯文档快照覆盖投递记录
async function syncApplyFromCloud(){
  try{
    const r=await fetch('./data.json',{cache:'no-store'});
    if(!r.ok)throw 0;
    const data=await r.json();
    db.applications=(data.records||[]).map(x=>({
      company:x.company||'—',position:x.position||'—',status:x.status||'意向投递',
      date:x.date||'',note:x.note||'',link:x.link||''
    }));
    db.applySyncAt=data.syncedAt||'';
    save();
    renderApply();renderBoard();renderOverview();
    const b=document.getElementById('feishuBadge');if(b){b.textContent='已同步';b.classList.add('on')}
  }catch(e){
    const b=document.getElementById('feishuBadge');if(b){b.textContent='同步失败';b.classList.remove('on')}
  }
}
function renderApply(){
  const stats=document.getElementById('applyStats');
  const apps=db.applications;
  const counts={};APPLY_STATUSES.forEach(s=>counts[s]=0);
  apps.forEach(a=>{if(counts[a.status]!==undefined)counts[a.status]++});
  stats.innerHTML=APPLY_STATUSES.map(s=>`<div class="apply-stat s-${s}"><div class="n">${counts[s]}</div><div class="l">${s}</div></div>`).join('');
  const list=document.getElementById('applyList');
  const empty=document.getElementById('applyEmpty');
  list.innerHTML='';
  // 今日投递排前面
  const sorted=[...apps].sort((a,b)=>(applyToday(b)-applyToday(a))||((b.date||'')>(a.date||'')?1:-1));
  sorted.forEach(a=>{
    const li=document.createElement('li');
    li.className='apply-item';
    const co=a.link?`<a class="apply-co" href="${a.link}" target="_blank"></a>`:`<div class="apply-co"></div>`;
    li.innerHTML=`${co}<div class="apply-pos"></div><div class="apply-status ${a.status}" title="点击切换状态"></div>`;
    li.querySelector('.apply-co').textContent=a.company;
    li.querySelector('.apply-pos').textContent=a.position+(a.note?` · ${a.note}`:'');
    const stEl=li.querySelector('.apply-status');
    stEl.textContent=a.status;
    stEl.onclick=()=>cycleApplyStatus(a);
    list.appendChild(li);
  });
  empty.style.display=apps.length?'none':'block';
}
function cycleApplyStatus(a){
  const i=APPLY_STATUSES.indexOf(a.status);
  a.status=APPLY_STATUSES[(i+1)%APPLY_STATUSES.length];
  save();renderApply();renderBoard();renderOverview();
}

// ===== 投递数据看板 =====
let pieChart=null,barChart=null;
const STATUS_COLORS={'是否投递？':'#d1d5db','意向投递':'#a9adc0','已投递':'#4f46e5','测评':'#0ea5e9','笔试':'#f59e0b','ai面':'#06b6d4','约一面':'#ea580c','约二面':'#7c3aed','已offer':'#16a34a','再接再厉':'#e11d48'};
function renderBoard(){
  if(typeof Chart==='undefined'){setTimeout(renderBoard,300);return}
  const counts={};APPLY_STATUSES.forEach(s=>counts[s]=0);
  db.applications.forEach(a=>{if(counts[a.status]!==undefined)counts[a.status]++});
  document.getElementById('boardTotal').textContent='共 '+db.applications.length+' 条';
  const labels=APPLY_STATUSES.filter(s=>counts[s]>0);
  const data=labels.map(s=>counts[s]);
  const colors=labels.map(s=>STATUS_COLORS[s]);
  const ctxP=document.getElementById('pieChart').getContext('2d');
  if(pieChart)pieChart.destroy();
  pieChart=new Chart(ctxP,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:0}]},options:{plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10,padding:8}}},cutout:'58%',maintainAspectRatio:false}});
  const ctxB=document.getElementById('barChart').getContext('2d');
  if(barChart)barChart.destroy();
  barChart=new Chart(ctxB,{type:'bar',data:{labels:APPLY_STATUSES,datasets:[{data:APPLY_STATUSES.map(s=>counts[s]),backgroundColor:APPLY_STATUSES.map(s=>STATUS_COLORS[s]),borderRadius:4,maxBarThickness:26}]},options:{plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:9},autoSkip:false,maxRotation:45,minRotation:45}},y:{beginAtZero:true,ticks:{precision:0,font:{size:10}}}},maintainAspectRatio:false}});
}

// ===== 运动 =====
function renderSport(){
  const w=db.workouts[todayKey()]||{aerobic:false,anaerobic:false};
  db.workouts[todayKey()]=w;
  document.getElementById('aerobicState').textContent=w.aerobic?'已完成':'未完成';
  document.getElementById('anaerobicState').textContent=w.anaerobic?'已完成':'未完成';
  document.querySelectorAll('.sport-toggle').forEach(el=>{
    el.classList.toggle('on',w[el.dataset.type]);
  });
  // 连续天数
  let streak=0;let d=new Date();
  for(;;){const k=dateKey(d);const ww=db.workouts[k];if(ww&&(ww.aerobic||ww.anaerobic)){streak++;d=new Date(d.getTime()-86400000)}else break}
  document.getElementById('sportStreak').textContent='连续 '+streak+' 天';
  // 本周日历(本周一-周日)
  const ws=document.getElementById('weekSport');ws.innerHTML='';
  const now=new Date();const day=now.getDay()||7;
  const monday=new Date(now);monday.setDate(now.getDate()-day+1);
  for(let i=0;i<7;i++){
    const dd=new Date(monday);dd.setDate(monday.getDate()+i);
    const k=dateKey(dd);const ww=db.workouts[k];
    const has=ww&&(ww.aerobic||ww.anaerobic);
    const isToday=k===todayKey();
    const lab=['一','二','三','四','五','六','日'][i];
    ws.insertAdjacentHTML('beforeend',`<div class="week-day ${has?'has':''} ${isToday?'today':''}"><div class="wd">${lab}</div><div class="dot">${has?'✓':''}</div></div>`);
  }
}
document.querySelectorAll('.sport-toggle').forEach(el=>{
  el.onclick=()=>{
    const w=db.workouts[todayKey()]||(db.workouts[todayKey()]={aerobic:false,anaerobic:false});
    w[el.dataset.type]=!w[el.dataset.type];
    save();renderSport();renderOverview();
  }
});

// ===== 心情 + 月历 =====
const MOODS=['激动','平静','压力','难过'];
const MOOD_EMOJI={'激动':'🤩','平静':'😊','压力':'😣','难过':'😢'};
const MOOD_COLOR={'激动':'#ea580c','平静':'#16a34a','压力':'#7c3aed','难过':'#e11d48'};
let calMonth=new Date();calMonth.setDate(1);
function renderMood(){
  const m=db.mood[todayKey()]||'';
  document.querySelectorAll('.mood-item').forEach(el=>{
    el.classList.toggle('on',el.dataset.mood===m);
  });
  let streak=0,d=new Date();
  for(;;){const k=dateKey(d);if(db.mood[k]){streak++;d=new Date(d.getTime()-86400000)}else break}
  document.getElementById('moodStreak').textContent='连续打卡 '+streak+' 天';
}
function renderCalendar(){
  const y=calMonth.getFullYear(),mo=calMonth.getMonth();
  document.getElementById('calTitle').textContent=y+'年'+(mo+1)+'月';
  const first=new Date(y,mo,1);const startDow=first.getDay();
  const daysInMonth=new Date(y,mo+1,0).getDate();
  const grid=document.getElementById('calendar');grid.innerHTML='';
  ['日','一','二','三','四','五','六'].forEach(w=>grid.insertAdjacentHTML('beforeend','<div class="cal-dow">'+w+'</div>'));
  for(let i=0;i<startDow;i++)grid.insertAdjacentHTML('beforeend','<div class="cal-cell empty"></div>');
  for(let dd=1;dd<=daysInMonth;dd++){
    const date=new Date(y,mo,dd);const k=dateKey(date);
    const mood=db.mood[k];
    const isToday=k===todayKey();
    let style='';
    if(mood){const c=MOOD_COLOR[mood];style='background:'+c+'1f;border-color:'+c+';color:'+c}
    grid.insertAdjacentHTML('beforeend','<div class="cal-cell '+(isToday?'today':'')+'" style="'+style+'">'+dd+'<span class="cal-emoji">'+(mood?MOOD_EMOJI[mood]:'')+'</span></div>');
  }
  const lg=document.getElementById('calLegend');
  lg.innerHTML=MOODS.map(function(m){return '<span class="lg-item"><i class="lg-dot" style="background:'+MOOD_COLOR[m]+'"></i>'+m+'</span>'}).join('');
}
document.querySelectorAll('.mood-item').forEach(el=>{
  el.onclick=()=>{
    const cur=db.mood[todayKey()];
    if(cur===el.dataset.mood){delete db.mood[todayKey()]}
    else{db.mood[todayKey()]=el.dataset.mood}
    save();renderMood();renderCalendar();renderOverview();
  }
});
document.getElementById('calPrev').onclick=()=>{calMonth.setMonth(calMonth.getMonth()-1);renderCalendar()};
document.getElementById('calNext').onclick=()=>{calMonth.setMonth(calMonth.getMonth()+1);renderCalendar()};

// ===== 反思 =====
function renderReflect(){
  const k=todayKey();
  const r=db.reflect[k]||'';
  document.getElementById('reflectInput').value=r;
  document.getElementById('reflectDate').textContent=k;
  document.getElementById('reflectCount').textContent=r.length+'/200';
}
const rInp=document.getElementById('reflectInput');
rInp.addEventListener('input',()=>{
  db.reflect[todayKey()]=rInp.value;save();
  document.getElementById('reflectCount').textContent=rInp.value.length+'/200';
});

// ===== 新开秋招List（数据源：腾讯文档《招聘信息汇总表》快照 jobs.json）=====
async function syncJobsFromCloud(){
  try{
    const r=await fetch('./jobs.json',{cache:'no-store'});
    if(!r.ok)throw 0;
    const data=await r.json();
    db.jobs=data.jobs||[];
    db.jobsMeta={latestDate:data.latestDate,count:data.count,syncedAt:data.syncedAt};
    renderJobs();
  }catch(e){}
}
function renderJobs(){
  const list=document.getElementById('jobsList');
  const empty=document.getElementById('jobsEmpty');
  const dateEl=document.getElementById('jobsDate');
  const jobs=db.jobs||[];
  if(!jobs.length){list.innerHTML='';empty.style.display='block';dateEl.textContent='--';return}
  empty.style.display='none';
  const meta=db.jobsMeta||{};
  dateEl.textContent=meta.latestDate?('最新 '+meta.latestDate+' · '+jobs.length+'条'):(jobs.length+'条');
  list.innerHTML='';
  jobs.forEach(j=>{
    const li=document.createElement('div');
    li.className='job-item';
    const cat=j.category||'';
    const catTag=cat?'<span class="job-cat">'+cat+'</span>':'';
    const co=j.link?('<a class="job-co" href="'+j.link+'" target="_blank"></a>'):'<div class="job-co"></div>';
    li.innerHTML=co+'<div class="job-main"></div>'+catTag;
    li.querySelector('.job-co').textContent=j.company||'—';
    li.querySelector('.job-main').innerHTML=
      '<div class="job-pos">'+(j.position||'—')+'</div>'+
      '<div class="job-meta">'+(j.city||'多地')+' · '+(j.edu||'')+' · '+(j.session||'')+'</div>'+
      (j.deadline&&j.deadline!=='/'?'<div class="job-dl">截止 '+j.deadline+'</div>':'');
    list.appendChild(li);
  });
}

// ===== 周记 =====
function weekKey(d){
  const dt=new Date(d||Date.now());
  const day=dt.getDay()||7;
  dt.setDate(dt.getDate()-day+1);
  return dateKey(dt);
}
function weekLabel(k){
  const [y,m,d]=k.split('-').map(Number);
  const m1=new Date(y,m-1,d);
  const m7=new Date(y,m-1,d+6);
  return (m1.getMonth()+1)+'.'+m1.getDate()+'-'+(m7.getMonth()+1)+'.'+m7.getDate();
}
function renderWeek(){
  const k=weekKey();
  const wk=db.weeks[k]||{apply:'',review:'',summary:'',report:''};
  db.weeks[k]=wk;
  document.getElementById('wkApply').value=wk.apply||'';
  document.getElementById('wkReview').value=wk.review||'';
  document.getElementById('wkSummary').value=wk.summary||'';
  document.getElementById('weekSub').textContent='第'+weekLabel(k)+'周';
  const out=document.getElementById('wkOutput');
  out.innerHTML=wk.report?wk.report.replace(/\n/g,'<br>'):'';
  const dow=new Date().getDay();
  document.getElementById('weekReminder').style.display=(dow===5||dow===6)?'block':'none';
  const arch=document.getElementById('wkArch');
  arch.innerHTML='';
  const keys=Object.keys(db.weeks).sort().reverse();
  let hasAny=false;
  keys.forEach(wkk=>{
    const w=db.weeks[wkk];
    if(!w||!w.report)return;
    hasAny=true;
    const li=document.createElement('li');
    li.className='wk-arch-item';
    li.innerHTML='<span class="wk-arch-date">第'+weekLabel(wkk)+'周</span><span class="wk-arch-preview">'+(w.report.slice(0,28).replace(/\n/g,' '))+'…</span>';
    li.onclick=()=>{showArchWeek(wkk)};
    arch.appendChild(li);
  });
  if(!hasAny)arch.innerHTML='<li class="empty">还没有生成的周记</li>';
}
function showArchWeek(k){
  const w=db.weeks[k];if(!w||!w.report)return;
  const out=document.getElementById('wkOutput');
  out.innerHTML='<div class="wk-arch-title">第'+weekLabel(k)+'周周记</div>'+w.report.replace(/\n/g,'<br>');
  out.scrollIntoView({behavior:'smooth'});
}
['wkApply','wkReview','wkSummary'].forEach(id=>{
  document.getElementById(id).addEventListener('input',()=>{
    const k=weekKey();
    const w=db.weeks[k]||(db.weeks[k]={apply:'',review:'',summary:'',report:''});
    w[id.slice(2).toLowerCase()]=document.getElementById(id).value;
    save();
  });
});
document.getElementById('wkGen').onclick=()=>{
  const k=weekKey();
  const w=db.weeks[k]||{};
  w.apply=document.getElementById('wkApply').value.trim();
  w.review=document.getElementById('wkReview').value.trim();
  w.summary=document.getElementById('wkSummary').value.trim();
  // 计算本周投递核心指标
  const [yy,mm,dd]=k.split('-').map(Number);
  const m1=new Date(yy,mm-1,dd);
  const m7=new Date(yy,mm-1,dd+6);
  const weekApps=db.applications.filter(a=>{
    if(!a.date)return false;
    const [y2,m2,d2]=a.date.split('-').map(Number);
    const dt=new Date(y2,m2-1,d2);
    return dt>=m1&&dt<=m7;
  });
  const wkCount=weekApps.length;
  const total=db.applications.length;
  const stat={};APPLY_STATUSES.forEach(s=>stat[s]=0);
  weekApps.forEach(a=>{if(stat[a.status]!==undefined)stat[a.status]++});
  const hl=(n,label)=>'<b class="hl">'+n+'</b> '+label;
  let report='【第'+weekLabel(k)+'周 · 秋招周报】\n\n';
  report+='一、投递进度\n';
  report+='本周新增投递 '+hl(wkCount,'家')+'，累计投递 '+hl(total,'家')+'。\n';
  const dist=APPLY_STATUSES.filter(s=>stat[s]>0).map(s=>hl(stat[s],s)).join('、');
  report+='本周状态分布：'+(dist||'暂无')+'。\n';
  report+='复盘要点：'+(w.apply||'（未填写）')+'\n\n';
  report+='二、面试/投递复盘\n'+(w.review||'（未填写）')+'\n\n';
  report+='三、本周经验总结\n'+(w.summary||'（未填写）')+'\n';
  w.report=report;save();
  document.getElementById('wkOutput').innerHTML=report.replace(/\n/g,'<br>');
};
let wkArchOpen=false;
document.getElementById('wkToggleArch').onclick=()=>{
  wkArchOpen=!wkArchOpen;
  document.getElementById('wkArch').style.display=wkArchOpen?'block':'none';
};
document.getElementById('wkArch').style.display='none';

renderAll();
syncJobsFromCloud();
syncApplyFromCloud();
document.getElementById('syncDocBtn').onclick=()=>{
  const badge=document.getElementById('feishuBadge');
  if(badge)badge.textContent='同步中...';
  Promise.all([syncApplyFromCloud(),syncJobsFromCloud()]).then(()=>{
    alert('✅ 同步完成！\n\n投递数据已从腾讯文档《2027秋招fighting》更新。\n招聘信息已从《招聘信息汇总表》更新。');
  }).catch(()=>{
    alert('同步失败，请稍后重试。\n\n提示：每小时整点会自动同步，或对我说「同步投递」触发。');
  });
};

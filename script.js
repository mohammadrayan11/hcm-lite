/* ===== CONFIG: paste Supabase URL + anon key to switch from localStorage to Supabase ===== */
const CFG={url:'https://fehjjgdxgwggzqfkzyxu.supabase.co',key:'sb_publishable_YCvVYkJlKI9XXX6sJcosoQ_doh-vLvR',roles:{'hr@hcm.com':'hr','manager@hcm.com':'manager','employee@hcm.com':'employee'}};
const sb=(CFG.url&&CFG.key&&window.supabase)?supabase.createClient(CFG.url,CFG.key,{auth:{storage:window.sessionStorage}}):null;

/* ===== storage: Supabase table hcm_kv(k text primary key, v jsonb) or localStorage ===== */
const store={
 async get(k,d){ if(sb){try{const{data,error}=await sb.from('hcm_kv').select('v').eq('k',k).maybeSingle();if(error)throw error;return data?data.v:d}catch(x){if(!store.warned){store.warned=1;setTimeout(()=>toast('Supabase read failed: '+(x.message||x)),300)}return d}}
  try{return JSON.parse(localStorage.getItem('hcm_'+k))??d}catch{return d} },
 async set(k,v){ if(sb){try{const{error}=await sb.from('hcm_kv').upsert({k,v});if(error)throw error}catch(x){toast('Supabase save failed: '+(x.message||x))}}else localStorage.setItem('hcm_'+k,JSON.stringify(v)) }
};
const S={employees:[],attendance:[],leaves:[],notes:[],payroll:[]};
const save=k=>store.set(k,S[k]);
let me=null,page='dash';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ymd=d=>new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
const today=()=>ymd(new Date());
const hm=d=>d.toTimeString().slice(0,5);
const uid=()=>Math.random().toString(36).slice(2,9);
const money=n=>'PKR '+Math.round(n).toLocaleString();
const $=id=>document.getElementById(id);
function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2400)}
const isWork=d=>![0,6].includes(d.getDay());
function workdays(a,b){let n=0;for(let d=new Date(a+'T00:00');d<=new Date(b+'T00:00');d.setDate(d.getDate()+1))if(isWork(d))n++;return n}
const QUOTA={annual:14,sick:8,casual:10};
const myEmp=()=>S.employees.find(e=>e.email===me.email);
const onLeave=(eid,date)=>S.leaves.some(l=>l.eid===eid&&l.status==='approved'&&l.start<=date&&l.end>=date);
function used(eid,t){return S.leaves.filter(l=>l.eid===eid&&l.type===t&&l.status==='approved').reduce((s,l)=>s+l.days,0)}

/* ===== auth: 3 emails -> 3 panels ===== */
const seed={'hr@hcm.com':{pw:'123456',role:'hr'},'manager@hcm.com':{pw:'123456',role:'manager'},'employee@hcm.com':{pw:'123456',role:'employee'}};
const roleOf=u=>{const r=u.user_metadata?.role;return['hr','manager','employee'].includes(r)?r:(CFG.roles[u.email]||'employee')};
async function doLogin(email,pw){
 email=email.trim().toLowerCase();
 if(sb){const{data,error}=await sb.auth.signInWithPassword({email,password:pw});if(error)throw error;
  return{email,role:roleOf(data.user),name:data.user.user_metadata?.name}}
 let u=await store.get('users',null);if(!u){u=seed;await store.set('users',u)}
 if(!u[email]||u[email].pw!==pw)throw new Error('Wrong email or password.');
 return{email,role:u[email].role,name:u[email].name};
}
async function doSignup(name,email,pw,role){
 email=email.trim().toLowerCase();name=name.trim();
 if(pw.length<6)throw new Error('Password must be at least 6 characters.');
 if(sb){const{data,error}=await sb.auth.signUp({email,password:pw,options:{data:{name,role}}});if(error)throw error;
  if(!data.session)return{confirm:true};return{email,role,name}}
 const u=(await store.get('users',null))||seed;
 if(u[email])throw new Error('This email already has an account. Please sign in.');
 u[email]={pw,role,name};await store.set('users',u);return{email,role,name};
}
async function enter(user){
 me=user;sessionStorage.setItem('hcm_session',JSON.stringify(user));
 for(const k of Object.keys(S)){S[k]=await store.get(k,[]);if(!Array.isArray(S[k]))S[k]=[]}
 if(!S.employees.length)await seedDemo();
 if(me.role==='employee'&&!S.employees.some(e=>e.email===me.email)){S.employees.push({id:uid(),code:'EMP-'+String(S.employees.length+1).padStart(3,'0'),name:me.name||me.email.split('@')[0],email:me.email,dept:'General',designation:'Staff',basic:40000,joined:today()});await save('employees')}
 page='dash';$('login').classList.add('hidden');$('app').classList.remove('hidden');
 document.documentElement.style.setProperty('--acc',`var(--${me.role})`);
 $('badge').textContent={hr:'HR',manager:'Manager',employee:'Employee'}[me.role];
 draw();
}
async function logout(){if(sb)await sb.auth.signOut();sessionStorage.removeItem('hcm_session');location.reload()}
$('lf').onsubmit=async e=>{e.preventDefault();$('err').textContent='';$('lb').disabled=true;
 try{await enter(await doLogin($('em').value,$('pw').value))}catch(x){$('err').textContent=x.message||'Could not sign in.'}$('lb').disabled=false};
function showTab(t){$('lf').classList.toggle('hidden',t!=='in');$('sf').classList.toggle('hidden',t!=='up');$('tin').classList.toggle('on',t==='in');$('tup').classList.toggle('on',t==='up');$('err').textContent='';$('su_err').textContent=''}
$('sf').onsubmit=async e=>{e.preventDefault();$('su_err').textContent='';$('su_btn').disabled=true;
 try{const r=await doSignup($('su_name').value,$('su_email').value,$('su_pw').value,$('su_role').value);
  if(r.confirm){showTab('in');$('err').style.color='#12683f';$('err').textContent='Account created. Check your email to confirm it, then sign in.'}else await enter(r)}
 catch(x){$('su_err').textContent=x.message||'Could not create account.'}$('su_btn').disabled=false};
$('mode').textContent=sb?'Connected to Supabase':'Saving in this browser (localStorage)';
$('roles').innerHTML=[['hr','HR','Registers staff, approves leave','hr@hcm.com'],['manager','Manager','Reports and payroll','manager@hcm.com'],['employee','Employee','Check in, apply for leave','employee@hcm.com']]
 .map(r=>`<button type="button" class="rolebtn" onclick="em.value='${r[3]}';pw.value='123456';pw.focus()"><span class="dot" style="background:var(--${r[0]})"></span><span><b>${r[1]}</b><small>${r[2]}</small></span></button>`).join('');

/* ===== layout ===== */
const NAV={hr:[['dash','Dashboard'],['emp','Employees'],['att','Attendance'],['leave','Leave requests'],['news','Announcements']],
 manager:[['dash','Overview'],['emp','Employees'],['att','Attendance'],['pay','Payroll'],['news','Announcements']],
 employee:[['dash','My day'],['att','My attendance'],['leave','My leave'],['slip','Payslip'],['news','Announcements']]};
function draw(){
 $('nav').innerHTML=NAV[me.role].map(n=>`<a class="${n[0]===page?'on':''}" onclick="go('${n[0]}')">${n[1]}</a>`).join('');
 const fn=PAGES[page]||PAGES.dash;
 try{$('main').innerHTML=fn()}catch(x){console.error(x);$('main').innerHTML='<div class="card"><h3>This page could not open</h3><p class="sub">'+esc(x.message)+'</p><div class="actions"><button class="btn" onclick="go(\'dash\')">Go to dashboard</button></div></div>'}
}
const go=p=>{page=p;draw()};
const head=(t,s)=>`<h2>${t}</h2><p class="sub">${s}</p>`;
const kpi=(n,l)=>`<div class="kpi"><b>${n}</b><span>${l}</span></div>`;
const empty=t=>`<div class="empty">${t}</div>`;
const tagFor=s=>`<span class="tag ${{present:'ok',approved:'ok',late:'warn',pending:'warn',half_day:'warn',on_leave:'ok',rejected:'bad',absent:'bad'}[s]||''}">${s.replace('_',' ')}</span>`;
function statusOf(e,date){
 const r=S.attendance.find(a=>a.eid===e.id&&a.date===date);
 if(r)return r.status;if(onLeave(e.id,date))return'on_leave';if(!isWork(new Date(date+'T00:00')))return'weekend';return'absent';
}

/* ===== pages ===== */
const PAGES={
 dash(){
  if(me.role==='employee')return empDash();
  const t=today(),n=S.employees.length;
  const present=S.employees.filter(e=>['present','late','half_day'].includes(statusOf(e,t))).length;
  const lv=S.employees.filter(e=>onLeave(e.id,t)).length,late=S.employees.filter(e=>statusOf(e,t)==='late').length;
  const pend=S.leaves.filter(l=>l.status==='pending').length;
  const dept={};S.employees.forEach(e=>dept[e.dept]=(dept[e.dept]||0)+1);const mx=Math.max(1,...Object.values(dept));
  const k=me.role==='hr'?kpi(pend,'Pending leave requests'):kpi(money(S.employees.reduce((s,e)=>s+e.basic*1.5,0)),'Monthly gross payroll');
  return head(me.role==='hr'?'HR dashboard':'Company overview','Numbers come from what people enter in the app.')+
  `<div class="grid">${kpi(n,'Headcount')}${kpi(present,'Present today')}${kpi(lv,'On leave')}${kpi(late,'Late today')}${k}</div>
  <div class="card"><h3>Headcount by department</h3>${n?Object.entries(dept).map(([d,c])=>`<div class="bar"><span style="width:120px">${esc(d)}</span><i style="width:${c/mx*60}%"></i><b>${c}</b></div>`).join(''):empty('No employees yet. HR can register the first one.')}</div>`;
 },
 emp(){
  const canEdit=me.role==='hr';
  const form=canEdit?`<div class="card"><h3>Register employee</h3><form onsubmit="addEmp(event)"><div class="row">
   <div><label>Full name</label><input id="n" required></div><div><label>Email</label><input id="e" type="email" required></div>
   <div><label>Department</label><input id="d" required></div><div><label>Designation</label><input id="g" required></div>
   <div><label>Basic salary</label><input id="b" type="number" min="1" required></div><div><label>Joining date</label><input id="j" type="date" value="${today()}" required></div></div>
   <div class="actions"><button class="btn">Register employee</button><button type="button" class="btn ghost" onclick="resetDemo()">Reload demo data</button></div><p class="sub" style="margin:10px 0 0">Creates a login with the temporary password Temp@123.</p></form></div>`:'';
  return head('Employees',canEdit?'Register and manage your team.':'Everyone on the team.')+form+
  `<div class="card tw">${S.employees.length?`<table><tr><th>Code</th><th>Name</th><th>Email</th><th>Department</th><th>Designation</th><th>Basic</th>${canEdit?'<th></th>':''}</tr>`+
  S.employees.map(e=>`<tr><td>${e.code}</td><td>${esc(e.name)}</td><td>${esc(e.email)}</td><td>${esc(e.dept)}</td><td>${esc(e.designation)}</td><td>${money(e.basic)}</td>${canEdit?`<td><button class="btn bad sm" onclick="delEmp('${e.id}')">Remove</button></td>`:''}</tr>`).join('')+'</table>':empty('No employees registered yet.')}</div>`;
 },
 att(){
  if(me.role==='employee'){const e=myEmp();const rs=S.attendance.filter(a=>e&&a.eid===e.id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
   return head('My attendance','Your last 30 records.')+`<div class="card tw">${rs.length?'<table><tr><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th></tr>'+rs.map(r=>`<tr><td>${r.date}</td><td>${r.in||'-'}</td><td>${r.out||'-'}</td><td>${r.hours??'-'}</td><td>${tagFor(r.status)}</td></tr>`).join('')+'</table>':empty('No attendance yet. Check in from My day.')}</div>`}
  const t=today();
  return head('Attendance board','Today, '+t)+`<div class="card tw">${S.employees.length?'<table><tr><th>Employee</th><th>Department</th><th>In</th><th>Out</th><th>Status</th></tr>'+S.employees.map(e=>{const r=S.attendance.find(a=>a.eid===e.id&&a.date===t)||{};
   return `<tr><td>${esc(e.name)}</td><td>${esc(e.dept)}</td><td>${r.in||'-'}</td><td>${r.out||'-'}</td><td>${tagFor(statusOf(e,t))}</td></tr>`}).join('')+'</table>':empty('No employees yet.')}</div>`;
 },
 leave(){
  const E=id=>S.employees.find(e=>e.id===id)||{name:'Unknown'};
  if(me.role==='employee'){const e=myEmp();if(!e)return noProfile();
   const mine=S.leaves.filter(l=>l.eid===e.id).reverse();
   return head('My leave','Weekends are skipped automatically.')+
   `<div class="grid">${Object.keys(QUOTA).map(t=>kpi(QUOTA[t]-used(e.id,t),t+' days left')).join('')}</div>
   <div class="card"><h3>Apply for leave</h3><form onsubmit="applyLeave(event)"><div class="row">
   <div><label>Type</label><select id="lt"><option>annual</option><option>sick</option><option>casual</option><option>unpaid</option></select></div>
   <div><label>From</label><input id="ls" type="date" required min="${today()}"></div><div><label>To</label><input id="le" type="date" required min="${today()}"></div></div>
   <label>Reason</label><textarea id="lr" rows="2" required></textarea><div class="actions"><button class="btn">Send request</button></div></form></div>
   <div class="card tw"><h3>History</h3>${mine.length?'<table><tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>HR comment</th><th></th></tr>'+mine.map(l=>`<tr><td>${l.type}</td><td>${l.start} to ${l.end}</td><td>${l.days}</td><td>${tagFor(l.status)}</td><td>${esc(l.comment||'')}</td><td>${l.status==='pending'?`<button class="btn ghost sm" onclick="decide('${l.id}','cancelled')">Cancel</button>`:''}</td></tr>`).join('')+'</table>':empty('No requests yet.')}</div>`}
  const pend=S.leaves.filter(l=>l.status==='pending');
  return head('Leave requests','Approve or reject with a comment.')+`<div class="card tw"><h3>Waiting for a decision</h3>${pend.length?'<table><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Comment</th><th></th></tr>'+pend.map(l=>`<tr><td>${esc(E(l.eid).name)}</td><td>${l.type}</td><td>${l.start} to ${l.end}</td><td>${l.days}</td><td>${esc(l.reason)}</td><td><input id="c${l.id}" placeholder="Optional"></td><td style="white-space:nowrap"><button class="btn sm" onclick="decide('${l.id}','approved')">Approve</button> <button class="btn bad sm" onclick="decide('${l.id}','rejected')">Reject</button></td></tr>`).join('')+'</table>':empty('Nothing pending.')}</div>
  <div class="card tw"><h3>Decided</h3>${S.leaves.filter(l=>l.status!=='pending').length?'<table><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Status</th></tr>'+S.leaves.filter(l=>l.status!=='pending').reverse().map(l=>`<tr><td>${esc(E(l.eid).name)}</td><td>${l.type}</td><td>${l.start} to ${l.end}</td><td>${tagFor(l.status)}</td></tr>`).join('')+'</table>':empty('No decisions yet.')}</div>`;
 },
 pay(){
  const m=$('pm')?.value||today().slice(0,7);const run=S.payroll.find(p=>p.month===m);const rows=run?run.rows:calcPay(m);
  return head('Payroll','Gross = 1.5 x basic. Absent, unpaid and half days are deducted; tax uses the annual slab.')+
  `<div class="card"><div class="row" style="align-items:end"><div><label>Month</label><input id="pm" type="month" value="${m}" onchange="go('pay')"></div>
  <div>${run?'<span class="tag ok">Finalized and locked</span>':rows.length?'<button class="btn" onclick="finalize()">Finalize month</button>':''}</div></div></div>
  <div class="card tw">${rows.length?'<table><tr><th>Employee</th><th>Gross</th><th>Deductions</th><th>Tax</th><th>Net pay</th></tr>'+rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${money(r.gross)}</td><td>${money(r.ded)}</td><td>${money(r.tax)}</td><td><b>${money(r.net)}</b></td></tr>`).join('')+`<tr><td><b>Total</b></td><td>${money(rows.reduce((s,r)=>s+r.gross,0))}</td><td></td><td></td><td><b>${money(rows.reduce((s,r)=>s+r.net,0))}</b></td></tr></table>`:empty('Register employees to run payroll.')}</div>`;
 },
 slip(){
  const e=myEmp();if(!e)return noProfile();const runs=S.payroll.slice().reverse();
  const mine=runs.map(p=>({month:p.month,r:p.rows.find(r=>r.eid===e.id)})).filter(x=>x.r);
  return head('Payslip','Available after your manager finalizes the month.')+(mine.length?mine.map(x=>`<div class="card"><h3>${x.month}</h3><p>${esc(e.name)}, ${esc(e.designation)}</p><table><tr><td>Gross</td><td>${money(x.r.gross)}</td></tr><tr><td>Deductions</td><td>${money(x.r.ded)}</td></tr><tr><td>Tax</td><td>${money(x.r.tax)}</td></tr><tr><td><b>Net pay</b></td><td><b>${money(x.r.net)}</b></td></tr></table><div class="actions"><button class="btn ghost" onclick="print()">Print or save as PDF</button></div></div>`).join(''):`<div class="card">${empty('No payslip yet.')}</div>`);
 },
 news(){
  const can=me.role!=='employee';
  return head('Announcements','Visible to everyone on the team.')+(can?`<div class="card"><form onsubmit="addNews(event)"><label>Title</label><input id="nt" required><label>Message</label><textarea id="nb" rows="3" required></textarea><div class="actions"><button class="btn">Post announcement</button></div></form></div>`:'')+
  (S.notes.length?S.notes.slice().reverse().map(n=>`<div class="card"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><p class="sub" style="margin:8px 0 0">${n.by}, ${n.date}</p></div>`).join(''):`<div class="card">${empty('No announcements yet.')}</div>`);
 }
};
const noProfile=()=>`<div class="card">${empty('HR has not registered '+esc(me.email)+' yet. Ask HR to add you under Employees.')}</div>`;

function empDash(){
 const e=myEmp();if(!e)return head('My day','')+noProfile();
 const t=today(),r=S.attendance.find(a=>a.eid===e.id&&a.date===t);
 const wk=new Date();wk.setDate(wk.getDate()-((wk.getDay()+6)%7));const w0=ymd(wk);
 const hrs=S.attendance.filter(a=>a.eid===e.id&&a.date>=w0).reduce((s,a)=>s+(a.hours||0),0);
 const late=S.attendance.filter(a=>a.eid===e.id&&a.status==='late').length;
 const left=Object.keys(QUOTA).reduce((s,k)=>s+QUOTA[k]-used(e.id,k),0);
 setTimeout(tick,0);
 return head('Hello, '+esc(e.name.split(' ')[0]),e.designation+', '+e.dept)+
 `<div class="card"><div class="clock" id="clk"></div><p class="sub" style="margin:0">${r?(r.out?'You checked out at '+r.out+'.':'You checked in at '+r.in+' ('+r.status+').'):'You have not checked in today.'}</p>
 <div class="actions"><button class="btn" onclick="checkIn()" ${r?'disabled':''}>Check in</button><button class="btn ghost" onclick="checkOut()" ${!r||r.out?'disabled':''}>Check out</button></div></div>
 <div class="grid">${kpi(hrs.toFixed(1)+' / 40','Hours this week')}${kpi(late,'Late arrivals')}${kpi(left,'Leave days left')}</div>
 <div class="card"><h3>Latest announcement</h3>${S.notes.length?`<b>${esc(S.notes.at(-1).title)}</b><p>${esc(S.notes.at(-1).body)}</p>`:empty('No announcements yet.')}</div>`;
}
function tick(){const c=$('clk');if(!c)return;c.textContent=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});setTimeout(tick,1000)}

/* ===== actions ===== */
async function addEmp(ev){ev.preventDefault();const email=$('e').value.trim().toLowerCase();
 if(S.employees.some(x=>x.email===email))return toast('That email is already registered.');
 const code='EMP-'+String(S.employees.length+1).padStart(3,'0');
 S.employees.push({id:uid(),code,name:$('n').value.trim(),email,dept:$('d').value.trim(),designation:$('g').value.trim(),basic:+$('b').value,joined:$('j').value});
 await save('employees');
 if(!sb){const u=await store.get('users',seed);if(!u[email]){u[email]={pw:'Temp@123',role:'employee'};await store.set('users',u)}}
 toast('Registered '+code);draw()}
async function delEmp(id){if(!confirm('Remove this employee?'))return;S.employees=S.employees.filter(e=>e.id!==id);await save('employees');draw()}
async function checkIn(){const e=myEmp(),n=new Date();if(S.attendance.some(a=>a.eid===e.id&&a.date===today()))return toast('Already checked in today.');
 const t=hm(n);S.attendance.push({id:uid(),eid:e.id,date:today(),in:t,out:null,hours:null,status:t>'09:15'?'late':'present'});await save('attendance');toast('Checked in at '+t);draw()}
async function checkOut(){const e=myEmp(),r=S.attendance.find(a=>a.eid===e.id&&a.date===today());if(!r||r.out)return;
 const n=new Date(),t=hm(n),h=((+t.slice(0,2)*60+ +t.slice(3))-(+r.in.slice(0,2)*60+ +r.in.slice(3)))/60;
 r.out=t;r.hours=+h.toFixed(1);if(h<5)r.status='half_day';await save('attendance');toast('Checked out at '+t);draw()}
async function applyLeave(ev){ev.preventDefault();const e=myEmp(),type=$('lt').value,s=$('ls').value,en=$('le').value;
 if(en<s)return toast('End date is before start date.');const days=workdays(s,en);
 if(!days)return toast('Those dates have no working days.');
 if(S.leaves.some(l=>l.eid===e.id&&['pending','approved'].includes(l.status)&&l.start<=en&&l.end>=s))return toast('Overlaps with another request.');
 if(type!=='unpaid'&&days>QUOTA[type]-used(e.id,type))return toast('Not enough '+type+' leave left.');
 S.leaves.push({id:uid(),eid:e.id,type,start:s,end:en,days,reason:$('lr').value.trim(),status:'pending',comment:''});await save('leaves');toast('Request sent to HR');draw()}
async function decide(id,st){const l=S.leaves.find(x=>x.id===id);l.status=st;const c=$('c'+id);if(c)l.comment=c.value;await save('leaves');toast('Leave '+st);draw()}
async function addNews(ev){ev.preventDefault();S.notes.push({title:$('nt').value.trim(),body:$('nb').value.trim(),by:me.role,date:today()});await save('notes');toast('Posted');draw()}

/* payroll */
const tax=a=>a<=6e5?0:a<=12e5?(a-6e5)*.05:a<=24e5?3e4+(a-12e5)*.15:a<=36e5?21e4+(a-24e5)*.25:51e4+(a-36e5)*.35;
function calcPay(m){
 const[y,mo]=m.split('-').map(Number),last=new Date(y,mo,0).getDate(),now=today();let wd=0;
 const days=[];for(let d=1;d<=last;d++){const dt=new Date(y,mo-1,d);if(isWork(dt)){wd++;days.push(ymd(dt))}}
 return S.employees.filter(e=>e.joined.slice(0,7)<=m).map(e=>{
  const gross=e.basic*1.5,per=gross/wd;let absent=0,unpaid=0,half=0;
  days.forEach(d=>{if(d>=now||d<e.joined)return;const a=S.attendance.find(x=>x.eid===e.id&&x.date===d);
   const lv=S.leaves.find(l=>l.eid===e.id&&l.status==='approved'&&l.start<=d&&l.end>=d);
   if(lv){if(lv.type==='unpaid')unpaid++}else if(!a)absent++;else if(a.status==='half_day')half++});
  const ded=(absent+unpaid+half*.5)*per,tx=tax(gross*12)/12;
  return{eid:e.id,name:e.name,gross,ded,tax:tx,net:gross-ded-tx}});
}
async function finalize(){const m=$('pm').value;if(!confirm('Finalize '+m+'? It cannot be edited afterwards.'))return;
 S.payroll.push({month:m,rows:calcPay(m),by:me.email});await save('payroll');toast('Payroll finalized');draw()}

/* ===== demo data (24 employees, 70 days of attendance, leaves, payroll) ===== */
const DEMO=[
['Ayesha Khan','employee@hcm.com','Engineering','Frontend Developer',90000,'2025-02-10'],
['Bilal Ahmed','bilal@hcm.com','Engineering','Backend Developer',95000,'2024-11-01'],
['Hassan Ali','hassan@hcm.com','Engineering','Full Stack Developer',110000,'2024-03-12'],
['Noor Fatima','noor@hcm.com','Engineering','QA Engineer',75000,'2025-01-20'],
['Daniyal Sheikh','daniyal@hcm.com','Engineering','DevOps Engineer',120000,'2023-10-02'],
['Hira Aslam','hira@hcm.com','Engineering','Mobile Developer',100000,'2024-06-17'],
['Talha Mehmood','talha@hcm.com','Engineering','Junior Developer',55000,'2025-09-01'],
['Sana Malik','sana@hcm.com','Design','UI Designer',70000,'2025-03-17'],
['Zara Hussain','zara@hcm.com','Design','Brand Designer',72000,'2025-08-11'],
['Imran Qureshi','imran@hcm.com','Design','UX Researcher',80000,'2024-04-22'],
['Laiba Noman','laiba@hcm.com','Design','Motion Designer',68000,'2025-05-26'],
['Hamza Raza','hamza@hcm.com','Sales','Sales Executive',60000,'2025-06-02'],
['Usman Tariq','usman@hcm.com','Sales','Sales Lead',85000,'2024-05-20'],
['Maham Javed','maham@hcm.com','Sales','Account Manager',78000,'2024-08-05'],
['Rizwan Bhatti','rizwan@hcm.com','Sales','Sales Executive',58000,'2025-10-06'],
['Anum Farooq','anum@hcm.com','Sales','Business Developer',72000,'2024-12-09'],
['Mariam Siddiqui','mariam@hcm.com','HR','HR Officer',65000,'2024-09-15'],
['Kamran Yousuf','kamran@hcm.com','HR','Recruiter',62000,'2025-04-14'],
['Faisal Iqbal','faisal@hcm.com','Finance','Accountant',78000,'2024-07-08'],
['Rabia Anwar','rabia@hcm.com','Finance','Finance Analyst',88000,'2024-02-19'],
['Shahzaib Khan','shahzaib@hcm.com','Finance','Payroll Officer',66000,'2025-07-21'],
['Saad Mirza','saad@hcm.com','Operations','Operations Manager',115000,'2023-08-14'],
['Iqra Butt','iqra@hcm.com','Operations','Admin Officer',52000,'2025-02-24'],
['Adeel Rauf','adeel@hcm.com','Operations','Support Agent',48000,'2025-11-03']];
const off=n=>{const d=new Date();d.setDate(d.getDate()+n);return ymd(d)};
const hh=(a,b)=>+(((+b.slice(0,2)*60+ +b.slice(3))-(+a.slice(0,2)*60+ +a.slice(3)))/60).toFixed(1);
/* [employee number, type, start offset, end offset, reason, status, HR comment] */
const LV=[
[5,'casual',0,1,'Family visit','approved',''],[9,'sick',-1,1,'Fever and flu','approved','Get well soon'],
[12,'annual',-2,3,'Cousin wedding','approved','Enjoy'],[17,'casual',0,0,'Bank work','approved',''],
[3,'sick',-1,0,'Migraine','approved',''],[21,'annual',-1,2,'Family trip','approved',''],
[1,'casual',-14,-13,'Family event','approved','Enjoy'],[2,'sick',-8,-7,'Fever','approved','Get well soon'],
[6,'annual',-25,-21,'Umrah','approved','Safe travels'],[14,'unpaid',-20,-19,'Visa appointment','approved',''],
[8,'casual',-10,-10,'Personal work','approved',''],[11,'sick',-16,-15,'Dental surgery','approved',''],
[19,'annual',-35,-31,'Holiday','approved',''],[4,'casual',-5,-5,'Plumber at home','approved',''],
[13,'annual',8,12,'Trip to Hunza','pending',''],[7,'casual',3,3,'Passport office','pending',''],
[16,'sick',2,3,'Doctor appointment','pending',''],[22,'annual',10,14,'Sister wedding','pending',''],
[10,'casual',5,6,'Moving house','pending',''],[15,'annual',-30,-28,'Holiday','rejected','Project deadline, please reschedule'],
[20,'casual',-12,-12,'Personal','rejected','Short staff that day'],[24,'unpaid',-3,-2,'Family matter','approved','']];
async function seedDemo(){
 S.employees=DEMO.map((r,i)=>({id:'e'+(i+1),code:'EMP-'+String(i+1).padStart(3,'0'),name:r[0],email:r[1],dept:r[2],designation:r[3],basic:r[4],joined:r[5]}));
 S.leaves=LV.map((r,i)=>({id:'l'+(i+1),eid:'e'+r[0],type:r[1],start:off(r[2]),end:off(r[3]),reason:r[4],status:r[5],comment:r[6]}));
 S.leaves.forEach(l=>l.days=workdays(l.start,l.end));
 S.attendance=[];
 S.employees.forEach((e,i)=>{for(let n=-70;n<=0;n++){
  const date=off(n),d=new Date(date+'T00:00');
  if((!isWork(d)&&n<0)||date<e.joined||onLeave(e.id,date))continue;
  if(n===0&&e.email==='employee@hcm.com')continue;
  const r=(i*7+(n+100)*13)%11;let tin,tout,st;
  if(r<7){tin='09:0'+r;tout='17:'+String(10+r*4).padStart(2,'0');st='present'}
  else if(r<9){tin='09:'+(20+r);tout='17:45';st='late'}
  else if(r===9){tin='09:05';tout='13:40';st='half_day'}
  else continue;
  if(n===0){tout=null;if(st==='half_day')st='present'}
  S.attendance.push({id:uid(),eid:e.id,date,in:tin,out:tout,hours:tout?hh(tin,tout):null,status:st});
 }});
 S.notes=[{title:'Welcome to HCM Lite',body:'Check in every morning and apply for leave from the My leave page.',by:'hr',date:off(-30)},
  {title:'Eid holiday schedule',body:'The office will stay closed for the public holiday. Please plan your work before the break.',by:'manager',date:off(-9)},
  {title:'Fire drill on Thursday',body:'A short fire drill will take place at 11:00. Please follow the instructions of your floor warden.',by:'hr',date:off(-4)},
  {title:'Payroll cut-off',body:'Please submit any attendance corrections to HR before the last working day of the month.',by:'manager',date:off(-2)}];
 const t=new Date(),pm=ymd(new Date(t.getFullYear(),t.getMonth()-1,1)).slice(0,7);
 S.payroll=[{month:pm,rows:calcPay(pm),by:'manager@hcm.com'}];
 for(const k of Object.keys(S))await save(k);
 if(!sb){const u=await store.get('users',seed);DEMO.forEach(r=>{if(!u[r[1]])u[r[1]]={pw:'Temp@123',role:'employee'}});await store.set('users',u)}
 await store.set('seeded',true);
}
async function resetDemo(){if(!confirm('Replace all data with demo data?'))return;await seedDemo();toast('Demo data loaded');draw()}

/* page always opens on the sign-in screen; old sessions are cleared */
sessionStorage.removeItem('hcm_session');
if(sb)sb.auth.signOut();

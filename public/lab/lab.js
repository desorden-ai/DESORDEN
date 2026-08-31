(() => {
  'use strict';
  const API = '/lab/api';
  const SESSION_KEY = 'desorden_lab_office_session_v1';
  const REFRESH_MS = 15000;
  const state = { weekStart: startOfWeek(new Date()), agenda: [], photos: [], editingId: '', view: 'agenda' };
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  function text(v){return typeof v==='string'||typeof v==='number'?String(v).trim():''}
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c])}
  function startOfWeek(value){const d=new Date(value);d.setHours(0,0,0,0);const day=d.getDay()||7;d.setDate(d.getDate()-day+1);return d}
  function addDays(value,n){const d=new Date(value);d.setDate(d.getDate()+n);return d}
  function isoDate(value){const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function fmt(value,options){return new Intl.DateTimeFormat('es-ES',options).format(value)}

  function normalizeJob(raw){return{
    id:text(raw?.id||raw?.orderId||raw?.calendarEventId||raw?.sa),
    sa:text(raw?.sa||raw?.serviceAppointment||raw?.SA),date:text(raw?.date||raw?.DATA),time:text(raw?.time||raw?.HORA),
    type:text(raw?.type||raw?.TIPO)||'Avería',client:text(raw?.client||raw?.CLIENT),phone:text(raw?.phone||raw?.['TELÉFON']),
    address:text(raw?.address||raw?.['DIRECCIÓ']),city:text(raw?.city||raw?.['POBLACIÓ']),model:text(raw?.model||raw?.MODEL),
    state:text(raw?.state||raw?.status||raw?.ESTAT)||'Pendiente',priority:text(raw?.priority||raw?.PRIORITAT)||'Normal',
    observations:text(raw?.observations||raw?.notes||raw?.OBSERVACIONS),calendarEventId:text(raw?.calendarEventId||raw?.CALENDAR_EVENT_ID)
  }}
  function normalizePhoto(raw){return{
    id:text(raw?.id||raw?.photoId||raw?.PHOTO_ID),sa:text(raw?.sa||raw?.serviceAppointment||raw?.SA),workOrder:text(raw?.workOrder||raw?.ORDER_ID),
    url:text(raw?.fileUrl||raw?.FILE_URL||raw?.url||raw?.photoUrl),note:text(raw?.note||raw?.NOTE),timestamp:text(raw?.timestamp||raw?.TIMESTAMP||raw?.createdAt||raw?.CREATED_AT)
  }}

  async function api(path,options={}){
    const token=sessionStorage.getItem(SESSION_KEY)||'';
    const headers={Accept:'application/json',...(options.headers||{})};
    if(options.body!==undefined&&!headers['Content-Type'])headers['Content-Type']='application/json';
    if(token)headers.Authorization=`Bearer ${token}`;
    let response;
    try{response=await fetch(`${API}${path}`,{...options,headers})}catch(error){setConnection(false);throw error}
    const body=await response.text();let data={};try{data=body?JSON.parse(body):{}}catch{data={}}
    if(response.status===401&&path!=='/auth/login'){sessionStorage.removeItem(SESSION_KEY);showLogin('La sesión ha caducado.');throw new Error('Sesión expirada')}
    if(!response.ok||data?.ok===false)throw new Error(data?.error||`HTTP ${response.status}`);
    setConnection(true);return data;
  }

  function setConnection(ok){const el=$('#connection-state');if(!el)return;el.className=`connection ${ok?'ok':'error'}`;el.textContent=ok?'● CONECTADO':'● SIN CONEXIÓN'}
  let feedbackTimer=0;
  function feedback(title,detail='',duration=2300){clearTimeout(feedbackTimer);const box=$('#global-feedback');if(!box)return;$('#feedback-title').textContent=title;$('#feedback-detail').textContent=detail;box.hidden=false;if(duration)feedbackTimer=setTimeout(()=>{box.hidden=true},duration)}
  function showLogin(message=''){const shell=$('#app-shell');const login=$('#login-screen');if(shell)shell.hidden=true;if(login)login.hidden=false;$('#login-message').textContent=message}
  function enterApp(){const shell=$('#app-shell');const login=$('#login-screen');if(login)login.hidden=true;if(shell)shell.hidden=false;void refreshAll()}

  async function handleLogin(event){event.preventDefault();const button=$('#login-submit-btn');button.disabled=true;$('#login-message').textContent='Verificando…';try{
    const result=await api('/auth/login',{method:'POST',body:JSON.stringify({username:$('#login-user').value.trim(),password:$('#login-pass').value})});
    const token=result.sessionToken||result.token;if(!token)throw new Error('Sesión no válida');sessionStorage.setItem(SESSION_KEY,token);$('#login-message').textContent='';enterApp();
  }catch(error){$('#login-message').textContent=error instanceof Error?error.message:'No se ha podido iniciar sesión'}finally{button.disabled=false}}
  function logout(){sessionStorage.removeItem(SESSION_KEY);showLogin()}
  function switchView(name){state.view=name;$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===name));$$('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==name);$('#view-title').textContent=name==='agenda'?'AGENDA':'FOTOS';if(name==='agenda')void loadAgenda();else void loadPhotos()}

  async function loadAgenda(silent=false){const status=$('#agenda-status');if(status&&!silent)status.textContent='Cargando…';try{
    const payload=await api('/agenda');const rows=Array.isArray(payload)?payload:payload?.rows||payload?.items||[];state.agenda=rows.map(normalizeJob).filter(j=>j.sa||j.client||j.date);state.agenda.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.time||'99:99').localeCompare(b.time||'99:99'));renderWeek();renderMetrics();if(status)status.textContent=`${state.agenda.length} trabajos`;
  }catch(error){if(!silent){state.agenda=[];renderWeek();renderMetrics()}if(status)status.textContent=error instanceof Error?error.message:'Error de agenda'}}

  function renderWeek(){const end=addDays(state.weekStart,6);$('#week-range').textContent=`${fmt(state.weekStart,{day:'2-digit',month:'short'})} — ${fmt(end,{day:'2-digit',month:'short',year:'numeric'})}`.toUpperCase();const today=isoDate(new Date());
    $('#week-grid').innerHTML=Array.from({length:7},(_,i)=>{const day=addDays(state.weekStart,i);const key=isoDate(day);const rows=state.agenda.filter(j=>j.date===key);return `<section class="day-column ${key===today?'today':''}"><div class="day-head"><strong>${esc(fmt(day,{weekday:'short'}).toUpperCase())} ${day.getDate()}</strong><span>${rows.length}</span></div><div class="job-list">${rows.length?rows.map(j=>`<article class="job-card" data-job-id="${esc(j.id)}"><time>${esc(j.time||'--:--')}</time><strong>${esc(j.sa||'SIN SA')}</strong><span>${esc(j.client||'Sin cliente')}</span><span>${esc(j.city||j.address||'')}</span><span class="job-state">${esc(j.state)}</span></article>`).join(''):'<div class="empty">Sin trabajos</div>'}</div></section>`}).join('');
    $$('[data-job-id]').forEach(card=>card.addEventListener('click',()=>openJob(card.dataset.jobId||'')))}

  function renderMetrics(){const today=isoDate(new Date());const start=isoDate(state.weekStart);const end=isoDate(addDays(state.weekStart,6));$('#metric-today').textContent=String(state.agenda.filter(j=>j.date===today).length);$('#metric-week').textContent=String(state.agenda.filter(j=>j.date>=start&&j.date<=end).length);$('#metric-pending').textContent=String(state.agenda.filter(j=>!/realiz|finaliz|complet/i.test(j.state)).length);$('#metric-photos').textContent=String(state.photos.length)}

  function openJob(id=''){const form=$('#job-form');form.reset();const job=state.agenda.find(j=>j.id===id);state.editingId=job?.id||'';$('#job-dialog-title').textContent=job?'Editar trabajo':'Nuevo trabajo';if(job){Object.entries({id:job.id,date:job.date,time:job.time,sa:job.sa,type:job.type,client:job.client,phone:job.phone,address:job.address,city:job.city,model:job.model,state:job.state,priority:job.priority,observations:job.observations}).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v??''})}else{form.elements.date.value=isoDate(new Date());form.elements.state.value='Pendiente';form.elements.priority.value='Normal'}$('#job-message').textContent='';$('#job-dialog').showModal()}
  async function saveJob(event){event.preventDefault();const form=event.currentTarget;const data=Object.fromEntries(new FormData(form).entries());if(!data.sa&&!data.client){$('#job-message').textContent='Introduce al menos una SA o un cliente.';return}const existing=state.agenda.find(j=>j.id===state.editingId);const payload={...data,id:existing?.id||'',calendarEventId:existing?.calendarEventId||''};$('#job-message').textContent='Guardando…';try{await api('/agenda',{method:existing?'PUT':'POST',body:JSON.stringify(payload)});$('#job-dialog').close();state.editingId='';await loadAgenda();feedback('TRABAJO GUARDADO',existing?'Agenda actualizada.':'Trabajo añadido.')}catch(error){const msg=error instanceof Error?error.message:'No se ha podido guardar';$('#job-message').textContent=msg;feedback('ERROR',msg,4500)}}

  async function loadPhotos(silent=false){try{const payload=await api('/office/photos');const rows=Array.isArray(payload)?payload:payload?.photos||[];state.photos=rows.map(normalizePhoto).filter(p=>p.url).sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp)));renderPhotos();renderMetrics()}catch{if(!silent){state.photos=[];renderPhotos();renderMetrics()}}}
  function renderPhotos(){const q=($('#photo-search')?.value||'').trim().toLowerCase();const rows=state.photos.filter(p=>!q||`${p.sa} ${p.workOrder} ${p.note}`.toLowerCase().includes(q));$('#photo-grid').innerHTML=rows.length?rows.map(p=>`<article class="photo-card"><img src="${esc(p.url)}" alt="Foto ${esc(p.sa)}" loading="lazy"><div><strong>${esc(p.sa||p.workOrder||'FOTO')}</strong><span>${esc(p.note||'')}</span><span>${esc(p.timestamp||'')}</span></div></article>`).join(''):'<div class="empty">Sin fotografías recibidas</div>';const badge=$('#photos-badge');badge.hidden=!state.photos.length;badge.textContent=String(state.photos.length)}

  async function refreshAll(show=false){if(show)feedback('ACTUALIZANDO','');await Promise.all([loadAgenda(true),loadPhotos(true)]);renderWeek();renderPhotos();renderMetrics();if(show)feedback('DATOS ACTUALIZADOS','Agenda y fotos sincronizadas.')}

  function bind(){
    $('#login-form')?.addEventListener('submit',handleLogin);$('#logout-button')?.addEventListener('click',logout);$('#reload-button')?.addEventListener('click',()=>void refreshAll(true));
    $$('.tab').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));$('#new-job-button')?.addEventListener('click',()=>openJob());$('#job-form')?.addEventListener('submit',saveJob);$('#photo-search')?.addEventListener('input',renderPhotos);
    $('#prev-week')?.addEventListener('click',()=>{state.weekStart=addDays(state.weekStart,-7);renderWeek()});$('#next-week')?.addEventListener('click',()=>{state.weekStart=addDays(state.weekStart,7);renderWeek()});$('#this-week')?.addEventListener('click',()=>{state.weekStart=startOfWeek(new Date());renderWeek()});
    $$('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close)?.close()));
    window.setInterval(()=>{if(sessionStorage.getItem(SESSION_KEY)&&!$('#app-shell').hidden)void refreshAll(false)},REFRESH_MS);
  }
  bind();if(sessionStorage.getItem(SESSION_KEY))enterApp();
})();

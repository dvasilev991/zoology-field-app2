const STORAGE_KEY = 'turilik_field_records_v2';
const form = document.getElementById('form');
const statusEl = document.getElementById('status');
const detectionSet = new Set();
let records = [];
let currentId = '';
let coverPoints = [];

const coverCategories = [
  {key:'herbaceous', label:'Тревиста растителност', short:'ТР', cls:'cat-herbaceous'},
  {key:'bareSoil', label:'Гола почва', short:'ГП', cls:'cat-bareSoil'},
  {key:'gravelSmallStones', label:'Чакъл / дребни камъни', short:'ДК', cls:'cat-gravelSmallStones'},
  {key:'largeStones', label:'Едри камъни', short:'ЕК', cls:'cat-largeStones'},
  {key:'exposedRock', label:'Гола скала', short:'СК', cls:'cat-exposedRock'},
  {key:'juniper', label:'Хвойна', short:'ХВ', cls:'cat-juniper'},
  {key:'otherShrubs', label:'Други храсти', short:'ДХ', cls:'cat-otherShrubs'},
  {key:'litterMossLichen', label:'Постилка / мъх / лишеи', short:'ПМ', cls:'cat-litterMossLichen'},
  {key:'anthropogenic', label:'Антропогенен субстрат', short:'АН', cls:'cat-anthropogenic'}
];
const coverByKey = Object.fromEntries(coverCategories.map(c => [c.key, c]));

function newId(){ return 'TUR-' + new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14); }
function today(){ return new Date().toISOString().slice(0,10); }
function nowTime(){ return new Date().toTimeString().slice(0,5); }
function n(v){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
function avg(arr){ const a = arr.map(n).filter(x=>Number.isFinite(x)); if(!a.length) return ''; return (a.reduce((s,x)=>s+x,0)/a.length).toFixed(1); }
function pct(count,total){ const t = Math.max(n(total),1); return ((n(count)/t)*100).toFixed(1); }
function csvEscape(v){ const s = String(v ?? ''); return '"' + s.replace(/"/g,'""') + '"'; }
function xmlEscape(v){ return String(v ?? '').replace(/[<>&"']/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[ch])); }
function aspectClass(deg){ const d=Number(deg); if(!Number.isFinite(d)) return ''; const x=((d%360)+360)%360; if(x>=337.5||x<22.5)return'N'; if(x<67.5)return'NE'; if(x<112.5)return'E'; if(x<157.5)return'SE'; if(x<202.5)return'S'; if(x<247.5)return'SW'; if(x<292.5)return'W'; return'NW'; }
function setStatus(msg){ statusEl.textContent = msg; }

const defaults = {
  id:newId(), observer:'', date:today(), time:nowTime(), locality:'', plotType:'occupied', habitatStratum:'open_stony_steppe',
  latitude:'', longitude:'', elevation:'', gpsAccuracy:'', coordinateNote:'',
  breedingEvidence:'probable_territory', firstDetectionMethod:'passive_listening', numberOfBirds:'', numberOfVisits:'', playbackUsed:'no', thermalUsed:'yes_night', confidence:'probable', behaviour:'',
  slope1:'', slope2:'', slope3:'', aspectDeg:'', aspectClass:'', totalPoints:'100', herbaceous:'', bareSoil:'', gravelSmallStones:'', largeStones:'', exposedRock:'', juniper:'', otherShrubs:'', litterMossLichen:'', anthropogenic:'', coverPoints:[],
  meanHerbHeight:'', maxHerbHeight:'', juniperClumps:'', juniperPattern:'isolated', meanJuniperHeight:'', maxJuniperHeight:'', nearestJuniperDistance:'', visibilityN:'', visibilityNE:'', visibilityE:'', visibilitySE:'', visibilityS:'', visibilitySW:'', visibilityW:'', visibilityNW:'',
  grazingIndex:'', disturbanceIndex:'', distanceToRoad:'', distanceToSettlement:'', disturbanceNotes:'', notes:''
};

function getFormData(){
  const fd = new FormData(form); const obj = {...defaults};
  for(const [k,v] of fd.entries()) obj[k]=v;
  obj.id = document.getElementById('id').value || currentId || newId();
  obj.detectionBasis = Array.from(detectionSet);
  obj.coverPoints = [...coverPoints];
  obj.updatedAt = new Date().toISOString();
  obj.derived = derive(obj);
  return obj;
}

function setFormData(obj){
  const r = {...defaults, ...obj}; currentId = r.id; detectionSet.clear(); (r.detectionBasis||[]).forEach(x=>detectionSet.add(x));
  coverPoints = Array.isArray(r.coverPoints) ? [...r.coverPoints] : [];
  for(const [k,v] of Object.entries(r)){
    const el=form.elements[k] || document.getElementById(k);
    if(el && typeof v !== 'object') el.value = v ?? '';
  }
  if(!r.aspectClass && r.aspectDeg) form.elements.aspectClass.value = aspectClass(r.aspectDeg);
  document.querySelectorAll('#detectionPills .pill').forEach(btn=>btn.classList.toggle('on', detectionSet.has(btn.dataset.method)));
  if (coverPoints.length) syncCountsFromCoverPoints();
  renderCoverPoints();
  updateSummaries();
}

function derive(r){
  const open = n(r.bareSoil)+n(r.gravelSmallStones)+n(r.largeStones)+n(r.exposedRock);
  const stony = n(r.gravelSmallStones)+n(r.largeStones)+n(r.exposedRock);
  const shrub = n(r.juniper)+n(r.otherShrubs);
  const vv = ['visibilityN','visibilityNE','visibilityE','visibilitySE','visibilityS','visibilitySW','visibilityW','visibilityNW'].map(k=>r[k]).filter(v=>String(v).trim()!=='');
  const meanVisibility = vv.length ? avg(vv) : '';
  return {
    meanSlope: avg([r.slope1,r.slope2,r.slope3]),
    aspectClass: r.aspectClass || aspectClass(r.aspectDeg),
    herbaceousPct: pct(r.herbaceous,r.totalPoints), openSubstratePct: pct(open,r.totalPoints), stonySubstratePct: pct(stony,r.totalPoints), juniperPct: pct(r.juniper,r.totalPoints), shrubCoverPct: pct(shrub,r.totalPoints),
    meanVisibility, visualObstruction: meanVisibility===''?'':(100-Number(meanVisibility)).toFixed(1),
    enteredCoverPoints: Array.isArray(r.coverPoints) ? r.coverPoints.length : 0
  };
}

function updateSummaries(){
  const r = getFormData(); const d = r.derived;
  document.getElementById('coverSummary').innerHTML = metric(`${d.meanSlope||'—'}°`,'среден наклон')+metric(`${d.herbaceousPct}%`,'тревно')+metric(`${d.openSubstratePct}%`,'открит субстрат')+metric(`${d.stonySubstratePct}%`,'каменисто')+metric(`${d.juniperPct}%`,'хвойна')+metric(`${d.shrubCoverPct}%`,'храсти')+metric(`${d.enteredCoverPoints}/${r.totalPoints||100}`,'въведени точки');
  document.getElementById('visibilitySummary').innerHTML = metric(`${d.meanVisibility||'—'}%`,'средна видимост')+metric(`${d.visualObstruction||'—'}%`,'закритост');
  updateCoverProgress();
}
function metric(v,l){ return `<div class="metric"><b>${v}</b><span>${l}</span></div>`; }
function saveLocal(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
function loadLocal(){
  try{
    records = JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
    if (!records.length) {
      const old = JSON.parse(localStorage.getItem('turilik_field_records_v1')||'[]');
      if (Array.isArray(old) && old.length) records = old;
    }
  }catch{ records=[]; }
  renderRecords();
}
function saveRecord(){ const r = getFormData(); r.createdAt = records.find(x=>x.id===r.id)?.createdAt || new Date().toISOString(); const i=records.findIndex(x=>x.id===r.id); if(i>=0) records[i]=r; else records.unshift(r); saveLocal(); renderRecords(); setStatus(`Записът ${r.id} е запазен.`); }
function renderRecords(){ const q=document.getElementById('search').value.toLowerCase(); const box=document.getElementById('records'); const list=records.filter(r=>`${r.id} ${r.date} ${r.locality} ${r.observer}`.toLowerCase().includes(q)); box.innerHTML = list.length ? list.map(r=>`<div class="record"><div class="id">${xmlEscape(r.id)}</div><div class="meta">${xmlEscape(r.date)} · ${xmlEscape(r.locality||'без локалитет')}</div><div class="meta">${xmlEscape((r.coverPoints||[]).length)} точки покривка</div><div class="row" style="margin-top:7px"><button class="small ghost" onclick="loadRecord('${r.id}')">Отвори</button><button class="small danger" onclick="deleteRecord('${r.id}')">Изтрий</button></div></div>`).join('') : '<div class="status">Няма записи.</div>'; }
window.loadRecord = (id)=>{ const r=records.find(x=>x.id===id); if(r){ setFormData(r); setStatus(`Отворен е запис ${id}.`); } };
window.deleteRecord = (id)=>{ if(!confirm('Да изтрия ли този запис?')) return; records=records.filter(x=>x.id!==id); saveLocal(); renderRecords(); if(currentId===id) newRecord(); };
function newRecord(){ currentId = newId(); detectionSet.clear(); coverPoints=[]; setFormData({...defaults,id:currentId,date:today(),time:nowTime(),coverPoints:[]}); setStatus('Създаден е нов празен запис.'); }
function download(name, type, text){ const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function exportJSON(){ download(`turilik_records_${today()}.json`,'application/json',JSON.stringify(records,null,2)); }
function exportCSV(){
  const cols=['id','date','time','observer','locality','plotType','habitatStratum','latitude','longitude','elevation','gpsAccuracy','breedingEvidence','detectionBasis','numberOfBirds','numberOfVisits','firstDetectionMethod','playbackUsed','thermalUsed','confidence','slope1','slope2','slope3','meanSlope','aspectDeg','aspectClass','totalPoints','coverPointsSequence','enteredCoverPoints','herbaceous','herbaceousPct','bareSoil','gravelSmallStones','largeStones','exposedRock','openSubstratePct','stonySubstratePct','juniper','juniperPct','otherShrubs','shrubCoverPct','meanHerbHeight','maxHerbHeight','juniperClumps','meanJuniperHeight','maxJuniperHeight','nearestJuniperDistance','juniperPattern','meanVisibility','visualObstruction','grazingIndex','disturbanceIndex','distanceToRoad','distanceToSettlement','behaviour','notes','disturbanceNotes'];
  const rows=records.map(r=>{const m={...r,...(r.derived||{}),detectionBasis:(r.detectionBasis||[]).join(';'),coverPointsSequence:(r.coverPoints||[]).join(';')}; return cols.map(c=>csvEscape(m[c])).join(',');});
  download(`turilik_records_${today()}.csv`,'text/csv;charset=utf-8',[cols.join(','),...rows].join('\n'));
}
function validCoord(r){ return Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)); }
function exportGeoJSON(){
  const features = records.filter(validCoord).map(r => ({
    type:'Feature',
    geometry:{type:'Point', coordinates:[Number(r.longitude), Number(r.latitude), r.elevation === '' ? undefined : Number(r.elevation)].filter(v=>v!==undefined)},
    properties:{...r, coverPoints:(r.coverPoints||[]).join(';'), detectionBasis:(r.detectionBasis||[]).join(';')}
  }));
  download(`turilik_coordinates_${today()}.geojson`,'application/geo+json',JSON.stringify({type:'FeatureCollection', features}, null, 2));
}
function exportKML(){
  const placemarks = records.filter(validCoord).map(r => `<Placemark><name>${xmlEscape(r.id)}</name><description>${xmlEscape([r.date,r.locality,r.plotType,r.breedingEvidence].filter(Boolean).join(' | '))}</description><Point><coordinates>${Number(r.longitude)},${Number(r.latitude)},${r.elevation ? Number(r.elevation) : 0}</coordinates></Point></Placemark>`).join('\n');
  const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Turilik field records</name>${placemarks}</Document></kml>`;
  download(`turilik_coordinates_${today()}.kml`,'application/vnd.google-earth.kml+xml',kml);
}
async function copyCoords(){
  const lat = form.elements.latitude.value, lon = form.elements.longitude.value;
  if(!lat || !lon){ setStatus('Няма въведени координати за копиране.'); return; }
  const text = `${lat}, ${lon}`;
  try{ await navigator.clipboard.writeText(text); setStatus(`Координатите са копирани: ${text}`); }
  catch{ setStatus(`Координати: ${text}`); }
}
function useGPS(){
  if(!window.isSecureContext){ setStatus('GPS изисква HTTPS или инсталирана PWA. Отвори GitHub Pages адреса, не локален файл.'); return; }
  if(!navigator.geolocation){setStatus('Браузърът не поддържа GPS.');return;}
  setStatus('Изчакване на GPS позиция с висока точност...');
  navigator.geolocation.getCurrentPosition(pos=>{
    form.elements.latitude.value=pos.coords.latitude.toFixed(6);
    form.elements.longitude.value=pos.coords.longitude.toFixed(6);
    if(pos.coords.altitude!=null) form.elements.elevation.value=pos.coords.altitude.toFixed(1);
    if(pos.coords.accuracy!=null) form.elements.gpsAccuracy.value=pos.coords.accuracy.toFixed(1);
    updateSummaries();
    setStatus(`GPS координатите са добавени. Точност: ${pos.coords.accuracy ? pos.coords.accuracy.toFixed(1)+' m' : 'няма данни'}.`);
  },err=>{
    const msg = err.code===1 ? 'Достъпът до локация е отказан. Разреши Location за Chrome/приложението.' : err.code===2 ? 'Позицията не може да бъде определена. Излез на открито и пробвай пак.' : 'Времето за GPS изтече. Пробвай отново на открито.';
    setStatus(msg);
  },{enableHighAccuracy:true,timeout:30000,maximumAge:0});
}

function syncCountsFromCoverPoints(){
  const counts = Object.fromEntries(coverCategories.map(c => [c.key, 0]));
  coverPoints.forEach(k => { if(counts[k] !== undefined) counts[k] += 1; });
  coverCategories.forEach(c => { if(form.elements[c.key]) form.elements[c.key].value = counts[c.key] || ''; });
  form.elements.totalPoints.value = form.elements.totalPoints.value || '100';
}
function addCoverPoint(cat){
  const total = Math.max(n(form.elements.totalPoints.value), 1);
  if(coverPoints.length >= total){ setStatus(`Вече са въведени ${total} точки. Използвай „Назад“ или „Изчисти точките“, ако има грешка.`); return; }
  coverPoints.push(cat);
  syncCountsFromCoverPoints();
  renderCoverPoints();
  updateSummaries();
  if(coverPoints.length === total) setStatus('Въведени са всички точки от протокола за покривка.');
}
function undoCoverPoint(){ coverPoints.pop(); syncCountsFromCoverPoints(); renderCoverPoints(); updateSummaries(); setStatus('Последната точка е премахната.'); }
function clearCoverPoints(){ if(!coverPoints.length || confirm('Да изчистя ли всички въведени точки за покривка?')){ coverPoints=[]; syncCountsFromCoverPoints(); renderCoverPoints(); updateSummaries(); setStatus('Точките за покривка са изчистени.'); } }
function updateCoverProgress(){
  const total = Math.max(n(form.elements.totalPoints?.value), 1);
  const done = coverPoints.length;
  const pctDone = Math.min(100, (done/total)*100);
  const t = document.getElementById('coverProgressText');
  const b = document.getElementById('coverProgressBar');
  if(t) t.textContent = `${done} / ${total}`;
  if(b) b.style.width = pctDone + '%';
}
function renderCoverPointGrid(){
  const grid = document.getElementById('coverPointGrid');
  const total = Math.max(n(form.elements.totalPoints?.value), 100);
  if(!grid) return;
  let html = '';
  for(let i=0;i<total;i++){
    const key = coverPoints[i];
    const cat = coverByKey[key];
    html += `<div class="pointcell ${cat ? cat.cls : 'empty'}" title="${i+1}: ${cat ? cat.label : 'празно'}">${cat ? cat.short : ''}</div>`;
  }
  grid.innerHTML = html;
}
function renderCoverCategories(){
  const box = document.getElementById('coverCategoryButtons');
  if(!box) return;
  box.innerHTML = coverCategories.map(c => `<button type="button" class="catbtn" data-covercat="${c.key}"><span class="${c.cls}"></span>${c.label}</button>`).join('');
  box.querySelectorAll('[data-covercat]').forEach(btn => btn.onclick = () => addCoverPoint(btn.dataset.covercat));
}
function renderCoverPoints(){ renderCoverPointGrid(); updateCoverProgress(); }

form.addEventListener('input',()=>{
  if(form.elements.aspectDeg && document.activeElement===form.elements.aspectDeg){ form.elements.aspectClass.value = aspectClass(form.elements.aspectDeg.value); }
  updateSummaries();
});

document.getElementById('saveBtn').onclick=saveRecord;
document.getElementById('resetBtn').onclick=newRecord;
document.getElementById('newBtn').onclick=newRecord;
document.getElementById('gpsBtn').onclick=useGPS;
document.getElementById('copyCoordsBtn').onclick=copyCoords;
document.getElementById('csvBtn').onclick=exportCSV;
document.getElementById('jsonBtn').onclick=exportJSON;
document.getElementById('geojsonBtn').onclick=exportGeoJSON;
document.getElementById('kmlBtn').onclick=exportKML;
document.getElementById('search').oninput=renderRecords;
document.getElementById('undoPointBtn').onclick=undoCoverPoint;
document.getElementById('clearPointsBtn').onclick=clearCoverPoints;

document.getElementById('importFile').onchange=(e)=>{ const file=e.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{ try{ const data=JSON.parse(reader.result); if(!Array.isArray(data)) throw 0; records=data; saveLocal(); renderRecords(); setStatus(`Импортирани са ${records.length} записа.`); }catch{setStatus('Невалиден JSON файл.');} }; reader.readAsText(file); };
document.querySelectorAll('#detectionPills .pill').forEach(btn=>btn.onclick=()=>{ const m=btn.dataset.method; if(detectionSet.has(m)){detectionSet.delete(m);btn.classList.remove('on');}else{detectionSet.add(m);btn.classList.add('on');} });
document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{ document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); document.querySelectorAll('.tabpane').forEach(p=>p.classList.add('hidden')); document.getElementById('tab-'+btn.dataset.tab).classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); });

if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{})); }
renderCoverCategories();
loadLocal();
newRecord();

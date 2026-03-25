
const fmt = {
  int: n => n.toLocaleString('en-US'),
  one: n => n.toLocaleString('en-US', { maximumFractionDigits: 1 }),
  two: n => n.toLocaleString('en-US', { maximumFractionDigits: 2 }),
  sci: n => (!isFinite(n) ? '—' : n.toExponential(2).replace('e', ' ×10^')),
};
const q = id => document.getElementById(id);

const DENS = {
  stony: 3000, ordinary: 3500, carbonaceous: 2200, enstatite: 3300,
  basaltic: 3000, ureilite: 2600, pallasite: 4600, rubble: 1500,
  porous: 1000, ultraporous: 500, metalrich: 6500, iron: 7800,
  comet: 600, icy: 900
};

const COLORS = [
  { severe: '#ff5577', moderate: '#ffd15a', minor: '#4cd964' },
  { severe: '#ff6b6b', moderate: '#ffe08a', minor: '#5ddc6a' },
  { severe: '#ff7a8a', moderate: '#ffe8a8', minor: '#6beb77' },
  { severe: '#ff8fa3', moderate: '#fff1b5', minor: '#74f08b' },
];

let asteroids = [];  
let activeIdx = 0;

const PRESETS = {
  none: null,
  chicxulub: { label: 'Chicxulub (K–Pg, 66 Ma) — ~10 km, shallow sea', comp:'ordinary', d:10000, v:20, angle:45, frag:5, surface:'water', latlng:{lat:21.4, lng:-89.5}},
  manicouagan: { label: 'Manicouagan (Triassic, 215 Ma) — large, debated link', comp:'ordinary', d:5000, v:20, angle:45, frag:10, surface:'land', latlng:{lat:51.38, lng:-68.70}},
  popigai: { label: 'Popigai (Eocene, 35.7 Ma) — very large', comp:'ordinary', d:5000, v:20, angle:45, frag:10, surface:'land', latlng:{lat:71.83, lng:111.00}},
  chesapeake: { label: 'Chesapeake Bay (Eocene, 35.5 Ma) — marine', comp:'carbonaceous', d:3000, v:20, angle:45, frag:15, surface:'water', latlng:{lat:37.30, lng:-76.00}},
  vredefort: { label: 'Vredefort (~2.02 Ga) — enormous remnant', comp:'ordinary', d:12000, v:20, angle:45, frag:5, surface:'land', latlng:{lat:-26.90, lng:27.50}},
  sudbury: { label: 'Sudbury (~1.85 Ga) — very large', comp:'ordinary', d:10000, v:20, angle:45, frag:5, surface:'land', latlng:{lat:46.60, lng:-81.20}},
  acraman: { label: 'Acraman (~580 Ma) — turnover candidate', comp:'ordinary', d:4000, v:20, angle:45, frag:15, surface:'land', latlng:{lat:-32.00, lng:135.45}},
  alamo: { label: 'Alamo (~382 Ma) — candidate pulse', comp:'carbonaceous', d:2500, v:20, angle:45, frag:15, surface:'water', latlng:{lat:37.30, lng:-116.00}},
  siljan: { label: 'Siljan (~377 Ma) — large structure', comp:'ordinary', d:2500, v:20, angle:45, frag:10, surface:'land', latlng:{lat:61.00, lng:14.90}},
  woodleigh: { label: 'Woodleigh (~364 Ma?) — large, debated', comp:'ordinary', d:6000, v:20, angle:45, frag:15, surface:'land', latlng:{lat:-26.05, lng:114.65}},
  tunguska: { label: 'Tunguska (1908) — ~50 m airburst', comp:'porous', d:50, v:15, angle:30, frag:40, surface:'land', latlng:{lat:60.9, lng:101.9}},
  chelyabinsk: { label: 'Chelyabinsk (2013) — ~19 m airburst', comp:'ordinary', d:19, v:19, angle:18, frag:50, surface:'land', latlng:{lat:55.15, lng:61.41}},
  barringer: { label: 'Barringer/Meteor Crater — ~50 m iron', comp:'iron', d:50, v:12, angle:45, frag:5, surface:'land', latlng:{lat:35.027, lng:-111.022}},
  sikhote: { label: 'Sikhote-Alin (1947) — ~5–10 m iron', comp:'iron', d:8, v:14, angle:35, frag:20, surface:'land', latlng:{lat:46.16, lng:134.65}}
};

function newAsteroid(n=asteroids.length+1){
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()),
    name: `Asteroid ${n}`,
    comp: 'stony',
    d: 50, v: 18, angle: 45, frag: 0,
    surface: 'land',
    latlng: null,
    preset: 'none',
    visible: true,
    results: null
  };
}

let map, markers = [], circles = []; 
function initMap(){
  map = L.map('map').setView([45.8, 24.97], 3); 
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ attribution:'© OpenStreetMap' }).addTo(map);

  map.on('click', (e)=>{
    const a = asteroids[activeIdx];
    a.latlng = e.latlng;
    placeMarker(activeIdx);
    drawCircles(activeIdx);
    updateCombinedRadiiBadge();
  });
}

function ensureMarkerSlot(i){
  if (!markers[i]) markers[i] = null;
  if (!circles[i]) circles[i] = { severe:null, moderate:null, minor:null };
}

function placeMarker(i){
  ensureMarkerSlot(i);
  const a = asteroids[i];
  if(!a.latlng) return;
  if(!markers[i]){
    markers[i] = L.marker(a.latlng).addTo(map);
    markers[i].bindTooltip(a.name, {permanent:true, direction:'top', offset:[0,-12]});
  } else {
    markers[i].setLatLng(a.latlng);
  }
  if (markers[i]) {
    if (a.visible) markers[i].addTo(map);
    else map.removeLayer(markers[i]);
  }
}

function drawCircles(i){
  ensureMarkerSlot(i);
  const a = asteroids[i];
  if(!a.latlng || !a.results) return;
  const col = COLORS[i % COLORS.length];
  const { severe, moderate, minor } = a.results.radii;

  ['severe','moderate','minor'].forEach(key=>{
    if (circles[i][key]) { map.removeLayer(circles[i][key]); circles[i][key]=null; }
  });

  if (a.visible && severe>0){
    circles[i].severe = L.circle(a.latlng, {radius: severe*1000, color: col.severe, fillColor: col.severe, fillOpacity:.15}).addTo(map);
  }
  if (a.visible && moderate>0){
    circles[i].moderate = L.circle(a.latlng, {radius: moderate*1000, color: col.moderate, fillColor: col.moderate, fillOpacity:.12}).addTo(map);
  }
  if (a.visible && minor>0){
    circles[i].minor = L.circle(a.latlng, {radius: minor*1000, color: col.minor, fillColor: col.minor, fillOpacity:.08}).addTo(map);
  }
}

function transmittanceFromParams(d_m, angle_deg, comp, fragPct, surface){
  const theta = angle_deg*Math.PI/180;
  const atmos = Math.sin(theta);              
  const sizeFactor = Math.min(1, d_m/20);       
  const base = Math.max(0.15, 0.6*atmos + 0.4*sizeFactor);
  const fragLoss = Math.max(0, Math.min(0.5, fragPct/100)); 
  const surfaceMod = surface==='water' ? 0.9 : 1.0;        
  return base * (1 - fragLoss) * surfaceMod;
}

function radiiFromYield(MT){
  if (MT<=0) return { severe:0, moderate:0, minor:0 };
  const c = Math.cbrt(MT);
  return {
    severe: 2.5*c, 
    moderate: 6.0*c, 
    minor: 12.0*c 
  };
}

function computeAsteroid(a){
  const rho = DENS[a.comp];
  const r = a.d/2;
  const volume = (4/3)*Math.PI*Math.pow(r,3);
  const mass = rho*volume;                
  const v_ms = a.v*1000;                   
  const E = 0.5*mass*v_ms*v_ms;         
  const T = transmittanceFromParams(a.d, a.angle, a.comp, a.frag, a.surface);
  const E_ground = E*T;                 
  const MT = E_ground / 4.184e15;         
  let riskClass='low', riskTxt='Low';
  if (MT>=1 && MT<10) { riskClass='med'; riskTxt='Moderate'; }
  else if (MT>=10) { riskClass='high'; riskTxt='High'; }
  const radii = radiiFromYield(MT);
  return { mass, E, E_ground, MT, riskClass, riskTxt, radii };
}


function compLabel(value){
  const map = {
    stony:'Stony (~3000 kg/m³)', ordinary:'Ordinary chondrite (~3500 kg/m³)', carbonaceous:'Carbonaceous chondrite (~2200 kg/m³)',
    enstatite:'Enstatite chondrite (~3300 kg/m³)', basaltic:'Basaltic (V-type) (~3000 kg/m³)', ureilite:'Ureilite (~2600 kg/m³)',
    pallasite:'Pallasite (~4600 kg/m³)', rubble:'Rubble pile (~1500 kg/m³)', porous:'Porous / fractured (~1000 kg/m³)',
    ultraporous:'Ultra-porous (~500 kg/m³)', metalrich:'Metal-rich (~6500 kg/m³)', iron:'Metallic (nickel-iron) (~7800 kg/m³)',
    comet:'Cometary (~600 kg/m³)', icy:'Icy body (~900 kg/m³)'
  };
  return map[value] || value;
}

function compositionOptions(selected){
  const keys = ['stony','ordinary','carbonaceous','enstatite','basaltic','ureilite','pallasite','rubble','porous','ultraporous','metalrich','iron','comet','icy'];
  return keys.map(k => `<option value="${k}" ${selected===k?'selected':''}>${compLabel(k)}</option>`).join('');
}

function presetOptions(selected){
  const entries = Object.entries(PRESETS).filter(([k])=>k!=='none');
  const opts = [`<option value="none" ${selected==='none'?'selected':''}>— Choose preset —</option>`];
  entries.forEach(([key, p])=>{
    opts.push(`<option value="${key}" ${selected===key?'selected':''}>${p.label}</option>`);
  });
  return opts.join('');
}

function asteroidPanelTemplate(idx, a){
  return `
  <fieldset class="card" style="margin:0 0 10px 0; padding:12px">
    <legend style="color:#9fb0d0">Settings — ${a.name}</legend>

    <div class="row">
      <label>Preset</label>
      <select data-key="preset" data-idx="${idx}">
        ${presetOptions(a.preset)}
      </select>
    </div>

    <div class="row">
      <label>Name</label>
      <input type="text" data-key="name" data-idx="${idx}" value="${a.name}" style="width:100%" />
    </div>

    <div class="row">
      <label>Composition</label>
      <select data-key="comp" data-idx="${idx}">
        ${compositionOptions(a.comp)}
      </select>
    </div>

    <div class="row">
      <label>Diameter (m)</label>
      <input type="range" data-key="d" data-idx="${idx}" min="5" max="20000" step="1" value="${a.d}" />
      <div class="value"><span>${a.d}</span> m</div>
    </div>

    <div class="row">
      <label>Velocity (km/s)</label>
      <input type="range" data-key="v" data-idx="${idx}" min="11" max="40" step="0.5" value="${a.v}" />
      <div class="value"><span>${a.v.toFixed(1)}</span> km/s</div>
    </div>

    <div class="row">
      <label>Entry angle (°)</label>
      <input type="range" data-key="angle" data-idx="${idx}" min="10" max="90" step="1" value="${a.angle}" />
      <div class="value"><span>${a.angle}</span>°</div>
    </div>

    <div class="row">
      <label>Fragmentation loss (%)</label>
      <input type="range" data-key="frag" data-idx="${idx}" min="0" max="50" step="1" value="${a.frag}" />
      <div class="value"><span>${a.frag}</span>%</div>
    </div>

    <div class="row">
      <label>Surface</label>
      <select data-key="surface" data-idx="${idx}">
        <option value="land" ${a.surface==='land'?'selected':''}>Land</option>
        <option value="water" ${a.surface==='water'?'selected':''}>Water</option>
      </select>
    </div>

    <div class="row" style="gap:12px">
      <label>Visibility</label>
      <label class="inline-pill" style="margin-left:-4px">
        <input type="checkbox" data-key="visible" data-idx="${idx}" ${a.visible?'checked':''} />
        <span>Show on map</span>
      </label>
    </div>

    <div class="row" style="justify-content:flex-end">
      <span class="pill">Position: ${a.latlng ? `${a.latlng.lat.toFixed(3)}, ${a.latlng.lng.toFixed(3)}` : '— click on map or choose preset'}</span>
    </div>
  </fieldset>
  `;
}

function applyPreset(idx, key){
  const p = PRESETS[key];
  asteroids[idx].preset = key;
  if(!p) return;
  Object.assign(asteroids[idx], {
    comp: p.comp, d: p.d, v: p.v, angle: p.angle, frag: p.frag, surface: p.surface,
    latlng: p.latlng ? { lat: p.latlng.lat, lng: p.latlng.lng } : asteroids[idx].latlng
  });
  renderAsteroidControls();
  placeMarker(idx);
  computeAll();
}

function renderAsteroidControls(){
  const cont = q('asteroidControls');
  cont.innerHTML = asteroids.map((a,i)=>asteroidPanelTemplate(i,a)).join('');

  cont.querySelectorAll('input[type="range"], select, input[type="text"], input[type="checkbox"]').forEach(el=>{
    const idx = Number(el.dataset.idx);
    const key = el.dataset.key;
    el.addEventListener('input', ()=>{
      if(key==='name'){
        asteroids[idx].name = el.value || `Asteroid ${idx+1}`;
        fillActiveSelect();
        if (markers[idx]) markers[idx].setTooltipContent(asteroids[idx].name);
      } else if (key==='preset'){
        applyPreset(idx, el.value);
        return;
      } else if (key==='visible'){
        asteroids[idx].visible = el.checked;
        placeMarker(idx);
        drawCircles(idx);
      } else if (key==='surface' || key==='comp'){
        asteroids[idx][key] = el.value;
      } else {
        const v = Number(el.value);
        asteroids[idx][key] = v;
        const valueSpan = el.parentElement.querySelector('.value span');
        if(valueSpan){
          if(key==='v') valueSpan.textContent = v.toFixed(1);
          else valueSpan.textContent = v;
        }
      }
    });
  });
}

function fillActiveSelect(){
  const sel = q('activeSelect');
  sel.innerHTML = asteroids.map((a,i)=>`<option value="${i}" ${i===activeIdx?'selected':''}>${a.name}</option>`).join('');
}

let chart = null;

function ensureChart(totalE, totalEg){
  const ctx = q('chart').getContext('2d');
  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Total energy','Energy at ground'],
      datasets: [{ label: 'Joules (×10^15)', data: [totalE/1e15, totalEg/1e15] }]
    },
    options:{
      responsive:true,
      plugins:{ legend:{display:false}},
      scales:{ y:{ beginAtZero:true, ticks:{ callback:v=>v.toLocaleString('en-US') } } }
    }
  });
}

function updateCombinedRadiiBadge(){
  const a = asteroids[activeIdx];
  if(!a.results) { q('radiiOut').textContent = 'Radii: —'; return; }
  const { severe, moderate, minor } = a.results.radii;
  q('radiiOut').textContent = `Radii — Severe: ${fmt.one(severe)} km | Moderate: ${fmt.one(moderate)} km | Minor: ${fmt.one(minor)} km`;
}

function buildStory(){
  if (asteroids.length===0) return 'Add at least one asteroid.';
  const compTxt = {
    stony:'stony', ordinary:'ordinary chondrite', carbonaceous:'carbonaceous chondrite',
    enstatite:'enstatite chondrite', basaltic:'basaltic (V-type)', ureilite:'ureilite',
    pallasite:'pallasite', rubble:'rubble pile', porous:'porous', ultraporous:'ultra-porous',
    metalrich:'metal-rich', iron:'metallic (nickel-iron)', comet:'cometary', icy:'icy body'
  };
  const lines = asteroids.map((a)=>{
    if(!a.results) return `• ${a.name}: not computed yet.`;
    const r = a.results;
    const pos = a.latlng ? ` at ${a.latlng.lat.toFixed(2)}, ${a.latlng.lng.toFixed(2)}` : '';
    return `• <b>${a.name}</b>${pos}: ${compTxt[a.comp]}, <b>${fmt.int(a.d)} m</b>, <b>${fmt.one(a.v)} km/s</b>, <b>${a.angle}°</b>, frag <b>${a.frag}%</b>, <b>${a.visible?'visible':'hidden'}</b> → <b>${fmt.two(r.MT)}</b> Mt TNT; radii: severe <b>${fmt.one(r.radii.severe)} km</b>, moderate <b>${fmt.one(r.radii.moderate)} km</b>, minor <b>${fmt.one(r.radii.minor)} km</b>.`;
  });
  return lines.join('<br>');
}

function computeAll(){
  const popdens = Number(q('popdens').value);

  let totalE = 0, totalEg = 0, totalMT = 0;
  let highestRisk = 'low', highestTxt='Low';
  let exposed = 0;

  asteroids.forEach((a,i)=>{
    const res = computeAsteroid(a);
    a.results = res;
    totalE += res.E;
    totalEg += res.E_ground;
    totalMT += res.MT;

    if (a.latlng){
      const area_km2 = Math.PI * Math.pow(res.radii.moderate,2);
      exposed += popdens * area_km2;
    }

    placeMarker(i);
    drawCircles(i);

    const rank = {low:1, med:2, high:3}[res.riskClass];
    const rankH = {low:1, med:2, high:3}[highestRisk];
    if(rank > rankH){ highestRisk = res.riskClass; highestTxt = res.riskTxt; }
  });

  q('energyOut').textContent = fmt.sci(totalEg) + ' J';
  q('tntOut').textContent    = fmt.two(totalMT) + ' Mt';
  q('popOut').textContent    = fmt.int(Math.round(exposed));

  const riskSpan = document.createElement('span');
  riskSpan.className = `risk ${highestRisk}`;
  riskSpan.textContent = highestTxt;
  q('riskOut').innerHTML = '';
  q('riskOut').appendChild(riskSpan);

  ensureChart(totalE, totalEg);
  q('story').innerHTML = buildStory();
  updateCombinedRadiiBadge();
}


document.addEventListener('DOMContentLoaded', ()=>{

  asteroids = [ newAsteroid(1), newAsteroid(2) ];
  fillActiveSelect();
  renderAsteroidControls();

  const popdens = q('popdens'), popdensVal = q('popdensVal');
  popdens.addEventListener('input', ()=>{ popdensVal.textContent = popdens.value; });

  q('activeSelect').addEventListener('change', (e)=>{
    activeIdx = Number(e.target.value);
    updateCombinedRadiiBadge();
  });

  q('toggleAll').addEventListener('change', (e)=>{
    const on = e.target.checked;
    asteroids.forEach((a,i)=>{ a.visible = on; });
    renderAsteroidControls();
    asteroids.forEach((_,i)=>{ placeMarker(i); drawCircles(i); });
  });

  q('addAst').addEventListener('click', ()=>{
    asteroids.push(newAsteroid());
    activeIdx = asteroids.length-1;
    fillActiveSelect();
    renderAsteroidControls();
  });

  q('removeAst').addEventListener('click', ()=>{
    if (asteroids.length<=1) return alert('Keep at least one asteroid.');
    const i = activeIdx;
    if (markers[i]){ map.removeLayer(markers[i]); markers[i]=null; }
    if (circles[i]){
      ['severe','moderate','minor'].forEach(k=>{ if(circles[i][k]) map.removeLayer(circles[i][k]); });
      circles.splice(i,1);
    }
    asteroids.splice(i,1);
    activeIdx = Math.max(0, i-1);
    fillActiveSelect();
    renderAsteroidControls();
    updateCombinedRadiiBadge();
    computeAll();
  });


  q('calc').addEventListener('click', computeAll);

  q('export').addEventListener('click', async ()=>{
    const node = document.body;
    const canvas = await html2canvas(node, {backgroundColor:'#0b1220', scale:1.2, useCORS:true});
    const link = document.createElement('a');
    link.download = 'meteor-madness.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  initMap();
  computeAll();
});

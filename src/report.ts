import { createHmac, randomBytes } from 'node:crypto';
import { mkdir, writeFile, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Result } from './model.js';
import { outcome } from './outcome.js';

export function redactor(full: boolean, key = randomBytes(32)) {
  const url = (raw: string): string => {
    try {
      const u=new URL(raw);
      if(!['http:','https:','ws:','wss:'].includes(u.protocol)) return raw;
      const originOnly=raw===u.origin;
      u.username=''; u.password=''; u.hash='';
      if(!full) for(const name of [...new Set(u.searchParams.keys())]) u.searchParams.set(name,'[redacted]');
      return originOnly?u.origin:u.href;
    } catch { return raw; }
  };
  const text = (raw: string) => raw.replace(/(?:https?|wss?):\/\/[^\s<>"']+/g,u=>url(u));
  const clean = (value: unknown): any => {
    if(typeof value==='string') return text(value);
    if(Array.isArray(value)) return value.map(clean);
    if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clean(v)]));
    return value;
  };
  return (result: Result) => {
    const safe=clean(result) as Omit<Result,'observations'> & {observations: (Result['observations'][number] & {urlKey:string})[]};
    safe.options.output='[local output directory]';
    safe.observations.forEach((r,i) => { r.urlKey=createHmac('sha256',key).update(result.observations[i].url).digest('hex').slice(0,24); });
    return safe;
  };
}
export function csvCell(value: unknown): string {
  let s=String(value ?? ''); if(/^[\s]*[=+@-]/.test(s)) s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
const script = String.raw`
const data=JSON.parse(document.getElementById('data').textContent);
const byPage=new Map(data.visits.map(v=>[v.id,v]));
const $=id=>document.getElementById(id);
function cell(row,text){const td=document.createElement('td');td.textContent=text??'';row.append(td);return td;}
${outcome.toString()}
function fill(id,values){for(const v of [...new Set(values)].sort()){const opt=document.createElement('option');opt.value=v;opt.textContent=v;$(id).append(opt);}}
fill('type',data.observations.map(r=>r.type));fill('scenario',data.visits.map(v=>v.scenario));
fill('mode',data.visits.map(v=>v.mode));fill('state',data.observations.map(outcome));
let visibleLimit=250;
function render(){
 const query=$('search').value.toLowerCase();
 const records=data.observations.filter(r=>{const v=byPage.get(r.pageId);return (!$('external').checked||r.external)&&
   ($('hints').checked || !(r.type==='navigation-link'||(r.type.startsWith('link:')&&!/stylesheet|preload|modulepreload/.test(r.type))))&&
   (!$('type').value||r.type===$('type').value)&&(!$('scenario').value||v.scenario===$('scenario').value)&&
   (!$('mode').value||v.mode===$('mode').value)&&(!$('state').value||outcome(r)===$('state').value)&&
   (r.url+' '+v.url+' '+r.origin).toLowerCase().includes(query);});
 const groups=new Map();
 for(const r of records){const key=$('group').value==='origin'?r.origin:r.urlKey; if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 $('results').replaceChildren();$('count').textContent=groups.size+' Gruppen · '+records.length+' Beobachtungen · '+Math.min(visibleLimit,groups.size)+' Gruppen angezeigt';
 $('more').hidden=groups.size<=visibleLimit;
 for(const [key,rs] of [...groups].sort((a,b)=>a[1][0].url.localeCompare(b[1][0].url)).slice(0,visibleLimit)){
  const tr=document.createElement('tr');
  const details=document.createElement('details');const summary=document.createElement('summary');
  summary.textContent=$('group').value==='origin'?rs[0].origin:rs[0].url;details.append(summary);
  const list=document.createElement('div');list.className='details';
  details.addEventListener('toggle',()=>{if(!details.open||list.childElementCount)return;
  for(const r of rs){const v=byPage.get(r.pageId);const p=document.createElement('p');
    p.textContent=v.url+' | '+v.scenario+' / '+v.mode+' | '+r.phase+' | '+r.type+' | '+outcome(r)+
      (r.status?' '+r.status:'')+(r.directive?' | '+r.directive:'')+(r.failure?' | '+r.failure:'')+(r.observationEnd?' | '+r.observationEnd:'')+' | '+r.url+
      ' | Start: '+r.timestamp+(r.responseAt?' | Antwort: '+r.responseAt:'')+(r.finishedAt?' | Ende: '+r.finishedAt:'')+(r.failedAt?' | Fehler: '+r.failedAt:'');
    list.append(p);} });
  details.append(list);cell(tr,'').append(details);
  cell(tr,[...new Set(rs.map(r=>r.type))].join(', '));
  cell(tr,new Set(rs.map(r=>byPage.get(r.pageId).url)).size);
  cell(tr,[...new Set(rs.map(outcome))].join(', '));$('results').append(tr);
 }
}
for(const el of document.querySelectorAll('input,select'))el.addEventListener('input',()=>{visibleLimit=250;render();});
$('more').addEventListener('click',()=>{visibleLimit+=250;render();});
$('status').textContent=({complete:'Abgeschlossen',partial:'Teilergebnis',aborted:'Abgebrochen',failed:'Fehlgeschlagen',running:'Läuft'})[data.state];
$('status').style.background=data.state==='complete'?'#c9efde':'#ffe3ad';
$('overview').textContent=data.pages.filter(p=>p.state==='visited').length+' / '+data.pages.length+' Seiten bearbeitet · '+data.visits.length+' Besuche · '+data.observations.filter(r=>r.external).length+' externe Beobachtungen';
$('target').textContent=data.options.target;
$('timing').textContent=data.started+' — '+(data.ended||'Zwischenstand');
for(const text of [...data.issues,...data.limitations]){const li=document.createElement('li');li.textContent=text;$('issues').append(li);}
for(const p of data.pages){const tr=document.createElement('tr');cell(tr,p.url);cell(tr,p.state);cell(tr,p.reason||p.source);$('pages').append(tr);}
for(const v of data.visits.filter(v=>v.issues.length||!v.scenarioConfirmed)){const li=document.createElement('li');li.textContent=v.url+' | '+v.scenario+' / '+v.mode+': '+v.issues.join('; ');$('issues').append(li);}
render();
`;
export function html(result: unknown): string {
  const json=JSON.stringify(result).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');
  return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>kanka.dev · Web Audit</title><style>
:root{color-scheme:light;font-family:system-ui,sans-serif;color:#172f36;background:#f4f7f6}*{box-sizing:border-box}body{margin:0}header{background:#153c40;color:#fff;padding:36px max(24px,5vw)}header small{color:#a8d8cc;letter-spacing:.15em}h1{font-size:32px;margin:12px 0}header p{overflow-wrap:anywhere}main{max-width:1500px;margin:auto;padding:24px}section{background:white;border:1px solid #dae3e1;border-radius:12px;padding:24px;margin:0 0 24px}h2{font-size:21px;margin:0 0 18px}.bar{display:flex;gap:12px;flex-wrap:wrap;align-items:end}label{display:flex;flex-direction:column;gap:6px;font-size:13px}input,select{font:inherit;padding:10px;border:1px solid #b8cac6;border-radius:6px;max-width:100%}#search{width:300px}.check{flex-direction:row;align-items:center;padding-bottom:10px}table{min-width:700px;width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;font-size:12px;color:#496568;text-transform:uppercase}td,th{border-bottom:1px solid #e0e9e6;padding:14px 10px;vertical-align:top;overflow-wrap:anywhere}td:first-child{max-width:700px}summary{cursor:pointer;color:#155e58}.details{font-size:12px;background:#f5f8f7;padding:12px;max-height:350px;overflow:auto}.scroll{overflow:auto}li{margin:8px 0;overflow-wrap:anywhere}.badge{display:inline-block;background:#c9efde;color:#12392f;border-radius:20px;padding:5px 12px;font-weight:600}.muted{color:#587273;font-size:13px}@media(max-width:700px){main{padding:12px}section{padding:16px}.bar>*{width:100%}#search{width:100%}h1{font-size:26px}}
</style><header><small>kanka.dev / Ressourceninventar</small><h1>Web Audit <span id="status" class="badge"></span></h1><p id="target"></p><p id="overview"></p><small id="timing"></small></header>
<main><section><h2>Ressourcen</h2><div class="bar"><label>Suche<input id="search" type="search" placeholder="Ressource oder Fundseite"></label>
<label>Gruppierung<select id="group"><option value="origin">Origin</option><option value="url">Exakte URL</option></select></label>
<label>Typ<select id="type"><option value="">Alle</option></select></label><label>Szenario<select id="scenario"><option value="">Alle</option></select></label>
<label>CSP-Modus<select id="mode"><option value="">Alle</option></select></label><label>Status<select id="state"><option value="">Alle</option></select></label>
<label class="check"><input id="external" type="checkbox" checked>Nur externe Ressourcen</label><label class="check"><input id="hints" type="checkbox">Auch Links und Ladehinweise</label></div><p id="count" class="muted"></p>
<div class="scroll"><table><thead><tr><th>Origin / URL · aufklappen für Fundstellen</th><th>Typen</th><th>Seiten</th><th>Status</th></tr></thead><tbody id="results"></tbody></table></div><button id="more" hidden>Weitere 250 Gruppen anzeigen</button></section>
<section><h2>Abdeckung und Grenzen</h2><p>CSP blockiert bedeutet eine belegte CSP-Blockade. HTTP-Fehler und Netzwerkabbrüche werden gesondert ausgewiesen. Ein Abbruch nach einer Antwort (auch HTTP 204) beweist keine CSP-Blockade. Bei Scan-Ende offene Requests sind keine nachgewiesenen Website-Fehler. Beobachtungen können denselben Vorgang mehrfach beschreiben.</p><p>Ein Inventar ist keine rechtliche Konformitätsbewertung. „Übertragen“ bestätigt keine erfolgreiche Ausführung. Query-Werte sind standardmäßig maskiert.</p><ul id="issues"></ul></section>
<section><h2>Untersuchte und ausgelassene Seiten</h2><div class="scroll"><table><thead><tr><th>Seite</th><th>Status</th><th>Quelle / Grund</th></tr></thead><tbody id="pages"></tbody></table></div></section></main>
<script id="data" type="application/json">${json}</script><script>${script}</script></html>`;
}
export async function prepareOutput(path: string) {
  await mkdir(path,{recursive:true});
  for(const file of ['report.json','report.html','resources.csv']) {
    if(await stat(join(path,file)).catch(()=>null)) throw new Error('Output directory already contains a report; choose a new directory.');
  }
}
export function writer(path: string, full: boolean) {
  const sanitize=redactor(full);
  let pending=Promise.resolve();
  return (result: Result, final=false) => {
    const safe=sanitize(result);
    const json=JSON.stringify(safe,null,2);
    pending=pending.then(async()=>{
      const tmp=join(path,'report.json.tmp'); await writeFile(tmp,json,{mode:0o600}); await rename(tmp,join(path,'report.json'));
      if(final) {
        await writeFile(join(path,'report.html'),html(safe),{mode:0o600});
        const pageMap=new Map(safe.visits.map(v=>[v.id,v]));
        const rows=[['Outcome','Observation end','URL','Origin','URL key','Page','Scenario','Mode','Phase','Type','Source','HTTP status','Completed','Failure','Directive']];
        for(const r of safe.observations){const p=pageMap.get(r.pageId)!;rows.push([outcome(r),r.observationEnd??'',r.url,r.origin,r.urlKey,p.url,p.scenario,p.mode,r.phase,r.type,r.source,String(r.status??''),String(r.complete??''),r.failure??'',r.directive??'']);}
        await writeFile(join(path,'resources.csv'),'\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n'),{mode:0o600});
      }
    });
    return pending;
  };
}

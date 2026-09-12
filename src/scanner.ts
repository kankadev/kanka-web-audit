import { chromium } from 'playwright';
import { normalizeUrl } from './config.js';
import { Discovery } from './discovery.js';
import { visit } from './visit.js';
import { prepareOutput, writer } from './report.js';
import type { Options, Result, PageEntry } from './model.js';

export async function scan(options: Options, signal?: AbortSignal, progress:(message:string)=>void=(message)=>{process.stderr.write(message+'\n');}): Promise<Result> {
  await prepareOutput(options.output);
  const controller=new AbortController();
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},options.maxDurationMs);
  const abort=()=>controller.abort(); signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted) controller.abort();
  const state: Result={schemaVersion:1,toolVersion:'0.1.0',started:new Date().toISOString(),state:'running',options,pages:[],visits:[],observations:[],issues:[],limitations:[
    'Erfasst werden entdeckte Seiten und konfigurierte Interaktionen. Das Ergebnis ist keine rechtliche Konformitätsbewertung.',
    'Jede Seite und jedes Szenario startet mit einem frischen Browserkontext. Login-Sitzungen und seitenübergreifender Consent werden nicht übernommen.',
    'Nicht ausgewählte srcset-Varianten, beliebige JavaScript-URLs, Hash-Routen und geschlossene Popups werden nicht vollständig erfasst.',
    'Bei Service-Worker-Anfragen kann die Zuordnung zum Frame fehlen. Serverseitige Weitergaben sind nicht sichtbar.',
    'WebSocket-Adressen werden auf Seiten beobachtet. Worker-WebSockets und Nachrichteninhalte sind nicht abgedeckt.',
    'Die Beobachtungszeit ist begrenzt. Späte Anfragen sowie regionale oder zeitabhängige Varianten können fehlen.'
  ]};
  const save=writer(options.output,options.fullUrls);
  const discovery=new Discovery(options,controller.signal);
  const known=new Map<string,PageEntry>();
  const add=(raw:string,depth:number,source:string)=>{
    const url=normalizeUrl(raw);if(!url||known.has(url))return;
    if(known.size>=options.maxDiscovered){if(!state.issues.includes('Page discovery limit reached.'))state.issues.push('Page discovery limit reached.');return;}
    const p:PageEntry={url,depth,source,state:'queued'};
    if(!discovery.inScope(url)){p.state='skipped';p.reason='outside-scope';}
    else if(depth>options.maxDepth){p.state='skipped';p.reason='depth-limit';}
    else if(options.exclude.some(text=>url.includes(text)) || /(?:^|[/?&=_-])(logout|signout|delete|remove|checkout|add-to-cart)(?:[/?&=_-]|$)/i.test(url)){p.state='skipped';p.reason='excluded';}
    known.set(url,p);state.pages.push(p);
  };
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    add(options.target,0,'start');for(const u of options.starts)add(u,0,'extra-start');
    await discovery.prepare((u,source)=>add(u,0,source));state.issues.push(...discovery.issues);
    if(controller.signal.aborted) throw new Error('Aborted');
    browser=await chromium.launch({headless:true,chromiumSandbox:true,
      timeout:Math.max(1,Math.min(options.timeoutMs,options.maxDurationMs-(Date.now()-Date.parse(state.started))))});
    await save(state);
    let processed=0;
    while(!controller.signal.aborted) {
      const available=state.pages.filter(p=>p.state==='queued');
      if(!available.length)break;
      if(processed>=options.maxPages)break;
      const batch=available.slice(0,Math.min(options.concurrency,options.maxPages-processed));
      await Promise.all(batch.map(async p=>{
        if(!discovery.allowed(p.url)){p.state='skipped';p.reason='robots';return;}
        p.state='visiting';processed++;
        for(const mode of options.modes)for(const scenario of options.scenarios){
          if(controller.signal.aborted)break;
          try {
            const links=await visit(browser!,p.url,mode,scenario,options,controller.signal,state.observations,state.visits);
            for(const u of links)add(u,p.depth+1,p.url);
          } catch {state.issues.push('Browser visit setup failed.');}
        }
        const visits=state.visits.filter(v=>v.url===p.url);
        p.state=visits.length && visits.every(v=>v.state==='complete')?'visited':'failed';
        progress(`Pages processed: ${processed}; discovered: ${state.pages.length}; observations: ${state.observations.length}`);
        await save(state);
      }));
    }
    for(const p of state.pages.filter(p=>p.state==='queued')){p.state='skipped';p.reason=controller.signal.aborted?'interrupted':'page-limit';}
    state.state=controller.signal.aborted ? (timedOut?'partial':'aborted') :
      state.issues.length || state.pages.some(p=>p.state==='failed'||p.reason==='page-limit'||p.reason==='depth-limit'||p.reason==='robots') ||
      state.visits.some(v=>v.issues.length||!v.scenarioConfirmed) ? 'partial':'complete';
    if(timedOut)state.issues.push('Maximum scan duration reached.');
  } catch {
    state.state=controller.signal.aborted?(timedOut?'partial':'aborted'):'failed';
    state.issues.push(controller.signal.aborted?'Scan interrupted.':'Browser could not start or scan failed; verify runtime and browser installation.');
    for(const p of state.pages.filter(p=>p.state==='queued'||p.state==='visiting')){p.state='skipped';p.reason='interrupted';}
  } finally {
    clearTimeout(timer);signal?.removeEventListener('abort',abort);
    await browser?.close().catch(()=>{});
    state.ended=new Date().toISOString();
    await save(state,true);
  }
  return state;
}

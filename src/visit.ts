import type { Browser, Request, Page } from 'playwright';
import { randomUUID } from 'node:crypto';
import { normalizeUrl } from './config.js';
import { observeNetwork } from './network.js';
import type { Options, Mode, Scenario, Visit, Observation, Action } from './model.js';

export async function visit(browser: Browser, url: string, mode: Mode, scenario: Scenario,
  options: Options, signal: AbortSignal, records: Observation[], visits: Visit[]): Promise<string[]> {
  const start = Date.now();
  const item: Visit = { id: randomUUID(),url,mode,scenario:scenario.name,state:'running',
    scenarioConfirmed: !scenario.consent,actions:[],issues:[],started:new Date().toISOString() };
  visits.push(item);
  const context = await browser.newContext({ bypassCSP: mode === 'inventory', acceptDownloads:false,
    viewport:{width:1440,height:1000}, serviceWorkers:'allow' });
  let phase = 'initial';
  let recordCount=0;
  const byRequest = new Map<Request,Observation>();
  let markCdpOpen: ((reason:'visit-end'|'scan-abort')=>void)|undefined;
  const add = (raw: string, type: string, source: Observation['source'], extra: Partial<Observation> = {}) => {
    if(recordCount>=10000 || records.length>=250000) {
      if(!item.issues.includes('Observation limit reached.'))item.issues.push('Observation limit reached.');
      return;
    }
    let parsed: URL;
    try { parsed = new URL(raw); } catch { return; }
    if (!['http:','https:','ws:','wss:'].includes(parsed.protocol)) return;
    const observation: Observation = {id:randomUUID(),pageId:item.id,url:parsed.href,origin:parsed.origin,
      external:parsed.origin !== new URL(item.finalUrl ?? url).origin, own:options.ownOrigins.includes(parsed.origin),
      type,source,phase,timestamp:new Date().toISOString(),...extra};
    records.push(observation); recordCount++; return observation;
  };
  const markOpen = (reason: 'visit-end' | 'scan-abort') => {
    for(const r of byRequest.values()) if(r.complete===undefined && !r.failure) r.observationEnd=reason;
    markCdpOpen?.(reason);
  };
  let closing: Promise<void>|undefined;
  const close = () => closing??=(async()=>{
    item.contextCloseStarted=new Date().toISOString();
    await context.close().catch(()=>{});item.contextClosed=new Date().toISOString();
  })();
  const abort = () => { markOpen('scan-abort'); void close(); };
  signal.addEventListener('abort',abort,{once:true});
  const frameOf = (request: Request) => { try { return request.frame().url(); } catch { return undefined; } };
  context.on('request',request => {
    const record = add(request.url(),request.resourceType(),'network',{
      method:request.method(),frame:frameOf(request),redirectedFrom:request.redirectedFrom()?.url() });
    if (record) {
      const previous=request.redirectedFrom();const previousRecord=previous?byRequest.get(previous):undefined;
      if(previousRecord){record.previousId=previousRecord.id;previousRecord.nextId=record.id;}
      byRequest.set(request,record);
    }
  });
  context.on('response',response => { const r=byRequest.get(response.request()); if(r) {r.status=response.status();r.responseAt=new Date().toISOString();} });
  context.on('requestfinished',request => { const r=byRequest.get(request); if(r) {r.complete=true;r.finishedAt=new Date().toISOString();delete r.observationEnd;} });
  context.on('requestfailed',request => {
    const r=byRequest.get(request); if(r) { r.complete=false; r.failure=request.failure()?.errorText ?? 'Network failure';r.failedAt=new Date().toISOString(); }
  });
  await context.exposeBinding('__kwaCsp',({frame},data:{blockedURI:string;effectiveDirective:string;disposition:string}) => {
    add(data.blockedURI,'csp','csp',{frame:frame.url(),directive:data.effectiveDirective,disposition:data.disposition,
      failure:data.disposition === 'enforce' ? 'CSP blocked' : undefined});
  });
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation',event => {
      void (window as any).__kwaCsp({blockedURI:event.blockedURI,effectiveDirective:event.effectiveDirective,disposition:event.disposition});
    });
  });
  let page: Page | undefined;
  const instrument = (p: Page) => {
    p.on('dialog',d => void d.dismiss().catch(() => {}));
    p.on('websocket',socket => {
      const r=add(socket.url(),'websocket','websocket',{frame:p.url()});
      socket.on('socketerror',() => { if(r) r.failure='WebSocket error'; });
    });
  };
  context.on('page',p => { instrument(p); if(page && p !== page) { item.issues.push('Popup closed; popup content not inspected.'); void p.close(); } });
  const links: string[]=[];
  try {
    if(signal.aborted) throw new Error('Aborted');
    page=await context.newPage(); page.setDefaultTimeout(Math.min(options.timeoutMs,10000));
    item.browser={version:browser.version(),profile:options.browserProfile,
      ...await page.evaluate(()=>({userAgent:navigator.userAgent,webdriver:navigator.webdriver}))};
    // CDP pauses each redirected document request; Playwright routing only handles the first redirect hop.
    const cdp=await context.newCDPSession(page);
    markCdpOpen=await observeNetwork(cdp,add);
    const {frameTree}=await cdp.send('Page.getFrameTree');
    cdp.on('Fetch.requestPaused',event=>{
      let blocked=false;
      if(event.frameId===frameTree.frame.id) {
        try { blocked=!options.origins.includes(new URL(event.request.url).origin); } catch { blocked=true; }
      }
      if(blocked)item.issues.push('Top-level navigation outside allowed origins was blocked.');
      void cdp.send(blocked?'Fetch.failRequest':'Fetch.continueRequest',blocked?
        {requestId:event.requestId,errorReason:'BlockedByClient'}:{requestId:event.requestId}).catch(()=>{});
    });
    await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*',resourceType:'Document',requestStage:'Request'}]});
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:options.timeoutMs});
    item.finalUrl=page.url(); item.status=response?.status();
    if(response && response.status() >= 400) item.issues.push(`Document HTTP ${response.status()}`);
    const delay=async () => { if(options.waitMs) await page!.waitForTimeout(options.waitMs); };
    const observeConsent=async (phase:string)=>{
      const visibleStates:string[]=[];
      for(const state of options.consentStates) {
        try {if(await page!.locator(state.selector).first().isVisible())visibleStates.push(state.name);}
        catch {item.issues.push('Consent state selector could not be evaluated.');}
      }
      (item.consentObservations??=[]).push({phase,timestamp:new Date().toISOString(),visibleStates,
        state:visibleStates.length===1?'observed':visibleStates.length>1?'ambiguous':'unknown'});
    };
    await delay();
    await observeConsent('before-actions');
    const act=async (a:Action, nextPhase:string) => {
      const result={selector:a.selector,confirmed:false}; item.actions.push(result);
      phase=nextPhase;
      await page!.locator(a.selector).click();
      await page!.locator(a.confirm).waitFor({state:'visible'});
      result.confirmed=true;
      await delay();
    };
    if(scenario.consent) {
      try { await act(scenario.consent,'consent'); item.scenarioConfirmed=true; phase='after-consent'; }
      catch { item.issues.push('Consent action or visible confirmation failed.'); phase='unconfirmed-consent'; }
    }
    if(item.scenarioConfirmed) for(const a of scenario.actions ?? []) {
      try { await act(a,'interaction'); } catch { item.issues.push('Configured interaction or confirmation failed.'); }
    }
    for(let i=0;i<options.scrollSteps;i++) {
      await page.evaluate(() => window.scrollBy(0,Math.max(window.innerHeight * .8,300)));
      await page.waitForTimeout(200);
    }
    await delay();
    await observeConsent('after-actions');
    for(const frame of page.frames()) {
      try {
        const refs=await frame.evaluate(() => {
          const result:{url:string;type:string}[]=[];
          for(const el of document.querySelectorAll('script[src],link[href],img[src],img[srcset],source[src],source[srcset],video[src],audio[src],video[poster],iframe[src],object[data],embed[src],a[href]')) {
            const tag=el.tagName.toLowerCase();
            const type=tag==='a'?'navigation-link':tag==='link' ? `link:${el.getAttribute('rel') ?? ''}` : tag;
            for(const attr of ['src','href','poster','data']) {
              const raw=el.getAttribute(attr); if(raw) { try { result.push({url:new URL(raw,document.baseURI).href,type}); } catch {} }
            }
            const current=(el as HTMLImageElement).currentSrc;
            if(current) result.push({url:current,type});
            // Only currentSrc is reliable for comma-containing srcset URLs; unselected alternatives are not claimed complete.
          }
          return result;
        });
        const seen=new Set<string>();
        for(const ref of refs) {
          if(seen.has(`${ref.type}:${ref.url}`)) continue; seen.add(`${ref.type}:${ref.url}`);
          add(ref.url,ref.type,'dom',{frame:frame.url()});
          if(ref.type==='navigation-link' && frame===page.mainFrame()) {
            const u=normalizeUrl(ref.url); if(u) links.push(u);
          }
        }
      } catch { item.issues.push('A frame could not be inspected.'); }
    }
    item.state='complete';
  } catch {
    item.state=signal.aborted ? 'interrupted':'failed';
    item.issues.push(signal.aborted ? 'Visit interrupted.':'Navigation or browser observation failed.');
  } finally {
    markOpen(signal.aborted?'scan-abort':'visit-end');
    for(const r of records.filter(r=>r.pageId===item.id))r.external=r.origin!==new URL(item.finalUrl ?? url).origin;
    item.elapsedMs=Date.now()-start;
    signal.removeEventListener('abort',abort);
    await close();
  }
  return links;
}

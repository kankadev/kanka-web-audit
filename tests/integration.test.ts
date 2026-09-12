import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { config, normalizeUrl } from '../src/config.js';
import { scan } from '../src/scanner.js';
import { csvCell, html, redactor } from '../src/report.js';
import { fixture } from './fixtures/server.js';
import { outcome } from '../src/outcome.js';
import type { Observation } from '../src/model.js';

test('outcomes distinguish CSP, HTTP, aborts and unconfirmed network causes',()=>{
  const record={source:'network',type:'fetch'} as Observation;
  assert.equal(outcome({...record,status:204,failure:'net::ERR_ABORTED'}),'Antwort erhalten, danach abgebrochen');
  assert.equal(outcome({...record,status:404,failure:'net::ERR_ABORTED'}),'HTTP-Fehler');
  assert.equal(outcome({...record,failure:'net::ERR_FAILED'}),'Netzwerkfehler (Ursache offen)');
  assert.equal(outcome({...record,failure:'csp'}),'CSP blockiert');
  assert.equal(outcome({...record,failure:'net::ERR_FAILED',corsErrorStatus:{corsError:'MissingAllowOriginHeader',failedParameter:''}}),'CORS blockiert (Browsernachweis)');
  assert.equal(outcome({...record,source:'csp',disposition:'report'}),'CSP-Meldung (nur Bericht)');
  assert.equal(outcome({...record,status:204,complete:true}),'Übertragen');
  assert.equal(outcome({...record,failure:'net::ERR_ABORTED',observationEnd:'visit-end'}),'Bei Scan-Ende offen');
});

test('CDP preserves CORS evidence, redirect methods, browser identity and automatic consent state',async()=>{
  const f=await fixture();try{
    const browserProfile=process.env.KWA_TEST_HEADED==='1'?'headed':'headless';
    const dir=await output();
    const r=await scan(config({target:f.origin+'/diagnostics',browserProfile,output:dir,maxPages:1,waitMs:400,scrollSteps:0,
      consentStates:[{name:'automatic-acceptance',selector:'.auto-accepted'},{name:'fetch-resolved',selector:'#state:text-is("resolved")'}]}),undefined,()=>{});
    const denied=r.observations.find(o=>o.source==='cdp'&&o.url.endsWith('/cors-denied'));
    assert.ok(denied?.corsErrorStatus);assert.equal(outcome(denied),'CORS blockiert (Browsernachweis)');
    const post=r.observations.find(o=>o.source==='cdp'&&o.url.endsWith('/post303'));
    assert.equal(post?.method,'POST');assert.equal(post?.status,303);assert.ok(post?.nextId);
    const redirected=r.observations.find(o=>o.id===post?.nextId);
    assert.equal(redirected?.method,'GET');assert.equal(redirected?.status,204);assert.equal(redirected?.previousId,post?.id);
    assert.ok(!outcome(redirected!).includes('CSP'));
    const v=r.visits[0];assert.ok(v.browser?.version);assert.ok(v.browser?.userAgent);assert.equal(v.browser?.profile,browserProfile);
    assert.equal(v.actions.length,0);assert.ok(v.consentObservations?.[0].visibleStates.includes('automatic-acceptance'));
    assert.ok(v.consentObservations?.at(-1)?.visibleStates.includes('fetch-resolved'));
    assert.equal(v.consentObservations?.at(-1)?.state,'ambiguous');
    assert.ok(v.contextCloseStarted&&v.contextClosed&&v.contextCloseStarted<=v.contextClosed);
    assert.ok(denied.failedAt&&denied.failedAt<=v.contextClosed);
    const csv=await readFile(join(dir,'resources.csv'),'utf8');assert.ok(csv.includes('MissingAllowOriginHeader'));
  }finally{await f.close();}
});

test('unfinished response is marked before closing the browser and exported consistently',async()=>{
  const f=await fixture();try {
    const dir=await output();
    const r=await scan(config({target:f.origin+'/pending-page',output:dir,maxPages:1,waitMs:150,scrollSteps:0}),undefined,()=>{});
    const pending=r.observations.find(o=>o.url.endsWith('/pending')&&o.source==='network');
    assert.ok(pending);assert.equal(pending.status,200);assert.ok(pending.responseAt);
    assert.equal(pending.observationEnd,'visit-end');
    assert.equal(outcome(pending),'Bei Scan-Ende offen');
    assert.ok((await readFile(join(dir,'resources.csv'),'utf8')).includes('Bei Scan-Ende offen'));
    const browser=await chromium.launch({chromiumSandbox:true});try {
      const page=await browser.newPage();await page.goto(pathToFileURL(join(dir,'report.html')).href);
      await page.locator('#state').selectOption('Bei Scan-Ende offen');
      assert.ok(await page.locator('#results tr').count()>0);
      assert.ok((await page.locator('#results').innerText()).includes('Bei Scan-Ende offen'));
    }finally{await browser.close();}
  }finally{await f.close();}
});

const output=()=>mkdtemp(join(process.env.KWA_TEST_OUTPUT ?? tmpdir(),'kwa-test-'));

test('thorough audit verifies both decisions before crawling and respects scroll locks',async()=>{
  const f=await fixture();try{
    const settings={audit:'thorough',maxPages:1,waitMs:100,scrollSteps:1,timeoutMs:500,
      consentStates:[{name:'accepted',selector:'.accepted'},{name:'rejected',selector:'.rejected'}],
      scenarios:[{name:'accepted',decision:'accept',expectedState:'accepted',consent:{selector:'#accept',confirm:'.accepted'}},
        {name:'rejected',decision:'reject',expectedState:'rejected',consent:{selector:'#reject',confirm:'.rejected'}}]};
    const r=await scan(config({...settings,target:f.origin+'/consent-lock',output:await output()}),undefined,()=>{});
    assert.equal(r.visits.filter(v=>v.purpose==='preflight').length,4);
    assert.equal(r.visits.filter(v=>v.purpose==='crawl').length,4);
    assert.ok(r.visits.every(v=>v.scenarioConfirmed));
    assert.ok(r.pages.some(p=>p.url.endsWith('/consent-lock')&&p.state==='visited'));
    assert.ok(r.visits.every(v=>v.scroll?.[0].moved===0));
    assert.ok(r.visits.every(v=>v.scroll?.[1].moved===1));
    const failed=await scan(config({...settings,target:f.origin+'/diagnostics',output:await output(),scrollSteps:0,
      consentStates:[{name:'accepted',selector:'.auto-accepted'},{name:'rejected',selector:'.rejected'}],
      scenarios:[{name:'accepted',decision:'accept',expectedState:'accepted',consent:{selector:'#accept',confirm:'.auto-accepted'}},settings.scenarios[1]]}),undefined,()=>{});
    assert.equal(failed.state,'partial');assert.ok(failed.issues.some(i=>i.includes('preflight')));
    assert.ok(failed.visits.every(v=>v.purpose==='preflight'));
    assert.ok(!failed.pages.some(p=>p.state==='visited'));
    assert.throws(()=>config({...settings,target:f.origin,scenarios:[settings.scenarios[0]]}),/accept and reject/);
    assert.throws(()=>config({...settings,target:f.origin,modes:['inventory']}),/both CSP/);
  }finally{await f.close();}
});
test('URL/config validation and CSV formula escaping',()=>{
  assert.equal(normalizeUrl('https://site.test:443/a?q=1#b'),'https://site.test/a?q=1');
  assert.equal(normalizeUrl('https://user:pass@site.test'),undefined);
  assert.throws(()=>config({target:'file:///secret'}));
  assert.throws(()=>config({target:'https://site.test',maxPages:0}));
  assert.throws(()=>config({target:'https://site.test',typo:true}));
  assert.throws(()=>config({target:'https://site.test',browserProfile:'human'}));
  assert.throws(()=>config({target:'https://site.test',consentStates:[{name:'accepted',selector:''}]}));
  assert.equal(csvCell('=1+1'),'"\'=1+1"');
});

test('CLI writes all reports with correct exit status and handles SIGTERM on Linux',async()=>{
  const f=await fixture();try{
    const cli=fileURLToPath(new URL('../src/cli.js',import.meta.url));
    const run=(args:string[],stop=false)=>new Promise<number|null>((resolve,reject)=>{
      const child=spawn(process.execPath,[cli,...args],{stdio:'ignore'});
      const timer=stop?setTimeout(()=>child.kill('SIGTERM'),2000):undefined;
      child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);resolve(code);});
    });
    const dir=await output();
    assert.equal(await run([f.origin,'--output',dir,'--max-pages','1','--wait-ms','0']),2);
    for(const file of ['report.html','report.json','resources.csv'])assert.ok((await readFile(join(dir,file))).length>0);
    assert.equal(await run(['file:///invalid']),1);
    assert.equal(await run(['--help']),0);
    if(process.platform!=='win32'){
      const aborted=await output();
      assert.equal(await run([f.origin+'/hang','--output',aborted],true),130);
      assert.equal(JSON.parse(await readFile(join(aborted,'report.json'),'utf8')).state,'aborted');
    }
  }finally{await f.close();}
});

test('crawl merges sitemap and links, preserves errors, redirects, lazy assets and frames',async()=>{
  const f=await fixture();
  try {
    const dir=await output();
    const r=await scan(config({target:f.origin,output:dir,waitMs:250,scrollSteps:8,maxPages:20}),undefined,()=>{});
    assert.ok(r.pages.some(p=>p.url.endsWith('/orphan')&&p.state==='visited'));
    assert.ok(r.pages.some(p=>p.url.endsWith('/query?a=1&b=2')&&p.state==='visited'));
    assert.equal(r.pages.filter(p=>p.url.endsWith('/contact')).length,1);
    assert.ok(r.pages.some(p=>p.url.endsWith('/private')&&p.reason==='robots'));
    assert.ok(r.pages.some(p=>p.url.endsWith('/logout')&&p.reason==='excluded'));
    for(const suffix of ['/style.css','/font.woff2','/inner.svg','/lazy.svg','/entry.js'])assert.ok(r.observations.some(o=>o.url.endsWith(suffix)),suffix);
    assert.ok(r.observations.some(o=>o.redirectedFrom?.endsWith('/redirect')));
    assert.ok(r.observations.some(o=>o.status===404&&o.url.endsWith('/missing')));
    assert.ok(r.observations.some(o=>o.failure&&o.url.endsWith('/broken')));
    assert.ok(r.observations.some(o=>o.source==='websocket'));
    const disk=await readFile(join(dir,'report.json'),'utf8');
    assert.ok(!disk.includes('fixture-query-value'));
    assert.ok(disk.includes('redacted'));
    assert.ok((await readFile(join(dir,'resources.csv'),'utf8')).includes('Origin'));
    const browser=await chromium.launch({chromiumSandbox:true});
    try {
      const page=await browser.newPage(); const requests:string[]=[];const errors:string[]=[];
      page.on('request',req=>requests.push(req.url()));page.on('pageerror',e=>errors.push(e.message));
      await page.goto(pathToFileURL(join(dir,'report.html')).href);
      assert.ok(Number((await page.locator('#results tr').count()))>0);
      await page.locator('#search').fill('nonexistent-filter-value');
      assert.equal(await page.locator('#results tr').count(),0);
      assert.equal(requests.filter(u=>u.startsWith('http')).length,0);assert.deepEqual(errors,[]);
      await page.locator('#search').fill('');
      await page.screenshot({path:join(dir,'report-desktop.png'),fullPage:true});
      await page.setViewportSize({width:390,height:844});await page.locator('#search').fill('');
      await page.screenshot({path:join(dir,'report-mobile.png'),fullPage:true});
      console.log(`Report screenshots: ${dir}`);
    }finally{await browser.close();}
  }finally{await f.close();}
});

test('CSP enforcement reports blocked script while inventory discovers nested dependency',async()=>{
  const f=await fixture();try{
    const r=await scan(config({target:f.origin+'/csp',output:await output(),modes:['enforce','inventory'],maxPages:1,waitMs:300,scrollSteps:0}),undefined,()=>{});
    const modes=new Map(r.visits.map(v=>[v.id,v.mode]));
    assert.ok(r.observations.some(o=>o.source==='csp'&&o.directive?.startsWith('script-src')&&modes.get(o.pageId)==='enforce'));
    assert.ok(!r.observations.some(o=>o.url.includes('/nested?')&&modes.get(o.pageId)==='enforce'));
    assert.ok(r.observations.some(o=>o.url.includes('/nested?')&&modes.get(o.pageId)==='inventory'));
  }finally{await f.close();}
});

test('consent is isolated, confirmation is required, initial traffic retains its phase',async()=>{
  const f=await fixture();try{
    const r=await scan(config({target:f.origin,output:await output(),maxPages:1,waitMs:100,scrollSteps:0,timeoutMs:1000,
      scenarios:[{name:'initial'},{name:'accept',consent:{selector:'#accept',confirm:'.accepted'}},{name:'reject',consent:{selector:'#reject',confirm:'.rejected'}},{name:'missing',consent:{selector:'#absent',confirm:'.accepted'}}]}),undefined,()=>{});
    const visits=new Map(r.visits.map(v=>[v.scenario,v]));
    assert.equal(visits.get('missing')?.scenarioConfirmed,false);
    for(const [scenario,suffix] of [['accept','/accepted'],['reject','/rejected']]){
      assert.equal(visits.get(scenario)?.scenarioConfirmed,true);
      assert.ok(r.observations.some(o=>o.pageId===visits.get(scenario)?.id&&o.url.endsWith(suffix)&&o.phase==='consent'));
    }
    assert.ok(!r.observations.some(o=>o.pageId===visits.get('initial')?.id&&o.url.endsWith('/accepted')));
  }finally{await f.close();}
});

test('bounded interruption saves reports and external top-level redirect is not followed',async()=>{
  const f=await fixture();try{
    const dir=await output();const c=new AbortController();const timer=setTimeout(()=>c.abort(),700);
    const r=await scan(config({target:f.origin+'/hang',output:dir,maxPages:1,waitMs:0,scrollSteps:0}),c.signal,()=>{});clearTimeout(timer);
    assert.equal(r.state,'aborted');assert.ok((await readFile(join(dir,'report.html'),'utf8')).includes('Web Audit'));
    const redirect=await scan(config({target:f.origin+'/via',output:await output(),maxPages:1,waitMs:0,scrollSteps:0}),undefined,()=>{});
    assert.ok(redirect.visits[0].issues.some(i=>i.includes('outside')));
    assert.ok(!redirect.observations.some(o=>o.url.endsWith('/inner.svg')));
  }finally{await f.close();}
});

test('unsafe sitemap, duration limits, document HTTP errors and existing output are visible',async()=>{
  const f=await fixture();try{
    const dir=await output();
    const r=await scan(config({target:f.origin+'/notfound',sitemaps:[f.origin+'/unsafe.xml'],output:dir,maxPages:1,waitMs:0,scrollSteps:0}),undefined,()=>{});
    assert.equal(r.state,'partial');assert.ok(r.issues.some(i=>i.includes('Sitemap')));
    assert.ok(r.visits[0].issues.some(i=>i.includes('404')));
    assert.ok(r.pages.some(p=>p.reason==='page-limit'));
    await assert.rejects(()=>scan(config({target:f.origin,output:dir}),undefined,()=>{}),/already contains/);
    const timed=await scan(config({target:f.origin+'/hang',output:await output(),maxDurationMs:1000,timeoutMs:10000}),undefined,()=>{});
    assert.equal(timed.state,'partial');
    assert.ok(timed.issues.some(i=>i.includes('duration')||i.includes('interrupted')));
  }finally{await f.close();}
});

test('service-worker fetches are captured and URL masking does not merge identities',async()=>{
  const f=await fixture();try{
    const r=await scan(config({target:f.origin+'/sw',output:await output(),maxPages:1,waitMs:800,scrollSteps:0}),undefined,()=>{});
    assert.ok(r.observations.some(o=>o.url.endsWith('/worker-fetch')));
    const first=r.observations[0];r.observations=[{...first,url:'https://asset.test/a?x=one'},{...first,url:'https://asset.test/a?x=two'}];
    const safe=redactor(false)(r);assert.equal(safe.observations[0].url,safe.observations[1].url);
    assert.equal(safe.observations[0].origin,first.origin);
    assert.notEqual(safe.observations[0].urlKey,safe.observations[1].urlKey);
    const doc=html({...safe,issues:['</script><script>window.pwned=true</script>']});
    assert.ok(!doc.includes('</script><script>window.pwned'));
  }finally{await f.close();}
});

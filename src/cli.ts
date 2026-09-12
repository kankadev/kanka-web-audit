#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { config } from './config.js';
import { scan } from './scanner.js';
import { VERSION } from './version.js';

async function main() {
  const {values,positionals}=parseArgs({allowPositionals:true,options:{
    help:{type:'boolean',short:'h'},version:{type:'boolean'},profile:{type:'string'},output:{type:'string',short:'o'},
    'max-pages':{type:'string'},'max-duration':{type:'string'},concurrency:{type:'string'},'wait-ms':{type:'string'},
    sitemap:{type:'string',multiple:true},origin:{type:'string',multiple:true},start:{type:'string',multiple:true},
    mode:{type:'string'},'ignore-robots':{type:'boolean'},'full-urls':{type:'boolean'},'browser-profile':{type:'string'}
  }});
  if(values.version){console.log(VERSION);return;}
  if(values.help){console.log(`kanka-web-audit <URL> [options]

  --profile <file>        JSON website profile (selectors and limits)
  -o, --output <folder>   New report directory (default reports/<timestamp>)
  --max-pages <n>         Page limit (default 200)
  --max-duration <sec>    Total time budget (default 1800)
  --concurrency <n>       Concurrent pages, 1..8 (default 2)
  --wait-ms <ms>          Observation wait per phase (default 2000)
  --sitemap <URL>         Additional sitemap; repeatable
  --origin <URL>          Additional allowed page origin; repeatable
  --start <URL>           Additional start page; repeatable
  --mode <mode>          enforce, inventory or both (default enforce)
  --browser-profile <p>  headless (default) or headed; use separate output folders
  --ignore-robots         Explicitly ignore robots.txt crawl rules
  --full-urls             Keep query values in private local reports

Outputs: report.html, report.json, resources.csv. No remote upload.
Exit codes: 0 complete, 2 partial, 1 failure, 130 interrupted.
Only inspect targets and interactions you are authorized to test.`);return;}
  if(positionals.length>1)throw new Error('Expected one target URL.');
  let input:Record<string,unknown>={};
  if(values.profile){
    try { input=JSON.parse(await readFile(values.profile,'utf8')); } catch { throw new Error('Profile could not be read as JSON.'); }
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Profile must be a JSON object.');
  }
  if(positionals[0])input.target=positionals[0];
  if(values.output)input.output=values.output;
  if(values['browser-profile'])input.browserProfile=values['browser-profile'];
  for(const [flag,key] of [['max-pages','maxPages'],['concurrency','concurrency'],['wait-ms','waitMs']] as const)
    if(values[flag]!==undefined)input[key]=Number(values[flag]);
  if(values['max-duration']!==undefined)input.maxDurationMs=Number(values['max-duration'])*1000;
  if(values.sitemap)input.sitemaps=values.sitemap;if(values.origin)input.origins=values.origin;if(values.start)input.starts=values.start;
  if(values.mode)input.modes=values.mode==='both'?['enforce','inventory']:[values.mode];
  if(values['ignore-robots'])input.respectRobots=false;if(values['full-urls'])input.fullUrls=true;
  const options=config(input);
  const controller=new AbortController();
  const stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try {
    process.stderr.write(`Scan: max ${options.maxPages} pages, ${options.concurrency} parallel, modes ${options.modes.join(', ')}; ${options.scenarios.length} scenario(s).\n`);
    const result=await scan(options,controller.signal);
    console.log(JSON.stringify({state:result.state,output:options.output,pages:result.pages.length,visits:result.visits.length}));
    process.exitCode=result.state==='complete'?0:result.state==='aborted'?130:result.state==='partial'?2:1;
  }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
main().catch(error=>{process.stderr.write(`Error: ${error instanceof Error?error.message:'Invalid input'}\n`);process.exitCode=1;});

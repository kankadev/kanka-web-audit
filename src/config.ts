import { resolve } from 'node:path';
import type { Options, Scenario, Action } from './model.js';

export function normalizeUrl(raw: string, base?: string): string | undefined {
  try {
    const u = new URL(raw, base);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return;
    u.hash = '';
    return u.href;
  } catch { return; }
}
export function config(input: Record<string, unknown>): Options {
  const known = new Set(['target','output','origins','ownOrigins','starts','sitemaps','scenarios','modes',
    'maxPages','maxDiscovered','maxDepth','concurrency','timeoutMs','waitMs','scrollSteps','maxDurationMs',
    'respectRobots','fullUrls','exclude','browserProfile','consentStates','audit']);
  for (const key of Object.keys(input)) if (!known.has(key)) throw new Error(`Unknown option: ${key}`);
  const target = typeof input.target === 'string' ? normalizeUrl(input.target) : undefined;
  if (!target) throw new Error('Provide an absolute HTTP(S) target URL without credentials.');
  const list = (key: string, fallback: string[]): string[] => {
    const value = input[key] ?? fallback;
    if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) throw new Error(`${key} must be a string array.`);
    return value as string[];
  };
  const urls = (key: string) => list(key, []).map(v => {
    const u = normalizeUrl(v); if (!u) throw new Error(`Invalid URL in ${key}.`); return u;
  });
  const int = (key: string, fallback: number, min: number, max: number): number => {
    const v = input[key] ?? fallback;
    if (!Number.isInteger(v) || (v as number) < min || (v as number) > max) throw new Error(`Invalid ${key}: expected integer ${min}..${max}.`);
    return v as number;
  };
  const bool = (key: string, fallback: boolean) => {
    const v = input[key] ?? fallback;
    if (typeof v !== 'boolean') throw new Error(`${key} must be boolean.`); return v;
  };
  const action = (a: unknown): a is Action => !!a && typeof a === 'object' &&
    typeof (a as Action).selector === 'string' && !!(a as Action).selector.trim() &&
    typeof (a as Action).confirm === 'string' && !!(a as Action).confirm.trim();
  const scenarios = input.scenarios ?? [{ name: 'initial' }];
  if (!Array.isArray(scenarios) || !scenarios.length || scenarios.length > 10) throw new Error('Provide 1..10 scenarios.');
  for (const s of scenarios) {
    if (!s || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 80 ||
      (s.decision!==undefined&&!['accept','reject'].includes(s.decision)) ||
      (s.expectedState!==undefined&&(typeof s.expectedState!=='string'||!s.expectedState.trim())) ||
      (s.consent !== undefined && !action(s.consent)) ||
      (s.actions !== undefined && (!Array.isArray(s.actions) || s.actions.length > 10 || !s.actions.every(action))))
      throw new Error('Each scenario needs a name; each action needs selector and visible confirm selector.');
  }
  if (new Set(scenarios.map(s => s.name)).size !== scenarios.length) throw new Error('Scenario names must be unique.');
  const audit=input.audit??'resources';
  if(audit!=='resources'&&audit!=='thorough')throw new Error('audit must be resources or thorough.');
  const modes = list('modes', audit==='thorough'?['enforce','inventory']:['enforce']);
  if (!modes.length || modes.some(m => !['enforce','inventory'].includes(m)) || new Set(modes).size !== modes.length) throw new Error('Invalid modes.');
  const output = input.output ?? resolve('reports', new Date().toISOString().replace(/[:.]/g, '-'));
  if (typeof output !== 'string' || !output.trim()) throw new Error('Invalid output directory.');
  const browserProfile=input.browserProfile??'headless';
  if(browserProfile!=='headless'&&browserProfile!=='headed')throw new Error('browserProfile must be headless or headed.');
  const consentStates=input.consentStates??[];
  if(!Array.isArray(consentStates)||consentStates.length>20||consentStates.some(s=>!s||typeof s.name!=='string'||!s.name.trim()||typeof s.selector!=='string'||!s.selector.trim())||new Set(consentStates.map(s=>s.name)).size!==consentStates.length)throw new Error('consentStates requires unique names and visible-state selectors (maximum 20).');
  for(const s of scenarios)if(s.expectedState&&!consentStates.some(state=>state.name===s.expectedState))throw new Error('expectedState must name a configured consent state.');
  if(audit==='thorough') {
    if(!modes.includes('enforce')||!modes.includes('inventory'))throw new Error('Thorough audit requires both CSP modes.');
    if(!['accept','reject'].every(decision=>scenarios.some(s=>s.decision===decision)))throw new Error('Thorough audit requires accept and reject scenarios.');
    if(scenarios.some(s=>!s.decision||!s.consent||!s.expectedState))throw new Error('Each thorough scenario requires decision, consent action and expectedState.');
    const accepted=scenarios.filter(s=>s.decision==='accept').map(s=>s.expectedState);
    if(scenarios.some(s=>s.decision==='reject'&&accepted.includes(s.expectedState)))throw new Error('Accept and reject must have distinct expected states.');
  }
  return {
    audit,browserProfile,consentStates,
    target, output: resolve(output), origins: [...new Set([new URL(target).origin, ...urls('origins').map(u => new URL(u).origin)])],
    ownOrigins: urls('ownOrigins').map(u => new URL(u).origin), starts: urls('starts'), sitemaps: urls('sitemaps'),
    scenarios: scenarios as Scenario[], modes: modes as Options['modes'],
    maxPages: int('maxPages',200,1,100000), maxDiscovered: int('maxDiscovered',10000,1,1000000),
    maxDepth: int('maxDepth',10,0,100), concurrency: int('concurrency',2,1,8),
    timeoutMs: int('timeoutMs',30000,100,120000), waitMs: int('waitMs',2000,0,30000),
    scrollSteps: int('scrollSteps',8,0,100), maxDurationMs: int('maxDurationMs',1800000,1000,86400000),
    respectRobots: bool('respectRobots',true), fullUrls: bool('fullUrls',false), exclude: list('exclude',[])
  };
}

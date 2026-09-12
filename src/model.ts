export type Mode = 'enforce' | 'inventory';
export interface Action { selector: string; confirm: string; }
export interface Scenario {
  name: string;
  decision?: 'accept' | 'reject';
  expectedState?: string;
  consent?: Action;
  actions?: Action[];
}
export interface Options {
  audit: 'resources' | 'thorough';
  browserProfile: 'headless' | 'headed';
  consentStates: {name: string; selector: string}[];
  target: string; output: string; origins: string[]; ownOrigins: string[];
  starts: string[]; sitemaps: string[]; scenarios: Scenario[]; modes: Mode[];
  maxPages: number; maxDiscovered: number; maxDepth: number; concurrency: number;
  timeoutMs: number; waitMs: number; scrollSteps: number; maxDurationMs: number;
  respectRobots: boolean; fullUrls: boolean; exclude: string[];
}
export interface Observation {
  id: string; pageId: string; url: string; origin: string; external: boolean; own: boolean;
  type: string; source: 'network' | 'cdp' | 'dom' | 'csp' | 'websocket'; phase: string;
  frame?: string; method?: string; status?: number; complete?: boolean;
  failure?: string; redirectedFrom?: string; directive?: string; disposition?: string;
  timestamp: string;
  responseAt?: string; finishedAt?: string; failedAt?: string;
  observationEnd?: 'visit-end' | 'scan-abort';
  requestId?: string; previousId?: string; nextId?: string;
  blockedReason?: string; corsErrorStatus?: {corsError: string; failedParameter: string};
  protocolTimestamp?: number;
  redirectAt?: string;
}
export interface Visit {
  purpose?: 'preflight' | 'crawl';
  id: string; url: string; finalUrl?: string; mode: Mode; scenario: string;
  state: 'running' | 'complete' | 'failed' | 'interrupted'; status?: number;
  scenarioConfirmed: boolean; actions: { selector: string; confirmed: boolean }[];
  issues: string[]; started: string; elapsedMs?: number;
  browser?: {version: string; userAgent: string; webdriver: boolean; profile: string};
  contextCloseStarted?: string; contextClosed?: string;
  scroll?: {phase: string; requested: number; moved: number}[];
  consentObservations?: {phase: string; timestamp: string; visibleStates: string[]; state: 'observed' | 'unknown' | 'ambiguous'}[];
}
export interface PageEntry { url: string; depth: number; source: string; state: string; reason?: string; }
export interface Result {
  schemaVersion: 1; toolVersion: string; started: string; ended?: string;
  state: 'running' | 'complete' | 'partial' | 'aborted' | 'failed';
  options: Options; pages: PageEntry[]; visits: Visit[]; observations: Observation[];
  issues: string[]; limitations: string[];
}

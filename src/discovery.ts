import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { createRequire } from 'node:module';
const robotsParser = createRequire(import.meta.url)('robots-parser') as (url:string,text:string) => {
  getSitemaps(): string[]; isAllowed(url:string,agent:string): boolean | undefined;
};
import type { Options } from './model.js';
import { normalizeUrl } from './config.js';

export const userAgent = 'kanka-web-audit/0.1';
export class Discovery {
  private robots = new Map<string, ReturnType<typeof robotsParser> | null>();
  private sitemapSeen = new Set<string>();
  issues: string[] = [];
  constructor(private options: Options, private signal: AbortSignal) {}
  inScope(url: string): boolean { return this.options.origins.includes(new URL(url).origin); }
  async text(url: string): Promise<{ status: number; text: string }> {
    let current = url;
    for (let i = 0; i < 6; i++) {
      if (!this.inScope(current)) throw new Error('Discovery redirect outside allowed origins');
      const response = await fetch(current, {
        redirect: 'manual', headers: { 'user-agent': userAgent },
        signal: AbortSignal.any([this.signal, AbortSignal.timeout(this.options.timeoutMs)])
      });
      if ([301,302,303,307,308].includes(response.status)) {
        const next = normalizeUrl(response.headers.get('location') ?? '',current);
        await response.body?.cancel();
        if (!next) throw new Error('Invalid discovery redirect');
        current = next; continue;
      }
      const parts: Uint8Array[] = []; let length = 0;
      if (response.body) for await (const part of response.body) {
        length += part.length;
        if (length > 5 * 1024 * 1024) throw new Error('Discovery response exceeds 5 MiB');
        parts.push(part);
      }
      return { status: response.status, text: Buffer.concat(parts).toString('utf8') };
    }
    throw new Error('Too many discovery redirects');
  }
  async prepare(add: (url: string, source: string) => void) {
    const maps = new Set(this.options.sitemaps);
    for (const origin of this.options.origins) {
      try {
        const response = await this.text(`${origin}/robots.txt`);
        if (response.status >= 200 && response.status < 300) {
          const robot = robotsParser(`${origin}/robots.txt`, response.text);
          this.robots.set(origin, robot);
          for (const u of robot.getSitemaps()) maps.add(u);
        } else if ([404,410].includes(response.status)) this.robots.set(origin, robotsParser(`${origin}/robots.txt`, ''));
        else {
          this.robots.set(origin, null);
          this.issues.push(`robots.txt unavailable (${response.status}) at ${origin}; crawl denied unless robots checks are explicitly disabled.`);
        }
      } catch {
        this.robots.set(origin, null);
        this.issues.push(`robots.txt could not be retrieved at ${origin}; crawl denied unless robots checks are explicitly disabled.`);
      }
    }
    if (!maps.size) maps.add(new URL('/sitemap.xml', this.options.target).href);
    let count = 0;
    const discover = (url: string, source: string) => { if (count++ < this.options.maxDiscovered) add(url, source); };
    for (const url of maps) await this.sitemap(url, 0, discover);
    if (count > this.options.maxDiscovered) this.issues.push('Sitemap discovery limit reached.');
  }
  allowed(url: string): boolean {
    if (!this.options.respectRobots) return true;
    const robots = this.robots.get(new URL(url).origin);
    return !!robots && robots.isAllowed(url, userAgent) !== false;
  }
  private async sitemap(raw: string, depth: number, add: (url: string, source: string) => void): Promise<void> {
    const url = normalizeUrl(raw);
    if (!url || this.sitemapSeen.has(url) || this.signal.aborted) return;
    if (!this.inScope(url)) { this.issues.push(`Sitemap outside allowed origins skipped: ${url}`); return; }
    if (depth > 5 || this.sitemapSeen.size >= 100) { this.issues.push('Sitemap index limit reached.'); return; }
    this.sitemapSeen.add(url);
    try {
      const response = await this.text(url);
      if ([404,410].includes(response.status)) return;
      if (response.status < 200 || response.status >= 300) throw new Error('Sitemap HTTP error');
      if (/<!DOCTYPE|<!ENTITY/i.test(response.text) || XMLValidator.validate(response.text) !== true) throw new Error('Invalid or unsafe sitemap XML');
      const xml = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, processEntities: true }).parse(response.text);
      const array = (v: unknown): any[] => v === undefined ? [] : Array.isArray(v) ? v : [v];
      if (xml.sitemapindex) for (const entry of array(xml.sitemapindex.sitemap)) {
        if (typeof entry.loc === 'string') await this.sitemap(new URL(entry.loc,url).href,depth + 1,add);
      }
      else if (xml.urlset) for (const entry of array(xml.urlset.url)) {
        if (typeof entry.loc === 'string') { const u = normalizeUrl(entry.loc,url); if (u) add(u,`sitemap:${url}`); }
      }
      else throw new Error('Not a sitemap');
    } catch { this.issues.push(`Sitemap could not be parsed or retrieved: ${url}`); }
  }
}

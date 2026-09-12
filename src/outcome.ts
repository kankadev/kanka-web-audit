import type { Observation } from './model.js';

// Shared by HTML and CSV; evidence takes precedence over inferred causes.
export function outcome(r: Observation): string {
  if ((r.source==='csp' && r.disposition==='enforce') || r.failure==='csp' || r.failure==='CSP blocked' || r.blockedReason==='csp') return 'CSP blockiert';
  if (r.corsErrorStatus) return 'CORS blockiert (Browsernachweis)';
  if (r.status !== undefined && r.status>=400) return 'HTTP-Fehler';
  if (r.source==='csp') return 'CSP-Meldung (nur Bericht)';
  if (r.observationEnd) return 'Bei Scan-Ende offen';
  if (r.failure?.includes('ERR_ABORTED')) return r.status ? 'Antwort erhalten, danach abgebrochen' : 'Abgebrochen (Ursache offen)';
  if (r.failure) return 'Netzwerkfehler (Ursache offen)';
  if (r.complete) return 'Übertragen';
  if (r.source==='dom') return 'Referenziert';
  return r.status ? 'Antwort erhalten, Abschluss offen' : 'Versucht / offen';
}

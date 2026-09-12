# Kanka Web Audit – Umsetzungsplan

Stand: 2026-09-12

Status: Planung; Implementierung noch nicht begonnen

Verantwortlich: KankaDev

## 1. Ziel

Eine Website-Adresse soll genügen, um eine nachvollziehbare Bestandsaufnahme externer Ressourcen über alle auffindbaren und erfolgreich untersuchten Unterseiten zu erzeugen. Der Bericht beantwortet:

1. Welche externen URLs und Origins wurden beobachtet?
2. Auf welchen Seiten und in welchem Besuchszustand kamen sie vor?
3. Welcher Ressourcentyp und gegebenenfalls welche CSP-Direktive gehören dazu?
4. Wurde eine Ressource nur referenziert, angefordert, erfolgreich übertragen oder blockiert?
5. Welche Seiten, Interaktionen und Zustände wurden nicht untersucht?

Die Ergebnisse unterstützen die manuelle Prüfung von CSP-Freigaben und externen Datenverbindungen. Das Tool trifft keine rechtliche Konformitätsentscheidung und übernimmt keine Freigaben automatisch.

## 2. Produktform und erste Ausbaustufe

Die erste nutzbare Version besteht aus einem Kommandozeilenprogramm, einem Docker-Image und einem eigenständigen HTML-Bericht. Der Container wird für einen Scan gestartet und beendet sich anschließend. Ergebnisse werden in einen eingebundenen Ausgabeordner geschrieben. Es werden weder ein ständig laufender Webserver noch eine Datenbank benötigt.

Der Scanner erhält eine von CLI und Bericht getrennte Schnittstelle. Eine spätere Weboberfläche kann dadurch dieselben Scanaufträge ausführen. Eine Desktop-Anwendung und ein öffentlich erreichbarer Scanservice sind nicht Teil der ersten Version.

Vorgesehene technische Basis: TypeScript, Node.js und Playwright mit Chromium. Die konkreten unterstützten Versionen werden bei Implementierungsbeginn anhand der offiziellen Releases gewählt und gemeinsam mit den Browser-Binaries festgeschrieben. Playwright-Paket und Container-Browser müssen zusammenpassen.

## 3. Umfang

### Muss für die erste nutzbare Version

- Einstieg über Website-Adresse, optionale Sitemap und zusätzliche Start-URLs.
- Sitemap-Indizes und interne Links als kombinierte Seitenerkennung.
- Begrenzte Crawl-Tiefe, Seitenzahl, Laufzeit und Parallelität.
- Browsergestütztes Laden einschließlich JavaScript und begrenztem Scrollen.
- Inventar externer HTTP(S)-Anfragen, Redirect-Ziele und erkannter WebSocket-Verbindungen.
- DOM-basierte Referenzsuche als Ergänzung der beobachteten Anfragen.
- CSP-Verstöße und Netzwerkfehler mit nachvollziehbarer Herkunft.
- Getrennte Ergebnisse für unveränderte CSP und optionalen Inventarmodus.
- Ohne Consent-Interaktion sowie konfigurierbare Ablehnungs- und Zustimmungsprofile.
- Gruppierung nach URL und Origin mit vollständiger Zuordnung zu Fundseiten.
- Lokaler HTML-Bericht, maschinenlesbares JSON und CSV-Export.
- Deutliche Abdeckungsangaben und Erhalt bereits gesammelter Ergebnisse bei Abbruch.
- Synthetische Integrationstests ohne reale fremde Domains.

### Spätere Erweiterungen

- Vergleich zweier Scans mit neuen und verschwundenen Ressourcen.
- Komfortablere Einrichtung von Consent- und Interaktionsprofilen.
- Zusätzliche Browser, mobile Besuchsszenarien und kontrollierte Login-Profile.
- Ergänzende Cookie-, Storage- und DNS/CNAME-Auswertung.
- Hinweise auf mögliche CSP-Direktiven mit ausdrücklicher Prüfung durch den Anwender.
- Weboberfläche hinter Authentik mit Auftragswarteschlange und Ergebnisverwaltung.

### Nicht zugesagt

- Vollständiger DSGVO-Check oder automatische rechtliche Bewertung.
- Erkennung aller Dienste durch Hersteller- oder Tracking-Domainlisten.
- Vollständige Analyse beliebiger JavaScript-Programme.
- Erfassung serverseitiger Weitergaben oder aller regionalen und zeitabhängigen Varianten.
- Automatisches Ändern von CSP, Consent-Konfiguration oder untersuchten Websites.
- Automatisches Umgehen von Login, CAPTCHA oder Zertifikatsfehlern.

## 4. Bedienablauf

1. Nutzer gibt eine Zieladresse und gegebenenfalls ein Website-Profil an.
2. CLI prüft Eingaben und zeigt Crawl-Grenzen, gewählte Szenarien und Ausgabeziel.
3. Seitenerkennung legt eine deduplizierte Warteschlange an.
4. Browser besucht die Seiten je Szenario und protokolliert Beobachtungen.
5. Fortschrittsausgabe meldet bearbeitete Seiten, Fehler und verbleibende Grenzen.
6. Scanner schreibt Ergebnisse fortlaufend; Abschluss erzeugt die Berichte.
7. CLI beendet sich mit einem dokumentierten Status für Erfolg, Teilergebnis, Abbruch oder Fehler.

Der Fortschritt wird auf stderr ausgegeben; maschinenlesbare Ausgaben bleiben davon getrennt. Hilfetexte nennen sinnvolle Standardwerte. Die genaue Befehlsoberfläche wird erst nach Implementierung als ausführbare Anleitung in `readme.md` dokumentiert.

## 5. Seitenerkennung und Crawl-Grenzen

### Quellen

- Startadresse und explizite Zusatz-URLs.
- Explizit übergebene Sitemap sowie Sitemap-Hinweise aus robots.txt.
- Ein begrenzter Versuch am üblichen Sitemap-Pfad, wenn keine Sitemap bekannt ist.
- Sitemap-Indizes mit Schutz vor Schleifen, übergroßen Dateien und zu tiefer Verschachtelung.
- Interne Navigationslinks aus dem gerenderten DOM.

### Normalisierung

Fragmente werden für normale Dokumentnavigation entfernt; relative URLs werden gegen die wirksame Basis-URL aufgelöst. Scheme, Host und Standardports werden normalisiert. Query-Parameter bleiben grundsätzlich erhalten, da sie Inhalte verändern können. Optionale Regeln zum Entfernen bekannter Tracking-Parameter dürfen keine stillen Zusammenlegungen fachlich verschiedener Seiten verursachen.

Hash-Routing und clientseitige Sondernavigation gelten zunächst als gesonderte, zu dokumentierende Abdeckungslücke. Explizite Szenarien können später solche Zustände erschließen.

### Scope

Standardmäßig werden nur Seiten der erlaubten Ziel-Origin als Crawl-Ziele verfolgt. Zusätzliche eigene Origins werden ausdrücklich konfiguriert. Ein Redirect auf eine andere Origin wird sichtbar gemacht; die Crawl-Grenze wird dadurch nicht stillschweigend erweitert. Externe Ressourcen werden erfasst, ihre verlinkten Websites aber nicht rekursiv gecrawlt.

robots.txt wird standardmäßig respektiert. Eine bewusste Ausnahme für eigene Websites ist als Einstellung und im Bericht sichtbar. Formulare, Warenkorb-, Kauf-, Lösch- und Logout-Aktionen werden nicht automatisch betätigt. Linkfilter und Seitenlimits begrenzen Kalender, Suchseiten und Parameterkombinationen.

Startwerte für Tests: zwei gleichzeitig besuchte Seiten, höchstens 200 Seiten, 30 Sekunden Navigationstimeout und ein zusätzlich begrenztes Beobachtungsfenster. Diese Werte sind Planungsannahmen und werden anhand der Testlaufzeiten angepasst. Erreichte Grenzen erscheinen als Ursache unvollständiger Abdeckung.

## 6. Browserbeobachtung

Listener werden vor der ersten Navigation eingerichtet. Gesammelt werden Request-, Response- und Fehlerereignisse, Redirect-Beziehungen, Frame-Zuordnung sowie CSP-Verstöße. Zusätzlich wird geprüft, welche Ereignisse Service Worker und WebSockets liefern; nicht abgedeckte Bereiche werden ausdrücklich ausgewiesen.

Der Seitenbesuch umfasst Navigation, eine begrenzte Wartephase und schrittweises Scrollen mit Obergrenze. Ein ausschließliches Warten auf Netzwerkruhe ist ungeeignet, weil manche Seiten dauerhaft Anfragen erzeugen. Langsame oder fortlaufende Verbindungen dürfen den Scan nicht unbegrenzt aufhalten.

Die ergänzende DOM-Auswertung betrachtet unter anderem Script-, Stylesheet-, Bild-, srcset-, Medien- und Frame-Referenzen sowie Ladehinweise. CSS-Ressourcen, die der Browser tatsächlich anfordert, erscheinen im Netzwerkprotokoll. Ein umfassender statischer CSS-/JavaScript-Parser ist zunächst nicht vorgesehen. Externe Navigationslinks und bloße Verbindungs-Hinweise werden getrennt von Ressourcenanforderungen dargestellt.

Statuswerte sind unabhängig voneinander: Eine URL kann referenziert und angefordert worden sein. Eine Antwort allein bedeutet noch keine vollständig abgeschlossene Übertragung. HTTP-Fehlerstatus, Netzwerkfehler, CSP-Blockade und erfolgreicher Request-Abschluss werden separat gespeichert. Erfolgreiche Übertragung beweist nicht, dass ein Script erfolgreich ausgeführt oder ein Bild angezeigt wurde.

## 7. CSP-Modi

### Ist-Zustand

Der Browser respektiert die vorhandene CSP. CSP-Verstöße werden einschließlich wirksamer Direktive, Dokument und gemeldeter blockierter Adresse gesammelt. Es wird nicht angenommen, dass jeder blockierte Versuch ein normales Request-Ereignis auslöst. CSP-Meldungen können externe Adressen auf die Origin verkürzen; fehlende URL-Bestandteile werden nicht erfunden.

### Ressourceninventar

Ein ausdrücklich gewählter zweiter Durchlauf darf die CSP ausschließlich im Scan-Browser umgehen. Dadurch können Abhängigkeiten erscheinen, deren Einstiegsscript im Ist-Zustand blockiert war. Es werden keine produktiven Header verändert. Die Ergebnisse dieses Modus bleiben von tatsächlichem Verhalten unter der produktiven CSP unterscheidbar.

Die Zuordnung eines Ressourcentyps zu einer CSP-Direktive ist eine Hilfestellung. Vererbung, Nonces, Hashes, Frames und dynamische Script-Vertrauensketten verhindern eine allgemein sichere automatische Allowlist. Das Tool erzeugt in der ersten Version keine direkt einzuspielende CSP.

## 8. Consent und Interaktionen

Vorgesehen sind drei separat messbare Zustände: keine Interaktion, Ablehnung und Zustimmung. Ein frischer Browserkontext pro Seite und Szenario verhindert zunächst die unbeabsichtigte Übernahme von Cookies oder Storage aus anderen Messungen.

Website-Profile definieren konkrete Consent-Selektoren, eine erwartete Zustandsbestätigung und begrenzte Wartezeiten. Vor und nach der Aktion beobachtete Ressourcen bleiben unterscheidbar. Ein Klick allein beweist keine wirksame Zustimmung oder Ablehnung. Fehlt der Button oder schlägt die Zustandsprüfung fehl, wird das Szenario als unbestätigt ausgewiesen und nicht als bestanden behandelt.

Optional konfigurierte Aktionen aktivieren beispielsweise eine Karte oder ein Video. Es gibt kein beliebiges Durchklicken aller Buttons. Jeder Bericht nennt ausgeführte, fehlgeschlagene und ausgelassene Aktionen. Die Szenarien werden nur auf den vom Nutzer gewählten Zielen ausgeführt.

## 9. Extern-Begriff und Datenmodell

Für CSP wird eine Origin als Kombination aus Scheme, Host und Port betrachtet. Auch eine andere Subdomain kann daher CSP-relevant sein. Zusätzlich kann eine konfigurierbare Zuordnung eigene Infrastruktur kennzeichnen. Diese Zuordnung entfernt keine Beobachtung aus dem Rohinventar.

Eine fremde Origin ist nicht automatisch ein fremdes Unternehmen; eine eigene Origin beweist umgekehrt keine ausschließlich interne Verarbeitung. DNS-Aliase und vorgeschaltete Proxys werden in der ersten Version nicht automatisch rechtlich oder organisatorisch bewertet.

Vorgesehene Datensätze:

| Datensatz | Inhalte |
| --- | --- |
| Scan | Schema-Version, Tool-Version, Beginn/Ende, Scope, Grenzen, Szenarien, CSP-Modus, Gesamtstatus |
| Seite | Angefragte und endgültige URL, Entdeckungsquelle, HTTP-Status, Besuchsstatus, Fehler, Dauer |
| Beobachtung | URL soweit verfügbar, Origin, Ressourcentyp, Methode, Zeitpunkt, Frame, Phase, Fundseite |
| Netzwerkstatus | Antwortstatus, Request-Abschluss, Fehlergrund, Redirect-Beziehung |
| CSP-Verstoß | Gemeldete Adresse, wirksame Direktive, Dokument, disposition, verfügbare Quellinformation |
| Szenario | Gewünschter Zustand, ausgeführte Aktionen, bestätigter Zustand, Fehler |
| Abdeckung | Entdeckte, besuchte, fehlgeschlagene und ausgelassene Seiten; Gründe und erreichte Limits |

Rohbeobachtungen bleiben von aggregierten Ansichten getrennt. Gruppierung nach exakter URL und Origin muss bis zur einzelnen Fundstelle zurückverfolgbar sein. Unterschiedliche Query-Strings werden nicht allein für eine kürzere Anzeige zusammengeführt.

## 10. Berichte und Datensparsamkeit

Der HTML-Bericht funktioniert ohne Internetzugriff und benötigt keine externen Scripts, Schriften oder Dienste. Er enthält Suche, Filter nach Typ/Status/Szenario, Origin-Zusammenfassung, Fundseiten und eine sichtbare Abdeckungsübersicht.

JSON ist das versionierte Austauschformat. CSV stellt die wesentlichen Beobachtungen tabellarisch bereit. Exportierte Texte werden gegen HTML-/Script-Injektion und CSV-Formelausführung abgesichert; ungültige oder gefährliche Link-Schemes werden nicht klickbar gemacht.

URLs können vertrauliche Werte enthalten. Standardberichte maskieren Query-Werte und entfernen Benutzerinformationen aus URLs. Eine ausdrücklich gewählte lokale Detailausgabe kann vollständige Query-Werte bewahren. Die interne Gruppierung verwendet bei maskierter Ausgabe eine scanbezogene Kennung, damit unterschiedliche URLs nicht versehentlich zusammenfallen. Pfade können ebenfalls vertraulich sein; Berichte gelten deshalb grundsätzlich als private Arbeitsdaten.

Request-/Response-Bodies, Authorization-Header, Cookie-Werte und Browserprofile werden standardmäßig nicht gespeichert. Report-Dateien und kundenspezifische Profile werden über `.gitignore` ausgeschlossen. Beispieldaten beruhen ausschließlich auf lokalen Testfällen oder reservierten `.test`-Namen.

## 11. Module und Ablage

Geplante Module: CLI/Eingabeprüfung, URL-Normalisierung und Scope, Sitemap/Discovery, Browserbesuch, Szenarien, Beobachtungsspeicher, Aggregation und Export. Der Browserkern liefert strukturierte Ergebnisse und kennt keine HTML-Oberfläche.

Vorgesehene Ablage nach Beginn der Implementierung:

```text
src/
  cli/
  discovery/
  scanner/
  scenarios/
  reports/
  model/
tests/
  fixtures/
  integration/
examples/
docs/
Dockerfile
readme.md
plan.md
```

Ein öffentlich betriebener Webscanner würde zusätzliche Absicherung gegen SSRF, DNS-Rebinding, unkontrollierte Zielnetze, Ressourcenverbrauch und unbefugten Zugriff auf Reports benötigen. Authentik allein löst diese Anforderungen nicht. Diese Architektur wird erst für die spätere Webvariante entworfen; das CLI wird zunächst als lokal betriebenes Werkzeug für bewusst ausgewählte Ziele behandelt.

## 12. Docker und Betrieb

Das Image enthält passende Browser-Binaries und festgeschriebene Abhängigkeiten. Der Prozess läuft mit möglichst geringen Rechten; die Browser-Sandbox wird nicht pauschal deaktiviert. Die konkrete Sandbox-Konfiguration wird mit dem gewählten Basisimage geprüft.

Ein beschreibbares Ausgabeverzeichnis und temporäre Browserdaten sind getrennt. SIGINT/SIGTERM führen zu begrenztem Aufräumen und einem als unvollständig markierten Ergebnis. Es werden keine Host-Verzeichnisse außer bewusst übergebenen Eingabe-/Ausgabepfaden vorausgesetzt.

Zunächst wird das Image lokal gebaut und geprüft. Registry-Publishing erfolgt später ausdrücklich privat mit versionierten Tags. Öffentliche Repository- oder Image-Sichtbarkeit wird nicht automatisch aktiviert. Lizenzwahl, unterstützte Plattformen und Release-Verfahren bleiben vor Veröffentlichung offene Entscheidungen.

## 13. Test- und Abnahmekonzept

Die Tests verwenden einen lokalen Fixture-Server mit getrennten Origins. Er stellt Seiten, Ressourcen, verschachtelte Sitemaps, Redirects, CSP-Header und ein kontrollierbares Consent-Modell bereit. Erwartete externe Ressourcen sind im Test bekannt und werden mit dem erzeugten Inventar verglichen.

| Testfall | Abnahme |
| --- | --- |
| Sitemap plus interne Links | Vereinigung dedupliziert; Index-Schleifen und Limits werden beherrscht |
| Statische und dynamische Ressourcen | Script, CSS, Bild, Font, Frame und Fetch werden mit Fundseite erkannt |
| Verschachtelte Frames und Redirects | Ziel-Origin und Zuordnung bleiben nachvollziehbar |
| CSP blockiert Einstiegsscript | Ist-Modus meldet Blockade; Inventarmodus findet zusätzliche Abhängigkeiten |
| Consent | Initial-, Ablehnungs- und Zustimmungszustand sind getrennt und bestätigt |
| Fehlende Consent-Aktion | Kein falscher Erfolg; deutlicher Szenariofehler |
| Lazy Loading und Dauerverbindung | Begrenztes Scrollen entdeckt Ressourcen; Scan endet trotz Daueraktivität |
| Netzwerk-/HTTP-Fehler | Status werden korrekt unterschieden; andere Seiten werden weiter bearbeitet |
| Service Worker/WebSocket | Verhalten experimentell geprüft und erfasste bzw. fehlende Bereiche dokumentiert |
| Abbruch und Seitenlimit | Teilergebnis lesbar; ausgelassene Seiten und Gründe vorhanden |
| Bericht mit bösartigen Zeichen | Keine Script- oder CSV-Formelausführung; Sonderzeichen bleiben lesbar |
| Vertrauliche Query-Werte | Standardexport maskiert Werte, Gruppierung bleibt unterscheidbar |
| Docker-End-to-End | Fixture-Scan schreibt lesbare HTML-, JSON- und CSV-Dateien in den Ausgabeordner |

Ein erster realer Scan erfolgt nur gegen ein bewusst ausgewähltes eigenes Ziel. Ergebnisse bleiben außerhalb des Repositorys. Tests gegen reale fremde Websites sind keine Voraussetzung für die automatisierte Suite.

## 14. Umsetzungsschritte

### Phase 0 – Projektgrundlage

- [x] Privates Repository anlegen.
- [x] Lokale Commit-Identität auf Akay mit der KankaDev-Mailadresse setzen.
- [x] Plan und faktenbasierte Readme vorbereiten.
- [x] Dokumentation committen, übertragen und Remote-Stand prüfen.

Abnahme: Beide Dokumente liegen im privaten Repository; Autor und Committer stimmen.

Nachweis vom 2026-09-12: Initialer Dokumentationscommit `66b235f` nach `main` übertragen; Remote-SHA stimmt mit dem lokalen Commit überein. Autor und Committer sind jeweils Akay mit der konfigurierten KankaDev-Mailadresse. Der vorgelagerte Git-Whitespace-Check war erfolgreich. Anwendungstests sind in dieser Phase noch nicht vorhanden.

### Phase 1 – Reproduzierbarer technischer Kern

- [ ] Aktuelle Laufzeit-/Playwright-Versionen prüfen und festschreiben.
- [ ] Projektstruktur, Lockfile, Build, Eingabeprüfung und CLI-Hilfe erstellen.
- [ ] Lokalen Fixture-Server und erste Browsermessung implementieren.
- [ ] Datenmodell und versioniertes JSON-Ergebnis festlegen.

Abnahme: Ein lokaler Testscan erfasst die erwarteten Ressourcen einschließlich Fehlern.

### Phase 2 – Crawl und Abdeckung

- [ ] Sitemap-/Index-Verarbeitung, interne Links und Deduplizierung implementieren.
- [ ] Scope, robots.txt, Limits, Timeouts und Fortschritt umsetzen.
- [ ] Abbruchverhalten und teilweise Ergebnisse prüfen.

Abnahme: Der Fixture-Crawl besucht genau die zulässigen Seiten und dokumentiert Auslassungen.

### Phase 3 – CSP und Szenarien

- [ ] CSP-Ereignisse und getrennten Inventarmodus integrieren.
- [ ] DOM-Referenzen, Frames, Redirects und Verbindungsarten prüfen.
- [ ] Consent-Profile mit Zustandsbestätigung und begrenzten Interaktionen umsetzen.

Abnahme: Die Unterschiede zwischen produktiver CSP, Inventarmodus und Consent-Zuständen entsprechen den Fixtures.

### Phase 4 – Nutzbare Berichte

- [ ] Aggregation, HTML-Bericht, Filter und CSV entwickeln.
- [ ] Maskierung, sichere Darstellung und Offline-Funktion prüfen.
- [ ] Abdeckung und Teilergebnisse auf der Startansicht sichtbar machen.

Abnahme: Jede aggregierte Ressource ist zu ihrer Fundseite zurückverfolgbar; der Bericht lädt keine externen Ressourcen.

### Phase 5 – Container und erste Anwendung

- [ ] Docker-Build mit passender Browser-Version erstellen.
- [ ] Rechte, Sandbox, Ausgabe-Mount und Prozessabbruch testen.
- [ ] Einen vollständigen Fixture-Scan im Container durchführen.
- [ ] Nach Auswahl eines eigenen Ziels einen begrenzten realen Scan ausführen.
- [ ] Geprüfte Befehle, Einstellungen und Grenzen in `readme.md` übernehmen.

Abnahme: Der dokumentierte Startbefehl funktioniert in der getesteten Umgebung und erzeugt alle Berichte. Nicht getestete Plattformen bleiben als solche benannt.

### Phase 6 – Optionale Distribution

- [ ] Private Registry und Release-Tags festlegen.
- [ ] Build-/Test-Automatisierung mit minimalen Berechtigungen ergänzen.
- [ ] Für öffentliche Freigabe Lizenz und Inhalte einschließlich Historie prüfen.
- [ ] Erst nach gesonderter Entscheidung Repository oder Images öffentlich machen.

## 15. Arbeitsregeln und Pflege

`plan.md` bleibt die einzige allgemeine Aufgabenliste. Nach jeder abgeschlossenen Phase werden Status und Abnahmebelege aktualisiert. Dauerhafte Bedieninformationen wandern in `readme.md`; zusätzliche Fachdetails können später unter `docs/` stehen.

Commits verwenden Akay und die konfigurierte KankaDev-Mailadresse als Autor und Committer. Die lokale Git-Konfiguration wird vor dem ersten Commit geprüft. Automatisch erzeugte Web-/API-Commits werden nur verwendet, wenn ihre Identität den Vorgaben entspricht. Commit-Nachrichten nennen die tatsächliche Änderung und enthalten keine Werkzeug-Zuschreibungen.

Reale fremde Domains, Kundeninformationen, Scanprotokolle und Zugangsdaten werden vor jedem Commit ausgeschlossen. Dokumentation unterscheidet überprüfte Eigenschaften von Plänen und Annahmen. Ein Test wird nur dann als bestanden markiert, wenn er tatsächlich ausgeführt wurde und sein Ergebnis vorliegt.

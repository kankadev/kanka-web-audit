# Kanka Web Audit

## Gründlicher Audit (0.2.0)

Für wiederkehrende Bestandsprüfungen ist `--audit thorough --profile examples/profile.json` vorgesehen. Die Selektoren des Beispiels müssen an die geprüfte Website angepasst werden. Der Ablauf ist unabhängig von einer bestimmten Consent-Management-Plattform:

1. Auf der Startseite werden Akzeptieren und Ablehnen jeweils in frischen Kontexten und beiden CSP-Modi vorab geprüft.
2. Erst nach erfolgreicher Vorprüfung startet der Crawl. Jeder Seitenbesuch zeichnet die Phase vor der Entscheidung auf, versucht normales Scrollen und prüft danach die konfigurierte Entscheidung mit eindeutigem Zielzustand.
3. Nach der Entscheidung werden erneut Ressourcen beim Scrollen und bei konfigurierten Interaktionen erfasst. Der Zielzustand wird anschließend nochmals geprüft.

`decision` benennt `accept` oder `reject`, `expectedState` verweist auf einen Eintrag in `consentStates`. Beide Entscheidungen brauchen unterschiedliche Zielzustände und eine sichtbare Bestätigung. Ein bereits vorhandener Zielzustand oder eine bereits vor dem Klick sichtbare Bestätigung kann die Vorprüfung nicht bestehen. Das hilft, automatische Freigaben oder unbrauchbare Selektoren zu erkennen, ermittelt aber nicht automatisch deren Ursache.

Scheitert die Vorprüfung, enthält der Teilergebnis-Report den Grund und `purpose: preflight`; der lange Crawl wird nicht gestartet. Diese Vorabmessungen bleiben über den Abschnittsfilter von `purpose: crawl` unterscheidbar. Später auf Unterseiten fehlgeschlagene Zustandsprüfungen zählen ebenfalls nicht als erfolgreich geprüfte Seiten.

Scrollen erfolgt per Mausrad und respektiert Seitensperren. Im Bericht stehen angeforderte Schritte und tatsächlich beobachtete Bewegungen des Hauptdokuments. Keine Bewegung kann auch das Seitenende bedeuten; daraus wird nicht automatisch eine Banner-Sperre abgeleitet. Gesonderte Scrollcontainer werden nicht vollständig vermessen.

Der Standard `--audit resources` bleibt für reine Ressourceninventare, Websites ohne CMP und unbekannte Consent-Konfigurationen verfügbar und wird ausdrücklich als unvollständig hinsichtlich Consent gekennzeichnet. Ein normaler Besucher aus einer gewünschten Region muss tatsächlich über den passenden Netzausgang getestet werden. Headed allein garantiert weder diese Region noch die Behandlung als menschlicher Besucher. Das Tool ändert keine produktiven Bot-/Geo-Einstellungen.

Die Prüfung erleichtert CSP-Konfiguration und das Auffinden möglicher Einträge für eine CMP. Sie leitet weder aus jeder externen Anfrage eine Pflicht zur Einwilligung noch aus einer leeren Fehlerliste vollständige Konformität ab.

## Änderungen in 0.1.2

CDP ergänzt die Playwright-Messungen um `blockedReason` und `corsErrorStatus`. Nur ein konkreter CORS-Nachweis führt zu „CORS blockiert“. Beide Quellen bleiben getrennt und können denselben Request abbilden; im HTML hilft der Quellenfilter. Redirect-Schritte sind über `previousId`/`nextId` innerhalb derselben Quelle verbunden und erhalten Methoden und Statuscodes. Es werden keine vollständigen Request-Header oder Bodies gespeichert.

Browser-Version, User-Agent, `webdriver` und Profil werden pro Besuch protokolliert. `--browser-profile headless` ist der Standard; `--browser-profile headed` öffnet einen sichtbaren automatisierten Chromium. Für Vergleiche zwei Läufe mit getrennten Ausgabeordnern ausführen. Headed benötigt eine grafische Sitzung und ist weder ein garantiert normales Besucherprofil noch eine Umgehung von Bot-Erkennung. Der Container läuft standardmäßig headless; ein echter manueller Besuch bleibt bei abweichender CMP-Erkennung eine gesonderte Vergleichsprüfung.

`consentStates` enthält benannte Selektoren für sichtbare Zustände (siehe Beispielprofil). Vor und nach den Aktionen werden sichtbare Treffer dokumentiert: kein Treffer ist `unknown`, mehrere sind `ambiguous`. Namen sind vom Anwender definierte Beobachtungen, kein automatisch ermittelter rechtlicher Zustimmungsstatus. `scenarioConfirmed` beschreibt weiterhin nur den Ablauf des konfigurierten Szenarios. Ohne Consent-Aktion bedeutet es insbesondere keine nachgewiesene Zustimmung oder Ablehnung. Automatische Bot-Zustimmung kann auch ohne Klick stattfinden.

Request-, Antwort-, Abschluss-, Fehler- und `context.close`-Zeitpunkte bleiben im JSON erhalten. CDP-Redirects haben `redirectAt`, ohne ein nicht geliefertes `loadingFinished`-Ereignis vorzutäuschen. Antwort-/Abschluss-/Fehlerzeiten sind Empfangszeiten der Messereignisse; CDP-Requests liefern zusätzlich Protokollzeit und Browser-Walltime. Die CDP-Ergänzung deckt das Seiten-Target ab; separate Worker- und Out-of-process-Frame-Targets sind nicht vollständig erfasst. Dort bleiben vorhandene Playwright-Befunde ohne garantierte CDP-Ursachendiagnose erhalten.

HTTP 204 mit `ERR_ABORTED` sagt nichts Sicheres über das Auflösen eines JavaScript-fetch oder die Verarbeitung beim Anbieter aus. HTTP-Antwort und Browser-Abschluss werden getrennt angezeigt; die Anwendung instrumentiert keine JavaScript-Promises.

## Änderungen in 0.1.1

HTML und CSV unterscheiden belegte CSP-Blockaden, HTTP-Fehler, Netzwerkfehler mit ungeklärter Ursache und Abbrüche nach empfangener Antwort. HTTP 204 mit anschließendem Abbruch wird nicht als CSP-Blockade interpretiert. CSP-Meldungen im Report-only-Modus bleiben gesondert sichtbar.

Neue Scans speichern Antwort-, Abschluss- und Fehlerzeitpunkte. Vor dem Schließen des Browserkontexts noch offene Requests erhalten `observationEnd` (`visit-end` oder `scan-abort`). Das beschreibt die Beobachtungsgrenze, beweist aber nicht die Ursache eines späteren Abbruchs. Historische Reports ohne dieses Feld lassen sich nicht rückwirkend entsprechend zuordnen. Die Rohmeldungen bleiben erhalten.

Eine Seite zählt nur dann als vollständig bearbeitet, wenn alle konfigurierten Kombinationen aus CSP-Modus und Szenario abgeschlossen wurden. Die zehn Testgruppen umfassen auch eine dauerhaft offene Antwort und die konsistente Darstellung in HTML und CSV.

Ein Projekt von kanka.dev zur Bestandsaufnahme externer Website-Ressourcen als Grundlage für CSP- und Datenschutzprüfungen.

## Projektstand

Version 0.2.0 enthält einen ausführbaren Chromium-Scanner, eine Kommandozeile, ein Dockerfile und lokale HTML-, JSON- und CSV-Berichte. Die Browser-Integrationstests wurden unter Windows und in Linux/amd64-Containern ausgeführt. Der Scanner arbeitet ohne Datenbank oder dauerhaft laufenden Server.

Der verbindliche Funktionsumfang, die vorgesehenen Umsetzungsschritte und deren Abnahmekriterien stehen in [plan.md](plan.md). Geplante Funktionen sind dort beschrieben; diese Datei dokumentiert den tatsächlich erreichten Stand.

## Zweck und Grenzen

Die Bestandsaufnahme zeigt, welche externen Ressourcen eine Website referenziert, anzufordern versucht oder tatsächlich überträgt, und auf welchen Seiten diese vorkommen. Sie erleichtert die manuelle Suche nach CSP-Abhängigkeiten.

Ein Ressourceninventar ist kein Nachweis vollständiger DSGVO-Konformität. Es erfasst insbesondere keine unsichtbaren serverseitigen Datenweitergaben. Auch eine Domainliste allein ist keine sichere, unmittelbar einsetzbare CSP.

## Dokumentation und Projektdaten

- `readme.md` dokumentiert implementierte Funktionen, geprüfte Bedienung und bekannte Grenzen.
- `plan.md` ist die zentrale Liste für geplante Arbeiten und Abnahmekriterien.
- Dokumentation, Kommentare, Testdaten und Beispiele enthalten keine realen fremden oder kundenbezogenen Domains. Synthetische Beispiele verwenden reservierte `.test`-Namen oder lokale Testserver.
- Reale Scanergebnisse, Browserprofile, Zugangsdaten und kundenspezifische Konfigurationen gehören nicht in die Versionsverwaltung.
- Commit-Nachrichten beschreiben die konkrete Änderung. Projekttexte werden sachlich unter kanka.dev geführt.

## Lokal starten

Voraussetzung ist Node.js 24 mit npm. Abhängigkeiten stehen mit festen Versionen im Lockfile: Playwright 1.63.0, fast-xml-parser 5.11.1 und robots-parser 3.0.1. Chromium wird passend zu Playwright installiert.

```sh
npm ci
npx playwright install chromium
npm run build
node dist/src/cli.js --help
node dist/src/cli.js https://site.test/ --output reports/first-scan
```

`site.test` ist ein Platzhalter und muss durch eine freigegebene Zieladresse ersetzt werden. Unter Linux können zusätzlich Browser-Systempakete nötig sein: `npx playwright install --with-deps chromium`. Die Browser-Sandbox bleibt aktiviert.

Auf dem Entwicklungsrechner sind die Browser projektlokal installiert. Dort wird in PowerShell vor lokalen Scans gesetzt:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PWD '.git/browsers'
```

## Mit Docker starten

Das Image lässt sich direkt aus diesem privaten Checkout bauen. Es läuft als Benutzer `node`, enthält Chromium und benötigt das mitgelieferte Seccomp-Profil für Benutzer-Namensräume. Es benötigt weder `--privileged` noch eine deaktivierte Browser-Sandbox.

```sh
docker build --target runtime -t kanka-web-audit:0.2.0 .
```

PowerShell:

```powershell
New-Item -ItemType Directory -Force reports | Out-Null
docker run --rm --init --shm-size=1g `
  --security-opt seccomp=./docker/seccomp_profile.json `
  --mount "type=bind,source=$($PWD.Path)/reports,target=/reports" `
  kanka-web-audit:0.2.0 https://site.test/ --output /reports/first-scan
```

Linux/macOS-Shell:

```sh
mkdir -p reports
docker run --rm --init --shm-size=1g \
  --user "$(id -u):$(id -g)" \
  --security-opt seccomp=./docker/seccomp_profile.json \
  --mount "type=bind,source=$PWD/reports,target=/reports" \
  kanka-web-audit:0.2.0 https://site.test/ --output /reports/first-scan
```

Der Ausgabeordner muss für den Containerbenutzer beschreibbar sein. Getestet wurde Docker Desktop mit Linux/amd64-Containern; andere Betriebssysteme und Architekturen sind noch nicht abgenommen. Auf Hosts mit zusätzlichen Beschränkungen für Benutzer-Namensräume muss die Hostkonfiguration geprüft werden. Herkunft und Lizenz des Profils stehen in [docker/readme.md](docker/readme.md).

Ohne Registry lässt sich ein lokal gebautes Image mit `docker save -o kanka-web-audit.tar kanka-web-audit:0.2.0` übertragen und mit `docker load -i kanka-web-audit.tar` wieder einlesen. Das Seccomp-Profil wird zusätzlich benötigt. Image-Archive gehören nicht ins Git-Repository.

## Scan-Einstellungen

```sh
node dist/src/cli.js https://site.test/ --mode both --max-pages 100 --max-duration 600
node dist/src/cli.js --profile examples/profile.json --output reports/profile-scan
```

CLI-Werte überschreiben die entsprechenden Profilwerte. Zusätzliche Origins werden nicht automatisch aus Redirects freigegeben. Beispielsweise muss eine benötigte zweite eigene Origin ausdrücklich mit `--origin` oder im Profil ergänzt werden. Bestehende Ergebnisdateien werden nicht überschrieben; jeder Scan erhält einen neuen Ordner.

| Profilfeld | Standard | Bedeutung |
| --- | --- | --- |
| `target` | erforderlich | Absolute HTTP(S)-Startadresse ohne Zugangsdaten |
| `output` | `reports/<Zeitstempel>` | Neuer Ausgabeordner |
| `origins` | Start-Origin | Weitere erlaubte Origins für Seitennavigation und Sitemaps |
| `ownOrigins` | leer | Eigene Ressourcen-Infrastruktur markieren, ohne sie auszublenden |
| `starts`, `sitemaps` | leer | Weitere Startseiten bzw. Sitemap-Adressen |
| `maxPages` | 200 | Maximale Zahl untersuchter Seiten, unabhängig von Szenariozahl |
| `maxDiscovered` | 10000 | Obergrenze der gespeicherten Seitenentdeckung |
| `maxDepth` | 10 | Maximale Linktiefe; Sitemap-Seiten starten bei Tiefe null |
| `concurrency` | 2 | Parallel besuchte Seiten, maximal acht |
| `timeoutMs` | 30000 | Navigations- und Discovery-Timeout |
| `waitMs` | 2000 | Wartefenster vor/nach Interaktionen und Scrollen |
| `scrollSteps` | 8 | Scrollschritte mit jeweils 200 ms Wartezeit |
| `maxDurationMs` | 1800000 | Gesamtes Zeitbudget einschließlich Discovery |
| `respectRobots` | true | robots.txt beachten; bei unklarer Erreichbarkeit keine Seitenbesuche |
| `fullUrls` | false | Query-Werte im Export maskieren |
| `exclude` | leer | Zusätzliche URL-Teilzeichenfolgen zum Ausschließen |
| `modes` | `["enforce"]` | `enforce`, `inventory` oder beide |
| `scenarios` | initial | Besuchs- und Consent-Profile |

Sitemap-Indizes sind auf fünf Verschachtelungsebenen und 100 Dokumente begrenzt, Discovery-Antworten auf 5 MiB. Pro Besuch werden maximal 10000 Beobachtungen, pro Scan maximal 250000 gespeichert. Erreichte Grenzen erscheinen im Bericht. Erkennbare Logout-, Lösch-, Checkout- und Warenkorb-Links werden nicht verfolgt. Der Scanner sendet keine Formulare automatisch ab; ausdrücklich konfigurierte Klicks können jedoch Website-Aktionen auslösen.

## Consent und CSP

Jedes Szenario wird in einem frischen Browserkontext ausgeführt. [examples/profile.json](examples/profile.json) zeigt synthetische Selektoren für Zustimmung und Ablehnung. Diese müssen für das konkrete Consent-System angepasst werden. `selector` bezeichnet das zu klickende Element; `confirm` muss danach sichtbar sein und den erreichten Zustand eindeutig belegen. Ohne diese Bestätigung gilt das Szenario als unbestätigt. Weitere geprüfte Klicks können als `actions` ergänzt werden, jeweils ebenfalls mit `selector` und `confirm`.

Die Phasen `initial`, `consent`, `after-consent`, `unconfirmed-consent` und `interaction` bleiben getrennt. Ein Szenario mit Zustimmung enthält deshalb auch die vor dem Klick beobachteten Anfragen. Consent wird nicht zwischen Unterseiten übertragen.

`enforce` respektiert die produktive CSP und erfasst externe Verstöße. `inventory` ignoriert die CSP ausschließlich im Scan-Browser, damit blockierte Einstiegsscripts ihre weiteren Abhängigkeiten laden können. Produktive Header bleiben unverändert. Die Modi ergeben keine automatische Freigabeempfehlung. Inline-/Eval-Verstöße ohne externe URL sind nicht Bestandteil dieses Ressourceninventars; CSP-Meldungen können externe URLs auf ihre Origin kürzen.

## Ergebnisse lesen

- `report.html`: Offline-Bericht mit Suche, Filtern und Gruppierung nach Origin oder exakter URL. Aufklappen zeigt die Fundstellen. Normale Navigationslinks und Ladehinweise sind standardmäßig ausgeblendet. Bei großen Ergebnissen werden Gruppen schrittweise eingeblendet.
- `report.json`: Versioniertes Datenmodell (`schemaVersion: 1`) mit Scanparametern, Seiten, Besuchen, Beobachtungen und Grenzen. Während des Scans wird es nach jeder bearbeiteten Seite atomar aktualisiert.
- `resources.csv`: Tabellenexport der Beobachtungen mit Fundseite, Szenario, Phase, Status und CSP-Direktive. Potenzielle Tabellenformeln werden entschärft.

Die Standardexporte maskieren Query-Werte, entfernen URL-Benutzerinformationen und Fragmente. Eine scanbezogene URL-Kennung hält verschieden parametrisierte URLs auseinander. Pfade und Konfigurationswerte können trotzdem vertraulich sein; alle Reports sind private Arbeitsdaten. Mit `--full-urls` werden Query-Werte bewusst erhalten. Es werden keine Request-/Response-Bodies, Cookie-Werte oder Authorization-Header gespeichert.

„Übertragen“ bezeichnet den abgeschlossenen Request, nicht eine erfolgreiche Script-Ausführung. HTTP-Fehler, Netzwerkfehler und CSP-Blockaden bleiben getrennt. Eigene Subdomains können andere Origins sein; eine fremde Origin beweist keinen externen Betreiber. Service-Worker-Traffic kann ohne Frame-Zuordnung erscheinen.

Die Abdeckung umfasst nur entdeckte Seiten innerhalb der gewählten Grenzen. Login-Sitzungen, nicht aktivierte Inhalte, alternative srcset-Kandidaten, beliebige JavaScript-URLs, Hash-Routen, Worker-WebSockets, geschlossene Popups und serverseitige Weitergaben werden nicht vollständig abgedeckt.

## Status und Abbruch

| Exitcode | Bedeutung |
| --- | --- |
| 0 | Alle innerhalb des Scans vorgesehenen Besuche abgeschlossen, keine gemeldete Abdeckungslücke |
| 2 | Teilergebnis, etwa wegen robots.txt, Fehlern, unbestätigtem Consent oder Zeit-/Seitenlimit |
| 1 | Eingabe-, Laufzeit- oder Ausgabefehler |
| 130 | SIGINT/SIGTERM: abgebrochenes Ergebnis gespeichert |

Fortschritt geht auf stderr, die abschließende JSON-Zusammenfassung auf stdout. Ctrl+C beziehungsweise SIGTERM schließt die Browserkontexte und schreibt die verfügbaren Berichte. Bei hartem Prozessabbruch oder Stromausfall bleibt nur der letzte JSON-Zwischenstand; HTML/CSV werden erst beim regulären Abschluss oder behandelten Abbruch geschrieben.

## Entwicklung und Tests

```sh
npm ci
npx playwright install chromium
npm test
docker build --target test -t kanka-web-audit:test .
docker run --rm --init --shm-size=1g --security-opt seccomp=./docker/seccomp_profile.json kanka-web-audit:test
```

Die Suite startet ausschließlich lokale Fixture-Server. Sie prüft Sitemap-/Link-Zusammenführung, robots.txt, Ressourcenarten, Frames, Redirects, Lazy Loading, CSP-Modi, Consent-Isolation, Fehler, Abbrüche, Service Worker, WebSockets, Maskierung und den interaktiven Offline-Bericht. Die CI-Konfiguration führt Container-Tests bei Push und Pull Request aus; sie veröffentlicht keine Images und lädt keine Live-Reports hoch.

## Veröffentlichung

Das Repository ist zunächst privat. Über eine öffentliche Freigabe, eine Nutzungslizenz und die Veröffentlichung von Container-Images wird vor dem ersten öffentlichen Release entschieden.

## Prüfung vor Commits

`.githooks/pre-commit` prüft vorgemerkte Änderungen mit Gitleaks. Lokal wurde Version 8.30.1 unter Windows getestet. Die Ausgabe maskiert erkannte Geheimnisse. Fehlende Scanner und Scannerfehler stoppen den Commit ebenfalls.

Nach einem neuen Clone muss Gitleaks installiert und der Hook einmal aktiviert werden. Bestehende Hooks müssen vorher geprüft und gegebenenfalls zusammengeführt werden:

```sh
git config --local core.hooksPath .githooks
```

Der Hook verwendet entweder `gitleaks` aus dem Suchpfad oder die lokale Windows-Binary unter `.git/tools/gitleaks/gitleaks.exe`. Die Binary wird nicht mitversioniert. Der Hook schützt lokale Git-Commits; API-/Web-Commits und andere Klone sind dadurch nicht automatisch abgesichert. Ein Secret-Scan erkennt nicht zuverlässig alle personenbezogenen Daten oder vertraulichen fachlichen Inhalte. Der vorgemerkte Inhalt wird deshalb zusätzlich inhaltlich geprüft.

### Bewusste Ausnahmen

Für freigegebene, eindeutig künstliche Testwerte kann die betreffende Zeile einen `gitleaks:allow`-Kommentar mit Begründung erhalten. Für Dateien ohne Kommentare kommt eine eng begrenzte Finding-Ausnahme infrage. Solche Ausnahmen werden selbst mitgeprüft; private Repository-Sichtbarkeit ist kein automatischer Ausnahmegrund.

Eine einmalige ausdrückliche Freigabe ist an die vollständige vorgemerkte Git-Tree-ID gebunden. Das folgende PowerShell-Beispiel akzeptiert gefundene Werte für genau diesen Inhalt. Es umgeht keine Scannerfehler:

```powershell
# Erst nach inhaltlicher Prüfung und ausdrücklicher Freigabe der konkreten Funde.
$env:KANKA_COMMIT_ALLOW_TREE = (git write-tree).Trim()
$env:KANKA_COMMIT_ALLOW_REASON = 'Geprüfte synthetische Testwerte'
try {
    git commit -m 'Synthetische Testdaten ergänzen'
    if ($LASTEXITCODE -ne 0) { throw 'Commit fehlgeschlagen' }
} finally {
    Remove-Item Env:KANKA_COMMIT_ALLOW_TREE -ErrorAction SilentlyContinue
    Remove-Item Env:KANKA_COMMIT_ALLOW_REASON -ErrorAction SilentlyContinue
}
```

Die Variablen werden danach entfernt. Ändert sich der vorgemerkte Inhalt, passt die Freigabe nicht mehr. Die Tree-ID ist ein technischer Schutz vor versehentlich zu breiten Freigaben, kein Berechtigungsnachweis. Wer Git selbst bedient, kann lokale Hooks technisch umgehen; der Arbeitsablauf tut das nicht eigenständig. Der Hook meldet eine übersteuerte Prüfung ausdrücklich als nicht sauber. Die Begründung wird nicht in die Commit-Nachricht geschrieben und nicht automatisch dauerhaft gespeichert.

Geprüft am 2026-09-12 mit isolierten lokalen Fixtures: normaler Commit, Blockade bei künstlichem Token, Ablehnung einer falschen Tree-ID, Freigabe der passenden Tree-ID, Ungültigkeit nach zusätzlichen Änderungen, gezielte Testwert-Annotation und Blockade bei defekter Scanner-Konfiguration. Die Testwerte wurden nicht ins Projekt-Repository übernommen.

# Kanka Web Audit

Ein Projekt von kanka.dev zur Bestandsaufnahme externer Website-Ressourcen als Grundlage für CSP- und Datenschutzprüfungen.

## Projektstand

Das Projekt befindet sich in der Planungsphase. Dieses Repository enthält den Umsetzungsplan, die Projektdokumentation und einen geprüften Git-Hook für Secret-Prüfungen. Es gibt derzeit keinen ausführbaren Website-Scanner, kein Docker-Image und keine abgeschlossenen Funktionstests der Anwendung.

Der verbindliche Funktionsumfang, die vorgesehenen Umsetzungsschritte und deren Abnahmekriterien stehen in [plan.md](plan.md). Geplante Funktionen sind dort beschrieben; diese Datei dokumentiert den tatsächlich erreichten Stand.

## Zweck und Grenzen

Die geplante Bestandsaufnahme soll sichtbar machen, welche externen Ressourcen eine Website referenziert, anzufordern versucht oder tatsächlich lädt, und auf welchen Seiten diese vorkommen. Sie soll die manuelle Suche nach CSP-Abhängigkeiten erleichtern.

Ein Ressourceninventar ist kein Nachweis vollständiger DSGVO-Konformität. Es erfasst insbesondere keine unsichtbaren serverseitigen Datenweitergaben. Auch eine Domainliste allein ist keine sichere, unmittelbar einsetzbare CSP.

## Dokumentation und Projektdaten

- `readme.md` dokumentiert implementierte Funktionen, geprüfte Bedienung und bekannte Grenzen.
- `plan.md` ist die zentrale Liste für geplante Arbeiten und Abnahmekriterien.
- Dokumentation, Kommentare, Testdaten und Beispiele enthalten keine realen fremden oder kundenbezogenen Domains. Synthetische Beispiele verwenden reservierte `.test`-Namen oder lokale Testserver.
- Reale Scanergebnisse, Browserprofile, Zugangsdaten und kundenspezifische Konfigurationen gehören nicht in die Versionsverwaltung.
- Commit-Nachrichten beschreiben die konkrete Änderung. Projekttexte werden sachlich unter kanka.dev geführt.

## Nutzung und Veröffentlichung

Eine Installation oder Ausführung ist noch nicht möglich. Geplant ist ein bei Bedarf gestarteter Docker-Container mit Kommandozeile und lokalem HTML-Bericht. Eine Weboberfläche kann später denselben Scanner verwenden.

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

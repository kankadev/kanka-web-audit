# Kanka Web Audit

Ein Projekt von KankaDev zur Bestandsaufnahme externer Website-Ressourcen als Grundlage für CSP- und Datenschutzprüfungen.

## Projektstand

Das Projekt befindet sich in der Planungsphase. Dieses Repository enthält den Umsetzungsplan und die Projektdokumentation. Es gibt derzeit keinen ausführbaren Scanner, kein Docker-Image und keine abgeschlossenen Funktionstests.

Der verbindliche Funktionsumfang, die vorgesehenen Umsetzungsschritte und deren Abnahmekriterien stehen in [plan.md](plan.md). Geplante Funktionen sind dort beschrieben; diese Datei dokumentiert den tatsächlich erreichten Stand.

## Zweck und Grenzen

Die geplante Bestandsaufnahme soll sichtbar machen, welche externen Ressourcen eine Website referenziert, anzufordern versucht oder tatsächlich lädt, und auf welchen Seiten diese vorkommen. Sie soll die manuelle Suche nach CSP-Abhängigkeiten erleichtern.

Ein Ressourceninventar ist kein Nachweis vollständiger DSGVO-Konformität. Es erfasst insbesondere keine unsichtbaren serverseitigen Datenweitergaben. Auch eine Domainliste allein ist keine sichere, unmittelbar einsetzbare CSP.

## Dokumentation und Projektdaten

- `readme.md` dokumentiert implementierte Funktionen, geprüfte Bedienung und bekannte Grenzen.
- `plan.md` ist die zentrale Liste für geplante Arbeiten und Abnahmekriterien.
- Dokumentation, Kommentare, Testdaten und Beispiele enthalten keine realen fremden oder kundenbezogenen Domains. Synthetische Beispiele verwenden reservierte `.test`-Namen oder lokale Testserver.
- Reale Scanergebnisse, Browserprofile, Zugangsdaten und kundenspezifische Konfigurationen gehören nicht in die Versionsverwaltung.
- Commit-Nachrichten beschreiben die konkrete Änderung. Projekttexte werden sachlich unter KankaDev geführt.

## Nutzung und Veröffentlichung

Eine Installation oder Ausführung ist noch nicht möglich. Geplant ist ein bei Bedarf gestarteter Docker-Container mit Kommandozeile und lokalem HTML-Bericht. Eine Weboberfläche kann später denselben Scanner verwenden.

Das Repository ist zunächst privat. Über eine öffentliche Freigabe, eine Nutzungslizenz und die Veröffentlichung von Container-Images wird vor dem ersten öffentlichen Release entschieden.

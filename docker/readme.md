# Browser-Sandbox

`seccomp_profile.json` ist das unverändert übernommene Chromium-Sandbox-Profil aus Playwright 1.63.0, Pfad `utils/docker/seccomp_profile.json` im Upstream-Repository `microsoft/playwright`.

Die zugehörige Apache-2.0-Lizenz liegt in `PLAYWRIGHT-LICENSE`. Das Profil erlaubt insbesondere die für Chromium benötigten Benutzer-Namensräume und verwendet ansonsten eine Syscall-Allowlist. Es ist kein unbeschränktes Seccomp-Profil.

Der Anwendungscontainer läuft als Benutzer `node` und startet Chromium mit aktivierter Sandbox. Getestet wurde Linux/amd64 unter Docker Desktop. Auf anderen Hosts können zusätzliche Hostbeschränkungen für Benutzer-Namensräume bestehen. Ein fehlgeschlagener Browserstart wird als Fehler gemeldet; die Anwendung schaltet die Sandbox nicht automatisch ab.

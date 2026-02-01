# Versionen

## V1 (aktuell)
- Stand: Iftar-Organisation mit Gästeliste, Einladungen, E-Mail-Konfiguration (Gmail, iCloud, IMAP, Mailjet), Tischplanung, Programmablauf, Push-Benachrichtigungen, Berichte, VIP-Namensschilder, Audit-Logs.
- **Git:** Tag **v1** (Commit mit VERSION.md, package.json 1.0.0).
- **Railway (Production):** V1 = Git-Tag **v1** (Commit `085f094`). Nach dem Push von v1 ist dieser Stand auf Railway ausgerollt. Um V1 auf Railway festzuhalten: im Railway-Dashboard unter **Deployments** prüfen, dass der aktuelle Production-Deploy von Commit **v1** / `085f094` stammt; bei Bedarf diesen Deploy per **Redeploy** erneut ausführen.

## V2 (ab jetzt)
- Alle Änderungen nach V1 werden als **V2** gezählt.
- Neue Features und Anpassungen ab dem nächsten Commit gehören zu V2.

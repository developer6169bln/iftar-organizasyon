# Railway: E-Mail-Versand (SMTP vs. API)

Quelle: [Railway – Outbound Networking](https://docs.railway.com/reference/outbound-networking)

## SMTP auf Railway

- **Free-, Trial- und Hobby-Pläne:** SMTP ist **deaktiviert**. E-Mail-Versand per Gmail/iCloud/eigener SMTP-Server funktioniert **nicht**.
- **Pro-Plan und höher:** SMTP ist verfügbar (Ports 25, 465, 587). Nach Upgrade auf Pro den Service **neu deployen**, damit SMTP aktiv wird.

## Empfehlung für alle Pläne

Railway empfiehlt **transaktionale E-Mail-Dienste mit HTTPS-API** statt SMTP (bessere Auswertung, weniger Spam-Risiko):

- **Mailjet** (in dieser App bereits integriert)
- [Resend](https://resend.com/features/email-api) (von Railway empfohlen)
- [SendGrid](https://sendgrid.com/en-us/solutions/email-api)
- [Mailgun](https://www.mailgun.com/products/send/)
- [Postmark](https://postmarkapp.com/email-api)

**In dieser App:** Unter **Einladungen → Email-Konfiguration** Typ **„Mailjet (API)“** wählen und API Key/Secret eintragen – funktioniert auf **allen** Railway-Plänen.

---

## SMTP-Probleme auf Pro debuggen

Wenn Sie auf dem **Pro-Plan** SMTP (Gmail, iCloud, eigener Server) nutzen und Verbindungsprobleme haben:

1. Service **neu deployen** (nach Pro-Upgrade erforderlich).
2. Per [Railway CLI](https://docs.railway.com/reference/cli-api#ssh) per SSH in den Service einloggen.
3. Folgenden Befehl ausführen und `SMTP_HOST` durch Ihren SMTP-Host ersetzen (z. B. `smtp.gmail.com`, `smtp.mail.me.com`):

```bash
SMTP_HOST="$REPLACE_THIS_WITH_YOUR_SMTP_HOST" bash -c '
for port in 25 465 587 2525; do
  timeout 1 bash -c "</dev/tcp/$SMTP_HOST/$port" 2>/dev/null && \
    echo "$SMTP_HOST port $port reachable" || \
    echo "$SMTP_HOST port $port unreachable"
done
'
```

4. Wenn Ports **unreachable** sind: E-Mail-Anbieter prüfen, ob Verbindungen von Railway-IPs erlaubt sind. Port **2525** ist optional (nicht Standard); wenn nur 2525 unreachable ist, ist das unkritisch.
5. Sonst: Bei [Central Station](https://station.railway.com) melden und Ausgabe des Befehls mitsenden.

---

## Kurzfassung

| Plan     | SMTP (Gmail/iCloud/eigener Server) | Mailjet/API (HTTPS) |
|----------|------------------------------------|----------------------|
| Free     | ❌ deaktiviert                     | ✅ nutzbar           |
| Trial    | ❌ deaktiviert                     | ✅ nutzbar           |
| Hobby    | ❌ deaktiviert                     | ✅ nutzbar           |
| Pro+     | ✅ nach Re-Deploy                  | ✅ nutzbar           |

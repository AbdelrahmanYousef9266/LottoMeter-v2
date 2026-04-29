# LottoMeter v2.0 — Deployment Runbook

Last updated: 2026-04-29

## Production stack overview

- **API:** Flask + Gunicorn on Render (Web Service, Starter $7/mo)
- **Database:** Render Postgres (Basic-256mb, $6/mo)
- **Custom domain:** api.lottometer.com (Cloudflare Registrar, Cloudflare DNS)
- **Mobile:** EAS Build (preview profile, Android APK, internal distribution)
- **Error tracking:** Sentry (lottometer-api + lottometer-mobile projects)
- **Uptime monitoring:** UptimeRobot (5-minute interval, email alerts)

Total monthly cost: ~$13 (Render) + ~$10/year (domain) = ~$14/month.

## Production URLs

- API: https://api.lottometer.com
- API health: https://api.lottometer.com/api/health
- Render dashboard: https://dashboard.render.com
- Sentry: https://lottometer.sentry.io
- UptimeRobot: https://uptimerobot.com
- EAS dashboard: https://expo.dev/accounts/almomani/projects/lottometer-mobile

## Common operations

### Deploy a backend change
1. Commit and push to main: `git push origin main`
2. Render auto-deploys (~5 min)
3. Watch build log on Render dashboard
4. Verify: `curl https://api.lottometer.com/api/health`

### Deploy a mobile change
1. Commit and push to main
2. Run new EAS build: `cd lottometer-mobile && eas build --platform android --profile preview`
3. Wait ~15-20 min for cloud build
4. Install new APK on test devices via the URL EAS provides
5. (Future: OTA updates via `eas update --channel preview` for JS-only changes)

### Roll back a backend deploy
1. Render dashboard → lottometer-api → Events tab
2. Find a previous successful deploy
3. Click "Redeploy" on that commit's row
4. Wait ~5 min for rollback to complete

### Update a production environment variable
1. Render dashboard → lottometer-api → Environment tab
2. Edit or add the variable
3. Render auto-redeploys (~5 min)

### Check production database
- Render dashboard → lottometer-db → Connect tab
- Use the External Database URL with psql or pgAdmin (do NOT use this URL in any deployed code; production uses Internal URL)

## Troubleshooting

### Service is down (UptimeRobot alert)
1. Check Render dashboard → lottometer-api → Logs tab for recent errors
2. Check Render service status: https://status.render.com
3. If service crashed, redeploy from latest known-good commit
4. If Render is down, no action — wait for their status page

### High error rate (Sentry alert)
1. Open Sentry → lottometer-api project
2. Sort issues by event count
3. Top issue is usually the culprit; click for stack trace + breadcrumbs
4. Identify which deploy introduced it (Sentry tags errors with the commit SHA via `RENDER_GIT_COMMIT`)
5. Either fix and redeploy, or rollback

### Database connection issues
1. Render dashboard → lottometer-db → check status
2. Verify DATABASE_URL is set correctly on lottometer-api Web Service
3. Check Postgres connection pool — Basic-256mb tier supports ~30-50 concurrent connections

### Mobile app login fails
1. Verify mobile is pointing at correct URL (check `lottometer-mobile/src/api/config.js` — should be `https://api.lottometer.com/api`)
2. Verify backend is responding: `curl https://api.lottometer.com/api/health`
3. Check Sentry for backend errors during login attempts
4. If user-specific: check the user's record exists in production DB

### Custom domain certificate expiry
- Render auto-renews Let's Encrypt certs every ~60 days
- If a cert error appears: Render dashboard → lottometer-api → Settings → Custom Domains → click the domain → "Verify Domain" to retrigger

## Recovery scenarios

### Lost access to Render account
- Email recovery via render.com/login → "Forgot password"
- If billing email lost: contact support@render.com with proof of identity (last 4 of credit card on file)

### Lost Expo account access (blocks mobile builds)
- Email recovery at expo.dev
- The Android keystore is stored on Expo's servers — losing account access = losing keystore = inability to release new versions of THIS app on the same package ID without app store users having to reinstall fresh

### Sentry DSN compromised
- Sentry → Project Settings → Client Keys → revoke + regenerate
- Update SENTRY_DSN env var on Render
- Update EXPO_PUBLIC_SENTRY_DSN via `eas env:create --override` (will require new build to propagate to mobile)

### Domain expired
- Cloudflare auto-renewal enabled by default; renewal happens 30 days before expiry
- 30-day grace period after expiry before domain becomes available to others
- Action: re-register or upgrade Cloudflare account if billing fails

## Production secrets

Stored in:
- Render env vars (FLASK_ENV, JWT_SECRET_KEY, SECRET_KEY, JWT_ACCESS_TOKEN_EXPIRES_HOURS, DATABASE_URL, SENTRY_DSN, FLASK_APP)
- EAS secrets (EXPO_PUBLIC_SENTRY_DSN, SENTRY_AUTH_TOKEN)
- Cloudflare account credentials (your registrar login)
- Sentry account credentials
- UptimeRobot account credentials
- Render account credentials
- Expo account credentials
- Production admin password for store PTS001

Rotation policy: rotate JWT_SECRET_KEY and SECRET_KEY every 6 months minimum, or immediately if a compromise is suspected. Database password rotation requires Render-side coordination.

## Limitations of current setup

- **In-memory PIN rate limiter** resets on container restart. Acceptable for single-store pilot.
- **In-memory JWT blocklist** same. Logout-then-restart re-validates the JWT until natural expiry.
- **Single backend instance** — no horizontal scaling on Starter tier. Upgrade to Standard ($25/mo) for redundancy.
- **No automated backups beyond Render's defaults** (daily Postgres backups, 7-day retention). For longer retention, set up a separate backup pipeline.
- **No staging environment** — code goes from dev → main → production directly. Acceptable for pilot; consider a staging service before scaling to multiple customers.

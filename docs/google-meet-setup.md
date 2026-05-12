# Google Meet integration · one-time setup

This guide gets your booking flow auto-creating Google Calendar events with
Meet links when clients book a consultation. Total time: **~15 minutes**.

Host account used by the integration: **hello@mustaphaukizuru.com**
Calendar: **primary** (the main calendar on the host account)

> **The env-var block lives in `config/google-meet.env.template`** — open
> it side-by-side with this guide and you'll know exactly which line to
> paste each value into. It's the single dedicated file for the Google
> Meet / Calendar configuration; the main `.env.example` just references it.

---

## Step 1 · Google Cloud project (5 min)

1. Go to <https://console.cloud.google.com/>
   Sign in as **hello@mustaphaukizuru.com**.

2. **Create a new project**
   - Top-left project dropdown → "New Project"
   - Name: `mustaphaukizuru-bookings`
   - Organisation: leave default
   - Click **Create**

3. **Enable the Google Calendar API**
   - Open the left-nav: *APIs & Services → Library*
   - Search "Google Calendar API" → click it → **Enable**

---

## Step 2 · OAuth consent screen (3 min)

The consent screen is the page the host (you) will see ONCE during the
refresh-token bootstrap. After that it's never shown again.

1. Left-nav: *APIs & Services → OAuth consent screen*

2. **User type**: pick **External**, click **Create**

3. **App information**:
   - App name: `Mustapha Ukizuru Bookings`
   - User support email: `hello@mustaphaukizuru.com`
   - Developer contact: `hello@mustaphaukizuru.com`
   - Save and continue

4. **Scopes**:
   - Click *Add or Remove Scopes*
   - Filter: `calendar.events`
   - Check `https://www.googleapis.com/auth/calendar.events`
     (description: *"View and edit events on all your calendars"*)
   - Update → Save and continue

5. **Test users**:
   - Click *Add Users*
   - Add `hello@mustaphaukizuru.com`
   - Save and continue → Back to Dashboard

The app stays in "Testing" mode. That's fine — it just means only the
test users (you) can use it. You don't need to submit for verification
unless you ever add a second host.

---

## Step 3 · OAuth credentials (2 min)

1. Left-nav: *APIs & Services → Credentials*

2. **Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Bookings server`
   - **Authorized redirect URIs** → Add URI:
     `http://localhost:5000/api/v1/admin/google/oauth-callback`
     (This URL is used ONLY for the one-shot bootstrap below. No live
     server needs to serve it — the bootstrap script reads the code from
     the URL manually.)
   - Click **Create**

3. Copy the **Client ID** and **Client secret** from the popup. You'll
   paste both into your `.env` file in the next step.

---

## Step 4 · Bootstrap the refresh token (3 min)

This is the one-time handshake that gets you a long-lived refresh token.
After this, the integration runs forever without any user interaction.

1. **On your local machine** (not Hostinger), open `D:\mustaphaukizuru-repo\.env`
   and add (just below `VITE_I18N_ENABLED`):

   ```env
   GOOGLE_OAUTH_CLIENT_ID=<paste from step 3>
   GOOGLE_OAUTH_CLIENT_SECRET=<paste from step 3>
   GOOGLE_CALENDAR_HOST_EMAIL=hello@mustaphaukizuru.com
   GOOGLE_CALENDAR_ID=primary
   ```

   Leave `GOOGLE_OAUTH_REFRESH_TOKEN` blank for now.

2. **Run the bootstrap script:**

   ```powershell
   cd D:\mustaphaukizuru-repo
   node scripts/google-oauth-bootstrap.js
   ```

3. The script prints a long URL. Copy it and open it in your browser.

4. **Sign in as `hello@mustaphaukizuru.com`** when Google asks.
   If you have multiple Google accounts, double-check it's the right one.

5. You'll see a warning *"Google hasn't verified this app"* — that's
   expected because we kept the consent screen in Testing mode. Click
   **Continue** (or *Advanced → Go to Mustapha Ukizuru Bookings*).

6. Click **Allow** to grant calendar.events access.

7. Google redirects to a URL that **looks broken**:
   `http://localhost:5000/api/v1/admin/google/oauth-callback?code=4/0AVMBs…&scope=…`

   That's expected — there's no server on localhost:5000 yet. **Copy the
   full URL from the browser bar** (Ctrl+L → Ctrl+C).

8. Paste it back into the terminal where the bootstrap script is waiting.
   Press Enter.

9. The script prints the **refresh token** in green:
   ```
   GOOGLE_OAUTH_REFRESH_TOKEN=1//09xT3aB2k…
   ```

---

## Step 5 · Drop the token into production (1 min)

1. **SSH into Hostinger**:
   ```bash
   ssh <user>@<host>
   cd ~/htdocs
   ```

2. Open `.env.production`:
   ```bash
   nano .env.production
   ```

3. Add (or update) the five Google env vars:
   ```env
   GOOGLE_OAUTH_CLIENT_ID=<from step 3>
   GOOGLE_OAUTH_CLIENT_SECRET=<from step 3>
   GOOGLE_OAUTH_REFRESH_TOKEN=<from step 4>
   GOOGLE_CALENDAR_HOST_EMAIL=hello@mustaphaukizuru.com
   GOOGLE_CALENDAR_ID=primary
   ```

4. Save (Ctrl+O, Enter, Ctrl+X).

5. Restart the API:
   ```bash
   pm2 restart mustaphaukizuru --update-env
   ```

Done. The next consultation booking on the live site will auto-create a
Google Calendar event with a Meet link, send the invite to both you and
the client, and fire your branded confirmation email.

---

## Verifying it worked

Book a test consultation as a member at
`https://mustaphaukizuru.com/book-consultation`. Within ~5 seconds:

- ☐ Your hello@ inbox shows a **Google Calendar invite** for the slot
- ☐ The client's email shows the same Calendar invite AND your branded
      `consultation.confirmed` email with the Meet link
- ☐ Your Google Calendar (`primary`) shows the event with a **Join with
      Google Meet** button

If any of those are missing, check `pm2 logs mustaphaukizuru` for lines
starting with `[gcal]` or `[consultation]` — every fallback path logs
where it fell over.

---

## What gets created where

| Event | Where |
|---|---|
| Calendar event | `hello@mustaphaukizuru.com` → **primary** calendar |
| Meet link | Auto-generated by Google when the event is created |
| Attendee invite | Sent by Google directly to the client's email |
| Branded confirmation email | Sent by the app via the existing `consultation.confirmed` template |
| `googleEventId` in DB | Stored on the Consultation row, used to update/cancel later |

---

## Rescheduling

When you reschedule a booking from `/admin/consultations`, the app:
1. Updates the SAME Calendar event with the new time
2. The Meet link stays the same
3. Google emails both parties about the time change automatically
4. The Consultation row inherits the same `googleEventId`

---

## Cancellation

When a booking is cancelled (admin or client), the app:
1. Marks the Consultation row as `cancelled` in the DB
2. Deletes the Calendar event
3. Google emails the attendee a cancellation notice automatically

---

## Fallback behaviour

If any of the five Google env vars are unset, OR if the Calendar API call
fails (network blip, quota, revoked credentials), the booking flow falls
back to the existing **Jitsi** room generator. The booking still
succeeds, the client still gets the branded email — they just get a
Jitsi link instead of a Meet link. No-one ever sees an error from a
Google outage.

---

## Revoking access

If you ever want to disconnect the integration:

1. Go to <https://myaccount.google.com/permissions>
2. Find "Mustapha Ukizuru Bookings"
3. Click **Remove access**

Then on Hostinger, clear or comment out the `GOOGLE_OAUTH_*` env vars in
`.env.production` and `pm2 restart mustaphaukizuru`. Future bookings
fall back to Jitsi.

---

## Troubleshooting

**"No refresh_token in the response" during bootstrap**
Google has remembered your consent from a previous run. Visit
<https://myaccount.google.com/permissions>, remove "Mustapha Ukizuru
Bookings", then re-run the bootstrap script.

**"Access blocked: This app's request is invalid"**
The redirect URI you typed in the Cloud Console doesn't exactly match
the one in the bootstrap script. They must be byte-identical, including
the trailing path.

**Calendar events created, but no Meet link**
Confirm the OAuth consent screen scope is exactly
`https://www.googleapis.com/auth/calendar.events` (with the `.events`
suffix — `calendar.readonly` won't work).

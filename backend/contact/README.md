# LG Trading contact service

## Release status — 9 September 2026

The Bionee and Cedoly website updates are ready for Firebase Hosting.
The contact backend is implemented and tested but **not provisioned or deployed**.
`public/index.html` deliberately keeps its existing `mailto:info@lgtrading.it`
action. `public/contact.js` preserves that email handoff and never claims that
the cloud service received a message while this fallback is active.

The Hosting project `lgtrading-landing` has no active billing. Linking the
existing billing account failed because its project-link quota is exhausted.
An alternative deployment in the existing corporate infrastructure project
`tabellone-produzione-liv-e313e`, with a separate database, service account,
secret and container repository, was blocked by automatic approval review.
Reading/reusing `POSTMARK_SERVER_TOKEN` from `ilovepaghe-ludo-2026` was also
blocked. Both operations require explicit authorization before proceeding.
No resources were created in either project for this backend.

## Proposed isolated deployment

- Cloud Run service: `lgtrading-contact`, region `europe-west12`.
- Runtime: Node.js 22, 256 MiB, 1 CPU, request-based billing, minimum 0,
  maximum 2 instances, concurrency 20, request timeout 25 seconds.
- Firestore database: `lgtrading-contacts`. Never use another application's
  default database. Apply `firebase.contacts.json` only to the explicitly
  authorized project, keeping the Hosting configuration separate.
- Runtime identity: `lgtrading-contact-runtime` with `roles/datastore.user`
  conditioned on the single database and Secret Manager access on the single
  `lgtrading-contact-postmark-token` secret.
- Dedicated Artifact Registry repository: `lgtrading-contact`.
- Environment: `GOOGLE_CLOUD_PROJECT`, `CONTACT_DATABASE=lgtrading-contacts`,
  `CONTACT_RELEASE=<exact Git commit>` and secret-backed `POSTMARK_SERVER_TOKEN`.
- Verify the authorized Postmark server and the sender `info@lgtrading.it`
  before activating the form. Do not put credentials in Git or public files.

Use the existing corporate project only after authorization. Its project ID
must be passed explicitly to every deployment command. Hosting remains in
`lgtrading-landing`. The frontend can call the separate Cloud Run HTTPS URL
using the strict CORS allowlist already defined in `handler.js`.

## Behavior

`POST /api/contact` accepts JSON with `referente`, `email`, `telefono`,
`messaggio`, `startedAt` (milliseconds) and an empty `website` honeypot.
Messages go exclusively to `info@lgtrading.it`, from the verified LG Trading
sender, with the visitor's email in Reply-To. No automatic email is sent to
the visitor. Open and link tracking are disabled.

The handler validates field types, length, email, phone, control characters,
JSON size, origin and form completion timing. Firestore transactions cap
submissions at 3 per email and 30 overall per hour. HMAC fingerprints prevent
duplicate emails across simultaneous requests, repeated clicks and restarts.
An uncertain provider outcome is retained and never automatically resent.
Success is returned only for an accepted email or a known completed duplicate.

Firestore contains only HMAC identifiers, counters, state, timestamps and the
provider message ID. Names, addresses, phone numbers and message text are not
stored there. Enable TTL on `expiresAt` for `contactRequests` and
`contactRateLimits`; entries expire after 24 hours. Raw contact details and
credentials must not be written to logs. Firestore rules deny all client access.

## Validation and activation

Run `node --test backend/contact/test/*.test.js` from the repository root.
The tests require only Node.js and never send real emails. GitHub Actions
runs them before each Hosting deployment. The Docker image installs the
locked production Firestore dependency using `npm ci`.

After the cloud service is authorized, provisioned and deployed, verify
`GET /api/contact/health`, denied origins, malformed input, duplicate handling
and provider acceptance. Only then change `contactForm.action` in
`public/index.html` to the deployed HTTPS URL ending in `/api/contact`, and
deploy Hosting. The frontend already handles loading, confirmed success,
network failures and retries while preserving entered data on failure.

Firebase Hosting is currently the only automatic deployment workflow.
Backend deployment is intentionally not automatic while authorization and
cloud provisioning remain pending.

# LG Trading contact service

The contact form uses a dedicated Cloud Run service in the corporate project
`tabellone-produzione-liv-e313e`, as authorized on 9 September 2026.
Firebase Hosting remains in `lgtrading-landing`.

Backend release: `e5350cae57e363cc6a8bc1f6dcd3ac80a4249a27`, Cloud Run revision
`lgtrading-contact-00002-h92`. The final smoke test confirmed HTTP 200 for
delivery and for the identical retry, using the persistent deduplication record.

- Endpoint: `https://lgtrading-contact-537555699968.europe-west12.run.app/api/contact`.
- Health: append `/health` to the endpoint; the response includes the exact backend Git commit.
- Runtime: Node.js 22, 256 MiB, 1 CPU, request-based billing, minimum 0 and
  maximum 2 instances, concurrency 20, timeout 25 seconds, region `europe-west12`.
- Dedicated Firestore database: `lgtrading-contacts`.
- Runtime identity: `lgtrading-contact-runtime`, with Firestore access conditioned
  on this database and secret access limited to `lgtrading-contact-postmark-token`.
- Container repository: `lgtrading-contact` in Artifact Registry.

## Email configuration

Requests go exclusively to `info@lgtrading.it`. The displayed sender is
**LG Trading SRL**, using `info@ilovepaghe.com`, an already verified Postmark
sender. `info@lgtrading.it` is not currently a verified sender on this account;
its first delivery test was rejected by Postmark with error 400.
The visitor's address is used only as Reply-To. No automatic message is sent
to the visitor. Open and link tracking are disabled.

The user authorized reuse of the iLovePaghe Postmark credentials. A copy is
stored as version 1 of the dedicated contact secret in the deployment project.
No credential is exposed in Git, public assets or runtime logs.

Required runtime configuration:

- `GOOGLE_CLOUD_PROJECT=tabellone-produzione-liv-e313e`
- `CONTACT_DATABASE=lgtrading-contacts`
- `CONTACT_FROM_EMAIL=info@ilovepaghe.com`
- `CONTACT_RELEASE=<exact deployed Git commit>`
- `POSTMARK_SERVER_TOKEN`, mounted from the dedicated secret, version 1

The sender is restricted in server code to the two authorized company
addresses. To switch to `info@lgtrading.it`, first verify that address/domain in
Postmark and then update the deployment configuration and test delivery.

## Request processing

`POST /api/contact` accepts JSON with `referente`, `email`, `telefono`,
`messaggio`, `startedAt` in milliseconds and an empty `website` honeypot.

The handler validates types, lengths, email, phone, control characters,
request size, origin and form completion timing. Only the LG Trading domains
and its Firebase Hosting aliases are permitted by CORS.

Firestore transactions cap submissions at 3 per email and 30 overall per
hour. HMAC fingerprints prevent repeated emails across simultaneous requests,
repeated clicks and restarts. A confirmed duplicate returns success without
sending again. An uncertain provider outcome is retained and never
transparently retried. Known provider rejections can be retried.

Firestore contains only HMAC identifiers, counters, delivery states,
timestamps and the provider message ID. Contact names, email addresses,
phone numbers and message text are not stored there. TTL is enabled on
`expiresAt` for both `contactRequests` and `contactRateLimits`, with expiry
set to 24 hours. Firestore rules deny client reads and writes.

The frontend shows success only after provider acceptance or a confirmed
previous delivery. On failure it preserves the entered fields and allows a
retry. The original email handoff remains available as an explicit rollback:
change the form action back to `mailto:info@lgtrading.it` and deploy Hosting.

## Testing and deployment

Run from the repository root:

```bash
node --test backend/contact/test/*.test.js
```

These 12 tests do not send emails. They cover validation, duplicate and
concurrent submissions, provider failures, fixed recipient/sender, the
verified sender configuration and frontend loading/error/success behavior.
GitHub Actions runs them before every Hosting deployment.

For backend updates, commit the changes and run:

```bash
bash scripts/deploy-contact.sh
```

The script rejects uncommitted backend changes, builds from the locked
production dependencies and deploys the committed source with its exact Git
hash. It targets only the dedicated contact service. Backend deployment is
manual; pushing `main` automatically deploys Firebase Hosting.

When changing contact database rules, use the separate configuration and
explicit project/database target:

```bash
firebase deploy --project=tabellone-produzione-liv-e313e --config=firebase.contacts.json --only=firestore:lgtrading-contacts --non-interactive
```

Do not deploy these rules to the corporate project's default database.
After a backend release, check health, CORS, malformed requests and delivery
before changing the public form endpoint. Real delivery checks must use a
clearly labelled technical test to the company mailbox, and should verify
that a retry produces only one Postmark message.

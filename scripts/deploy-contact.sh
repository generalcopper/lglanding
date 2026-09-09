#!/usr/bin/env bash
set -euo pipefail

# Authorized LG Trading contact resources. Hosting stays in lgtrading-landing.
lgcontact_project='tabellone-produzione-liv-e313e'
lgcontact_region='europe-west12'
lgcontact_root="$(git rev-parse --show-toplevel)"
cd "$lgcontact_root"
git diff --exit-code HEAD -- backend/contact scripts/deploy-contact.sh
lgcontact_revision="$(git rev-parse HEAD)"
lgcontact_image="europe-west12-docker.pkg.dev/${lgcontact_project}/lgtrading-contact/app:${lgcontact_revision}"

node --test backend/contact/test/*.test.js
gcloud builds submit backend/contact \
  --project="$lgcontact_project" --region="$lgcontact_region" \
  --tag="$lgcontact_image" --quiet

gcloud run deploy lgtrading-contact \
  --project="$lgcontact_project" --region="$lgcontact_region" \
  --image="$lgcontact_image" \
  --service-account="lgtrading-contact-runtime@${lgcontact_project}.iam.gserviceaccount.com" \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=${lgcontact_project},CONTACT_DATABASE=lgtrading-contacts,CONTACT_FROM_EMAIL=info@ilovepaghe.com,CONTACT_RELEASE=${lgcontact_revision}" \
  --set-secrets='POSTMARK_SERVER_TOKEN=lgtrading-contact-postmark-token:1' \
  --min-instances=0 --max-instances=2 --concurrency=20 \
  --cpu=1 --memory=256Mi --timeout=25 --cpu-throttling \
  --allow-unauthenticated --quiet

gcloud run services describe lgtrading-contact \
  --project="$lgcontact_project" --region="$lgcontact_region" \
  --format='value(status.url,status.latestReadyRevisionName)'

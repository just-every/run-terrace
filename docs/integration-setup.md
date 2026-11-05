# Integration setup

Settings → Data & access → Integration diagnostics lists configuration presence and evidence from operations you already requested. Opening it or saving its cost and permission metadata makes no provider request. A configured credential is not evidence of authorization, delivery, settlement or an available account entitlement.

## Deployment settings

For a production installation, edit the nonsecret values in `deploy.json` → `vars`. Supply secret values to the deployment process through your private environment or secret manager. Alternatively, use `rer deploy --env-file /absolute/private/terrace.env` with an owner-only file outside the checkout: it must contain one `KEY=VALUE` per line, be owned by your user and have mode `0600`. Use your actual private file path. The file overrides matching process environment inputs; never use the local development `.dev.vars` file for deployment. The existing `secrets` entry maps the `MAIL_API_KEY` environment variable to the Worker binding of the same name. Do not paste credentials into Git, chat, command arguments or shell history.

The installation owner or their deployment operator must make these changes in the checkout that deploys this installation; this screen saves only non-secret metadata. For the first Cloudflare deployment, supply `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `OWNER_EMAIL`, `SESSION_SECRET`, `SETUP_TOKEN` and `MAIL_API_KEY` privately. Session and setup secrets must be random values of at least 32 characters. Keep an existing installation's identity and session configuration. Review and commit intentional tracked configuration changes: real deployment refuses dirty tracked files.

From that checkout, with the private environment supplied, run:

```sh
rer deploy --dry-run
rer deploy
```

Use the same `--env-file /absolute/private/terrace.env` argument on both commands if using a private file. The dry run builds and validates a local plan without provider requests; real deployment publishes the installation. Neither proves mail delivery or payment settlement. See [Terrace's deployment instructions](../README.md#deploy-to-your-cloudflare-account) for hosting prerequisites and the first owner's claim. Keep `wrangler.jsonc`'s local development configuration separate: `rer dev` suppresses development mail and proves no production provider connection.

A full deploy preserves a secret the Worker already holds. To replace an existing mail key, supply the new `MAIL_API_KEY` privately, then run:

```sh
rer deploy --set-secret MAIL_API_KEY
```

Add `--env-file /absolute/private/terrace.env` if needed. This updates the secret of the recorded deployment without rebuilding; it does not publish changes to `deploy.json` → `vars`. Deploy reviewed public-setting changes separately with `rer deploy`.

Choose one mail provider. Existing uncertain mail must be reconciled using its original provider reference before an explicit further action. Connecting another provider does not resolve that uncertainty.

## Resend

In `deploy.json` → `vars`, set `MAIL_PROVIDER` to `resend` and `MAIL_FROM` to a sender verified in your Resend account. Supply the authorized key privately as `MAIL_API_KEY` in the deployment process environment. The checked-in example sender is non-deliverable and must be replaced for production.

## SendGrid

Set `MAIL_PROVIDER` to `sendgrid` and `MAIL_FROM` to a verified sender in `deploy.json` → `vars`. Supply a SendGrid key with Mail Send permission privately as `MAIL_API_KEY` in the deployment process environment.

## Cloudflare

Set `MAIL_PROVIDER` to `cloudflare`, `MAIL_FROM` to a verified sender and `MAIL_ACCOUNT_ID` to the mail account's 32-character hexadecimal account ID in `deploy.json` → `vars`. Supply the key authorized for that account's mail service privately as `MAIL_API_KEY`. A Cloudflare hosting token is not automatically a mail-service credential.

## RER

Set `MAIL_PROVIDER` to `rer` only with approved relay configuration. Use the assigned `MAIL_FROM` and `MAIL_RELAY_URL` in `deploy.json` → `vars`, and supply `MAIL_API_KEY` privately. The relay must use its assigned HTTPS URL, without embedded credentials. Owner-entered relay validation remains held by Base; filling these values does not establish approval or entitlement.

## Stripe

Stripe is optional. Terrace's current hosted card-payment capability uses Stripe test mode; live credentials are refused. Hosted Checkout requires no publishable key in Terrace.

To configure deployment, add a secret mapping to the `secrets` array in `deploy.json` with `binding` and `environment` both set to `STRIPE_SECRET_KEY`. You may set `optional` to `true` so an installation without Stripe can still deploy. The entry contains names only:

```json
{ "binding": "STRIPE_SECRET_KEY", "environment": "STRIPE_SECRET_KEY", "optional": true }
```

Supply the authorized Stripe test secret privately as `STRIPE_SECRET_KEY` in the deployment process environment; never store the credential in the file. The binding name belongs in configuration, while its value stays private.

For a new binding, deploy the reviewed mapping with the private input using the commands above. To replace a key already held by the recorded Worker, supply the new test key privately and run `rer deploy --set-secret STRIPE_SECRET_KEY` (with the same private `--env-file` argument if used).

Register the installation's `/api/stripe/events` endpoint for `checkout.session.completed`, `checkout.session.expired` and `payment_intent.payment_failed`. Terrace retrieves the canonical event with the server credential and checks its stored payment context. A browser return is not payment evidence. No Stripe webhook signing secret is read by this implementation; the server retrieves and verifies the canonical event rather than verifying a webhook signature. See [card payments](card-payments.md) for the exact capability limits and **Payment recovery worklist** steps before taking a further action on an interrupted payment.

## Check the result

Return to **Settings → Data & access → Integration diagnostics** on the deployed installation and reload. Mail needs a supported `MAIL_PROVIDER`, nonempty `MAIL_FROM` and `MAIL_API_KEY`, plus the account or relay setting when required. Stripe needs a nonempty test secret; configuration presence alone does not validate that key. An incomplete setup stays marked **Missing configuration**.

**Save integration metadata** records only the owner's declared permission, entitlement and dated cost assumption; it does not connect a provider. A new configuration can show **Unknown** for the last successful exchange until a supported operation explicitly requested through its ordinary approval flow succeeds. Do not send mail or start a payment just to clear the status. Diagnostics currently observe Stripe requests, work-dispatch mail and resident repair-message mail; they do not prove every mail path. Keep failed or uncertain original operations for reconciliation before any further action.

## After a restore

Provider observations are retained evidence from their originating installation. Reconnect privately for the destination and reconcile pending operations with the original account. Restored messages and payment references do not grant send, collection or posting authority. Diagnostics initiate no automatic checks, retries or sends.

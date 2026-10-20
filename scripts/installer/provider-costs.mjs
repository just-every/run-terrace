// OPEN-001: this runs before the deployment hook can contact a paid provider,
// including secret changes that enable a previously unconfigured mail sender.
export function discloseProviderCosts(deploy) {
 return Object.assign(async context => {
  context.store.report('Terrace is MIT licensed: no author license key, paid gate, seat/unit cap or per-payment fee.');
  context.store.report('Cloudflare hosting/storage bills your account: https://developers.cloudflare.com/workers/platform/pricing/ and https://developers.cloudflare.com/d1/platform/pricing/');
  context.store.report('Resend email bills your account: https://resend.com/pricing. Review provider pricing before supplying credentials or enabling delivery.');
  return deploy(context);
 }, deploy);
}

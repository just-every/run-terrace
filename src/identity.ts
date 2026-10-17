// This edition's identity: what its installed Lobby and its run site say.
// The name and colour are the ones setup saves in src/branding.json.
import type { EditionIdentity } from './base/identity'
import branding from './branding.json'

export const identity: EditionIdentity = {
  product: branding.name,
  deployment: branding.name,
  purpose: '{deployment} keeps leases, rent, repairs and owner statements in one place.',
  tagline: 'Rent in. Repairs done. Owners paid.',
  signInPath: '/signin',
  // The run site `rer deploy --site` publishes (deploy-site.json).
  runSite: 'https://run-terrace.com',
  // An installed instance serves the Lobby at /.
  installedHome: 'lobby',
  theme: '/rer-theme.css',
  mark: '/brand/mark.svg',
  band: '/site/band.webp',
  fonts: '/fonts/fonts.css',
  accentColor: branding.primaryColor,
}

// The run-site homepage: one manager's October at Alder Court, from rent day to owner payout, built from the
// 17 Oct 2026 desk (evidence/desk-terrace). Sections run in date order, as the month ribbon lists them.
import { siteDocument } from '../document'
import { books } from './books'
import { closing } from './closing'
import { hero } from './hero'
import { lateRent } from './late-rent'
import { leak } from './leak'
import { leased } from './leased'
import { mailboxes } from './mailboxes'
import { month } from './month'
import { movingIn } from './moving-in'
import { owners } from './owners'
import { narrow } from './parts'
import { repaired } from './repaired'

export function homeHtml() {
 return siteDocument({
  title: 'Terrace · Rent in. Repairs done. Owners paid.',
  description: 'Free, open source property management for US residential portfolios: leasing, rent collection, trust accounting, owner and resident portals and maintenance in one reconciled ledger.',
  styles: ['/site/landing.css', '/site/landing-art.css'],
  preload: '<link rel="preload" as="image" type="image/avif" imagesrcset="/site/hero-768.avif 768w, /site/hero-1152.avif 1152w, /site/hero-1536.avif 1536w" imagesizes="100vw" media="(min-width: 1240px)">',
  narrow,
  body: `<main id="main">${hero()}${month()}${leased()}${leak()}${repaired()}${lateRent()}${mailboxes()}${books()}${owners()}${movingIn()}</main>${closing()}`,
 })
}

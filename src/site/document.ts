// One <head> for the run site's own pages: title, description, share card, icons, fonts and the site stylesheets.
import { escape } from '../base/run-site'
import { identity } from '../identity'
import { iconSprite } from './icons'

const SHARE = `${identity.runSite}/site/share.jpg`
const STYLES = ['/rer-theme.css', '/site/site.css', '/site/cards.css']

export function siteDocument({ title, description, styles, body, script = '', preload = '' }: { title: string; description: string; styles: string[]; body: string; script?: string; preload?: string }) {
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
  + `<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="theme-color" content="#F6F5FD">`
  + `<meta property="og:type" content="website"><meta property="og:site_name" content="Terrace"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}">`
  + `<meta property="og:image" content="${SHARE}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">`
  + `<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" type="image/svg+xml" href="/brand/favicon-32.svg"><link rel="icon" type="image/png" sizes="16x16" href="/brand/favicon-16.png"><link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png"><link rel="icon" type="image/png" sizes="192x192" href="/brand/icon-192.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">`
  + `<link rel="preload" href="/fonts/geist/geist-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/figtree/figtree-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>${preload}`
  + [...STYLES, ...styles].map(href => `<link rel="stylesheet" href="${href}">`).join('')
  + `</head><body>${iconSprite}${body}${script ? `<script>${script}</script>` : ''}</body></html>`
}

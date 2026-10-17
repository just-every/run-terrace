// The run site (run-terrace.com) `rer build --site` writes: the homepage with its Run action, /run, the docs
// from docs/*.md, /contract from CONTRACT.md, and the not-found page. Nothing here reads installation data.
import { contractPageHtml } from '../base/contract-page'
import { runPageHtml, siteNotFoundHtml, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity } from '../identity'
import { docsPages } from './docs'
import { homeHtml } from './landing/home'
import { run, repository } from './run'

// Base's shared pages (src/base/run-site.ts, copied unchanged) print British "licence"; Terrace is a US product.
const usSpelling = (html: string) => html.replaceAll(`${run.licence} licence<`, `${run.licence} license<`)

export function sitePages({ contract }: Partial<SiteContext> = {}): SiteBuild {
 return {
  pages: [
   { path: '/', html: homeHtml() },
   { path: '/run', html: usSpelling(runPageHtml(identity, run, contract)) },
   ...(contract ? [{ path: '/contract', html: contractPageHtml(identity, run, contract) }] : []),
   ...docsPages(repository),
   { path: '/404', html: siteNotFoundHtml(identity, run, contract) },
  ],
  assets: ['rer-theme.css', 'brand', 'fonts', 'site', 'favicon.ico', 'apple-touch-icon.png'],
 }
}

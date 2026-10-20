// The run site's frame: the Terrace lockup (the vector mark beside the wordmark), the header and the footer.
import { escape } from '../base/run-site'
import { repository } from './run'

/** The approved mark (stepped blocks, mark 2) inline, so its bars take the page's violet tokens. */
export const mark = (className = 'mark') => `<svg class="${className}" viewBox="0 0 45 30" aria-hidden="true"><path class="bar-deep" d="M0 20h19v10H0z"/><path class="bar-mid" d="M13 10h19v10H13z"/><path class="bar-pale" d="M26 0h19v10H26z"/></svg>`
export const lockup = `<a class="lockup" href="/">${mark()}<span>Terrace</span></a>`

export function siteHeader(current?: 'docs', className = '') {
 return `<header class="site-header${className ? ` ${className}` : ''}"><a class="skip-link" href="#main">Skip to content</a><div class="wrap site-header-row">${lockup}<nav aria-label="Site"><a href="/docs"${current === 'docs' ? ' aria-current="page"' : ''}>Docs</a><a href="/contract">Contract</a><a href="${escape(repository)}">Source</a></nav></div></header>`
}

export function siteFooter() {
 return `<footer class="site-footer"><div class="wrap site-footer-row">${lockup}<nav aria-label="Footer"><a href="/docs">Docs</a><a href="/contract">Contract</a><a href="${escape(repository)}">Source</a><a href="${escape(repository)}/blob/HEAD/LICENSE">MIT licensed</a></nav></div></footer>`
}

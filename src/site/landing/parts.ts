// Pieces every homepage section shares: the painted-art <picture>, the Run action, eyebrows, headings with
// the violet full stop, avatars and status pills.
import { icon } from '../icons'

const widths: Record<string, number[]> = { hero: [768, 1152, 1536], closing: [768, 1152, 1536], mailboxes: [768, 1152, 1536], 'hero-phone': [780, 1170], 'closing-phone': [780, 1170], 'mailboxes-phone': [780, 1170] }
const sizes: Record<string, [number, number]> = { hero: [1536, 1024], closing: [1536, 588], mailboxes: [1536, 1024] }
const srcset = (name: string, type: string) => widths[name].map(w => `/site/${name}-${w}.${type} ${w}w`).join(', ')

/** The homepage's one-column layout, used until its desktop composition fits (landing*.css use the same 1239 px). */
export const narrow = '(max-width: 1239px)'

/** A painted plate as AVIF with a WebP fallback, at three widths, with an optional phone crop for the narrow layout. */
export function picture(name: string, alt: string, { phone, eager = false }: { phone?: string; eager?: boolean } = {}) {
 const [w, h] = sizes[name]
 const crop = phone ? `<source media="${narrow}" type="image/avif" srcset="${srcset(phone, 'avif')}" sizes="100vw"><source media="${narrow}" type="image/webp" srcset="${srcset(phone, 'webp')}" sizes="100vw">` : ''
 return `<picture class="art">${crop}<source type="image/avif" srcset="${srcset(name, 'avif')}" sizes="100vw"><source type="image/webp" srcset="${srcset(name, 'webp')}" sizes="100vw"><img src="/site/${name}-1536.webp" alt="${alt}" width="${w}" height="${h}" ${eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"'}></picture>`
}

export const runButton = () => `<a class="run-button" href="/run">Run Terrace ${icon('arrow')}</a>`

/** A heading whose closing full stop is the violet dot. */
export const heading = (level: 'h2' | 'h3', text: string, id = '', className = '') => {
 const lines = text.split('\n').map(line => line.replace(/\.$/, '<span class="dot">.</span>'))
 return `<${level}${id ? ` id="${id}"` : ''}${className ? ` class="${className}"` : ''}>${lines.join('<br>')}</${level}>`
}
export const eyebrow = (text: string, className = '') => `<p class="eyebrow${className ? ` ${className}` : ''}">${text}</p>`
export const avatar = (initials: string, tone: string) => `<span class="avatar ${tone}" aria-hidden="true">${initials}</span>`
export const pill = (text: string, tone: string) => `<span class="pill ${tone}">${text}</span>`
export const disc = (glyph: string, tone: string, className = '') => `<span class="disc ${tone}${className ? ` ${className}` : ''}">${icon(glyph)}</span>`

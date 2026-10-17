/** Repository Markdown is read only while building the public static site. */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path/posix'
import { Marked } from 'marked'
import { siteDocument } from './document'
import { siteFooter, siteHeader } from './shell'

const guides = [
  { file: 'docs/index.md', path: '/docs', label: 'Overview', title: 'Terrace guides', description: 'Practical guides to tenancies, rent, inspections, maintenance and looking after your Terrace records.' },
  { file: 'docs/getting-started.md', path: '/docs/getting-started', label: 'Getting started', title: 'Getting started', description: 'Run Terrace, finish setup and add your first tenancy.' },
  { file: 'docs/tenancies.md', path: '/docs/tenancies', label: 'Tenancies & renewals', title: 'Tenancies and renewals', description: 'Record tenancy details and prepare, review and approve a lease renewal.' },
  { file: 'docs/rent-and-statements.md', path: '/docs/rent-and-statements', label: 'Rent & statements', title: 'Rent, arrears and owner statements', description: 'Record charges and external receipts, review arrears and download a period owner statement.' },
  { file: 'docs/inspections-and-maintenance.md', path: '/docs/inspections-and-maintenance', label: 'Inspections & maintenance', title: 'Inspections and maintenance', description: 'Complete photo inspections and send approved maintenance through your own email client.' },
  { file: 'docs/move-in.md', path: '/docs/move-in', label: 'Move in with CSV', title: 'Move into Terrace', description: 'Preview and approve the Terrace tenancy CSV, inspect custody and undo unchanged imports.' },
  { file: 'docs/backup-and-restore.md', path: '/docs/backup-and-restore', label: 'Backup & restore', title: 'Backup and restore', description: 'Export Terrace records and photographs and restore into an empty installation.' },
  { file: 'docs/roles-and-erasure.md', path: '/docs/roles-and-erasure', label: 'People & erasure', title: 'People, roles and erasure', description: 'Invite operators, choose roles, remove access and permanently erase a tenancy.' },
  { file: 'API.md', path: '/docs/api', label: 'Command API', title: 'Terrace commands', description: 'Authenticated commands, downloads and approval boundaries for Terrace integrations.' },
]

type Guide = typeof guides[number]
type Heading = { id: string; label: string; depth: number }
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))

function sourceUrl(repository: string, file: string) {
  return `${repository}/blob/HEAD/${file.split('/').map(encodeURIComponent).join('/')}`
}

function resolveLink(href: string, source: string, repository: string) {
  if (href.startsWith('#')) return href
  if (/^(https?:|mailto:)/i.test(href)) return href
  if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) throw new Error(`Unsupported docs link: ${href}`)
  if (href.startsWith('/')) return href
  const match = /^([^?#]*)([?#].*)?$/.exec(href)!
  const file = normalize(join(dirname(source), decodeURIComponent(match[1])))
  if (file.startsWith('../') || !existsSync(join(process.cwd(), file))) throw new Error(`Missing docs link in ${source}: ${href}`)
  const guide = guides.find(item => item.file === file)
  return (guide ? guide.path : sourceUrl(repository, file)) + (match[2] ?? '')
}

function renderMarkdown(source: string, file: string, repository: string) {
  const headings: Heading[] = []
  const ids = new Map<string, number>()
  const markdown = new Marked({
    gfm: true,
    renderer: {
      heading({ text, depth, tokens }) {
        const base = text.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'section'
        const count = ids.get(base) ?? 0
        ids.set(base, count + 1)
        const id = count ? `${base}-${count + 1}` : base
        headings.push({ id, label: text, depth })
        return `<h${depth} id="${escape(id)}">${this.parser.parseInline(tokens)}<a class="heading-link" href="#${escape(id)}" aria-label="Link to ${escape(text)}">#</a></h${depth}>\n`
      },
      link({ href, title, tokens }) {
        return `<a href="${escape(resolveLink(href, file, repository))}"${title ? ` title="${escape(title)}"` : ''}>${this.parser.parseInline(tokens)}</a>`
      },
      html({ text }) { return escape(text) },
    },
  })
  const html = markdown.parse(source, { async: false })
  return { html, headings: headings.filter(heading => heading.depth === 2 || heading.depth === 3) }
}

const sections: [string, string[]][] = [
  ['Start here', ['/docs', '/docs/getting-started']],
  ['Everyday work', ['/docs/tenancies', '/docs/rent-and-statements', '/docs/inspections-and-maintenance']],
  ['Your records', ['/docs/move-in', '/docs/backup-and-restore', '/docs/roles-and-erasure']],
  ['Integrations', ['/docs/api']],
]

function navigation(current: Guide) {
  return `<nav class="guide-nav" aria-label="Documentation guides">${sections.map(([label, paths]) => `<p class="nav-label">${escape(label)}</p><ul>${paths.map(path => guides.find(guide => guide.path === path)!).map(guide => `<li><a href="${guide.path}"${guide.path === current.path ? ' aria-current="page"' : ''}>${escape(guide.label)}</a></li>`).join('')}</ul>`).join('')}</nav>`
}

function pager(current: Guide) {
  const index = guides.indexOf(current), previous = guides[index - 1], next = guides[index + 1]
  const link = (guide: Guide | undefined, rel: string, label: string) => guide ? `<a class="card pager-${rel}" href="${guide.path}" rel="${rel}"><span>${label}</span><b>${escape(guide.title)}</b></a>` : '<span></span>'
  return `<nav class="pager" aria-label="More guides">${link(previous, 'prev', 'Previous')}${link(next, 'next', 'Next')}</nav>`
}

// Code cards get their Copy button only when script runs; without it the command is still there to select.
const COPY = "document.querySelectorAll('.prose pre').forEach(pre=>{const b=document.createElement('button');b.type='button';b.className='copy';b.textContent='Copy';b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(pre.querySelector('code').textContent.trim());b.textContent='Copied';setTimeout(()=>{b.textContent='Copy'},1600)}catch{}});pre.append(b)})"

function document(guide: Guide, repository: string, html: string, headings: Heading[]) {
  const contents = headings.length ? `<details class="contents" open><summary>On this page</summary><nav aria-label="On this page"><ul>${headings.map(heading => `<li${heading.depth === 3 ? ' class="subheading"' : ''}><a href="#${escape(heading.id)}">${escape(heading.label)}</a></li>`).join('')}</ul></nav></details>` : ''
  // The index lists each guide as "[Title](file): what it covers"; its cards set the title on its own line.
  if (guide.path === '/docs') html = html.replace(/(<li><a [^>]+>[^<]+<\/a>): /g, '$1')
  const article = html.replace(/<h1 id="[^"]*">([\s\S]*?)<a class="heading-link"[^>]*>#<\/a><\/h1>/, (_, title) => `<h1>${title}</h1><p class="title-dots" aria-hidden="true"><i></i><i></i><i></i></p>${contents}`)
  return siteDocument({
    title: guide.path === '/docs' ? 'Terrace docs' : `${guide.title} · Terrace docs`,
    description: guide.description,
    styles: ['/site/docs.css'],
    script: COPY,
    body: `${siteHeader('docs')}<div class="wrap docs-layout${guide.path === '/docs' ? ' is-index' : ''}"><aside>${navigation(guide)}</aside><main id="main" tabindex="-1"><p class="eyebrow">Terrace documentation</p><article class="prose">${article}</article>${pager(guide)}<footer class="doc-footer"><a href="${escape(sourceUrl(repository, guide.file))}">Read this guide in the source</a><p>Free and open source, MIT licensed.</p></footer></main></div>${siteFooter()}`,
  })
}

/** Called from the checkout root by the run site's static entry, never a Worker. */
export function docsPages(repository: string): { path: string; html: string }[] {
  const url = new URL(repository)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Docs need a public HTTPS repository URL.')
  repository = repository.replace(/\/$/, '').replace(/\.git$/, '')
  return guides.map(guide => {
    const source = readFileSync(join(process.cwd(), guide.file), 'utf8')
    const { html, headings } = renderMarkdown(source, guide.file, repository)
    return { path: guide.path, html: document(guide, repository, html, headings) }
  })
}

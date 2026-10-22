// PORT-007: the upload check. It is a static content-type and active-content screen that fails closed, never a malware
// verdict: a file that passes is only "no active content found by this check". Nothing here claims a file is safe or
// virus-free; a malware verdict needs the owner's own scanner (PORT-010).
// Refused: a declared type outside the allowlist, bytes that do not match it, scripts or markup in any file, PDFs with
// actions, launches, embedded files, forms or encryption, and any PDF stream the check cannot read to the end.
export const CHECK = 'content-type and active-content check v1'
export const TYPES: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'text/plain': 'txt', 'text/csv': 'csv', 'message/rfc822': 'eml' }
export const LIMIT = 5 * 1024 * 1024
const same = (b: Uint8Array, v: number[], at = 0) => v.every((x, i) => b[at + i] === x)
const ascii = (b: Uint8Array, s: string, at = 0) => [...s].every((ch, i) => b[at + i] === ch.charCodeAt(0))
function latin1(b: Uint8Array) { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s }
const MARKUP = /<\s*(script|iframe|object|embed|html|svg|applet)\b|javascript:|vbscript:|<\?php/i
const PDF_ACTIVE = /\/(JavaScript|JS|Launch|AA|EmbeddedFiles?|RichMedia|XFA|SubmitForm|ImportData|GoToR|GoToE|Encrypt)(?![A-Za-z0-9])|\/OpenAction(?!\s*\[)/
export type Scan = { ok: true; label: string; text: string | null } | { ok: false; reason: string }
const refuse = (reason: string): Scan => ({ ok: false, reason })

async function inflate(b: Uint8Array, cap: number): Promise<Uint8Array | null> {
 try {
  const reader = new Blob([new Uint8Array(b)]).stream().pipeThrough(new DecompressionStream('deflate')).getReader(), parts: Uint8Array[] = []
  let total = 0
  for (;;) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > cap) { await reader.cancel(); return null } parts.push(value) }
  const out = new Uint8Array(total); let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
 } catch { return null }
}

/** Every PDF stream as { dict, data }, in file order. */
function streams(raw: string, bytes: Uint8Array) {
 const found: { dict: string; data: Uint8Array }[] = [], start = /(?<!end)stream\r?\n/g
 let m: RegExpExecArray | null
 while ((m = start.exec(raw))) {
  const from = m.index + m[0].length, to = raw.indexOf('endstream', from)
  if (to < 0) { found.push({ dict: '', data: new Uint8Array(0) }); break }
  const head = raw.slice(Math.max(0, m.index - 600), m.index)
  found.push({ dict: head.slice(head.lastIndexOf('obj') + 1), data: bytes.subarray(from, to) })
  start.lastIndex = to
 }
 return found
}
const unescapePdf = (s: string) => s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, g: string) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' } as Record<string, string>)[g] ?? (/^[0-7]/.test(g) ? String.fromCharCode(parseInt(g, 8)) : g))
/** Text shown by simple (Tj/TJ) page content. Fonts that map glyph codes are not decoded, so such a PDF stays metadata-only. */
function pdfText(content: string) {
 const out: string[] = []
 for (const m of content.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj|\[((?:[^\]\\]|\\.)*)\]\s*TJ/g)) {
  if (m[1] !== undefined) out.push(unescapePdf(m[1]))
  else out.push([...m[2].matchAll(/\(((?:[^()\\]|\\.)*)\)/g)].map(x => unescapePdf(x[1])).join(''))
 }
 return out.join(' ').replace(/\s+/g, ' ').trim()
}
async function pdf(bytes: Uint8Array): Promise<Scan> {
 const raw = latin1(bytes), names = raw.replace(/#([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
 if (PDF_ACTIVE.test(names)) return refuse('The PDF contains an action, script, launch, embedded file, form submission or encryption. Upload a flattened copy.')
 const pieces: string[] = [];let budget = 24 * 1024 * 1024
 for (const s of streams(raw, bytes)) {
  const flate = /\/FlateDecode/.test(s.dict), objects = /\/ObjStm/.test(s.dict), image = /\/Subtype\s*\/Image/.test(s.dict)
  if (!s.data.length && !s.dict) return refuse('The PDF ends inside a stream, so it could not be read to the end.')
  if (image || (!objects && s.data.length > 1_500_000)) continue
  if (!objects && !flate && /\/Filter/.test(s.dict)) continue
  let data: Uint8Array | null = s.data
  if (flate) { data = await inflate(s.data, 8 * 1024 * 1024) ?? await inflate(s.data.subarray(0, s.data.length - (s.data.at(-1) === 10 && s.data.at(-2) === 13 ? 2 : 1)), 8 * 1024 * 1024); if (!data) return refuse('A PDF stream could not be decompressed for checking.'); budget -= data.length; if (budget < 0) return refuse('The PDF expands beyond what this check can read.') }
  else if (objects) return refuse('A PDF object stream uses a filter this check cannot read.')
  const inner = latin1(data), flat = inner.replace(/#([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
  if (objects && PDF_ACTIVE.test(flat)) return refuse('The PDF contains an action, script, launch, embedded file, form submission or encryption inside compressed objects. Upload a flattened copy.')
  if (!objects) pieces.push(inner)
 }
 const content = pieces.map(pdfText).filter(Boolean).join(' ')
 return { ok: true, label: 'No active content found by the ' + CHECK + '. Not a malware scan.', text: content ? content.slice(0, 200_000) : null }
}

export async function scan(bytes: Uint8Array, type: string): Promise<Scan> {
 if (!(type in TYPES)) return refuse('This file type is not accepted. Upload a PDF, JPEG, PNG, plain text, CSV or .eml file.')
 if (!bytes.length || bytes.length > LIMIT) return refuse('Each document must be between 1 byte and 5 MB.')
 const magic = type === 'application/pdf' ? ascii(bytes, '%PDF-') : type === 'image/png' ? same(bytes, [137, 80, 78, 71, 13, 10, 26, 10]) : type === 'image/jpeg' ? same(bytes, [255, 216, 255]) : true
 if (!magic) return refuse('The file contents do not match its declared type.')
 const head = latin1(bytes)
 if (same(bytes, [0x4d, 0x5a]) || same(bytes, [0x7f, 0x45, 0x4c, 0x46]) || ascii(bytes, '#!') || same(bytes, [0xca, 0xfe, 0xba, 0xbe]) || same(bytes, [0xcf, 0xfa, 0xed, 0xfe])) return refuse('Executable files are not accepted.')
 if (type === 'application/pdf') return pdf(bytes)
 if (MARKUP.test(head)) return refuse('The file contains script or markup content, which is not accepted.')
 let text: string | null = null
 if (type.startsWith('text/') || type === 'message/rfc822') {
  if (bytes.includes(0)) return refuse('Text files must not contain binary data.')
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { return refuse('Text files must be valid UTF-8.') }
  if (type === 'message/rfc822' && !/^(from|to|date|subject|mime-version|received):/im.test(text.slice(0, 1024))) return refuse('An .eml file must start with its email headers.')
  if (/^content-type:\s*(application\/|text\/html)|^content-disposition:\s*attachment/im.test(text)) return refuse('An email with attachments or HTML parts is not accepted; upload its attachments separately.')
 }
 return { ok: true, label: 'No active content found by the ' + CHECK + '. Not a malware scan.', text: text ? text.slice(0, 200_000) : null }
}

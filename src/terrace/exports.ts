// Table downloads: CSV (RFC 4180, formula-safe), XLSX (one sheet, stored zip) and PDF (plain text pages).
type Cell = string | number
const cell = (v: Cell) => '"' + String(v).replaceAll('"', '""').replace(/^[=+@-]/, "'$&") + '"'
export const csv = (rows: Cell[][]) => rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n'

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
/** A stored (uncompressed) zip of named text or binary files. */
export function zip(files: [string, string | Uint8Array][]) {
 const enc = new TextEncoder(), parts: Uint8Array[] = [], central: Uint8Array[] = []
 let offset = 0
 const le = (n: number, size: number) => { const b = new Uint8Array(size); for (let i = 0; i < size; i++) b[i] = (n >>> (8 * i)) & 0xff; return b }
 const cat = (xs: Uint8Array[]) => { const out = new Uint8Array(xs.reduce((s, x) => s + x.length, 0)); let o = 0; for (const x of xs) { out.set(x, o); o += x.length } return out }
 for (const [name, text] of files) {
  const n = enc.encode(name), d = typeof text === 'string' ? enc.encode(text) : text, crc = crc32(d)
  const head = cat([le(0x04034b50, 4), le(20, 2), le(0, 2), le(0, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(d.length, 4), le(d.length, 4), le(n.length, 2), le(0, 2), n])
  central.push(cat([le(0x02014b50, 4), le(20, 2), le(20, 2), le(0, 2), le(0, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(d.length, 4), le(d.length, 4), le(n.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(offset, 4), n]))
  parts.push(head, d); offset += head.length + d.length
 }
 const dir = cat(central)
 return cat([...parts, dir, le(0x06054b50, 4), le(0, 2), le(0, 2), le(files.length, 2), le(files.length, 2), le(dir.length, 4), le(offset, 4), le(0, 2)])
}
const xml = (s: string) => s.replace(/[&<>"]/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]!)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
export function xlsx(rows: Cell[][], sheet = 'Report') {
 const col = (i: number) => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s }
 const data = rows.map((r, y) => `<row r="${y + 1}">${r.map((v, x) => typeof v === 'number' ? `<c r="${col(x)}${y + 1}"><v>${v}</v></c>` : `<c r="${col(x)}${y + 1}" t="inlineStr"><is><t>${xml(v)}</t></is></c>`).join('')}</row>`).join('')
 return zip([
  ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
  ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(sheet)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
  ['xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${data}</sheetData></worksheet>`],
 ])
}
/** Landscape Letter pages of monospaced text lines; characters outside printable ASCII print as "?". */
export function pdf(title: string, rows: Cell[][]) {
 const width = rows[0]?.map((_, i) => Math.min(28, Math.max(...rows.map(r => String(r[i] ?? '').length)))) ?? []
 const lines = [title, '', ...rows.map(r => r.map((v, i) => String(v).slice(0, width[i]).padEnd(width[i])).join('  '))].map(l => l.replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, '\\$&'))
 const pages: string[][] = []; for (let i = 0; i < lines.length; i += 48) pages.push(lines.slice(i, i + 48))
 const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>']
 const kids: number[] = []
 for (const page of pages) {
  const stream = `BT /F1 7 Tf 9 TL 24 588 Td ${page.map(l => `(${l}) '`).join(' ')} ET`
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /Font << /F1 3 0 R >> >> /Contents ${objects.length} 0 R >>`)
  kids.push(objects.length)
 }
 objects[1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`
 let out = '%PDF-1.4\n'; const offsets: number[] = []
 objects.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n` })
 const xref = out.length
 out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
 return new TextEncoder().encode(out)
}

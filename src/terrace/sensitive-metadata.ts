/** Display and export metadata never need full payment or identity numbers. Original bytes remain intact. */
export function redactSensitive(value:unknown){
 return String(value??'')
  .replace(/\b\d{3}[ -]?\d{2}[ -]?\d{4}\b|\b\d{2}[ -]?\d{7}\b/g,'[Restricted identifier]')
  .replace(/\b(?:\d[ -]?){12,18}\d\b/g,'[Restricted payment number]')
  .replace(/\b(?:Bearer\s+|(?:tin|ssn|pan|tax[ -]?id|identity[ -]?(?:number|id)|api[_ -]?key|access[ _-]?token|token|password|secret)\s*[:=]\s*)[^\s,;]+/gi,'[Restricted credential]')
}
export function redactErrorReport(value:unknown):unknown{
 if(typeof value==='string')return redactSensitive(value)
 if(Array.isArray(value))return value.map(redactErrorReport)
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redactErrorReport(v)]))
 return value
}

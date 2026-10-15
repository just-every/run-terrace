const paths: Record<string,string> = {
 tenancy:'M3 11 12 3l9 8M5 10v11h14V10M9 21v-8h6v8M3 21h18',
 ledger:'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5',
 work:'m14 6 4-4a6 6 0 0 1-7 8L4 20a2 2 0 0 1-3-3l10-7a6 6 0 0 1 8-7l-4 4z',
 import:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3z',
 settings:'m10 2-.7 3-2 .9L4.7 4.5 2 9l2.3 2v2L2 15l2.7 4.5L7.3 18l2 .9.7 3h5l.7-3 2-.9 2.6 1.5L23 15l-2.3-2v-2L23 9l-2.7-4.5-2.6 1.4-2-.9L15 2zM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
}
export const navIcon=(name:string)=>`<svg viewBox="0 0 25 25" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]??paths.tenancy}"/></svg>`

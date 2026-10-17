// The site's one icon set: 24 px line icons drawn once as symbols, used by <use href="#i-name">.
const symbols: Record<string, string> = {
 dollar:'<path d="M12 3v18M16.5 7.5c-.8-1.2-2.5-2-4.5-2-2.6 0-4.5 1.3-4.5 3.2 0 4.6 9.5 2.2 9.5 6.6 0 2-2 3.2-4.9 3.2-2.2 0-4-.9-4.9-2.3"/>',
 wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
 doc:'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 11h5M10 14h5M10 17h3"/>',
 people:'<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.4-3.2 2.6-5 5.5-5s5.1 1.8 5.5 5"/><circle cx="16.5" cy="9" r="2.4"/><path d="M15.5 14.2c2.6-.3 4.6 1.3 5 4.8"/>',
 home:'<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9.5h11V10"/><path d="M10.5 19.5v-5h3v5"/>',
 check:'<path d="m5.5 12.5 4 4 9-9.5"/>',
 x:'<path d="m7 7 10 10M17 7 7 17"/>',
 alert:'<path d="M12 7v6.5"/><circle cx="12" cy="17" r=".6"/>',
 lock:'<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
 file:'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>',
 image:'<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.6"/><path d="m4.5 18 5-5 3.5 3.5 2.5-2.5 4 4"/>',
 chevron:'<path d="m9.5 6 6 6-6 6"/>',
 arrow:'<path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5"/>',
 down:'<path d="M12 5v13M7 13l5 5 5-5"/>',
 list:'<rect x="5" y="4" width="14" height="16" rx="2.5"/><path d="M9 9h6M9 12h6M9 15h4"/>',
}
export const iconSprite = `<svg class="sprite" aria-hidden="true" width="0" height="0"><defs>${Object.entries(symbols).map(([name, body]) => `<symbol id="i-${name}" viewBox="0 0 24 24">${body}</symbol>`).join('')}</defs></svg>`
export const icon = (name: string, className = '') => `<svg class="i${className ? ` ${className}` : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`

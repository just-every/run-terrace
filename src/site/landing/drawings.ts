// The small drawings inside the homepage's cards, as inline SVG: the 4B listing photo, the leaking P-trap in
// Jordan's report, Bayline's two completion photos, and the house on "Built for homes".

/** 4B's listing photo: an empty, bright living room (a flat drawing, not a photograph). */
export const listingRoom = `<svg class="listing-room" viewBox="0 0 375 147" role="img" aria-label="4B's living room: a sofa, a round coffee table, a lamp and a plant under a wide window">
<defs><linearGradient id="lr-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4F2F6"/><stop offset="1" stop-color="#ECE8EE"/></linearGradient>
<linearGradient id="lr-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CFE3F6"/><stop offset="1" stop-color="#EAF3FB"/></linearGradient>
<linearGradient id="lr-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E4DDD8"/><stop offset="1" stop-color="#D9D1CB"/></linearGradient></defs>
<rect width="375" height="147" fill="url(#lr-wall)"/><path d="M0 112h375v35H0z" fill="url(#lr-floor)"/><path d="M0 112h375" stroke="#D6CEC8"/>
<rect x="130" y="12" width="120" height="74" rx="2" fill="url(#lr-sky)" stroke="#C9C3CC" stroke-width="3"/><path d="M190 12v74M130 50h120" stroke="#C9C3CC" stroke-width="2.5"/>
<path d="M214 86c4-13 14-22 24-24 6-1 12 3 12 9v15z" fill="#9DC79B"/><path d="M226 86c2-8 8-14 14-15 5 0 10 4 10 9v6z" fill="#86B788"/>
<path d="M146 30c3-5 10-6 13-2 4-3 10-1 10 4 4 0 6 4 4 7h-31c-3-3-1-8 4-9z" fill="#fff" opacity=".9"/><path d="M204 22c2-4 8-4 10-1 3-2 8 0 8 3 3 0 4 3 3 5h-24c-2-2 0-6 3-7z" fill="#fff" opacity=".85"/>
<rect x="122" y="10" width="7" height="80" rx="2" fill="#E9E3EA"/><rect x="251" y="10" width="7" height="80" rx="2" fill="#E9E3EA"/>
<path d="M28 116V48" stroke="#8E8178" stroke-width="2"/><path d="M20 116h16" stroke="#8E8178" stroke-width="3" stroke-linecap="round"/><path d="M16 50h24l-5-16H21z" fill="#F7F1E7" stroke="#DCD2C4"/>
<rect x="58" y="80" width="112" height="28" rx="7" fill="#E7DCCF"/><rect x="62" y="66" width="104" height="22" rx="8" fill="#EEE5DA"/><rect x="52" y="78" width="14" height="30" rx="6" fill="#E2D6C8"/><rect x="162" y="78" width="14" height="30" rx="6" fill="#E2D6C8"/>
<path d="M66 108v7M162 108v7" stroke="#A9927C" stroke-width="3" stroke-linecap="round"/>
<ellipse cx="160" cy="127" rx="54" ry="7" fill="#CFC5BE" opacity=".6"/><ellipse cx="160" cy="114" rx="44" ry="6" fill="#B9875A"/><path d="M136 116l-6 15M184 116l6 15M160 120v12" stroke="#9A6C43" stroke-width="3" stroke-linecap="round"/>
<rect x="306" y="84" width="58" height="30" rx="3" fill="#C08A57"/><path d="M335 86v26M310 98h50" stroke="#A97546" stroke-width="1.5"/><path d="M312 114v7M358 114v7" stroke="#8C5E36" stroke-width="3" stroke-linecap="round"/>
<path d="M287 112l4-26h18l4 26z" fill="#F2EEE9" stroke="#DDD5CE"/><path d="M300 86c-2-12-12-20-20-22 8 0 14 6 18 14-1-14 3-26 12-32-5 9-6 20-4 32 4-9 11-14 19-14-8 4-14 12-15 22z" fill="#5E8F5C"/>
</svg>`

/** Jordan's report: water dripping from the joint of the kitchen sink's P-trap. */
export const pTrap = `<svg class="p-trap" viewBox="0 0 278 82" aria-hidden="true">
<path d="M80 6h120v10H80z" fill="#fff" stroke="#3E4468" stroke-width="2" stroke-linejoin="round"/>
<path d="M126 16v26a18 18 0 0 0 36 0V36h18a12 12 0 0 1 0 24h-6" fill="none" stroke="#3E4468" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M126 16v26a18 18 0 0 0 36 0V36h18a12 12 0 0 1 0 24h-6" fill="none" stroke="#fff" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M120 44h12" stroke="#3E4468" stroke-width="2.4" stroke-linecap="round"/>
<path d="M112 46c-2 4-4 6-4 9a4 4 0 0 0 8 0c0-3-2-5-4-9zM105 60c-1.6 3-3 4.6-3 6.8a3 3 0 0 0 6 0c0-2.2-1.4-3.8-3-6.8z" fill="#5B9DF0"/>
<ellipse cx="114" cy="76" rx="22" ry="3.4" fill="#9CC4F5" opacity=".75"/>
</svg>`

/** Bayline's completion photos: the new chrome P-trap inside the 3A sink cabinet, from two angles. */
export function sinkPhoto(angle: 1 | 2) {
 const id = `sp${angle}`
 // The trap: down from the tailpiece, round the U and across to the wall arm.
 const trap = angle === 1 ? 'M80 -4V58a24 24 0 0 0 48 0V48h40' : 'M66 -4V50a28 28 0 0 0 56 0V40h66'
 const nuts = angle === 1 ? [[69, 34], [117, 52], [150, 42]] : [[55, 28], [111, 44], [150, 34]]
 return `<svg class="sink-photo" viewBox="0 0 180 145" role="img" aria-label="Photo ${angle} of 2: the new P-trap under the sink">
<defs><linearGradient id="${id}-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9DFD0"/><stop offset=".7" stop-color="#D6C7B2"/><stop offset="1" stop-color="#BFAE96"/></linearGradient>
<radialGradient id="${id}-lamp" cx="${angle === 1 ? '.3' : '.62'}" cy=".2" r=".85"><stop offset="0" stop-color="#FFF8EC" stop-opacity=".75"/><stop offset="1" stop-color="#FFF8EC" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}-nut" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7E868F"/><stop offset=".4" stop-color="#F5F7F9"/><stop offset=".7" stop-color="#B9C0C7"/><stop offset="1" stop-color="#6B737C"/></linearGradient></defs>
<rect width="180" height="145" fill="url(#${id}-back)"/>
${[22, 58, 96, 134, 168].map(x => `<path d="M${x} 0v118" stroke="#C9B89F" stroke-width=".8" opacity=".6"/>`).join('')}
<path d="M0 112h180v33H0z" fill="#CDBCA4"/><path d="M0 112h180" stroke="#B19E84" stroke-width="1.5"/><path d="M0 118h180v27H0z" fill="#000" opacity=".06"/>
<rect width="180" height="145" fill="url(#${id}-lamp)"/>
<path d="M${angle === 1 ? 14 : 18} -2v34a7 7 0 0 0 7 7h${angle === 1 ? 26 : 16}" fill="none" stroke="#8E959D" stroke-width="5" stroke-linecap="round"/><path d="M${angle === 1 ? 13 : 17} -2v33" stroke="#E6E9EC" stroke-width="1.5"/>
<ellipse cx="${angle === 1 ? 104 : 96}" cy="${angle === 1 ? 104 : 108}" rx="44" ry="7" fill="#5A4A36" opacity=".18"/>
<path d="${trap}" fill="none" stroke="#4F5760" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${trap}" fill="none" stroke="#A9B1B9" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${trap}" fill="none" stroke="#D9DEE3" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" transform="translate(-2.5 -1.5)"/>
<path d="${trap}" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".9" transform="translate(-4 -3)"/>
<rect x="164" y="${angle === 1 ? 36 : 28}" width="16" height="24" rx="2" fill="#B8AA96"/><circle cx="168" cy="${angle === 1 ? 48 : 40}" r="10" fill="url(#${id}-nut)" stroke="#6B737C" stroke-width="1.2"/>
${nuts.map(([x, y]) => `<rect x="${x}" y="${y}" width="22" height="11" rx="2.5" fill="url(#${id}-nut)" stroke="#6B737C" stroke-width="1"/>`).join('')}
</svg>`
}

/** "Built for homes": a navy house with a violet door. */
export const builtForHomes = `<svg class="house" viewBox="0 0 72 72" aria-hidden="true"><path d="M8 34 36 9l28 25" fill="none" stroke="#12163A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 29v34h42V29" fill="none" stroke="#12163A" stroke-width="5" stroke-linejoin="round"/><rect x="29" y="40" width="14" height="21" rx="2" fill="#6C4CFF"/></svg>`

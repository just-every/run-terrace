// Line icons for the app (24 px grid, 1.6 px stroke, drawn in currentColor).
const paths: Record<string,string> = {
 renewal:'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
 arrears:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16v.01',
 maintenance:'M14.7 6.3a4 4 0 0 0-5.4 5l-5.6 5.6a1.9 1.9 0 0 0 2.7 2.7l5.6-5.6a4 4 0 0 0 5-5.4l-2.5 2.5-2.3-.5-.5-2.3z',
 inspection:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
 building:'M4 21V6l8-3v18M12 8l8 3v10M2 21h20M7.5 9h1M7.5 13h1M7.5 17h1M15.5 14h1M15.5 18h1',
 plus:'M12 5v14M5 12h14',
 chevron:'m9 6 6 6-6 6',
 download:'M12 4v11M7 10l5 5 5-5M5 20h14',
 check:'m5 12.5 4.5 4.5L19 7.5',
 people:'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14a6.5 6.5 0 0 1 3.5 6',
 shield:'M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z',
 calendar:'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
 dollar:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM14.5 9.2c-.4-.8-1.3-1.2-2.5-1.2-1.5 0-2.5.7-2.5 1.8 0 2.6 5 1.3 5 4 0 1.1-1 1.9-2.5 1.9-1.3 0-2.2-.5-2.6-1.4M12 6.5V8M12 16v1.5',
 archive:'M3 5h18v4H3zM5 9v11h14V9M10 13h4',
}
export const icon=(name:string)=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]??paths.chevron}"/></svg>`

// Based on the approved PAGE-1440 12ui conversion; SPEC.md supplies exact copy.
const escapeAttribute = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function homeHtml(repository: string): string {
  const source = escapeAttribute(repository);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Terrace · Rentals, in good order.</title>
<meta name="description" content="Free, open source residential property management: tenancies, rent, photo inspections, maintenance and owner statements in one place.">
<link rel="icon" href="/brand/mark.svg">
<link rel="stylesheet" href="/rer-theme.css">
<link rel="stylesheet" href="/landing.css">
</head>
<body class="terrace-landing">
<svg class="defs" aria-hidden="true">
<symbol id="house" viewBox="0 0 40 44">
<path d="M4 18 20 5l16 13M9 16v23h22V16M4 40h32M15 39V25h10v14M15 18h10M20 7v12M8 21h24"/>
</symbol>
<symbol id="doc" viewBox="0 0 40 44">
<path d="M9 3h16l8 9v28H9zM25 3v10h8M15 20h13M15 26h13M15 32h10"/>
</symbol>
<symbol id="upload" viewBox="0 0 44 44">
<path d="M12 32H9a8 8 0 0 1-1-16 13 13 0 0 1 25-2 9 9 0 0 1 2 18h-4M22 39V22m-7 7 7-7 7 7"/>
</symbol>
<symbol id="bin" viewBox="0 0 44 44">
<path d="M9 11h26M17 11V6h10v5M12 11l2 28h16l2-28M19 17v16M25 17v16"/>
</symbol>
<symbol id="people" viewBox="0 0 44 44">
<circle cx="22" cy="13" r="6"/>
<path d="M12 38v-7a10 10 0 0 1 20 0v7M8 10a5 5 0 0 0 0 10M36 10a5 5 0 0 1 0 10M3 34v-6a7 7 0 0 1 7-5M41 34v-6a7 7 0 0 0-7-5"/>
</symbol>
<symbol id="laptop" viewBox="0 0 44 44">
<path d="M8 7h28v26H8zM3 34h38v5H3z"/>
</symbol>
<symbol id="nodes" viewBox="0 0 44 44">
<circle cx="22" cy="9" r="5"/>
<circle cx="10" cy="34" r="5"/>
<circle cx="34" cy="34" r="5"/>
<path d="m20 14-8 15m12-15 8 15"/>
</symbol>
</svg>
<main>
<header class="nav">
<a class="brand" href="#top">
<img class="brand-mark" src="/brand/mark.svg" alt="">
<span>Terrace</span>
</a>
<nav class="links" aria-label="Main navigation">
<a href="/docs">Docs</a>
<a href="${source}">Source</a>
</nav>
</header>
<section class="intro" id="top">
<h1>Rentals, in good order.</h1>
<p>Tenancies, rent, photo inspections, maintenance and owner statements, together for every home you manage.</p>
<p class="alternative">100% free, open source alternative to <strong>PropertyMe</strong>, <strong>Console Cloud</strong> and <strong>Buildium</strong>
</p>
<div class="actions">
<a class="pill" href="/run">Run Terrace →</a>
<a class="pill" href="https://demo.run-terrace.com/">Try the demo</a>
<a href="/docs">Read the docs</a>
</div>
<p class="tiny">Free and open source, MIT licensed.</p>
</section>
<section class="workflow scene" role="img" aria-label="Terrace at work: an inspection notes that the kitchen tap drips, the repair is sent to River Plumbing, and the owner statement shows $620.00 in receipts.">
<div class="veranda-art" aria-hidden="true"><div class="veranda-frieze"></div><div class="veranda-post left"></div><div class="veranda-post right"></div><div class="veranda-plant left"></div><div class="veranda-plant right"></div><div class="veranda-floor"></div></div>
<div class="steps">
<article>
<h3 class="step-title">
<span class="number">1</span> Inspect</h3>
<div class="panel step-card inspect-mini">
<img src="/brand/landing-tap-photo.webp" alt="Kitchen tap">
<div>
<p>Kitchen tap drips.</p>
<span class="badge">Completed</span>
</div>
</div>
</article>
<article>
<h3 class="step-title">
<span class="number">2</span> Send to the trade</h3>
<div class="panel step-card">
<p>Repair leaking kitchen tap</p>
<p class="muted">River Plumbing</p>
<div class="split">
<span>$180.00</span>
<span class="badge">Sent</span>
</div>
</div>
</article>
<article>
<h3 class="step-title">
<span class="number">3</span> Report to the owner</h3>
<div class="panel step-card">
<p>Owner statement</p>
<div class="rule">
</div>
<div class="split">
<span>Receipts</span>
<span>$620.00</span>
</div>
<span class="outline">
<span>Download owner statement</span>
</span>
</div>
</article>
</div>
</section>
<section class="features scene">

<article class="feature free" id="free">
<div class="copy">
<p class="eyebrow">Free</p>
<h2>Free for every door.</h2>
<p>Free as in cost and free as in code, however many homes you look after.</p>
</div>
<div class="panel license">
<svg class="icon" aria-hidden="true" focusable="false">
<use href="#doc"/>
</svg>
<h3>MIT License</h3>
<div class="rule">
</div>
<div class="brand">
<img class="brand-mark" src="/brand/mark.svg" alt="">
<span>Terrace</span>
</div>
</div>
</article>
<article class="feature rent" id="rent">
<div class="panel rent-panel">
<div class="metrics">
<div class="metric">
<span class="dot" aria-hidden="true">
</span>
<div>
<small>Outstanding</small>
<strong>$120.00</strong>
</div>
</div>
<div class="metric">
<span class="dot dark" aria-hidden="true">
</span>
<div>
<small>Overdue as of today</small>
<strong>$120.00</strong>
</div>
</div>
</div>
<div class="rent-row">
<span>Rent for 1–7 September</span>
<span class="amount">$620.00</span>
<span>
<small>Unpaid</small>$120.00</span>
</div>
</div>
<div class="copy">
<p class="eyebrow">Rent &amp; arrears</p>
<h2>See who is behind, at a glance.</h2>
<p>Record rent as it lands in your bank. Terrace shows what is outstanding and what is overdue.</p>
</div>
</article>
<article class="feature inspection" id="inspections">
<div class="copy">
<p class="eyebrow">Inspections</p>
<h2>Inspections, photos kept.</h2>
<p>Date it, add notes and photos, and complete it. The record stays exactly as you saved it.</p>
</div>
<div class="panel inspection-panel">
<span class="badge">2026-10-01 · Completed</span>
<div class="rule">
</div>
<p>Kitchen tap drips.</p>
<div class="photos">
<img src="/brand/landing-tap-photo.webp" alt="Close view of the kitchen tap">
<img src="/brand/landing-sink-photo.webp" alt="Kitchen sink and tap beside a small green plant">
</div>
</div>
</article>
<article class="feature maintenance" id="maintenance">
<div class="panel job">
<h3>Repair leaking kitchen tap</h3>
<p>River Plumbing · Due 22 Oct</p>
<div class="rule">
</div>
<div class="split">
<span>$180.00</span>
<span class="badge">Sent</span>
</div>
</div>
<div class="copy">
<p class="eyebrow">Maintenance</p>
<h2>The trade gets a ready email.</h2>
<p>Prepare the job and send the packet from your own inbox. Terrace keeps the record.</p>
</div>
</article>
<article class="feature renewal" id="renewals">
<div class="copy">
<p class="eyebrow">Renewals</p>
<h2>Renewals with the history kept.</h2>
<p>Prepare new terms and confirm them. Every earlier lease stays on file.</p>
</div>
<div class="panel lease">
<div class="document-heading">
<svg class="icon" aria-hidden="true" focusable="false">
<use href="#doc"/>
</svg>
<div>
<h3>Lease</h3>
<small>2026-02-01 to 2027-01-31</small>
</div>
</div>
<div class="rule">
</div>
<div class="lease-values">
<div>
<small>Rent</small>$620.00 weekly</div>
<div>
<small>New terms</small>$650.00 weekly</div>
</div>
</div>
</article>
<article class="feature owners" id="owners">
<div class="panel statement">
<div class="document-heading">
<svg class="icon" aria-hidden="true" focusable="false">
<use href="#doc"/>
</svg>
<h3>Owner statement</h3>
</div>
<div class="rule">
</div>
<p>Rowan Ellis</p>
<div class="balances">
<div>
<small>Opening</small>$0.00</div>
<div>
<small>Closing</small>$0.00</div>
</div>
<span class="outline">
<span>Download owner statement</span>
</span>
</div>
<div class="copy">
<p class="eyebrow">Owners</p>
<h2>Owner statements in one click.</h2>
<p>Pick a period and download the statement for the property owner.</p>
</div>
</article>
</section>
<section class="extras scene" id="included">

<h2>Also included</h2>
<div class="tools-grid">
<div class="tool">
<svg class="icon" aria-hidden="true" focusable="false">
<use href="#doc"/>
<path d="M29 21h12m-5-5 5 5-5 5"/>
</svg>
<span>Move in from a CSV</span>
</div>
<div class="tool">
<svg class="icon" aria-hidden="true" focusable="false">
<use href="#upload"/>
</svg>
<span>Backup and restore</span>
</div>
<div class="tool">
<svg class="icon" aria-hidden="true" focusable="false">
<use href="#bin"/>
</svg>
<span>Erase a tenancy</span>
</div>
<div class="tool">
<svg class="icon" aria-hidden="true" focusable="false">
<use href="#people"/>
</svg>
<span>Roles for your team</span>
</div>
<div class="tool">
<svg class="icon" aria-hidden="true" focusable="false">
<use href="#laptop"/>
</svg>
<span>Runs on your computer</span>
</div>
<div class="tool">
<svg class="icon" aria-hidden="true" focusable="false">
<use href="#nodes"/>
</svg>
<span>An API for agents</span>
</div>
</div>
<div class="try" id="try">
<h2>Try it beside what you have.</h2>
<p>Move your tenancies in from a CSV, check the preview, and undo the import if you change your mind.</p>
<div class="panel import">
<img src="/brand/landing-import-art.webp" alt="">
<div>
<h3>Review before importing</h3>
<p>2 source records · 2 tenancies · 0 rejected</p>
<span class="outline">
<span>Undo import</span>
</span>
</div>
</div>
</div>
</section>
<section class="closing scene" id="run">
<div class="veranda-art" aria-hidden="true"><div class="veranda-frieze"></div><div class="veranda-post left"></div><div class="veranda-post right"></div><div class="veranda-plant left"></div><div class="veranda-plant right"></div><div class="veranda-floor"></div></div>
<h2>Rentals, in good order.</h2>
<div class="actions">
<a class="pill" href="/run">Run Terrace →</a>
<a href="/docs">Read the docs</a>
</div>
<footer class="footer">
<a class="brand" href="#top">
<img class="brand-mark" src="/brand/mark.svg" alt="">
<span>Terrace</span>
</a>
<span class="license-note">Free and open source, MIT licensed.</span>
<a href="/docs">Docs</a>
<a href="${source}">Source</a>
</footer>
</section>
</main>
</body>
</html>`;
}

import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';

/** Render responses from the real disposable production Worker in Chromium. */
export async function screens(context, name, path) {
 const directory = resolve(process.env.TERRACE_AGENT_UI_OUTPUT ?? '.cache/agent-door-ui');
 await mkdir(directory, { recursive: true });
 const browser = await chromium.launch({ headless: true });
 try {
  const page = await browser.newPage();
  await page.route('**/*', async route => {
   const input = route.request(), url = new URL(input.url());
   if (url.origin !== context.origin) return route.abort();
   const response = await context.request(url.href, {
    method: input.method(), headers: { ...input.headers(), Cookie: context.cookie },
    ...(input.postDataBuffer() ? { body: input.postDataBuffer() } : {}), redirect: 'manual',
   });
   await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  });
  for (const width of [1440,390]) {
   await page.setViewportSize({ width, height: 960 });
   await page.goto(new URL(path,context.origin).href, { waitUntil: 'networkidle' });
   await page.screenshot({ path: join(directory,`${name}-${width}.png`), fullPage: true });
   const headings = await page.locator('h1').count();
   const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
   console.log(`Agent UI measurements: ${name} width=${width} headings=${headings} overflow=${overflow}`);
   assert.ok(headings, 'Native screen must render its heading');
   assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Native screen overflows horizontally');
   const undersized = await page.locator('button,select,textarea').evaluateAll(elements => elements.filter(element => {
    const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
   }).length);
   console.log(`Agent UI controls: ${name} width=${width} undersized=${undersized}`);
   assert.equal(undersized,0,'Native action controls must remain usable');
   await page.screenshot({ path: join(directory,`${name}-${width}.png`), fullPage: true });
  }
  console.log(`Agent UI: ${name} checked at 1440 and 390; images=${directory}`);
 } finally { await browser.close(); }
}

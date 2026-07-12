const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('PAGE ERROR LOG:', msg.text());
    else console.log('PAGE LOG:', msg.text());
  });
  page.on('pageerror', error => console.log('PAGE UNCAUGHT ERROR:', error.message));
  page.on('requestfailed', request =>
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText)
  );

  try {
    await page.goto('http://localhost:4173/hh-swap', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 10000));
  } catch (e) {
    console.log('Goto error:', e.message);
  }
  
  await browser.close();
})();

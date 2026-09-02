

const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false }); // headless: false so you can SEE it happen
  const page = await browser.newPage();

  console.log('Opening Vanilla JS app...');
  await page.goto('http://127.0.0.1:5500/vanilla/index.html');

  console.log('Typing test text...');
  await page.fill('#text-input', 'I goes to school every day and I like very much.');

  console.log('Clicking Classify...');
  await page.click('#submit-btn');

  console.log('Waiting for result...');
  await page.waitForSelector('.result-card', { timeout: 10000 });

  const resultText = await page.textContent('.result-level');
  console.log(`Result: ${resultText}`);

  console.log('Closing browser in 3 seconds...');
  await page.waitForTimeout(3000);

  await browser.close();
  console.log('Done.');
})();
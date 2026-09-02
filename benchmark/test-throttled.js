

const { chromium } = require('playwright');

const TEST_TEXT = 'I goes to school every day and I like very much.';
const APP_URL = 'http://127.0.0.1:5500/vanilla/index.html';

async function runScenario(cpuThrottleRate, label) {
  console.log(`\n--- Running scenario: ${label} (CPU throttle: ${cpuThrottleRate}x) ---`);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Open a CDP session - this gives us direct access to Chrome's internal
  // debugging protocol, which is how DevTools itself applies throttling.
  const client = await page.context().newCDPSession(page);

  // Apply CPU throttling. A rate of 4 means "4x slower than normal".
  // A rate of 1 means no throttling (normal speed).
  await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottleRate });

  const startTime = Date.now();

  await page.goto(APP_URL);
  await page.fill('#text-input', TEST_TEXT);
  await page.click('#submit-btn');
  await page.waitForSelector('.result-card', { timeout: 30000 });

  const endTime = Date.now();
  const totalTimeMs = endTime - startTime;

  const resultText = await page.textContent('.result-level');
  console.log(`Result: ${resultText}`);
  console.log(`Total scenario time (page load + classify): ${totalTimeMs}ms`);

  await browser.close();

  return totalTimeMs;
}

(async () => {
  const normalTime = await runScenario(1, 'Baseline (no throttle)');
  const throttledTime = await runScenario(4, 'Simulated low-end device (4x CPU throttle)');

  console.log('\n--- Comparison ---');
  console.log(`Baseline:  ${normalTime}ms`);
  console.log(`Throttled: ${throttledTime}ms`);
  console.log(`Difference: ${throttledTime - normalTime}ms`);
})();


const { chromium } = require('playwright');

const TEST_TEXT = 'I goes to school every day and I like very much.';
const APP_URL = 'http://127.0.0.1:5500/vanilla/index.html';

.
const MBPS_TO_BYTES_PER_SEC = (mbps) => (mbps * 1024 * 1024) / 8;

async function runScenario(config) {
  const { label, cpuRate, networkMbps, latencyMs } = config;
  console.log(`\n--- Running scenario: ${label} ---`);
  console.log(`    CPU: ${cpuRate}x | Network: ${networkMbps ? networkMbps + 'Mbps' : 'unthrottled'} | Latency: ${latencyMs || 0}ms`);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const client = await page.context().newCDPSession(page);


  await client.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });

 
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: networkMbps ? MBPS_TO_BYTES_PER_SEC(networkMbps) : -1,
    uploadThroughput: networkMbps ? MBPS_TO_BYTES_PER_SEC(networkMbps) : -1,
    latency: latencyMs || 0,
  });

  const startTime = Date.now();

  await page.goto(APP_URL);
  await page.fill('#text-input', TEST_TEXT);
  await page.click('#submit-btn');
  await page.waitForSelector('.result-card', { timeout: 60000 });

  const endTime = Date.now();
  const totalTimeMs = endTime - startTime;

  const resultText = await page.textContent('.result-level');
  console.log(`Result: ${resultText}`);
  console.log(`Total scenario time: ${totalTimeMs}ms`);

  await browser.close();

  return totalTimeMs;
}

(async () => {
  const results = {};

  results.baseline = await runScenario({
    label: 'E1: Baseline (no throttle)',
    cpuRate: 1,
    networkMbps: null,
    latencyMs: 0,
  });

  results.e2 = await runScenario({
    label: 'E2: Mid-range mobile (4x CPU, 5Mbps, 100ms RTT)',
    cpuRate: 4,
    networkMbps: 5,
    latencyMs: 100,
  });

  results.e3 = await runScenario({
    label: 'E3: Low-end mobile (6x CPU, 5Mbps, 100ms RTT)',
    cpuRate: 6,
    networkMbps: 5,
    latencyMs: 100,
  });

  console.log('\n--- Comparison ---');
  console.log(`E1 (baseline): ${results.baseline}ms`);
  console.log(`E2 (mid-mobile): ${results.e2}ms`);
  console.log(`E3 (low-end mobile): ${results.e3}ms`);
})();


const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REPETITIONS = 30;
const HEAP_POLL_INTERVAL_MS = 10; // was 100ms - too slow for fast E1 loads

const FRAMEWORKS = [
  { name: 'Vanilla', url: 'http://127.0.0.1:5500/vanilla/index.html' },
  { name: 'React', url: 'http://localhost:5174/' },
  { name: 'Angular', url: 'http://localhost:4201/' },
];

const ENVIRONMENTS = [
  { name: 'E1', label: 'Baseline (desktop)', cpuRate: 1, networkMbps: null, latencyMs: 0 },
  { name: 'E2', label: 'Mid-range mobile', cpuRate: 4, networkMbps: 5, latencyMs: 100 },
  { name: 'E3', label: 'Low-end mobile', cpuRate: 6, networkMbps: 5, latencyMs: 100 },
];

const MBPS_TO_BYTES_PER_SEC = (mbps) => (mbps * 1024 * 1024) / 8;

const RESULTS_DIR = path.join(__dirname, 'results');
const CSV_PATH = path.join(RESULTS_DIR, `results-coldload-rerun-${Date.now()}.csv`);
const CSV_HEADER = 'scenario,framework,environment,run,result,timeMs,ttiMs,peakHeapKB\n';

function ensureResultsFileExists() {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR);
  fs.writeFileSync(CSV_PATH, CSV_HEADER);
}

function appendResultRow(row) {
  const line = `${row.scenario},${row.framework},${row.environment},${row.run},${row.result},${row.timeMs},${row.ttiMs},${row.peakHeapKB}\n`;
  fs.appendFileSync(CSV_PATH, line);
}

async function scenarioColdLoad(frameworkUrl, env) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const client = await page.context().newCDPSession(page);

  await client.send('Emulation.setCPUThrottlingRate', { rate: env.cpuRate });
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: env.networkMbps ? MBPS_TO_BYTES_PER_SEC(env.networkMbps) : -1,
    uploadThroughput: env.networkMbps ? MBPS_TO_BYTES_PER_SEC(env.networkMbps) : -1,
    latency: env.latencyMs || 0,
  });

  await client.send('Performance.enable');
  let peakHeapBytes = 0;
  const heapPollInterval = setInterval(async () => {
    try {
      const { metrics } = await client.send('Performance.getMetrics');
      const heapMetric = metrics.find((m) => m.name === 'JSHeapUsedSize');
      if (heapMetric && heapMetric.value > peakHeapBytes) peakHeapBytes = heapMetric.value;
    } catch {
      // ignore
    }
  }, HEAP_POLL_INTERVAL_MS);

  await page.addInitScript(() => {
    window.__ttiPromise = new Promise((resolve) => {
      if (document.readyState === 'complete') {
        requestAnimationFrame(() => resolve(performance.now()));
        return;
      }
      window.addEventListener('load', () => {
        requestAnimationFrame(() => resolve(performance.now()));
      });
    });
  });

  const startTime = Date.now();
  await page.goto(frameworkUrl);
  const ttiMs = await page.evaluate(() => window.__ttiPromise);
  const totalTimeMs = Date.now() - startTime;

  // One final immediate read right before closing, in case the interval
  // still hasn't fired even at 10ms (e.g. an extremely fast E1 run).
  try {
    const { metrics } = await client.send('Performance.getMetrics');
    const heapMetric = metrics.find((m) => m.name === 'JSHeapUsedSize');
    if (heapMetric && heapMetric.value > peakHeapBytes) peakHeapBytes = heapMetric.value;
  } catch {
    // ignore
  }

  clearInterval(heapPollInterval);
  await browser.close();

  return {
    result: 'N/A',
    timeMs: totalTimeMs,
    ttiMs: Math.round(ttiMs),
    peakHeapKB: Math.round(peakHeapBytes / 1024),
  };
}

(async () => {
  ensureResultsFileExists();
  console.log(`Results will be saved to: ${CSV_PATH}\n`);

  console.log('Running warm-up pass (discarded)...');
  await scenarioColdLoad(FRAMEWORKS[0].url, ENVIRONMENTS[0]);
  console.log('Warm-up complete.\n');

  const totalRuns = FRAMEWORKS.length * ENVIRONMENTS.length * REPETITIONS;
  let completedRuns = 0;
  const overallStart = Date.now();

  for (const framework of FRAMEWORKS) {
    for (const env of ENVIRONMENTS) {
      console.log(`\n=== [cold-load rerun] ${framework.name} / ${env.name} - ${REPETITIONS} runs ===`);

      for (let run = 1; run <= REPETITIONS; run++) {
        const { result, timeMs, ttiMs, peakHeapKB } = await scenarioColdLoad(framework.url, env);

        appendResultRow({
          scenario: 'cold-load',
          framework: framework.name,
          environment: env.name,
          run,
          result,
          timeMs,
          ttiMs,
          peakHeapKB,
        });

        completedRuns++;
        const percent = ((completedRuns / totalRuns) * 100).toFixed(1);
        console.log(`  Run ${run}/${REPETITIONS} -> ${timeMs}ms (TTI ${ttiMs}ms, heap ${peakHeapKB}KB) | Overall: ${percent}%`);
      }
    }
  }

  const totalMinutes = ((Date.now() - overallStart) / 60000).toFixed(1);
  console.log(`\nAll ${totalRuns} cold-load runs complete in ${totalMinutes} minutes.`);
  console.log(`Results saved to: ${CSV_PATH}`);
})();
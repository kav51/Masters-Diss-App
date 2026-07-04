/*
  script.js — Vanilla JS implementation
  --------------------------------------
  Calls the local FastAPI backend (http://127.0.0.1:8000/classify) which
  wraps the CEFR model. No frameworks, manual DOM manipulation only.
*/

const BACKEND_URL = "http://127.0.0.1:8000/classify";

const textInput = document.getElementById("text-input");
const submitBtn = document.getElementById("submit-btn");
const resultArea = document.getElementById("result-area");

submitBtn.addEventListener("click", handleSubmit);

async function handleSubmit() {
  const text = textInput.value.trim();
  if (!text) return;

  setLoadingState();

  const startTime = performance.now();

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: text }),
    });

    if (!response.ok) {
      throw new Error(`Backend returned status ${response.status}`);
    }

    const data = await response.json();
    const endTime = performance.now();

    const totalTimeMs = endTime - startTime;
    console.log(`Total round-trip time: ${totalTimeMs.toFixed(1)}ms`);

    renderResult(data.predictions);
  } catch (err) {
    renderError(err);
  }
}

function setLoadingState() {
  clearResultArea();
  const loadingEl = document.createElement("p");
  loadingEl.className = "loading";
  loadingEl.textContent = "Classifying...";
  resultArea.appendChild(loadingEl);
  submitBtn.disabled = true;
}

function renderResult(predictions) {
  clearResultArea();
  submitBtn.disabled = false;

  const top = predictions[0];

  const card = document.createElement("div");
  card.className = "result-card";

  const levelEl = document.createElement("div");
  levelEl.className = "result-level";
  levelEl.textContent = top.label;
  card.appendChild(levelEl);

  const scoresEl = document.createElement("div");
  scoresEl.className = "result-scores";
  scoresEl.textContent = predictions
    .map((p) => `${p.label}: ${(p.score * 100).toFixed(1)}%`)
    .join("  |  ");
  card.appendChild(scoresEl);

  resultArea.appendChild(card);
}

function renderError(err) {
  clearResultArea();
  submitBtn.disabled = false;

  const card = document.createElement("div");
  card.className = "error-card";
  card.textContent = `Error: ${err.message}`;
  resultArea.appendChild(card);
}

function clearResultArea() {
  resultArea.innerHTML = "";
}
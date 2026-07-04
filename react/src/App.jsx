import { useState } from "react";

const BACKEND_URL = "http://127.0.0.1:8000/classify";

function App() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [predictions, setPredictions] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit() {
    if (!text.trim()) return;

    setStatus("loading");

    const startTime = performance.now();

    try {
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text }),
      });

      if (!response.ok) {
        throw new Error(`Backend returned status ${response.status}`);
      }

      const data = await response.json();
      const endTime = performance.now();

      console.log(`Total round-trip time: ${(endTime - startTime).toFixed(1)}ms`);

      setPredictions(data.predictions);
      setStatus("success");
    } catch (err) {
      setErrorMessage(err.message);
      setStatus("error");
    }
  }

  return (
    <>
      <h1>CEFR Writing Level Classifier</h1>
      <p className="subtitle">React implementation</p>

      <textarea
        id="text-input"
        placeholder="Paste student writing here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <br />
      <button
        id="submit-btn"
        onClick={handleSubmit}
        disabled={status === "loading"}
      >
        Classify
      </button>

      <div id="result-area">
        {status === "loading" && <p className="loading">Classifying...</p>}

        {status === "success" && predictions.length > 0 && (
          <div className="result-card">
            <div className="result-level">{predictions[0].label}</div>
            <div className="result-scores">
              {predictions
                .map((p) => `${p.label}: ${(p.score * 100).toFixed(1)}%`)
                .join("  |  ")}
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="error-card">Error: {errorMessage}</div>
        )}
      </div>
    </>
  );
}

export default App;
"""
main.py — Local backend for the CEFR classifier
--------------------------------------------------
Loads the theluantran/cefr-bert-classifier model once when the server starts,
then exposes a single POST /classify endpoint that all three frontends
(Vanilla, React, Angular) will call.

Run with: uvicorn main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

app = FastAPI()

# Allow requests from your frontend files (running on Live Server, localhost, etc.)
# during development. This is fine for a dissertation project; you would lock
# this down for a real production system.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading CEFR model... this may take a minute the first time.")

MODEL_NAME = "theluantran/cefr-bert-classifier"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
model.eval()  # inference mode, not training

LABEL_MAP = {0: "A1", 1: "A2", 2: "B1", 3: "B2", 4: "C1/C2"}

print("Model loaded. Server ready.")


class ClassifyRequest(BaseModel):
    text: str


@app.post("/classify")
def classify(request: ClassifyRequest):
    inputs = tokenizer(
        request.text, return_tensors="pt", truncation=True, max_length=512
    )

    with torch.no_grad():
        outputs = model(**inputs)
        predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)

    scores = predictions[0].tolist()

    results = [
        {"label": LABEL_MAP[i], "score": scores[i]} for i in range(len(scores))
    ]
    results.sort(key=lambda r: r["score"], reverse=True)

    return {"predictions": results}


@app.get("/")
def root():
    return {"status": "CEFR classifier backend is running"}
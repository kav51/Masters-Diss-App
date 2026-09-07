# Masters-Diss-App


Code for a dissertation comparing Vanilla JS, React, and Angular performance under simulated classroom hardware/network constraints, using an NLP (CEFR classification) workload.

Structure
- backend/ - FastAPI backend serving the CEFR classifier
- vanilla/, react/, angular/ - the three frontend implementations
- shared/ - shared CSS used by all three frontends
- benchmark/ - Playwright harness + raw result CSVs
- analysis/ - statistical analysis scripts + output CSVs
- figures/ - dissertation figures + generating scripts

Setup
1. Backend (must run first, on port 8000)
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload

2. Frontends

Build for production before benchmarking - dev servers give inaccurate timings, see Chapter 4 for why.

Vanilla - just serve the folder, e.g:

npx serve vanilla -p 5500

React:

cd react
npm install
npm run build
npx serve dist -p 5174

Angular:

cd angular
npm install
ng build
npx serve dist/angular/browser -p 4201

3. Benchmark (all four servers must be running)
cd benchmark
npm install
node benchmark-scenarios.js

Runs all 1,080 combinations (~15-20 min). The dataset used in the dissertation is already included at: benchmark/results/results-MERGED-1788364838373.csv

4. Statistical analysis
cd analysis
python -m venv venv
venv\Scripts\activate
pip install pandas scipy
python analyse.py

5. Figures
pip install matplotlib pandas
python generate_figures.py
python generate_boxplots.py
Notes
node_modules/ and venv/ are excluded from this submission - reinstall using the commands above
The CEFR model (theluantran/cefr-bert-classifier) is used as-is - no training or fine-tuning was performed
# AUSIS — AI Underwriting Intelligence System v2.0

> FastAPI Python Backend + React Frontend  
> OCR: **Gemini 2.5 Flash Lite Preview** (primary) with 5-model fallback chain  
> IRDAI PHI Compliant · Non-STP Document Intelligence

---

## Architecture

```
ausis-v2/
├── backend/              ← Python FastAPI (deploy on Render as Web Service)
│   ├── main.py           ← All API routes + Gemini/OpenRouter callers + risk engine
│   └── requirements.txt
├── frontend/             ← React + Vite (deploy on Render as Static Site)
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── App.jsx           ← Root orchestrator (4 stages)
│       ├── main.jsx
│       ├── components/
│       │   ├── ui.jsx            ← Shared UI components
│       │   ├── setuppage.jsx     ← Stage 1: API key config
│       │   ├── uploadpage.jsx    ← Stage 2: Case info + doc upload
│       │   ├── extractionpage.jsx← Stage 3: Vision extraction
│       │   └── reportpage.jsx    ← Stage 4: AUSIS report + decision + PDF
│       └── utils/
│           ├── api.js            ← All backend API calls
│           └── pdf.js            ← jsPDF report generator
└── render.yaml           ← Render backend config
```

---

## AI Models Used

| Model | Provider | Role |
|-------|----------|------|
| **Gemini 2.5 Flash Lite Preview** | Google | ★ Primary OCR (vision extraction) |
| Gemini 2.0 Flash | Google | Fallback 1 |
| Gemini 1.5 Flash | Google | Fallback 2 |
| Gemini 1.5 Pro | Google | Fallback 3 |
| Llama 3.2 Vision 11B | OpenRouter | Fallback 4 |
| Qwen2-VL 7B | OpenRouter | Fallback 5 |
| Mistral Nemo | OpenRouter | Text: narratives + decision notes |

Get free keys:
- **Gemini**: https://aistudio.google.com/apikey
- **OpenRouter**: https://openrouter.ai/keys

---

## Deploy to Render — Step by Step

### Step 1 — Push to GitHub

```bash
cd ausis-v2
git init
git add .
git commit -m "AUSIS v2.0 — Python + React"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ausis-v2.git
git push -u origin main
```

### Step 2 — Deploy Backend (Python FastAPI)

1. Go to https://render.com → **New** → **Web Service**
2. Connect your GitHub repo `ausis-v2`
3. Settings:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python main.py`
4. Click **Create Web Service**
5. Note your backend URL: `https://ausis-uw-backend.onrender.com`

### Step 3 — Deploy Frontend (React Static Site)

1. Render → **New** → **Static Site**
2. Connect same repo `ausis-v2`
3. Settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. **Environment Variables** → Add:
   - Key: `VITE_API_URL`
   - Value: `https://ausis-uw-backend.onrender.com` (your backend URL from Step 2)
5. Click **Create Static Site**

### Step 4 — Done!

Your app is live. Frontend calls backend via `VITE_API_URL`.

---

## Local Development

```bash
# Terminal 1 — Backend
cd backend
pip install -r requirements.txt
python main.py
# Runs on http://localhost:8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000 (proxies /api → localhost:8000)
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/api/models` | List all available models |
| POST | `/api/validate-key` | Test Gemini/OpenRouter key |
| POST | `/api/extract` | Vision OCR extraction from document image |
| POST | `/api/risk` | Compute composite risk score from structured data |
| POST | `/api/narrative` | Generate AI UW narrative |
| POST | `/api/decision-note` | Generate formal IRDAI decision note |

---

## Integrating with your existing system

The `/api/extract` response returns fully structured JSON ready to POST to your policy admin system:

```json
{
  "decision": "Accept with Loading",
  "risk_score": 68,
  "risk_band": "Accept with Loading",
  "flags": [...],
  "structured_data": { "HbA1c": "7.2 %", "LDL": "118 mg/dL", ... },
  "used_model": "Gemini 2.5 Flash Lite Preview",
  "decision_note": "..."
}
```

Add a webhook in `reportpage.jsx` → `finalize()` function to POST this to your internal API.

---

*IRDAI PHI Compliant · Premium debit authorized strictly post-acceptance*

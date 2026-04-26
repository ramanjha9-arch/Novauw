import os, base64, json, re
import httpx
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AUSIS UW Intelligence API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model registry ─────────────────────────────────────────────────────────────
# Primary OCR model: gemini-2.5-flash-lite-preview (latest, fast, free)
GEMINI_MODELS = [
    {"id": "gemini-2.5-flash-lite-preview-06-17", "label": "Gemini 2.5 Flash Lite Preview", "tier": "Free", "vision": True, "primary": True},
    {"id": "gemini-2.0-flash",                     "label": "Gemini 2.0 Flash",              "tier": "Free", "vision": True, "primary": False},
    {"id": "gemini-1.5-flash",                     "label": "Gemini 1.5 Flash",              "tier": "Free", "vision": True, "primary": False},
    {"id": "gemini-1.5-pro",                       "label": "Gemini 1.5 Pro",                "tier": "Free (limited)", "vision": True, "primary": False},
]

OPENROUTER_MODELS = [
    {"id": "meta-llama/llama-3.2-11b-vision-instruct:free", "label": "Llama 3.2 Vision 11B", "tier": "Free", "vision": True},
    {"id": "qwen/qwen-2-vl-7b-instruct:free",               "label": "Qwen2-VL 7B",           "tier": "Free", "vision": True},
    {"id": "google/gemma-3-12b-it:free",                    "label": "Gemma 3 12B",            "tier": "Free", "vision": True},
    {"id": "mistralai/mistral-nemo:free",                   "label": "Mistral Nemo",           "tier": "Free", "vision": False},
]

DOC_FIELDS = {
    "lab_report":   ["HbA1c","Total Cholesterol","LDL","HDL","Triglycerides","Creatinine","eGFR","Blood Glucose","Hemoglobin","WBC","Platelets","Blood Pressure","BMI"],
    "ecg":          ["Heart Rate","Rhythm","PR Interval","QRS Duration","QTc","Axis","Findings","ST Changes"],
    "itr":          ["PAN","Assessment Year","Gross Total Income","Net Taxable Income","Tax Paid","Employer Name"],
    "bank_stmt":    ["Account Holder","Account Number","Average Balance","Total Credits 12M","Total Debits 12M","Closing Balance","Bank Name"],
    "prescription": ["Patient Name","Doctor Name","Diagnosis","Medications","Duration","Prognosis","Hospital"],
    "kyc":          ["Full Name","Date of Birth","ID Number","Address","Issue Date","Expiry Date","Document Type"],
    "salary_slip":  ["Employee Name","Employer","Month Year","Gross Salary","Net Salary","PF Deduction","Total Deductions"],
    "other":        [],
}

# ── Gemini helpers ─────────────────────────────────────────────────────────────
async def gemini_vision(api_key: str, model_id: str, b64: str, mime: str, prompt: str) -> str:
    safe_mime = "image/jpeg" if mime == "application/pdf" else mime
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"
    body = {
        "contents": [{"parts": [
            {"inline_data": {"mime_type": safe_mime, "data": b64}},
            {"text": prompt}
        ]}],
        "generationConfig": {"temperature": 0.05, "maxOutputTokens": 3000}
    }
    async with httpx.AsyncClient(timeout=90) as c:
        r = await c.post(url, json=body)
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]

async def gemini_text(api_key: str, model_id: str, prompt: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 2000}
    }
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(url, json=body)
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]

# ── OpenRouter helpers ─────────────────────────────────────────────────────────
async def openrouter_vision(api_key: str, model_id: str, b64: str, mime: str, prompt: str) -> str:
    body = {
        "model": model_id, "max_tokens": 2500, "temperature": 0.05,
        "messages": [{"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
            {"type": "text", "text": prompt}
        ]}]
    }
    async with httpx.AsyncClient(timeout=90) as c:
        r = await c.post("https://openrouter.ai/api/v1/chat/completions", json=body,
            headers={"Authorization": f"Bearer {api_key}", "HTTP-Referer": "https://ausis-uw.onrender.com", "X-Title": "AUSIS UW"})
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]

async def openrouter_text(api_key: str, model_id: str, prompt: str) -> str:
    body = {"model": model_id, "max_tokens": 2000, "messages": [{"role": "user", "content": prompt}]}
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post("https://openrouter.ai/api/v1/chat/completions", json=body,
            headers={"Authorization": f"Bearer {api_key}", "HTTP-Referer": "https://ausis-uw.onrender.com", "X-Title": "AUSIS UW"})
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]

# ── Utils ──────────────────────────────────────────────────────────────────────
def parse_json(text: str) -> dict:
    text = re.sub(r"```json|```", "", text).strip()
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise ValueError("No JSON found in response")
    return json.loads(m.group(0))

def extraction_prompt(doc_type: str) -> str:
    fields = DOC_FIELDS.get(doc_type, [])
    field_str = f"Extract these specific fields if present: {', '.join(fields)}." if fields else "Extract all key fields."
    return f"""You are a precision OCR and data extraction AI for Indian insurance underwriting.
Analyse this document image very carefully. {field_str}

Return ONLY a valid JSON object (null for missing fields):
{{
  "document_type": "detected type",
  "holder_name": "name on document",
  "document_date": "date as string",
  "extracted_fields": {{ "field_name": "value with units" }},
  "abnormal_flags": ["values outside normal range"],
  "summary": "2-3 sentence plain English summary for underwriter",
  "completeness": "complete|partial|illegible",
  "confidence": 0-100
}}
Rules: Include units (e.g. "7.2 %", "198 mg/dL"). Flag: HbA1c>6.5, LDL>160, eGFR<60, BP>140/90, BMI>30.
Return ONLY the JSON. No markdown. No explanation."""

def compute_risk(structured: dict) -> dict:
    score = 100
    flags = []

    def num(key):
        v = structured.get(key, "")
        try:
            return float(re.sub(r"[^\d.]", "", str(v))) if v else None
        except:
            return None

    rules = [
        ("HbA1c",             [(9,   None, 28, "critical", "Uncontrolled diabetes — severe mortality risk"),
                                (7.5, 9,   16, "high",     "Poorly controlled diabetes"),
                                (6.5, 7.5,  8, "medium",   "Diabetic range — monitor")]),
        ("LDL",               [(190, None, 15, "high",   "Severely elevated LDL"),
                                (160, 190,  8, "medium", "High LDL cholesterol")]),
        ("eGFR",              [(None, 30,  32, "critical", "Severe CKD — major mortality risk"),
                                (30,   60,  18, "high",    "Moderate CKD"),
                                (60,   90,   5, "low",     "Mild renal impairment")]),
        ("BMI",               [(40,  None, 15, "high",   "Severe obesity"),
                                (35,  40,   10, "high",   "Obesity Class II"),
                                (30,  35,    6, "medium", "Obesity Class I")]),
        ("Blood Glucose",     [(200, None, 10, "high",   "Elevated blood glucose")]),
        ("Triglycerides",     [(500, None, 10, "high",   "Severely elevated triglycerides"),
                                (200, 500,   5, "medium", "Elevated triglycerides")]),
        ("Total Cholesterol", [(240, None,  8, "medium", "High total cholesterol")]),
    ]

    for key, thresholds in rules:
        v = num(key)
        if v is None:
            continue
        for lo, hi, delta, sev, msg in thresholds:
            lo_ok = (lo is None or v > lo)
            hi_ok = (hi is None or v <= hi)
            if key == "eGFR":
                lo_ok = (lo is None or v >= lo)
                hi_ok = (hi is None or v < hi)
                if hi is None:
                    lo_ok = (lo is None or v < lo)
                    hi_ok = True
            if lo_ok and hi_ok:
                score -= delta
                flags.append({"key": key, "val": str(v), "sev": sev, "msg": msg, "delta": -delta})
                break

    # Income variance
    gross = num("Gross Total Income") or ((num("Gross Salary") or 0) * 12)
    itr   = num("Net Taxable Income")
    if gross and itr and itr > 0:
        var = abs(gross - itr) / itr
        if var > 0.3:
            score -= 12
            flags.append({"key": "Income Variance", "val": f"{var*100:.1f}%", "sev": "high",   "msg": "Large declared vs ITR discrepancy", "delta": -12})
        elif var > 0.15:
            score -= 6
            flags.append({"key": "Income Variance", "val": f"{var*100:.1f}%", "sev": "medium", "msg": "Moderate income variance", "delta": -6})

    score = max(0, min(100, round(score)))
    if   score >= 85: band, action, color = "Auto-Accept",           "ACCEPT", "#16a34a"
    elif score >= 65: band, action, color = "Accept with Review",    "REVIEW", "#0d9488"
    elif score >= 45: band, action, color = "Accept with Loading",   "LOAD",   "#d97706"
    else:             band, action, color = "CMO / Decline Referral","CMO",    "#e11d48"

    return {"score": score, "flags": flags, "band": band, "action": action, "color": color}

# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "service": "AUSIS UW Intelligence API v2.0", "primary_ocr": "gemini-2.5-flash-lite-preview-06-17"}

@app.get("/api/models")
def get_models():
    return {"gemini": GEMINI_MODELS, "openrouter": OPENROUTER_MODELS}

@app.post("/api/validate-key")
async def validate_key(provider: str = Form(...), api_key: str = Form(...)):
    try:
        if provider == "gemini":
            await gemini_text(api_key, "gemini-2.5-flash-lite-preview-06-17", "Reply: OK")
        else:
            await openrouter_text(api_key, "mistralai/mistral-nemo:free", "Reply: OK")
        return {"valid": True}
    except Exception as e:
        return {"valid": False, "error": str(e)}

@app.post("/api/extract")
async def extract_document(
    file:           UploadFile = File(...),
    doc_type:       str = Form("other"),
    gemini_key:     str = Form(""),
    openrouter_key: str = Form(""),
    primary_model:  str = Form("gemini-2.5-flash-lite-preview-06-17"),
):
    content = await file.read()
    b64     = base64.b64encode(content).decode()
    mime    = file.content_type or "image/jpeg"
    prompt  = extraction_prompt(doc_type)
    logs    = []

    # Build ordered fallback chain — primary model first
    chain = []
    if gemini_key:
        # Always put primary model first
        primary = next((m for m in GEMINI_MODELS if m["id"] == primary_model), GEMINI_MODELS[0])
        others  = [m for m in GEMINI_MODELS if m["id"] != primary_model]
        for m in [primary] + others:
            chain.append(("gemini", m["id"], m["label"]))
    if openrouter_key:
        for m in OPENROUTER_MODELS:
            if m["vision"]:
                chain.append(("openrouter", m["id"], m["label"]))

    if not chain:
        raise HTTPException(status_code=400, detail="No API key provided")

    parsed     = None
    used_model = None

    for provider, model_id, label in chain:
        try:
            logs.append(f"  Trying {label}…")
            if provider == "gemini":
                raw = await gemini_vision(gemini_key, model_id, b64, mime, prompt)
            else:
                raw = await openrouter_vision(openrouter_key, model_id, b64, mime, prompt)
            parsed = parse_json(raw)
            used_model = label
            logs.append(f"  ✓ Extracted via {label} (confidence: {parsed.get('confidence','?')}%)")
            break
        except Exception as e:
            logs.append(f"  ✗ {label}: {str(e)[:100]}")

    if not parsed:
        raise HTTPException(status_code=422, detail={"logs": logs, "error": "All models failed"})

    fields = parsed.get("extracted_fields") or {}
    structured = {
        **fields,
        "Holder Name":   parsed.get("holder_name"),
        "Document Date": parsed.get("document_date"),
        "Document Type": parsed.get("document_type"),
    }
    structured = {k: v for k, v in structured.items() if v}

    return {
        "success":    True,
        "filename":   file.filename,
        "doc_type":   doc_type,
        "used_model": used_model,
        "extracted":  parsed,
        "structured": structured,
        "logs":       logs,
    }

@app.post("/api/risk")
async def score_risk(structured: dict):
    return compute_risk(structured)

class NarrativeReq(BaseModel):
    structured:     dict
    case_info:      dict
    risk:           dict
    gemini_key:     str = ""
    openrouter_key: str = ""
    primary_model:  str = "gemini-2.5-flash-lite-preview-06-17"

@app.post("/api/narrative")
async def generate_narrative(req: NarrativeReq):
    flags_str = "; ".join(f"{f['key']}={f['val']} ({f['sev']}): {f['msg']}" for f in req.risk.get("flags", []))
    prompt = f"""You are a senior Indian insurance underwriter (IRDAI licensed).
Write a formal UW narrative (5-6 sentences) based on extracted document data.

Applicant: {req.case_info.get('name','?')}, Age {req.case_info.get('age','?')}, {req.case_info.get('gender','?')}
Smoker: {req.case_info.get('smoker',False)}, Alcohol: {req.case_info.get('alcohol',False)}, Diabetic: {req.case_info.get('diabetic',False)}
Product: {req.case_info.get('product','?')}, SA: {req.case_info.get('sa','?')}
Extracted Data: {json.dumps(req.structured, indent=2)}
Risk Score: {req.risk.get('score')}/100 | Band: {req.risk.get('band')}
Risk Flags: {flags_str or 'None'}

Cover: profile summary, medical risk with specific values, financial risk, lifestyle/environmental factors, final recommendation with any loadings or exclusions.
Professional IRDAI tone. Plain text only. No markdown."""
    try:
        model = req.primary_model if "gemini" in req.primary_model else "gemini-2.5-flash-lite-preview-06-17"
        if req.gemini_key:
            text = await gemini_text(req.gemini_key, model, prompt)
        elif req.openrouter_key:
            text = await openrouter_text(req.openrouter_key, "mistralai/mistral-nemo:free", prompt)
        else:
            raise HTTPException(status_code=400, detail="No API key")
        return {"narrative": text}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DecisionReq(BaseModel):
    case_info:      dict
    risk:           dict
    decision:       str
    override_reason: str = ""
    gemini_key:     str = ""
    openrouter_key: str = ""
    primary_model:  str = "gemini-2.5-flash-lite-preview-06-17"

@app.post("/api/decision-note")
async def decision_note(req: DecisionReq):
    flags_str  = ", ".join(f"{f['key']} ({f['sev']})" for f in req.risk.get("flags", []))
    loading    = "3-5‰ extra mortality loading" if req.risk.get("score", 100) < 65 else "None"
    exclusions = [f"{f['key']} related claims" for f in req.risk.get("flags", []) if f["sev"] == "critical"]
    prompt = f"""Generate a formal IRDAI-compliant underwriting decision note.

Case: {req.case_info.get('name')}, Age {req.case_info.get('age')}, {req.case_info.get('gender')}
Decision: {req.decision}
Risk Score: {req.risk.get('score')}/100 | Band: {req.risk.get('band')}
Override Reason: {req.override_reason or 'None — following AI recommendation'}
Key Flags: {flags_str or 'None'}
Loading: {loading}
Exclusions: {', '.join(exclusions) or 'None'}

Write a 4-6 line formal decision note covering: decision with rationale, loadings in per-mille if any, exclusions applied, next steps (acceptance communication trigger, mandate debit authorization).
Professional IRDAI-compliant language. Plain text only."""
    try:
        model = req.primary_model if "gemini" in req.primary_model else "gemini-2.5-flash-lite-preview-06-17"
        if req.gemini_key:
            text = await gemini_text(req.gemini_key, model, prompt)
        elif req.openrouter_key:
            text = await openrouter_text(req.openrouter_key, "mistralai/mistral-nemo:free", prompt)
        else:
            raise HTTPException(status_code=400, detail="No API key")
        return {"note": text, "loading": loading, "exclusions": exclusions}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

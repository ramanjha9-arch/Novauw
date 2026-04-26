// All API calls go to the Python FastAPI backend
// In dev: Vite proxy forwards /api → http://localhost:8000
// In prod: set VITE_API_URL env var on Render static site to point to backend URL

const BASE = import.meta.env.VITE_API_URL || ''

async function postForm(path, formData) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const msg = typeof err.detail === 'object' ? err.detail.error : err.detail
    throw new Error(msg || res.statusText)
  }
  return res.json()
}

async function postJSON(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const msg = typeof err.detail === 'object' ? err.detail.error : err.detail
    throw new Error(msg || res.statusText)
  }
  return res.json()
}

export async function getModels() {
  const res = await fetch(`${BASE}/api/models`)
  if (!res.ok) throw new Error('Failed to fetch models')
  return res.json()
}

export async function validateKey(provider, api_key) {
  const fd = new FormData()
  fd.append('provider', provider)
  fd.append('api_key', api_key)
  return postForm('/api/validate-key', fd)
}

export async function extractDocument({ file, docType, geminiKey, openrouterKey, primaryModel }) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('doc_type', docType || 'other')
  fd.append('gemini_key', geminiKey || '')
  fd.append('openrouter_key', openrouterKey || '')
  fd.append('primary_model', primaryModel || 'gemini-2.5-flash-lite-preview-06-17')
  return postForm('/api/extract', fd)
}

export async function scoreRisk(structured) {
  return postJSON('/api/risk', structured)
}

export async function generateNarrative({ structured, caseInfo, risk, geminiKey, openrouterKey, primaryModel }) {
  return postJSON('/api/narrative', {
    structured,
    case_info: caseInfo,
    risk,
    gemini_key: geminiKey || '',
    openrouter_key: openrouterKey || '',
    primary_model: primaryModel || 'gemini-2.5-flash-lite-preview-06-17',
  })
}

export async function generateDecisionNote({ caseInfo, risk, decision, overrideReason, geminiKey, openrouterKey, primaryModel }) {
  return postJSON('/api/decision-note', {
    case_info: caseInfo,
    risk,
    decision,
    override_reason: overrideReason || '',
    gemini_key: geminiKey || '',
    openrouter_key: openrouterKey || '',
    primary_model: primaryModel || 'gemini-2.5-flash-lite-preview-06-17',
  })
}

export const DOC_TYPES = [
  { id: 'lab_report',   label: 'Lab Report',          icon: '🧪' },
  { id: 'ecg',          label: 'ECG / Tele-Medical',  icon: '❤️' },
  { id: 'itr',          label: 'ITR / Form 16',       icon: '📊' },
  { id: 'bank_stmt',    label: 'Bank Statement',      icon: '🏦' },
  { id: 'prescription', label: 'Medical Certificate', icon: '📋' },
  { id: 'kyc',          label: 'KYC Document',        icon: '🪪' },
  { id: 'salary_slip',  label: 'Salary Slip',         icon: '💼' },
  { id: 'other',        label: 'Other Document',      icon: '📄' },
]

export const PRIMARY_MODEL = 'gemini-2.5-flash-lite-preview-06-17'

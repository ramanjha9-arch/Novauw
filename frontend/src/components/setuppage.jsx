import { useState, useEffect } from 'react'
import { Card, SectionHead, Spinner, C } from './ui.jsx'
import { validateKey, getModels, PRIMARY_MODEL } from '../utils/api.js'

export default function SetupPage({ config, setConfig, onNext }) {
  const [local, setLocal]   = useState(config)
  const [testing, setTesting] = useState({})
  const [tested, setTested]   = useState({})
  const [models, setModels]   = useState({ gemini: [], openrouter: [] })

  useEffect(() => { getModels().then(setModels).catch(() => {}) }, [])

  const set = (k, v) => setLocal(p => ({ ...p, [k]: v }))

  const testKey = async (provider) => {
    setTesting(p => ({ ...p, [provider]: true }))
    const key = provider === 'gemini' ? local.geminiKey : local.openrouterKey
    const res  = await validateKey(provider, key).catch(() => ({ valid: false }))
    setTested(p => ({ ...p, [provider]: res.valid ? 'ok' : 'fail' }))
    setTesting(p => ({ ...p, [provider]: false }))
  }

  const canProceed = !!(local.geminiKey || local.openrouterKey)
  const allModels  = [...(models.gemini || []), ...(models.openrouter || [])]

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.slate, fontFamily: "'Oswald',sans-serif", letterSpacing: 1 }}>
          Configure AI Models
        </div>
        <div style={{ color: C.muted, fontSize: 14, marginTop: 6 }}>
          Keys are sent to the Python backend which calls Gemini / OpenRouter securely
        </div>
      </div>

      {[
        { provider: 'gemini',     label: 'Google Gemini API Key', field: 'geminiKey',     link: 'https://aistudio.google.com/apikey', note: 'Free · 15 RPM · Primary OCR model', ph: 'AIzaSy...' },
        { provider: 'openrouter', label: 'OpenRouter API Key',    field: 'openrouterKey', link: 'https://openrouter.ai/keys',         note: 'Free models · Fallback provider',   ph: 'sk-or-v1-...' },
      ].map(({ provider, label, field, link, note, ph }) => (
        <Card key={provider} style={{ marginBottom: 16 }}
          accent={tested[provider] === 'ok' ? C.green : tested[provider] === 'fail' ? C.coral : C.teal}>
          <SectionHead title={label} badge={tested[provider] === 'ok' ? '✓ Valid' : tested[provider] === 'fail' ? '✗ Invalid' : ''} />
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
            {note} · <a href={link} target="_blank" rel="noreferrer" style={{ color: C.teal, fontWeight: 600 }}>Get free key →</a>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="password" value={local[field] || ''} onChange={e => set(field, e.target.value)}
              placeholder={ph}
              style={{ flex: 1, padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: "'Fira Code',monospace" }} />
            <button onClick={() => testKey(provider)} disabled={!local[field] || testing[provider]}
              style={{ padding: '10px 18px', background: C.teal, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: !local[field] || testing[provider] ? 0.5 : 1 }}>
              {testing[provider] ? <Spinner size={13} color="#fff" /> : null} Test
            </button>
          </div>
        </Card>
      ))}

      <Card style={{ marginBottom: 20 }} accent={C.amber}>
        <SectionHead title="Primary Vision Model" icon="🤖" />
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
          Default: <strong style={{ color: C.teal }}>Gemini 2.5 Flash Lite Preview</strong> — latest free OCR model. System auto-falls back if rate-limited.
        </div>
        <select value={local.primaryModel || PRIMARY_MODEL} onChange={e => set('primaryModel', e.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none' }}>
          {allModels.length === 0
            ? <option value={PRIMARY_MODEL}>Gemini 2.5 Flash Lite Preview [Free] ★ Primary OCR</option>
            : allModels.map(m => (
                <option key={m.id} value={m.id}>
                  {m.primary ? '★ ' : ''}{m.label} [{m.tier}]{m.primary ? ' — Primary OCR' : ''}
                </option>
              ))
          }
        </select>
      </Card>

      <Card style={{ marginBottom: 24, background: '#f0fdf9', border: `1px solid ${C.teal}30` }}>
        <div style={{ fontSize: 13, color: C.slate, lineHeight: 1.7 }}>
          <strong>🔒 Security:</strong> API keys are forwarded by the Python backend directly to Google/OpenRouter. They are never logged or stored.
          <br />
          <strong>📋 IRDAI PHI:</strong> All extracted data stays in your browser session. Premium collection unlocked only after UW acceptance decision.
        </div>
      </Card>

      <button onClick={() => { setConfig(local); onNext() }} disabled={!canProceed}
        className="btn-p" style={{ width: '100%', padding: 14, borderRadius: 10, fontSize: 15 }}>
        Save & Continue →
      </button>
      {!canProceed && <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: C.muted }}>Enter at least one API key to proceed</div>}
    </div>
  )
}

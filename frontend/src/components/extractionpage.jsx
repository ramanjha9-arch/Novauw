import { useState, useRef, useEffect } from 'react'
import { Card, SectionHead, Spinner, Badge, C } from './ui.jsx'
import { extractDocument, DOC_TYPES, PRIMARY_MODEL } from '../utils/api.js'

export default function ExtractionPage({ docs, setDocs, config, onNext }) {
  const [logs, setLogs]       = useState([])
  const [running, setRunning] = useState(false)
  const [done, setDone]       = useState(false)
  const logRef = useRef()

  const addLog = (msg, type = 'info') =>
    setLogs(p => [...p, { msg, type, ts: new Date().toLocaleTimeString('en-IN', { hour12: false }) }])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const run = async () => {
    setRunning(true); setLogs([])
    addLog('🚀 AUSIS Vision Extraction Pipeline started', 'header')
    addLog(`Primary OCR model: Gemini 2.5 Flash Lite Preview`, 'info')

    for (const doc of docs) {
      const dtype = DOC_TYPES.find(t => t.id === doc.docType)
      addLog(`\n📄 Processing: ${doc.name} [${dtype?.label || doc.docType}]`, 'header')
      setDocs(p => p.map(d => d.id === doc.id ? { ...d, status: 'extracting' } : d))
      try {
        const result = await extractDocument({
          file:          doc.file,
          docType:       doc.docType,
          geminiKey:     config.geminiKey,
          openrouterKey: config.openrouterKey,
          primaryModel:  config.primaryModel || PRIMARY_MODEL,
        })
        ;(result.logs || []).forEach(l =>
          addLog(l, l.includes('✓') ? 'success' : l.includes('✗') ? 'error' : 'attempt')
        )
        setDocs(p => p.map(d => d.id === doc.id ? {
          ...d,
          status:       'done',
          extracted:    result.extracted,
          structured:   result.structured,
          usedModel:    result.used_model,
          docTypeLabel: dtype?.label,
        } : d))
      } catch (e) {
        addLog(`  ✗ FAILED: ${e.message}`, 'error')
        setDocs(p => p.map(d => d.id === doc.id ? { ...d, status: 'failed' } : d))
      }
    }

    addLog('\n✅ Extraction complete. Proceeding to risk analysis…', 'success')
    setRunning(false)
    setDone(true)
  }

  const lc = t => ({ header: C.slate, success: C.green, error: C.coral, attempt: C.teal, info: C.muted }[t] || C.muted)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.slate, fontFamily: "'Oswald',sans-serif" }}>
          Vision Extraction Engine
        </div>
        <div style={{ color: C.muted, fontSize: 14, marginTop: 6 }}>
          Python backend calls Gemini 2.5 Flash Lite Preview with automatic model fallback
        </div>
      </div>

      <Card accent={C.teal} style={{ marginBottom: 20 }}>
        <SectionHead icon="🔗" title="Model Fallback Chain" />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 11 }}>
          {[
            ['Gemini 2.5 Flash Lite Preview', true],
            ['Gemini 2.0 Flash', false],
            ['Gemini 1.5 Flash', false],
            ['Llama 3.2 Vision', false],
            ['Qwen2-VL 7B', false],
          ].map(([label, primary], i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: C.muted }}>→</span>}
              <span style={{ padding: '4px 10px', background: primary ? C.teal : '#f1f5f9', borderRadius: 6, color: primary ? '#fff' : C.muted, fontWeight: 600 }}>
                {primary ? '★ ' : ''}{label}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ marginBottom: 20 }}>
        {docs.map(doc => {
          const dtype = DOC_TYPES.find(t => t.id === doc.docType)
          const sc = doc.status === 'done' ? C.green : doc.status === 'failed' ? C.coral : doc.status === 'extracting' ? C.teal : C.muted
          return (
            <Card key={doc.id} style={{ marginBottom: 10, border: `1px solid ${sc}30`, display: 'flex', alignItems: 'center', gap: 14, padding: 14 }}>
              <div style={{ fontSize: 26 }}>{dtype?.icon || '📄'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: C.slate }}>{doc.name}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{dtype?.label}</div>
                {doc.usedModel && <div style={{ fontSize: 11, color: C.teal, marginTop: 3, fontFamily: "'Fira Code',monospace" }}>via {doc.usedModel}</div>}
                {doc.extracted?.confidence && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Confidence: {doc.extracted.confidence}% · {doc.extracted.completeness}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {doc.status === 'extracting' && <Spinner size={14} />}
                <Badge color={sc} bg={sc + '15'}>
                  {doc.status === 'uploaded' ? '⏳ Queued' : doc.status === 'extracting' ? 'Extracting…' : doc.status === 'done' ? '✓ Done' : '✗ Failed'}
                </Badge>
              </div>
            </Card>
          )
        })}
      </div>

      <Card style={{ marginBottom: 20, background: '#0f172a' }}>
        <div style={{ fontSize: 10, color: C.muted, fontFamily: "'Fira Code',monospace", marginBottom: 8, letterSpacing: 1 }}>EXTRACTION LOG</div>
        <div ref={logRef} style={{ maxHeight: 200, overflowY: 'auto', fontFamily: "'Fira Code',monospace", fontSize: 12 }}>
          {logs.length === 0 && <div style={{ color: '#475569' }}>Awaiting extraction start…</div>}
          {logs.map((l, i) => (
            <div key={i} style={{ color: lc(l.type), lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
              <span style={{ color: '#334155' }}>{l.ts} </span>{l.msg}
            </div>
          ))}
        </div>
      </Card>

      {!running && !done && (
        <button onClick={run} className="btn-p" style={{ width: '100%', padding: 14, borderRadius: 10, fontSize: 15 }}>
          🔍 Start AI Vision Extraction
        </button>
      )}
      {running && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 14, background: '#f0fdf9', borderRadius: 10, border: `1px solid ${C.teal}30` }}>
          <Spinner /><span style={{ color: C.teal, fontWeight: 600 }}>Extraction in progress — please wait</span>
        </div>
      )}
      {done && (
        <button onClick={onNext} className="btn-p" style={{ width: '100%', padding: 14, borderRadius: 10, fontSize: 15 }}>
          View Risk Report & Decision →
        </button>
      )}
    </div>
  )
}

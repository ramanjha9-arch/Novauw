import { useState, useRef, useCallback } from 'react'
import { Card, SectionHead, Badge, C } from './ui.jsx'
import { DOC_TYPES } from '../utils/api.js'

export default function UploadPage({ docs, setDocs, caseInfo, setCaseInfo, onNext }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef()

  const addFiles = useCallback((files) => {
    ;[...files]
      .filter(f => f.type.startsWith('image/') || f.type === 'application/pdf')
      .forEach(file => {
        const reader = new FileReader()
        reader.onload = e => setDocs(prev => [...prev, {
          id: Date.now() + Math.random(),
          file, name: file.name, size: file.size,
          mimeType: file.type, preview: e.target.result,
          docType: 'other', status: 'uploaded',
          extracted: null, structured: null, usedModel: null,
        }])
        reader.readAsDataURL(file)
      })
  }, [setDocs])

  const set = (k, v) => setCaseInfo(p => ({ ...p, [k]: v }))

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.slate, fontFamily: "'Oswald',sans-serif" }}>
          Case Details & Documents
        </div>
        <div style={{ color: C.muted, fontSize: 14, marginTop: 6 }}>
          Enter applicant info then upload all supporting documents
        </div>
      </div>

      <Card accent={C.teal} style={{ marginBottom: 20 }}>
        <SectionHead icon="👤" title="Applicant Information" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 12 }}>
          {[
            ['Full Name',      'name',    'text',   'Sanjay Raj'],
            ['Age',            'age',     'number', '42'],
            ['Sum Assured (₹)','sa',      'text',   '2,00,00,000'],
            ['Product',        'product', 'text',   'Term Life Plus'],
            ['Tenure (yrs)',   'tenure',  'number', '30'],
          ].map(([label, key, type, ph]) => (
            <div key={key}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
              <input type={type} value={caseInfo[key] || ''} onChange={e => set(key, e.target.value)} placeholder={ph}
                style={{ width: '100%', padding: '9px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, outline: 'none' }} />
            </div>
          ))}
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>Gender</div>
            <select value={caseInfo.gender || ''} onChange={e => set('gender', e.target.value)}
              style={{ width: '100%', padding: '9px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none' }}>
              <option value="">Select…</option>
              {['Male', 'Female', 'Other'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
          {[['smoker', '🚬 Smoker'], ['alcohol', '🍷 Alcohol'], ['diabetic', '🩸 Diabetic']].map(([k, l]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.slate }}>
              <input type="checkbox" checked={!!caseInfo[k]} onChange={e => set(k, e.target.checked)}
                style={{ width: 16, height: 16, accentColor: C.teal }} />
              {l}
            </label>
          ))}
        </div>
      </Card>

      <div className={`drop ${drag ? 'drag' : ''}`}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        style={{ border: `2px dashed ${C.border}`, borderRadius: 14, padding: '40px 32px', textAlign: 'center', cursor: 'pointer', background: '#fafffe', transition: 'all .2s', marginBottom: 20 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.slate, marginBottom: 6 }}>Drop documents here or click to browse</div>
        <div style={{ fontSize: 13, color: C.muted }}>Lab reports · ITR · Bank statements · ECG · KYC · Prescriptions · Salary slips</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Supports: JPG, PNG, PDF</div>
        <input ref={inputRef} type="file" multiple accept="image/*,.pdf" style={{ display: 'none' }}
          onChange={e => addFiles(e.target.files)} />
      </div>

      {docs.map(doc => {
        const dtype = DOC_TYPES.find(t => t.id === doc.docType)
        return (
          <Card key={doc.id} style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, padding: 12 }}>
            {doc.mimeType.startsWith('image/')
              ? <img src={doc.preview} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}` }} />
              : <div style={{ width: 52, height: 52, background: '#f0fdf9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: `1px solid ${C.border}` }}>📄</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: C.slate, marginBottom: 7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={doc.docType}
                  onChange={e => setDocs(p => p.map(d => d.id === doc.id ? { ...d, docType: e.target.value } : d))}
                  style={{ padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, background: '#fff', outline: 'none' }}>
                  {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                </select>
                <span style={{ fontSize: 11, color: C.muted }}>{(doc.size / 1024).toFixed(1)} KB</span>
                <Badge color={C.teal}>{dtype?.icon} {dtype?.label}</Badge>
              </div>
            </div>
            <button onClick={() => setDocs(p => p.filter(d => d.id !== doc.id))}
              style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 20 }}>×</button>
          </Card>
        )
      })}

      <button onClick={onNext} disabled={docs.length === 0} className="btn-p"
        style={{ width: '100%', padding: 14, borderRadius: 10, fontSize: 15, marginTop: 8 }}>
        {docs.length > 0
          ? `Run AI Extraction on ${docs.length} Document${docs.length > 1 ? 's' : ''} →`
          : 'Upload at least one document'}
      </button>
    </div>
  )
}

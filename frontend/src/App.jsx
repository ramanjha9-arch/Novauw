import { useState } from 'react'
import { GlobalCSS, ProgressStep, C } from './components/ui.jsx'
import SetupPage     from './components/setuppage.jsx'
import UploadPage    from './components/uploadpage.jsx'
import ExtractionPage from './components/extractionpage.jsx'
import ReportPage    from './components/reportpage.jsx'
import { PRIMARY_MODEL } from './utils/api.js'

const STEPS = ['Model Setup', 'Case & Docs', 'AI Extraction', 'AUSIS Report']

export default function App() {
  const [stage, setStage] = useState(0)
  const [config, setConfig] = useState({
    geminiKey: '',
    openrouterKey: '',
    primaryModel: PRIMARY_MODEL,
  })
  const [docs, setDocs] = useState([])
  const [caseInfo, setCaseInfo] = useState({
    name: '', age: '', gender: '', sa: '',
    product: 'Term Life Plus', tenure: '30',
    smoker: false, alcohol: false, diabetic: false,
  })

  return (
    <>
      <GlobalCSS />
      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Nunito', system-ui, sans-serif" }}>

        {/* Top nav */}
        <div style={{ background: '#fff', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 8px #0000000a' }}>
          <div style={{ maxWidth: 1140, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14 }}>
            <div style={{ width: 34, height: 34, background: `linear-gradient(135deg,${C.tealDk},${C.teal})`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Oswald',sans-serif", fontSize: 16, fontWeight: 700 }}>
              A
            </div>
            <div>
              <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 18, color: C.slate, letterSpacing: 1, lineHeight: 1 }}>AUSIS</div>
              <div style={{ fontSize: 10, color: C.muted }}>AI Underwriting Intelligence · Python + React</div>
            </div>
            <div style={{ width: 1, height: 28, background: C.border, margin: '0 6px' }} />
            <div style={{ fontSize: 11, color: C.muted }}>Non-STP Document Intelligence · IRDAI PHI Compliant</div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, animation: 'aPulse 2s infinite' }} />
              <span style={{ fontSize: 11, color: C.muted, fontFamily: "'Fira Code',monospace" }}>
                OCR: Gemini 2.5 Flash Lite Preview
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '32px 24px 64px' }}>
          {stage < 3 && <ProgressStep steps={STEPS} current={stage} />}

          <div key={stage} className="fade-up">
            {stage === 0 && (
              <SetupPage
                config={config}
                setConfig={setConfig}
                onNext={() => setStage(1)}
              />
            )}
            {stage === 1 && (
              <UploadPage
                docs={docs}
                setDocs={setDocs}
                caseInfo={caseInfo}
                setCaseInfo={setCaseInfo}
                onNext={() => setStage(2)}
              />
            )}
            {stage === 2 && (
              <ExtractionPage
                docs={docs}
                setDocs={setDocs}
                config={config}
                onNext={() => setStage(3)}
              />
            )}
            {stage === 3 && (
              <ReportPage
                docs={docs}
                caseInfo={caseInfo}
                config={config}
              />
            )}
          </div>

          {stage > 0 && stage < 3 && (
            <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => setStage(s => s - 1)}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, padding: '8px 22px', fontSize: 13, cursor: 'pointer', fontFamily: "'Nunito',sans-serif" }}>
                ← Back
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${C.border}`, background: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 11, color: C.muted }}>
          <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 13, color: C.teal, letterSpacing: 1 }}>
            AUSIS · AI Underwriting Intelligence System v2.0
          </span>
          <span>FastAPI Backend · React Frontend · Gemini 2.5 Flash Lite Preview OCR</span>
          <span style={{ color: C.teal, fontWeight: 600 }}>IRDAI PHI Compliant · Premium debit post-acceptance only</span>
        </div>
      </div>
    </>
  )
}

import { useState, useEffect, useRef } from 'react'
import {
  Card, SectionHead, ScoreRing, Gauge, Donut,
  Badge, SevBadge, RiskPill, MetricCard,
  Spinner, AnimNum, bandInfo, C,
} from './ui.jsx'
import { scoreRisk, generateNarrative, generateDecisionNote, DOC_TYPES, PRIMARY_MODEL } from '../utils/api.js'
import { generatePDF } from '../utils/pdf.js'

function SentBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "'Oswald',sans-serif" }}>{value.toFixed(4)}</span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value * 100}%`, background: color, borderRadius: 4, transition: 'width 1.2s ease' }} />
      </div>
    </div>
  )
}

function RiskBarRow({ label, score, color, note }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.slate }}>{label}</div>
          {note && <div style={{ fontSize: 11, color: C.muted }}>{note}</div>}
        </div>
        <span style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'Oswald',sans-serif" }}>{score}</span>
      </div>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 3, transition: 'width 1.2s ease' }} />
      </div>
    </div>
  )
}

function deriveSentiment(ci) {
  let neg = 0.3, pos = 0.1, neu = 0.6
  if (ci.smoker)  { neg += 0.25; pos -= 0.05 }
  if (ci.alcohol) { neg += 0.15; pos -= 0.03 }
  if (ci.diabetic){ neg += 0.10 }
  const tot = neg + pos + neu
  return {
    positive: +(pos / tot).toFixed(4),
    neutral:  +(neu / tot).toFixed(4),
    negative: +(neg / tot).toFixed(4),
  }
}

export default function ReportPage({ docs, caseInfo, config }) {
  const [tab, setTab]             = useState('summary')
  const [risk, setRisk]           = useState(null)
  const [merged, setMerged]       = useState({})
  const [narrative, setNarrative] = useState('')
  const [narLoading, setNarLoading] = useState(false)
  const [decision, setDecision]   = useState(null)
  const [decNote, setDecNote]     = useState('')
  const [decLoading, setDecLoading] = useState(false)
  const [override, setOverride]   = useState('')
  const [finalized, setFinalized] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [edited, setEdited]       = useState({})
  const [selDoc, setSelDoc]       = useState(null)
  const caseId = useRef(`AUSIS-${Date.now().toString().slice(-8)}`).current

  const okDocs = docs.filter(d => d.status === 'done')

  // Merge all structured data
  useEffect(() => {
    const m = {}
    okDocs.forEach(d => Object.assign(m, d.structured || {}, edited[d.id] || {}))
    setMerged(m)
    if (Object.keys(m).length > 0) {
      scoreRisk(m).then(setRisk).catch(() => {})
    }
  }, [docs, edited])

  useEffect(() => {
    if (okDocs.length > 0) {
      setSelDoc(okDocs[0])
      genNarrative()
    }
  }, [])

  const genNarrative = async () => {
    if (!okDocs.length) return
    setNarLoading(true)
    const m = {}
    okDocs.forEach(d => Object.assign(m, d.structured || {}))
    const r = await scoreRisk(m).catch(() => ({ score: 50, flags: [], band: 'Unknown' }))
    try {
      const res = await generateNarrative({
        structured: m, caseInfo, risk: r,
        geminiKey: config.geminiKey, openrouterKey: config.openrouterKey,
        primaryModel: config.primaryModel || PRIMARY_MODEL,
      })
      setNarrative(res.narrative || '')
    } catch (e) {
      setNarrative('Narrative unavailable: ' + e.message)
    }
    setNarLoading(false)
  }

  const finalize = async (action) => {
    setDecision(action); setFinalized(true); setDecLoading(true)
    try {
      const res = await generateDecisionNote({
        caseInfo: { ...caseInfo, decision: action }, risk, decision: action,
        overrideReason: override,
        geminiKey: config.geminiKey, openrouterKey: config.openrouterKey,
        primaryModel: config.primaryModel || PRIMARY_MODEL,
      })
      setDecNote(res.note || '')
    } catch (e) {
      setDecNote('Error: ' + e.message)
    }
    setDecLoading(false)
  }

  const dlPDF = async () => {
    setPdfLoading(true)
    await generatePDF({
      caseInfo: { ...caseInfo, decision, overrideReason: override },
      risk, structured: merged, docs: okDocs,
      narrative, decisionNote: decNote, caseId,
    }).catch(e => alert('PDF error: ' + e.message))
    setPdfLoading(false)
  }

  const band        = risk ? bandInfo(risk.score) : bandInfo(50)
  const sent        = deriveSentiment(caseInfo)
  const aqiScore    = caseInfo.smoker ? 58 : 35
  const earlyScore  = risk ? Math.max(10, 100 - risk.score) : 30
  const healthScore = risk ? Math.round(risk.score * 5) : 250
  const fraudScore  = (caseInfo.smoker && caseInfo.alcohol) ? 65 : 45

  const tabs = [
    { id: 'summary',     label: '📋 Summary' },
    { id: 'documents',   label: '📄 Documents' },
    { id: 'health',      label: '🩺 Health' },
    { id: 'environment', label: '🌿 Environment' },
    { id: 'sentiment',   label: '💬 Sentiment' },
    { id: 'decision',    label: '⚖️ Decision' },
  ]

  return (
    <div>
      {/* AUSIS header bar */}
      <div style={{ background: `linear-gradient(135deg,${C.tealDk} 0%,${C.teal} 60%,${C.tealLt} 100%)`, borderRadius: 14, padding: '0 20px', marginBottom: 20, boxShadow: '0 4px 20px #0d948840' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, background: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Oswald',sans-serif", fontSize: 16, color: C.teal, fontWeight: 700 }}>A</div>
            <div>
              <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 20, color: '#fff', letterSpacing: 2, lineHeight: 1 }}>AUSIS</div>
              <div style={{ fontSize: 10, color: '#99f6e4' }}>AI Underwriting Decision System · OCR: Gemini 2.5 Flash Lite Preview</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ fontSize: 10, color: '#99f6e4', fontFamily: "'Fira Code',monospace", alignSelf: 'center' }}>{caseId}</div>
            <button onClick={dlPDF} disabled={pdfLoading}
              style={{ padding: '7px 16px', background: '#0f766e', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: pdfLoading ? 0.6 : 1 }}>
              {pdfLoading ? <Spinner size={12} color="#fff" /> : '⬇'} Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Case strip */}
      <div style={{ background: C.slate, borderRadius: 10, padding: '10px 18px', marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['Applicant', caseInfo.name || '—'], ['Age', caseInfo.age ? caseInfo.age + ' yrs' : '—'], ['Gender', caseInfo.gender || '—'], ['Product', caseInfo.product || '—'], ['SA', '₹' + (caseInfo.sa || '—')], ['Docs', okDocs.length + ' extracted']].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>{k}</div>
            <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 700, marginTop: 1 }}>{v}</div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {[['🚬', caseInfo.smoker], ['🍷', caseInfo.alcohol], ['🩸', caseInfo.diabetic]].map(([ic, v]) => v && <span key={ic} style={{ fontSize: 16 }}>{ic}</span>)}
          <div style={{ padding: '4px 14px', background: band.color, borderRadius: 20, color: '#fff', fontSize: 11, fontWeight: 700 }}>{band.label}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderRadius: '10px 10px 0 0', borderBottom: `2px solid ${C.border}`, padding: '0 4px', display: 'flex', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            style={{ padding: '13px 18px', background: 'transparent', color: tab === t.id ? '#fff' : C.muted, fontSize: 12, fontWeight: 700, borderRadius: '8px 8px 0 0', fontFamily: "'Nunito',sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: '0 0 14px 14px', padding: 20 }} className="fade-up">

        {/* ── SUMMARY ── */}
        {tab === 'summary' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, marginBottom: 18 }}>
              <Card accent={C.tealLt}>
                <SectionHead icon="❤️" title="Health Score" />
                <Gauge value={healthScore} max={500} size={130} color={C.amber} sublabel={healthScore < 200 ? 'Low' : healthScore < 350 ? 'Average' : 'Good'} />
              </Card>
              <Card accent={band.color}>
                <SectionHead icon="🎯" title="Composite Risk" />
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                  {risk && <ScoreRing score={risk.score} size={100} />}
                </div>
                <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: band.color }}>{band.label}</div>
              </Card>
              <Card accent={C.purple}>
                <SectionHead icon="📍" title="Location Risk" />
                {[['Risk Score', 60, C.amber], ['Fraud Probability', fraudScore, fraudScore > 55 ? C.coral : C.amber], ['Negative Pincode', null, C.green]].map(([l, v, c]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#fafffe', borderRadius: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>{l}</span>
                    <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 20, fontWeight: 700, color: c }}>
                      {v !== null ? <AnimNum target={v} /> : 'NO'}
                    </span>
                  </div>
                ))}
              </Card>
              <Card accent={C.coral}>
                <SectionHead icon="⚡" title="Early Claim Score" />
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                  <Donut value={earlyScore} size={90} color={C.coral} trackColor="#fecdd3" />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {(caseInfo.smoker ? ['Smoking'] : []).concat(caseInfo.alcohol ? ['Alcohol'] : []).concat(caseInfo.diabetic ? ['Diabetes'] : []).concat(['AQI']).map(r => <RiskPill key={r} label={r} color={C.coral} />)}
                </div>
              </Card>
            </div>

            {risk?.flags?.length > 0 && (
              <Card accent={C.amber} style={{ marginBottom: 18 }}>
                <SectionHead icon="⚠️" title="Risk Flags" badge={`${risk.flags.length} flags`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10 }}>
                  {risk.flags.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: '#fafffe', borderRadius: 8, border: `1px solid ${C.border}` }}>
                      <SevBadge sev={f.sev} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.slate }}>{f.key}: {f.val}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{f.msg}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card accent={C.teal}>
              <SectionHead icon="📝" title="AI UW Narrative"
                action={
                  <button onClick={genNarrative}
                    style={{ padding: '5px 14px', background: C.teal, border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {narLoading ? <Spinner size={12} color="#fff" /> : null}
                    {narrative ? '↻ Regenerate' : 'Generate'}
                  </button>
                }
              />
              {narLoading && <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: C.teal, fontSize: 13 }}><Spinner />Generating via backend…</div>}
              {narrative && !narLoading && <div style={{ fontSize: 13, color: C.slate, lineHeight: 1.8, padding: '12px 14px', background: '#f0fdf9', borderRadius: 8, borderLeft: `3px solid ${C.teal}`, fontStyle: 'italic' }}>{narrative}</div>}
              {!narrative && !narLoading && <div style={{ color: C.muted, fontSize: 13 }}>Click Generate to create an AI UW narrative across all documents.</div>}
            </Card>
          </div>
        )}

        {/* ── DOCUMENTS ── */}
        {tab === 'documents' && (
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
            <div>
              {okDocs.map(d => {
                const dtype = DOC_TYPES.find(t => t.id === d.docType)
                return (
                  <Card key={d.id} style={{ marginBottom: 10, cursor: 'pointer', border: `1px solid ${selDoc?.id === d.id ? C.teal : C.border}`, background: selDoc?.id === d.id ? '#f0fdf9' : '#fff' }}
                    onClick={() => setSelDoc(d)}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 22 }}>{dtype?.icon || '📄'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.slate, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{dtype?.label}</div>
                        {d.extracted?.confidence && <div style={{ fontSize: 10, color: C.teal }}>{d.extracted.confidence}% confidence</div>}
                      </div>
                      <span style={{ color: C.green }}>✓</span>
                    </div>
                  </Card>
                )
              })}
            </div>
            {selDoc && (
              <Card>
                <SectionHead icon={DOC_TYPES.find(t => t.id === selDoc.docType)?.icon || '📄'} title={selDoc.name}
                  badge={`${selDoc.extracted?.confidence || '?'}% · ${selDoc.extracted?.completeness || '?'}`} />
                {selDoc.extracted?.summary && (
                  <div style={{ padding: '10px 14px', background: '#f0fdf9', borderRadius: 8, borderLeft: `3px solid ${C.teal}`, fontSize: 13, color: C.slate, marginBottom: 14, lineHeight: 1.7, fontStyle: 'italic' }}>
                    {selDoc.extracted.summary}
                  </div>
                )}
                {selDoc.extracted?.abnormal_flags?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 6 }}>ABNORMAL FLAGS</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selDoc.extracted.abnormal_flags.map((f, i) => <RiskPill key={i} label={f} color={C.amber} />)}
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 8 }}>EXTRACTED FIELDS — Click to edit</div>
                {Object.entries({ ...(selDoc.structured || {}), ...(edited[selDoc.id] || {}) })
                  .filter(([k]) => k && k !== 'null' && k !== 'undefined')
                  .map(([key, val]) => {
                    const isAb = selDoc.extracted?.abnormal_flags?.some(f => f.toLowerCase().includes(key.toLowerCase()))
                    return (
                      <div key={key} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 10, padding: '7px 0', borderBottom: `1px solid #f1f5f9` }}>
                        <div style={{ fontSize: 12, color: isAb ? C.amber : C.muted, fontWeight: 600 }}>{isAb ? '⚠ ' : ''}{key}</div>
                        <input value={val || ''}
                          onChange={e => setEdited(p => ({ ...p, [selDoc.id]: { ...(p[selDoc.id] || {}), [key]: e.target.value } }))}
                          style={{ background: 'transparent', border: 'none', borderBottom: '1px solid transparent', color: isAb ? C.amber : C.slate, fontSize: 13, outline: 'none', padding: '2px 4px' }}
                          onFocus={e => e.target.style.borderBottom = `1px solid ${C.teal}`}
                          onBlur={e => e.target.style.borderBottom = '1px solid transparent'} />
                      </div>
                    )
                  })}
              </Card>
            )}
          </div>
        )}

        {/* ── HEALTH ── */}
        {tab === 'health' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12, marginBottom: 18 }}>
              {['HbA1c', 'Total Cholesterol', 'LDL', 'HDL', 'Triglycerides', 'Creatinine', 'eGFR', 'Blood Glucose', 'BMI', 'Heart Rate', 'Hemoglobin']
                .filter(k => merged[k])
                .map(k => (
                  <MetricCard key={k} label={k} value={String(merged[k])}
                    flag={risk?.flags?.some(f => f.key === k) ? 'bad' : 'ok'}
                    sub={risk?.flags?.some(f => f.key === k) ? '⚠ Abnormal' : 'Normal'} />
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card accent={C.coral}>
                <SectionHead icon="⚡" title="Medical Risk Matrix" />
                {[
                  ['Lung Cancer Risk',     caseInfo.smoker ? 72 : 25, C.coral],
                  ['CVD Risk',             risk?.flags?.some(f => f.key === 'LDL') ? 65 : 30, C.coralLt],
                  ['COPD Risk',            caseInfo.smoker ? 68 : 20, C.amber],
                  ['Hypertension Risk',    55, C.amber],
                  ['Metabolic Risk (BMI)', risk?.flags?.some(f => f.key === 'BMI') ? 60 : 30, C.purpleLt],
                  ['Renal Risk',           risk?.flags?.some(f => f.key === 'eGFR') ? 65 : 20, C.purple],
                ].map(([l, s, c]) => <RiskBarRow key={l} label={l} score={s} color={c} />)}
              </Card>
              <Card accent={C.amber}>
                <SectionHead icon="🛡️" title="Fraud Indicators" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  {[['Doctor Network', 45, 'Moderate'], ['Hospital Flag', 20, 'Low'], ['Claim History', 30, 'Low'], ['Fraud Probability', fraudScore, fraudScore > 55 ? 'High' : 'Moderate']].map(([l, s, st]) => (
                    <div key={l} style={{ textAlign: 'center', padding: 14, background: '#fafffe', borderRadius: 10 }}>
                      <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 28, fontWeight: 700, color: s > 55 ? C.coral : s > 35 ? C.amber : C.green }}>
                        <AnimNum target={s} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.slate, margin: '3px 0' }}>{l}</div>
                      <div style={{ fontSize: 10, color: s > 55 ? C.coral : s > 35 ? C.amber : C.green, fontWeight: 600 }}>{st}</div>
                    </div>
                  ))}
                </div>
                {risk?.flags?.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: `1px solid #f1f5f9` }}>
                    <SevBadge sev={f.sev} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.slate }}>{f.key}: </span>
                      <span style={{ fontSize: 12, color: C.muted }}>{f.msg}</span>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {/* ── ENVIRONMENT ── */}
        {tab === 'environment' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <Card accent={C.amber}>
                <SectionHead icon="🌫️" title="Air Quality Index (AQI)" />
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Gauge value={aqiScore} max={150} size={130} color={aqiScore > 50 ? C.amber : C.green} sublabel="AQI Score" segments={[C.greenLt, C.tealLt, C.amber, C.coralLt]} />
                  <div style={{ flex: 1, minWidth: 160 }}>
                    {[['Pollutant', 'PM 2.5'], ['Category', aqiScore > 100 ? 'Unhealthy' : aqiScore > 50 ? 'Moderate' : 'Good'], ['Health Impact', aqiScore > 50 ? 'Moderate risk' : 'Low risk']].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid #f1f5f9`, fontSize: 12 }}>
                        <span style={{ color: C.muted }}>{k}</span><span style={{ fontWeight: 700, color: C.slate }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap' }}>
                      {['Reduced Lung Function', 'Lung Cancer', 'CVD', 'COPD', 'Hypertension'].slice(0, aqiScore > 50 ? 5 : 2).map(r => <RiskPill key={r} label={r} color={C.teal} />)}
                    </div>
                  </div>
                </div>
              </Card>
              <Card accent={C.teal}>
                <SectionHead icon="🌤️" title="Weather Health Insights" />
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Condition', 'Status', 'Value'].map(h => <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11, color: C.muted, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Arthritis Pain', caseInfo.diabetic ? 'At High Risk' : 'At Risk', 4.2, C.coral],
                      ['Asthma', caseInfo.smoker ? 'At High Risk' : 'Moderate', 7.2, C.coralLt],
                      ['COPD', caseInfo.smoker ? 'High Risk' : 'Beneficial', caseInfo.smoker ? 6.5 : 2.5, caseInfo.smoker ? C.coral : C.green],
                      ['Common Cold', 'Neutral', 1.7, C.amber],
                    ].map(([cond, status, val, color]) => (
                      <tr key={cond} style={{ borderBottom: `1px solid #f1f5f9` }}>
                        <td style={{ padding: '8px 10px', color: C.slate }}>{cond}</td>
                        <td style={{ padding: '8px 10px' }}><span style={{ color, fontWeight: 600 }}>{status}</span></td>
                        <td style={{ padding: '8px 10px', fontFamily: "'Oswald',sans-serif", fontSize: 14, color, fontWeight: 700 }}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Smoking Risk Cluster', icon: '🚬', risks: ['Reduced Lung Function', 'Hypertension', 'Lung Cancer', 'COPD', 'CVD'], score: caseInfo.smoker ? 70 : 10, color: C.coral, active: caseInfo.smoker },
                { label: 'Alcohol Risk Cluster',  icon: '🍷', risks: ['Liver Disease', 'Hypertension', 'Cardiomyopathy', 'GI Cancer', 'CVD'], score: caseInfo.alcohol ? 55 : 10, color: C.purple, active: caseInfo.alcohol },
              ].map(cl => (
                <Card key={cl.label} accent={cl.color} style={{ opacity: cl.active ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <Donut value={cl.score} size={80} color={cl.color} trackColor="#f1f5f9" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.slate, marginBottom: 8 }}>{cl.icon} {cl.label}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap' }}>{cl.risks.map(r => <RiskPill key={r} label={r} color={cl.color} />)}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── SENTIMENT ── */}
        {tab === 'sentiment' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card accent={C.purpleLt}>
              <SectionHead icon="💬" title="Sentiment Analysis" />
              <SentBar label="Positive" value={sent.positive} color={C.green} />
              <SentBar label="Neutral"  value={sent.neutral}  color={C.amber} />
              <SentBar label="Negative" value={sent.negative} color={C.coral} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, margin: '14px 0' }}>
                {[['Positive', sent.positive, C.green], ['Neutral', sent.neutral, C.amber], ['Negative', sent.negative, C.coral]].map(([l, v, c]) => (
                  <div key={l} style={{ textAlign: 'center', padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                    <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 20, fontWeight: 700, color: c }}>{v.toFixed(4)}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{l}</div>
                  </div>
                ))}
              </div>
              {(caseInfo.smoker || caseInfo.alcohol) && (
                <div style={{ padding: 12, background: '#fff7ed', borderRadius: 8, borderLeft: `4px solid ${C.amber}`, fontSize: 12, color: C.slate, lineHeight: 1.7 }}>
                  <strong>Behavioural Observation:</strong> {caseInfo.smoker ? 'Active smoking declared. ' : ''}{caseInfo.alcohol ? 'Regular alcohol use declared. ' : ''}Dominant negative sentiment driven by high-risk lifestyle habits.
                </div>
              )}
            </Card>
            <Card accent={C.teal}>
              <SectionHead icon="🧠" title="Behavioural Risk Profiling" />
              {[
                ['Risk Awareness',       78, 'Self-declared habits accurately',    C.green],
                ['Disclosure Honesty',   82, 'High model prediction correlation', C.green],
                ['Lifestyle Risk Score', caseInfo.smoker ? 71 : caseInfo.alcohol ? 55 : 30, 'Based on declared habits', C.amber],
                ['Fraud Propensity',     35, 'Low — honest declarations',         C.greenLt],
                ['Compliance Risk',      28, 'Low non-disclosure risk',           C.greenLt],
              ].map(([l, s, n, c]) => <RiskBarRow key={l} label={l} score={s} color={c} note={n} />)}
            </Card>
          </div>
        )}

        {/* ── DECISION ── */}
        {tab === 'decision' && (
          <div>
            <div style={{ background: C.slate, borderRadius: 12, padding: 24, marginBottom: 20, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              {risk && <ScoreRing score={risk.score} size={100} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, color: band.color, marginBottom: 6 }}>{band.label}</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>
                  {risk?.flags?.length || 0} risk flags · {okDocs.length} documents · OCR: Gemini 2.5 Flash Lite Preview
                </div>
                {narrative && <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.7, maxWidth: 500 }}>{narrative.slice(0, 220)}…</div>}
              </div>
              <div style={{ background: '#0f172a', borderRadius: 10, padding: 14, minWidth: 200 }}>
                {[
                  { r: '85–100', l: 'Auto-Accept',   c: C.green, s: (risk?.score || 0) >= 85 },
                  { r: '65–84',  l: 'Review Accept', c: C.teal,  s: (risk?.score || 0) >= 65 && (risk?.score || 0) < 85 },
                  { r: '45–64',  l: 'Load & Accept', c: C.amber, s: (risk?.score || 0) >= 45 && (risk?.score || 0) < 65 },
                  { r: '< 45',   l: 'CMO Referral',  c: C.coral, s: (risk?.score || 0) < 45 },
                ].map(b => (
                  <div key={b.r} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', opacity: b.s ? 1 : 0.35 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: b.s ? b.c : '#334155' }} />
                    <span style={{ fontSize: 10, color: '#64748b', fontFamily: "'Fira Code',monospace", width: 44 }}>{b.r}</span>
                    <span style={{ fontSize: 12, color: b.s ? b.c : '#64748b', fontWeight: b.s ? 700 : 400 }}>{b.l}</span>
                    {b.s && <span style={{ fontSize: 9, color: b.c, fontWeight: 700, marginLeft: 'auto' }}>← HERE</span>}
                  </div>
                ))}
              </div>
            </div>

            {!finalized ? (
              <>
                <Card accent={C.amber} style={{ marginBottom: 16 }}>
                  <SectionHead icon="📝" title="Override Reason (optional)" />
                  <select value={override} onChange={e => setOverride(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none' }}>
                    <option value="">— Following AI recommendation —</option>
                    <option>Clinical judgement overrides algorithmic score</option>
                    <option>Additional documents reviewed not in system</option>
                    <option>Business exception — CMO pre-approved</option>
                    <option>Reinsurer pre-approval obtained</option>
                    <option>Risk within standard retention limits</option>
                  </select>
                </Card>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {[
                    ['✅ Accept',              'Standard terms',        'Accept',              C.green, '#f0fdf4'],
                    ['📋 Accept with Loading', 'Extra premium / excl.', 'Accept with Loading', C.amber, '#fffbeb'],
                    ['🏥 CMO Referral',        'Decline / senior UW',  'CMO Referral',        C.coral, '#fff1f2'],
                  ].map(([l, sub, action, color, bg]) => (
                    <button key={action} onClick={() => finalize(action)}
                      style={{ padding: '18px 12px', background: bg, border: `2px solid ${color}40`, borderRadius: 10, color, cursor: 'pointer', textAlign: 'center', fontFamily: "'Nunito',sans-serif" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{l}</div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>{sub}</div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="fade-up">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: '#f0fdf4', border: `1px solid ${C.green}40`, borderRadius: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 22 }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700, color: C.green, fontSize: 15 }}>Decision recorded: {decision}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Acceptance queued · Mandate authorized · IRDAI PHI compliant</div>
                  </div>
                </div>
                {decLoading && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: C.teal, fontSize: 13, marginBottom: 16 }}>
                    <Spinner />Generating formal decision note via backend…
                  </div>
                )}
                {decNote && (
                  <Card accent={C.amber} style={{ marginBottom: 16 }}>
                    <SectionHead icon="📋" title="Formal UW Decision Note — IRDAI Record" />
                    <div style={{ fontSize: 12, color: C.slate, lineHeight: 1.8, padding: '12px 14px', background: '#fffbeb', borderRadius: 8, borderLeft: `3px solid ${C.amber}`, fontFamily: "'Fira Code',monospace", whiteSpace: 'pre-wrap' }}>
                      {decNote}
                    </div>
                  </Card>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                  {[['📤', 'Acceptance Sent', 'SMS + Email', C.teal], ['🔗', 'Mandate Unlocked', 'First premium', C.green], ['📄', 'Policy Bond', 'Issuance triggered', C.purple], ['🗂️', 'IRDAI Record', 'Decision archived', C.amber]].map(([ic, l, sub, c]) => (
                    <div key={l} style={{ textAlign: 'center', padding: 14, background: c + '10', border: `1px solid ${c}30`, borderRadius: 10 }}>
                      <div style={{ fontSize: 22, marginBottom: 6 }}>{ic}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: c }}>{l}</div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{sub}</div>
                    </div>
                  ))}
                </div>
                <button onClick={dlPDF} disabled={pdfLoading} className="btn-p"
                  style={{ width: '100%', padding: 14, borderRadius: 10, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  {pdfLoading ? <Spinner size={16} color="#fff" /> : '⬇'} Download Full AUSIS PDF Report
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

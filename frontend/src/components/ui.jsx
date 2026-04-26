import { useEffect, useRef, useState } from 'react'

export const C = {
  teal:'#0d9488', tealLt:'#14b8a6', tealDk:'#0f766e',
  coral:'#e11d48', coralLt:'#f43f5e',
  purple:'#7c3aed', purpleLt:'#a78bfa',
  amber:'#d97706', amberLt:'#fbbf24',
  green:'#16a34a', greenLt:'#22c55e',
  slate:'#1e293b', slate2:'#0f172a',
  muted:'#94a3b8', border:'#e2e8f0',
  bg:'#f0fdf9', card:'#ffffff',
}

export const bandInfo = (s) =>
  s >= 85 ? { label:'Auto-Accept',           color:C.green,  bg:'#f0fdf4' } :
  s >= 65 ? { label:'Accept with Review',    color:C.teal,   bg:'#f0fdf9' } :
  s >= 45 ? { label:'Accept with Loading',   color:C.amber,  bg:'#fffbeb' } :
            { label:'CMO / Decline Referral', color:C.coral,  bg:'#fff1f2' }

export function AnimNum({ target, duration = 1000, decimals = 0 }) {
  const [val, setVal] = useState(0)
  const raf = useRef()
  useEffect(() => {
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      setVal(+(target * (1 - Math.pow(1 - p, 3))).toFixed(decimals))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target])
  return <>{decimals ? val.toFixed(decimals) : Math.round(val)}</>
}

export function Gauge({ value, max = 100, size = 130, color, sublabel, segments }) {
  const cx = size / 2, cy = size * 0.56, r = size * 0.38
  const SA = -Math.PI * 0.9, EA = Math.PI * 0.1, TA = EA - SA
  const na = SA + Math.min(value / max, 1) * TA
  const segs = segments || [C.coralLt, C.amber, C.tealLt, C.greenLt]
  const arc = (a1, a2, col) => {
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2)
    return <path key={a1} d={`M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}`} stroke={col} strokeWidth={size * 0.085} fill="none" strokeLinecap="round" />
  }
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size * 0.68} viewBox={`0 0 ${size} ${size * 0.68}`}>
        {segs.map((col, i) => arc(SA + (i / segs.length) * TA, SA + ((i + 1) / segs.length) * TA, col))}
        <line x1={cx} y1={cy} x2={cx + r * 0.75 * Math.cos(na)} y2={cy + r * 0.75 * Math.sin(na)} stroke={color || C.slate} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={size * 0.035} fill={color || C.slate} />
      </svg>
      <div style={{ fontSize: size * 0.2, fontWeight: 700, color: color || C.teal, lineHeight: 1, fontFamily: "'Oswald',sans-serif" }}>
        <AnimNum target={value} />
      </div>
      {sublabel && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sublabel}</div>}
    </div>
  )
}

export function Donut({ value, max = 100, size = 80, color, trackColor = '#e2e8f0', label, sublabel }) {
  const r = size * 0.37, circ = 2 * Math.PI * r
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={size * 0.1} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.1}
            strokeDasharray={`${(value / max) * circ} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1.2s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: size * 0.22, fontWeight: 700, color, fontFamily: "'Oswald',sans-serif" }}><AnimNum target={value} /></span>
        </div>
      </div>
      {label && <div style={{ fontSize: 11, fontWeight: 600, color: C.slate, marginTop: 5 }}>{label}</div>}
      {sublabel && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{sublabel}</div>}
    </div>
  )
}

export function ScoreRing({ score, size = 90 }) {
  const { color } = bandInfo(score)
  const r = size * 0.4, circ = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={size * 0.1} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.1}
          strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.24, fontWeight: 700, color, fontFamily: "'Oswald',sans-serif", lineHeight: 1 }}><AnimNum target={score} /></span>
        <span style={{ fontSize: 9, color: C.muted }}>/ 100</span>
      </div>
    </div>
  )
}

export function Card({ children, style = {}, accent }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 8px #0000000a', border: `1px solid ${C.border}`, borderTop: accent ? `3px solid ${accent}` : undefined, ...style }}>
      {children}
    </div>
  )
}

export function SectionHead({ icon, title, badge, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {icon && <span style={{ fontSize: 15 }}>{icon}</span>}
        <span style={{ fontSize: 13, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: 0.4 }}>{title}</span>
        {badge && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#f0fdf9', color: C.teal, fontWeight: 600, border: `1px solid ${C.teal}30` }}>{badge}</span>}
      </div>
      {action}
    </div>
  )
}

export function Badge({ children, color = C.teal, bg }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, background: bg || '#f0fdf9', color, fontSize: 11, fontWeight: 600, border: `1px solid ${color}30` }}>
      {children}
    </span>
  )
}

export function RiskPill({ label, color = C.teal }) {
  return <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 4, background: color, color: '#fff', fontSize: 11, fontWeight: 600, margin: '2px 3px' }}>{label}</span>
}

export function SevBadge({ sev }) {
  const m = { critical: [C.coral, '#fff1f2'], high: [C.amber, '#fffbeb'], medium: ['#3b82f6', '#eff6ff'], low: [C.muted, '#f8fafc'] }
  const [c, b] = m[sev] || m.low
  return <Badge color={c} bg={b}>{sev.toUpperCase()}</Badge>
}

export function Spinner({ size = 16, color = C.teal }) {
  return <div style={{ width: size, height: size, border: `2px solid ${color}30`, borderTop: `2px solid ${color}`, borderRadius: '50%', animation: 'aSpin .7s linear infinite', flexShrink: 0 }} />
}

export function MetricCard({ label, value, flag, sub }) {
  const fc = flag === 'ok' ? C.green : flag === 'warn' ? C.amber : flag === 'bad' ? C.coral : C.muted
  return (
    <div style={{ background: '#f8fafc', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: fc, fontFamily: "'Oswald',sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function ProgressStep({ steps, current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, overflowX: 'auto', paddingBottom: 4 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 72 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: i < current ? C.green : i === current ? C.teal : '#e2e8f0', color: i <= current ? '#fff' : C.muted, boxShadow: i === current ? `0 0 0 4px ${C.teal}25` : 'none', transition: 'all .3s' }}>
              {i < current ? '✓' : i + 1}
            </div>
            <div style={{ fontSize: 10, color: i === current ? C.teal : i < current ? C.green : C.muted, textAlign: 'center', whiteSpace: 'nowrap', fontWeight: i === current ? 700 : 400 }}>{s}</div>
          </div>
          {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: i < current ? C.green : '#e2e8f0', marginBottom: 18, minWidth: 16, transition: 'background .3s' }} />}
        </div>
      ))}
    </div>
  )
}

export function GlobalCSS() {
  return (
    <style>{`
      @keyframes aSpin { to { transform: rotate(360deg); } }
      @keyframes aFadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
      @keyframes aPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      .fade-up { animation: aFadeUp .35s ease forwards; }
      .tab-btn { border:none; cursor:pointer; transition:all .2s; }
      .tab-btn:hover { background:#ccfbf1 !important; color:#0f766e !important; }
      .tab-btn.active { background:#0d9488 !important; color:#fff !important; }
      .btn-p { background:linear-gradient(135deg,#0d9488,#0f766e); color:#fff; border:none; cursor:pointer; transition:all .2s; font-family:'Nunito',sans-serif; font-weight:700; }
      .btn-p:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 4px 16px #0d948860; }
      .btn-p:disabled { opacity:0.45; cursor:not-allowed; transform:none; }
      .drop:hover, .drop.drag { border-color:#0d9488 !important; background:#f0fdf9 !important; }
      * { box-sizing:border-box; }
      input,select,textarea { font-family:'Nunito',sans-serif; }
      select option { background:#fff; }
    `}</style>
  )
}

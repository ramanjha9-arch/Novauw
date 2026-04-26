export async function generatePDF({ caseInfo, risk, structured, docs, narrative, decisionNote, caseId }) {
  const { jsPDF } = await import('jspdf')
  await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 14
  let y = 0

  const TEAL  = [13, 148, 136]
  const DARK  = [15, 23, 42]
  const AMBER = [217, 119, 6]
  const GREEN = [22, 163, 74]
  const GREY  = [100, 116, 139]
  const LIGHT = [248, 250, 252]
  const WHITE = [255, 255, 255]

  const bc = (s) => s >= 85 ? GREEN : s >= 65 ? TEAL : s >= 45 ? AMBER : [225, 29, 72]
  const checkY = (n = 20) => { if (y + n > 275) { doc.addPage(); y = 20 } }

  // ── Header ──
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, W, 36, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('AUSIS', M, 13)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('AI Underwriting Decision System · Non-STP Document Intelligence', M, 20)
  doc.text('Solving for U/W — Speed · Accuracy · Cost Saves | IRDAI PHI Compliant', M, 27)
  doc.setFontSize(8)
  doc.text(`Case: ${caseId}`, W - M, 12, { align: 'right' })
  doc.text(new Date().toLocaleString('en-IN'), W - M, 18, { align: 'right' })
  doc.text('OCR: Gemini 2.5 Flash Lite Preview', W - M, 24, { align: 'right' })

  const scoreColor = bc(risk?.score || 50)
  doc.setFillColor(...scoreColor)
  doc.roundedRect(W - M - 54, 28, 54, 8, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(caseInfo.decision || risk?.band || 'Pending', W - M - 27, 33.5, { align: 'center' })
  y = 42

  // ── Applicant strip ──
  doc.setFillColor(...LIGHT)
  doc.rect(M, y, W - M * 2, 22, 'F')
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(caseInfo.name || 'Applicant', M + 4, y + 7)
  const strip = [
    ['Age', `${caseInfo.age || '—'} yrs`],
    ['Gender', caseInfo.gender || '—'],
    ['Product', caseInfo.product || '—'],
    ['Sum Assured', `₹${caseInfo.sa || '—'}`],
    ['Smoker', caseInfo.smoker ? 'Yes' : 'No'],
  ]
  doc.setFontSize(8)
  strip.forEach(([k, v], i) => {
    const x = M + 4 + i * 36
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...GREY); doc.text(k, x, y + 13)
    doc.setFont('helvetica', 'bold');   doc.setTextColor(...DARK); doc.text(v, x, y + 18)
  })
  y += 28

  // ── Risk score ──
  checkY(50)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TEAL)
  doc.text('COMPOSITE RISK ASSESSMENT', M, y); y += 5
  doc.setDrawColor(...TEAL); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 4

  const rbc = bc(risk?.score || 50)
  doc.setFillColor(...rbc)
  doc.roundedRect(M, y, 45, 26, 3, 3, 'F')
  doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(28)
  doc.text(String(risk?.score || 0), M + 22, y + 17, { align: 'center' })
  doc.setFontSize(8); doc.text('/ 100', M + 22, y + 23, { align: 'center' })
  doc.setTextColor(...rbc); doc.setFontSize(12)
  doc.text(risk?.band || '—', M + 52, y + 9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GREY)
  doc.text(`Decision: ${caseInfo.decision || '—'}`, M + 52, y + 15)
  doc.text(`Override: ${caseInfo.overrideReason || 'AI recommendation followed'}`, M + 52, y + 21)
  y += 32

  if (risk?.flags?.length) {
    checkY(10)
    doc.autoTable({
      startY: y,
      head: [['Parameter', 'Value', 'Severity', 'Clinical Note']],
      body: risk.flags.map(f => [f.key, f.val, f.sev.toUpperCase(), f.msg]),
      margin: { left: M, right: M },
      headStyles: { fillColor: DARK, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: LIGHT },
      theme: 'grid',
    })
    y = doc.lastAutoTable.finalY + 6
  }

  // ── Narrative ──
  if (narrative) {
    checkY(30)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TEAL)
    doc.text('UNDERWRITER NARRATIVE', M, y); y += 5
    doc.setDrawColor(...TEAL); doc.line(M, y, W - M, y); y += 4
    const lines = doc.splitTextToSize(narrative, W - M * 2 - 8)
    const bh = lines.length * 4.5 + 8
    doc.setFillColor(240, 253, 250); doc.rect(M, y, W - M * 2, bh, 'F')
    doc.setDrawColor(...TEAL); doc.setLineWidth(0.8); doc.line(M, y, M, y + bh)
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...DARK)
    doc.text(lines, M + 6, y + 6); y += bh + 6
  }

  // ── Medical data ──
  const medKeys = ['HbA1c','Total Cholesterol','LDL','HDL','Triglycerides','Creatinine','eGFR','Blood Glucose','BMI','Blood Pressure','Heart Rate','Hemoglobin']
  const medRows = medKeys.filter(k => structured[k]).map(k => [k, String(structured[k]), risk?.flags?.some(f => f.key === k) ? '⚠ Abnormal' : 'Normal'])
  if (medRows.length) {
    checkY(20)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TEAL)
    doc.text('EXTRACTED MEDICAL DATA', M, y); y += 5
    doc.setDrawColor(...TEAL); doc.line(M, y, W - M, y); y += 3
    doc.autoTable({ startY: y, head: [['Parameter', 'Value', 'Status']], body: medRows, margin: { left: M, right: M }, headStyles: { fillColor: DARK, textColor: WHITE, fontSize: 8 }, bodyStyles: { fontSize: 8 }, alternateRowStyles: { fillColor: LIGHT }, theme: 'grid' })
    y = doc.lastAutoTable.finalY + 6
  }

  // ── Financial data ──
  const finKeys = ['Gross Total Income','Net Taxable Income','Average Balance','Total Credits 12M','Gross Salary','Net Salary','Employer Name','Bank Name']
  const finRows = finKeys.filter(k => structured[k]).map(k => [k, String(structured[k])])
  if (finRows.length) {
    checkY(20)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TEAL)
    doc.text('EXTRACTED FINANCIAL DATA', M, y); y += 5
    doc.setDrawColor(...TEAL); doc.line(M, y, W - M, y); y += 3
    doc.autoTable({ startY: y, head: [['Financial Parameter', 'Value']], body: finRows, margin: { left: M, right: M }, headStyles: { fillColor: DARK, textColor: WHITE, fontSize: 8 }, bodyStyles: { fontSize: 8 }, alternateRowStyles: { fillColor: LIGHT }, theme: 'grid' })
    y = doc.lastAutoTable.finalY + 6
  }

  // ── Docs processed ──
  if (docs?.length) {
    checkY(20)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TEAL)
    doc.text('DOCUMENTS PROCESSED', M, y); y += 5
    doc.setDrawColor(...TEAL); doc.line(M, y, W - M, y); y += 3
    doc.autoTable({
      startY: y,
      head: [['Document', 'Type', 'AI Model Used', 'Confidence', 'Status']],
      body: docs.map(d => [d.name || d.filename, d.docTypeLabel || d.doc_type || d.docType, d.usedModel || d.used_model || '—', d.extracted?.confidence ? `${d.extracted.confidence}%` : '—', d.status === 'done' ? '✓ Extracted' : '✗ Failed']),
      margin: { left: M, right: M },
      headStyles: { fillColor: DARK, textColor: WHITE, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: LIGHT },
      theme: 'grid',
    })
    y = doc.lastAutoTable.finalY + 6
  }

  // ── Decision note ──
  if (decisionNote) {
    checkY(30)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TEAL)
    doc.text('FORMAL UW DECISION NOTE — IRDAI RECORD', M, y); y += 5
    doc.setDrawColor(...TEAL); doc.line(M, y, W - M, y); y += 4
    const dlines = doc.splitTextToSize(decisionNote, W - M * 2 - 8)
    const dh = dlines.length * 4.5 + 8
    doc.setFillColor(255, 253, 235); doc.rect(M, y, W - M * 2, dh, 'F')
    doc.setDrawColor(...AMBER); doc.setLineWidth(0.8); doc.line(M, y, M, y + dh)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...DARK)
    doc.text(dlines, M + 6, y + 6); y += dh + 8
  }

  // ── PHI footer ──
  checkY(20)
  doc.setFillColor(...DARK); doc.rect(M, y, W - M * 2, 18, 'F')
  doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text('IRDAI PHI COMPLIANCE', M + 4, y + 6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(153, 246, 228)
  doc.text('Premium collection authorized post-acceptance only. Per IRDAI PHI Regulations.', M + 4, y + 12, { maxWidth: W - M * 2 - 8 })
  doc.setTextColor(...GREY)
  doc.text(`Mandate: AUTHORIZED  |  Archived: ${new Date().toISOString()}  |  OCR: Gemini 2.5 Flash Lite Preview`, M + 4, y + 17, { maxWidth: W - M * 2 - 8 })

  // Page numbers
  const total = doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...GREY)
    doc.text(`AUSIS UW Intelligence  |  Case ${caseId}  |  Page ${i} of ${total}`, W / 2, 292, { align: 'center' })
    doc.setDrawColor(...TEAL); doc.setLineWidth(0.4); doc.line(M, 289, W - M, 289)
  }

  doc.save(`AUSIS-Report-${caseId}.pdf`)
}

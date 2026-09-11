import { Camera, FileImage, FileText, PenLine } from 'lucide-react'
import { useState } from 'react'
import { ReceiptCamera } from './ReceiptCamera'

type Source = 'receipt' | 'document' | 'manual'

export function ImportSourcePicker({ mode, onChoose }: { mode: 'expense' | 'income'; onChoose: (source: Source, file?: File) => void }) {
  const [camera, setCamera] = useState(false)
  const label = mode === 'expense' ? 'cheltuială' : 'venit'
  return <div className="import-picker">
    <p className="sheet-copy">Alege cum vrei să adaugi această {label}.</p>
    {camera ? <ReceiptCamera onClose={() => setCamera(false)} onCapture={file => onChoose('receipt', file)} /> : <div className="import-options">
      <button type="button" className="import-option" onClick={() => setCamera(true)}><span className="import-option-icon receipt"><Camera size={21} /></span><span><strong>Poză Bon Fiscal</strong><small>Deschide camera cu ghid de încadrare</small></span></button>
      <label className="import-option"><span className="import-option-icon receipt"><FileImage size={21} /></span><span><strong>Alege o fotografie</strong><small>Încarcă o imagine existentă</small></span><input type="file" accept="image/*" onChange={event => event.target.files?.[0] && onChoose('receipt', event.target.files[0])} /></label>
      <label className="import-option"><span className="import-option-icon document"><FileText size={21} /></span><span><strong>PDF sau Screenshot</strong><small>Încarcă un PDF sau o captură de ecran</small></span><input type="file" accept="application/pdf,image/*" onChange={event => event.target.files?.[0] && onChoose('document', event.target.files[0])} /></label>
      <button type="button" className="import-option" onClick={() => onChoose('manual')}><span className="import-option-icon manual"><PenLine size={21} /></span><span><strong>Manual</strong><small>Completează detaliile singur</small></span><FileImage size={17} /></button>
    </div>}
    <p className="import-note">Bonul este analizat automat, iar datele extrase pot fi verificate înainte de salvare.</p>
  </div>
}

export type { Source }

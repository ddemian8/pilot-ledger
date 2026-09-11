import { useEffect, useRef, useState } from 'react'

export function ReceiptCamera({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null); const [error, setError] = useState('')
  useEffect(() => { let stream: MediaStream | undefined; navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } }).then(value => { stream = value; if (video.current) video.current.srcObject = value }).catch(() => setError('Camera nu este disponibilă. Folosește încărcarea unei imagini.')); return () => stream?.getTracks().forEach(track => track.stop()) }, [])
  const capture = () => { const element = video.current; if (!element || !element.videoWidth) return; const canvas = document.createElement('canvas'); canvas.width = element.videoWidth; canvas.height = element.videoHeight; canvas.getContext('2d')?.drawImage(element, 0, 0); canvas.toBlob(blob => blob && onCapture(new File([blob], 'receipt.jpg', { type: 'image/jpeg' })), 'image/jpeg', .92) }
  return <div className="receipt-camera"><div className="camera-frame"><video ref={video} autoPlay playsInline /><div className="camera-corners" /><p>Încadrează tot bonul în chenar</p></div>{error && <p className="form-error">{error}</p>}<div className="camera-actions"><button type="button" className="cancel-button" onClick={onClose}>Anulează</button><button type="button" className="save-button" onClick={capture} disabled={Boolean(error)}>Fotografiază</button></div></div>
}

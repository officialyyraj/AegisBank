// src/components/banking/KycView.tsx — KYC document upload + status.
'use client'
import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { UploadCloud, FileText, ShieldCheck, Clock, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/frontend/api'
import { SectionCard, ErrorBanner } from './primitives'

export function KycView() {
  const [status, setStatus] = useState<string>('unknown')
  const [docType, setDocType] = useState('passport')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try { setStatus((await api.kycStatus()).kyc_status) } catch (e) { setError((e as Error).message) }
  }
  useEffect(() => { void load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setBusy(true); setError(null); setDone(null)
    try {
      const r = await api.kycUpload(file, docType)
      setDone(`Uploaded — document ID ${r.document_id}, status: ${r.status}`)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const statusBadge = () => {
    if (status === 'approved') return <Badge className="bg-primary text-primary-foreground"><ShieldCheck className="size-3" /> Approved</Badge>
    if (status === 'rejected') return <Badge variant="destructive"><XCircle className="size-3" /> Rejected</Badge>
    if (status === 'pending') return <Badge variant="secondary"><Clock className="size-3" /> Pending review</Badge>
    return <Badge variant="outline">Unknown</Badge>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard title="KYC status" description="Identity verification gate. Account creation is blocked until approved.">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3 py-8 text-center">
          <div className={`rounded-full p-4 ${status === 'approved' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
            <ShieldCheck className="size-8" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold capitalize">{status}</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {status === 'approved' && 'You can create accounts and transact freely.'}
              {status === 'pending' && 'Your document is awaiting admin review.'}
              {status === 'rejected' && 'Please re-upload a valid document.'}
            </p>
          </div>
          {statusBadge()}
        </motion.div>
      </SectionCard>

      <SectionCard title="Upload document" description="PDF, JPG, or PNG · max 5MB">
        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Document type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="passport">Passport</SelectItem>
                <SelectItem value="aadhaar">Aadhaar</SelectItem>
                <SelectItem value="pan">PAN Card</SelectItem>
                <SelectItem value="driving_license">Driving License</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">File</Label>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center transition hover:border-primary/40 hover:bg-accent"
            >
              <UploadCloud className="size-6 text-muted-foreground" />
              {file ? (
                <span className="text-sm font-medium">{file.name} <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span></span>
              ) : (
                <span className="text-sm text-muted-foreground">Click to choose a file</span>
              )}
            </button>
            <Input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>

          <Button type="submit" disabled={!file || busy} className="w-full">
            {busy ? 'Uploading…' : 'Submit for review'} {!busy && <FileText className="size-4" />}
          </Button>

          {done && <p className="text-sm text-primary">{done}</p>}
          {status === 'pending' && (
            <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              Your document will be reviewed securely. We&apos;ll update you when your verification is complete.
            </p>
          )}
        </form>
      </SectionCard>
    </div>
  )
}

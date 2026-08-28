import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { uploadMerchantImage } from '@/lib/upload-merchant-image'

type Props = {
  label: string
  value: string
  onChange: (url: string) => void
  compact?: boolean
}

export function ImageUrlField({ label, value, onChange, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const onPick = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadMerchantImage(file)
      onChange(url)
      toast.success('Image uploaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const labelClass = compact
    ? 'block text-[10px] text-text-3 mb-0.5'
    : 'block text-[11.5px] text-text-2 mb-1 font-medium'
  const inputClass = compact
    ? 'w-full px-1.5 py-1 rounded border border-border-subtle bg-bg-3 text-text-0 text-[11px] outline-none focus:border-green'
    : 'w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green'

  return (
    <div className={compact ? 'mb-1' : 'mb-2.5'}>
      <label className={labelClass}>{label}</label>
      {value ? (
        <div className={`mb-1.5 overflow-hidden rounded border border-border-default bg-bg-3 ${compact ? '' : ''}`}>
          <img
            src={value}
            alt=""
            className={`w-full object-cover ${compact ? 'max-h-20' : 'max-h-28'}`}
          />
          <div className="flex items-center justify-end gap-1 border-t border-border-subtle px-1.5 py-1">
            <button
              type="button"
              onClick={() => onChange('')}
              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-text-3 hover:text-status-red"
            >
              <X size={11} />
              Remove
            </button>
          </div>
        </div>
      ) : null}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or upload"
          className={`flex-1 min-w-0 ${inputClass}`}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="shrink-0 inline-flex items-center gap-1 rounded border border-border-default bg-bg-2 px-2 py-1 text-[10px] font-medium text-text-1 hover:border-green disabled:opacity-50"
          title="Upload image"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
          {uploading ? '…' : 'Upload'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0] || null)}
      />
    </div>
  )
}

const IMAGE_ITEM_KEYS = new Set(['src', 'image', 'avatar', 'logourl', 'heroimage'])

export function isImageItemKey(key: string): boolean {
  return IMAGE_ITEM_KEYS.has(key.toLowerCase())
}

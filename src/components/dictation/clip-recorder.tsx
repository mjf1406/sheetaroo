import { Mic, Square, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type ClipRecorderProps = {
  label: string
  description?: string
  onRecorded: (blob: Blob) => void
  existingUrl?: string | null
}

export function ClipRecorder({
  label,
  description,
  onRecorded,
  existingUrl,
}: ClipRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    existingUrl ?? null,
  )
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    chunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || 'audio/webm',
      })
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      onRecorded(blob)
      stream.getTracks().forEach((track) => track.stop())
    }
    mediaRecorderRef.current = recorder
    recorder.start()
    setIsRecording(true)
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    onRecorded(file)
    event.target.value = ''
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {isRecording ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={stopRecording}
          >
            <Square className="size-4" />
            Stop
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void startRecording()}
          >
            <Mic className="size-4" />
            Record
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" asChild>
          <label className="cursor-pointer">
            <Upload className="size-4" />
            Upload
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={handleFileUpload}
            />
          </label>
        </Button>
      </div>
      {previewUrl ? (
        <audio controls src={previewUrl} className="w-full" />
      ) : null}
    </div>
  )
}

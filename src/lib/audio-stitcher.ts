import type { AudioSegment } from '@/lib/dictation-types'

export async function stitchAudioSegments(
  segments: AudioSegment[],
): Promise<Blob> {
  if (segments.length === 0) {
    throw new Error('No audio segments to stitch')
  }

  const context = new AudioContext()
  try {
    const decoded: Array<{ buffer: AudioBuffer; silenceAfterMs: number }> = []

    for (const segment of segments) {
      const arrayBuffer = await segment.blob.arrayBuffer()
      const buffer = await context.decodeAudioData(arrayBuffer.slice(0))
      decoded.push({ buffer, silenceAfterMs: segment.silenceAfterMs })
    }

    const sampleRate = decoded[0]!.buffer.sampleRate
    const channels = decoded[0]!.buffer.numberOfChannels
    const totalLength = decoded.reduce((sum, item) => {
      const silenceFrames = Math.round(
        (item.silenceAfterMs / 1000) * sampleRate,
      )
      return sum + item.buffer.length + silenceFrames
    }, 0)

    const output = context.createBuffer(channels, totalLength, sampleRate)

    let offset = 0
    for (const item of decoded) {
      for (let channel = 0; channel < channels; channel++) {
        const source = item.buffer.getChannelData(
          Math.min(channel, item.buffer.numberOfChannels - 1),
        )
        output.copyToChannel(source, channel, offset)
      }
      offset += item.buffer.length

      if (item.silenceAfterMs > 0) {
        const silenceFrames = Math.round(
          (item.silenceAfterMs / 1000) * sampleRate,
        )
        offset += silenceFrames
      }
    }

    return audioBufferToWav(output)
  } finally {
    await context.close()
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1
  const bitDepth = 16

  const samples = buffer.length
  const blockAlign = (numChannels * bitDepth) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = samples * blockAlign
  const bufferLength = 44 + dataSize
  const arrayBuffer = new ArrayBuffer(bufferLength)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, bufferLength - 8, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i] ?? 0
      const clamped = Math.max(-1, Math.min(1, sample))
      view.setInt16(
        offset,
        clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
        true,
      )
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

export async function uploadBlob(
  uploadUrl: string,
  blob: Blob,
): Promise<string> {
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'audio/wav' },
    body: blob,
  })

  if (!response.ok) {
    throw new Error('Upload failed')
  }

  const { storageId } = (await response.json()) as { storageId: string }
  return storageId
}

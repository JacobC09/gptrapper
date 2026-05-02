/**
 * Segments an audio blob into individual sound events based on RMS power threshold.
 *
 * Algorithm:
 *  1. Decode audio to PCM (mono mix-down)
 *  2. Scan 10ms RMS windows; mark start when RMS > threshold, end when RMS < threshold/2 (hysteresis)
 *  3. Pad each event with pre/post silence
 *  4. Merge events separated by < 100ms
 *  5. Encode each segment as a WAV blob
 *
 * Tune `threshold` (0–1 RMS) to control sensitivity.
 * Lower values catch quieter sounds; higher values only grab strong transients.
 */

export const DEFAULT_SEGMENT_THRESHOLD = 0.015

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

function pcmToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length
  const buf = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buf)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)           // chunk size
  view.setUint16(20, 1, true)            // PCM format
  view.setUint16(22, 1, true)            // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true)            // block align
  view.setUint16(34, 16, true)           // bits per sample
  writeString(view, 36, 'data')
  view.setUint32(40, numSamples * 2, true)

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return new Blob([buf], { type: 'audio/wav' })
}

export async function segmentAudio(
  blob: Blob,
  threshold = DEFAULT_SEGMENT_THRESHOLD,
  /** Minimum event duration in ms */
  minDurationMs = 80,
  /** Silence padding prepended to each event (ms) */
  prePadMs = 20,
  /** Silence padding appended to each event (ms) */
  postPadMs = 120,
): Promise<Blob[]> {
  const arrayBuffer = await blob.arrayBuffer()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext
  const ctx: AudioContext = new AudioCtx()
  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  } finally {
    ctx.close()
  }

  // Mix down to mono
  const sampleRate = audioBuffer.sampleRate
  const length = audioBuffer.length
  const mono = new Float32Array(length)
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch)
    for (let i = 0; i < length; i++) mono[i] += data[i] / audioBuffer.numberOfChannels
  }

  const windowSamples = Math.floor(sampleRate * 0.01)        // 10ms
  const prePad       = Math.floor(sampleRate * prePadMs / 1000)
  const postPad      = Math.floor(sampleRate * postPadMs / 1000)
  const minSamples   = Math.floor(sampleRate * minDurationMs / 1000)
  const mergeGapSamples = Math.floor(sampleRate * 0.1)       // 100ms

  // Detect on/off transitions
  const raw: Array<{ start: number; end: number }> = []
  let inSeg = false
  let segStart = 0

  for (let i = 0; i < length; i += windowSamples) {
    const wEnd = Math.min(i + windowSamples, length)
    let sumSq = 0
    for (let j = i; j < wEnd; j++) sumSq += mono[j] * mono[j]
    const rms = Math.sqrt(sumSq / (wEnd - i))

    if (!inSeg && rms > threshold) {
      inSeg = true
      segStart = Math.max(0, i - prePad)
    } else if (inSeg && rms < threshold * 0.5) {
      // hysteresis: end at lower threshold to avoid premature cuts
      inSeg = false
      const segEnd = Math.min(length, i + postPad)
      if (segEnd - segStart >= minSamples) {
        raw.push({ start: segStart, end: segEnd })
      }
    }
  }
  if (inSeg && length - segStart >= minSamples) {
    raw.push({ start: segStart, end: length })
  }

  // Merge closely-spaced segments
  const merged: Array<{ start: number; end: number }> = []
  for (const seg of raw) {
    if (merged.length > 0 && seg.start - merged[merged.length - 1].end < mergeGapSamples) {
      merged[merged.length - 1].end = seg.end
    } else {
      merged.push({ ...seg })
    }
  }

  return merged.map(seg => pcmToWavBlob(mono.slice(seg.start, seg.end), sampleRate))
}

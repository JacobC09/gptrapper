export const BAR_COUNT = 50

export type ParsedNote = { midi: number; timeS: number; durationS: number; velocity: number }

export async function parseMidiNotes(buf: ArrayBuffer): Promise<ParsedNote[]> {
    const { Midi } = await import("@tonejs/midi")
    const midi = new Midi(buf)
    const notes: ParsedNote[] = []
    for (const track of midi.tracks) {
        for (const note of track.notes) {
            notes.push({ midi: note.midi, timeS: note.time, durationS: note.duration, velocity: note.velocity ?? 0.8 })
        }
    }
    return notes
}

export type BeatResult = {
    userSoundsUrl: string
    midiUrl: string
    originalUrl?: string
    assignments?: Record<string, string>  // slot → person name (sample beat only)
}

export type Clip = {
    id: string
    url: string
    bars: number[]
    durationMs: number
    ext: string
}

export function formatTime(ms: number): string {
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    const cs = Math.floor((ms % 1000) / 10)
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`
}

export function extFromMime(mime: string): string {
    if (mime.includes("ogg")) return "ogg"
    if (mime.includes("mp4")) return "mp4"
    return "webm"
}

export function barsFromAudioBuffer(buffer: AudioBuffer): number[] {
    const data = buffer.getChannelData(0)
    const perBar = Math.floor(data.length / BAR_COUNT)
    const bars: number[] = []
    for (let i = 0; i < BAR_COUNT; i++) {
        let sumSq = 0
        for (let j = 0; j < perBar; j++) sumSq += data[i * perBar + j] ** 2
        bars.push(Math.sqrt(sumSq / perBar))
    }
    return bars
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numCh = buffer.numberOfChannels
    const sr = buffer.sampleRate
    const n = buffer.length
    const dataLen = n * numCh * 2
    const ab = new ArrayBuffer(44 + dataLen)
    const v = new DataView(ab)
    const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
    str(0, "RIFF"); v.setUint32(4, 36 + dataLen, true)
    str(8, "WAVE"); str(12, "fmt ")
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, numCh, true)
    v.setUint32(24, sr, true); v.setUint32(28, sr * numCh * 2, true)
    v.setUint16(32, numCh * 2, true); v.setUint16(34, 16, true)
    str(36, "data"); v.setUint32(40, dataLen, true)
    let off = 44
    for (let i = 0; i < n; i++) {
        for (let ch = 0; ch < numCh; ch++) {
            const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]))
            v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
            off += 2
        }
    }
    return new Blob([ab], { type: "audio/wav" })
}

export function clipFromAudioBuffer(buffer: AudioBuffer): Clip {
    const blob = audioBufferToWavBlob(buffer)
    return {
        id: crypto.randomUUID(),
        url: URL.createObjectURL(blob),
        bars: barsFromAudioBuffer(buffer),
        durationMs: Math.round(buffer.duration * 1000),
        ext: "wav",
    }
}

export function drawWaveform(canvas: HTMLCanvasElement, bars: number[]) {
    const ctx = canvas.getContext("2d")!
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    ctx.fillStyle = "rgba(10,10,16,0.85)"
    ctx.fillRect(0, 0, W, H)

    if (bars.length === 0) return
    const count = Math.max(bars.length, BAR_COUNT)
    const bw = Math.max((W / count) * 0.75, 1)

    for (let i = 0; i < count; i++) {
        const t = bars.length <= 1 ? 0 : (i / (count - 1)) * (bars.length - 1)
        const lo = Math.floor(t)
        const hi = Math.min(lo + 1, bars.length - 1)
        const val = bars[lo] + (bars[hi] - bars[lo]) * (t - lo)
        const h = Math.max(Math.min(val * H * 10, H - 2), 2)
        const x = (i / count) * W
        const y = (H - h) / 2
        const r = Math.min(bw / 2, h / 2, 3)

        ctx.save()
        ctx.shadowBlur = 8
        ctx.shadowColor = "rgba(0,219,233,0.65)"
        ctx.fillStyle = "rgba(0,219,233,0.52)"
        ctx.beginPath()
        ctx.roundRect(x, y, bw, h, r)
        ctx.fill()
        ctx.restore()

        ctx.save()
        ctx.beginPath()
        ctx.roundRect(x, y, bw, h, r)
        ctx.clip()
        ctx.fillStyle = "rgba(0,219,233,0.5)"
        ctx.fillRect(x, y, bw, Math.max(h * 0.28, 2))
        ctx.restore()
    }
}

"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { motion } from "motion/react"
import { formatTime } from "@/lib/audio"
import { MatIcon } from "@/components/MatIcon"
import lamejs from "lamejs"
import type { Clip } from "@/lib/audio"
import type { InstrumentType, Sample } from "@/lib/types"

type ToneNamespace = typeof import("tone")

type ParsedNote = { midi: number; timeS: number; durationS: number; velocity: number; channel: number }

type RollLayout = {
    minPitch: number
    maxPitch: number
    totalS: number
    W: number
    H: number
    rowH: number
    dpr: number
}

const BLACK_KEYS = new Set([1, 3, 6, 8, 10])
const CANVAS_HEIGHT_PX = 320
const PITCH_PAD = 2
const DIM_ALPHA = 0.3
const MP3_BITRATE = 192
const MP3_BLOCK_SIZE = 1152
const MP3_FILENAME = "generated_beat.mp3"
const MP3_TAIL_S = 0.6

const PITCH_COLORS: [number, number, number][] = [
    [0,   219, 233],
    [100, 150, 255],
    [180,  80, 255],
    [255,  60, 180],
]

// Instrument types that respond to pitch (get pitch-shifted to each MIDI note)
const MELODIC_TYPES = new Set<InstrumentType>([
    "piano", "aguitar", "bguitar", "eguitar", "cello", "violin", "flute", "trumpet",
])

// GM standard drum note assignments — sample is loaded at this note so no pitch shift occurs
const GM_DRUM_NOTES: Partial<Record<InstrumentType, string>> = {
    kickdrum:  "C2",   // MIDI 36
    snaredrum: "D2",   // MIDI 38
    hihat:     "F#2",  // MIDI 42
}

type RollSnapshots = { dim: HTMLCanvasElement; bright: HTMLCanvasElement }

function noteColor(midi: number, alpha: number): string {
    const [r, g, b] = PITCH_COLORS[midi % PITCH_COLORS.length]
    return `rgba(${r},${g},${b},${alpha})`
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length)
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]))
        output[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
    }
    return output
}

function audioBufferToMp3(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, MP3_BITRATE)
    const mp3Data: Uint8Array[] = []
    const left = buffer.getChannelData(0)
    const right = numChannels > 1 ? buffer.getChannelData(1) : left

    for (let i = 0; i < buffer.length; i += MP3_BLOCK_SIZE) {
        const leftChunk = floatTo16BitPCM(left.subarray(i, i + MP3_BLOCK_SIZE))
        const rightChunk = numChannels > 1
            ? floatTo16BitPCM(right.subarray(i, i + MP3_BLOCK_SIZE))
            : leftChunk
        const mp3buf = numChannels > 1
            ? mp3encoder.encodeBuffer(leftChunk, rightChunk)
            : mp3encoder.encodeBuffer(leftChunk)
        if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf))
    }

    const end = mp3encoder.flush()
    if (end.length > 0) mp3Data.push(new Uint8Array(end))
    return new Blob(mp3Data as BlobPart[], { type: "audio/mpeg" })
}

// Encode an AudioBuffer as a WAV blob so Tone.Sampler can load it via URL
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const nc = buffer.numberOfChannels
    const sr = buffer.sampleRate
    const len = buffer.length
    const dataBytes = len * nc * 2
    const wav = new ArrayBuffer(44 + dataBytes)
    const v = new DataView(wav)
    const w = (o: number, str: string) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
    w(0, "RIFF"); v.setUint32(4, 36 + dataBytes, true)
    w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true)
    v.setUint16(20, 1, true); v.setUint16(22, nc, true)
    v.setUint32(24, sr, true); v.setUint32(28, sr * nc * 2, true)
    v.setUint16(32, nc * 2, true); v.setUint16(34, 16, true)
    w(36, "data"); v.setUint32(40, dataBytes, true)
    let o = 44
    for (let i = 0; i < len; i++) {
        for (let ch = 0; ch < nc; ch++) {
            const x = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]))
            v.setInt16(o, Math.round(x * 32767), true); o += 2
        }
    }
    return new Blob([wav], { type: "audio/wav" })
}

// Decode all needed clips, slice each sample out, return WAV blob URLs ready for Tone.Sampler
async function buildSamplerData(
    clips: Clip[],
    samples: Sample[],
    assignedTypes: InstrumentType[],
): Promise<{ melodicUrl: string | null; drumUrls: Record<string, string>; allUrls: string[] }> {
    const ctx = new AudioContext()
    const cached = new Map<number, AudioBuffer>()
    const allUrls: string[] = []

    const getBuffer = async (clipIdx: number): Promise<AudioBuffer> => {
        if (cached.has(clipIdx)) return cached.get(clipIdx)!
        const res = await fetch(clips[clipIdx].url)
        const decoded = await ctx.decodeAudioData(await res.arrayBuffer())
        cached.set(clipIdx, decoded)
        return decoded
    }

    const slice = (full: AudioBuffer, startS: number, durS: number): AudioBuffer => {
        const sr = full.sampleRate
        const start = Math.floor(startS * sr)
        const n = Math.max(1, Math.min(Math.ceil(durS * sr), full.length - start))
        const out = ctx.createBuffer(full.numberOfChannels, n, sr)
        for (let ch = 0; ch < full.numberOfChannels; ch++) {
            out.getChannelData(ch).set(full.getChannelData(ch).subarray(start, start + n))
        }
        return out
    }

    const toUrl = (buf: AudioBuffer): string => {
        const url = URL.createObjectURL(audioBufferToWavBlob(buf))
        allUrls.push(url)
        return url
    }

    // Find the first melodic sample — fall back to any sample if none are melodic-typed
    let melodicUrl: string | null = null
    const melodicIdx = assignedTypes.findIndex(t => MELODIC_TYPES.has(t))
    const effectiveMelodicIdx = melodicIdx !== -1 ? melodicIdx : (samples.length > 0 ? 0 : -1)
    if (effectiveMelodicIdx !== -1) {
        const s = samples[effectiveMelodicIdx]
        if (s && clips[s.clip_index]) {
            melodicUrl = toUrl(slice(await getBuffer(s.clip_index), s.start_s, s.duration_s))
        }
    }

    // Find drum samples
    const drumUrls: Record<string, string> = {}
    for (const [type, note] of Object.entries(GM_DRUM_NOTES) as [InstrumentType, string][]) {
        const idx = assignedTypes.indexOf(type)
        if (idx !== -1) {
            const s = samples[idx]
            if (s && clips[s.clip_index]) {
                drumUrls[note] = toUrl(slice(await getBuffer(s.clip_index), s.start_s, s.duration_s))
            }
        }
    }

    await ctx.close()
    return { melodicUrl, drumUrls, allUrls }
}

function getTotalDurationS(notes: ParsedNote[]): number {
    return notes.reduce((max, note) => Math.max(max, note.timeS + note.durationS), 0)
}

function triggerDownload(url: string, filename: string) {
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.rel = "noreferrer"
    link.style.display = "none"
    document.body.appendChild(link)
    link.click()
    link.remove()
}

function createSynth(Tone: ToneNamespace) {
    const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.4 },
        volume: -12,
    })
    synth.toDestination()
    return synth
}

async function renderMidiToBuffer(notes: ParsedNote[]): Promise<AudioBuffer> {
    const Tone = await import("tone")
    const totalS = getTotalDurationS(notes)
    const renderDurationS = Math.max(totalS + MP3_TAIL_S, 0.25)
    const events = notes.map(note => ({
        time: note.timeS,
        duration: Math.max(note.durationS, 0.05),
        midi: note.midi,
        velocity: Math.min(Math.max(note.velocity, 0.1), 1),
    }))

    const toneBuffer = await Tone.Offline(({ transport }) => {
        const synth = createSynth(Tone)
        new Tone.Part((time, value) => {
            synth.triggerAttackRelease(
                Tone.Frequency(value.midi, "midi").toNote(),
                value.duration,
                time,
                value.velocity
            )
        }, events).start(0)
        transport.start(0)
    }, renderDurationS)
    return toneBuffer.get()!
}

function isBlack(midi: number) { return BLACK_KEYS.has(midi % 12) }

function paintNotes(ctx: CanvasRenderingContext2D, notes: ParsedNote[], layout: RollLayout, alphaScale: number) {
    const { W, rowH, maxPitch, totalS } = layout
    for (const note of notes) {
        const x = (note.timeS / totalS) * W
        const y = (maxPitch - note.midi) * rowH + 1.5
        const w = Math.max((note.durationS / totalS) * W, 4)
        const h = Math.max(rowH - 3, 4)
        const r = Math.min(h / 2, w / 2, 4)

        ctx.save()
        ctx.shadowBlur = 10
        ctx.shadowColor = noteColor(note.midi, 0.65 * alphaScale)
        ctx.fillStyle = noteColor(note.midi, 0.48 * alphaScale)
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, r)
        ctx.fill()
        ctx.restore()

        ctx.save()
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, r)
        ctx.clip()
        ctx.fillStyle = noteColor(note.midi, 0.5 * alphaScale)
        ctx.fillRect(x, y, w, Math.max(h * 0.28, 2))
        ctx.restore()
    }
}

function drawRoll(canvas: HTMLCanvasElement, notes: ParsedNote[], layout: RollLayout): RollSnapshots {
    const { W, H, rowH, minPitch, maxPitch } = layout

    function makeSnapshot(alphaScale: number): HTMLCanvasElement {
        const c = document.createElement("canvas")
        c.width = W; c.height = H
        const cctx = c.getContext("2d")!
        cctx.fillStyle = "rgba(10,10,16,0.8)"
        cctx.fillRect(0, 0, W, H)
        for (let p = minPitch; p <= maxPitch; p++) {
            const y = (maxPitch - p) * rowH
            if (isBlack(p)) {
                cctx.fillStyle = "rgba(0,0,0,0.18)"
                cctx.fillRect(0, y, W, rowH)
            }
            cctx.fillStyle = "rgba(255,255,255,0.03)"
            cctx.fillRect(0, y + rowH - 1, W, 1)
        }
        paintNotes(cctx, notes, layout, alphaScale)
        return c
    }

    const snapshots: RollSnapshots = { dim: makeSnapshot(DIM_ALPHA), bright: makeSnapshot(1.0) }
    const ctx = canvas.getContext("2d")!
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(snapshots.dim, 0, 0)
    return snapshots
}

function drawPlayhead(ctx: CanvasRenderingContext2D, snapshots: RollSnapshots, layout: RollLayout, progress: number) {
    const playedW = progress * layout.W
    ctx.drawImage(snapshots.dim, 0, 0)
    if (playedW > 0) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, playedW, layout.H)
        ctx.clip()
        ctx.drawImage(snapshots.bright, 0, 0)
        ctx.restore()
    }
    ctx.save()
    ctx.shadowBlur = 8
    ctx.shadowColor = "rgba(0,219,233,0.7)"
    ctx.fillStyle = "rgba(0,219,233,0.9)"
    ctx.fillRect(playedW, 0, 1.5, layout.H)
    ctx.restore()
}

type SamplerPair = { melodic: unknown; percussion: unknown }

export function MidiPlayer({ midiUrl, clips, samples, assignedTypes }: {
    midiUrl: string
    clips?: Clip[]
    samples?: Sample[]
    assignedTypes?: InstrumentType[]
}) {
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0)
    const [durationMs, setDurationMs] = useState(0)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [mp3Url, setMp3Url] = useState<string | null>(null)
    const [isConverting, setIsConverting] = useState(false)
    const [convertError, setConvertError] = useState<string | null>(null)
    const [samplersLoading, setSamplersLoading] = useState(false)
    const [samplersReady, setSamplersReady] = useState(false)

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const notesRef = useRef<ParsedNote[]>([])
    const rollLayoutRef = useRef<RollLayout | null>(null)
    const snapshotRef = useRef<RollSnapshots | null>(null)
    const synthRef = useRef<unknown>(null)
    const samplersRef = useRef<SamplerPair | null>(null)
    const samplerUrlsRef = useRef<string[]>([])
    const rafRef = useRef<number>(0)
    const progressRef = useRef(0)
    progressRef.current = progress
    const autoDownloadRef = useRef(false)
    const autoConvertRef = useRef(false)
    const mountedRef = useRef(true)

    useEffect(() => () => { mountedRef.current = false }, [])

    // Load MIDI
    useEffect(() => {
        const controller = new AbortController()
        setStatus("loading")
        setProgress(0)
        setIsPlaying(false)
        setErrorMsg(null)
        setMp3Url(null)
        setIsConverting(false)
        setConvertError(null)
        setSamplersReady(false)
        autoDownloadRef.current = false
        autoConvertRef.current = false

        ;(async () => {
            try {
                const res = await fetch(midiUrl, { signal: controller.signal })
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const buf = await res.arrayBuffer()
                const { Midi } = await import("@tonejs/midi")
                const midi = new Midi(buf)
                const notes: ParsedNote[] = []
                for (const track of midi.tracks) {
                    const channel = track.channel ?? 0
                    for (const note of track.notes) {
                        notes.push({
                            midi: note.midi,
                            timeS: note.time,
                            durationS: note.duration,
                            velocity: note.velocity ?? 0.8,
                            channel,
                        })
                    }
                }
                if (notes.length === 0) throw new Error("No notes found in MIDI file")
                const totalDuration = notes.reduce((m, n) => Math.max(m, n.timeS + n.durationS), 0)
                notesRef.current = notes
                setDurationMs(totalDuration * 1000)
                setStatus("ready")
            } catch (e: unknown) {
                if (e instanceof Error && e.name === "AbortError") return
                setErrorMsg(e instanceof Error ? e.message : "Failed to load MIDI")
                setStatus("error")
            }
        })()

        return () => { controller.abort() }
    }, [midiUrl])

    // Load samplers from recorded clips once MIDI is ready
    useEffect(() => {
        if (status !== "ready") return
        if (!clips?.length || !samples?.length || !assignedTypes?.length) return

        let cancelled = false
        setSamplersLoading(true)
        setSamplersReady(false)

        buildSamplerData(clips, samples, assignedTypes).then(async ({ melodicUrl, drumUrls, allUrls }) => {
            if (cancelled) { allUrls.forEach(u => URL.revokeObjectURL(u)); return }

            const Tone = await import("tone")

            // Dispose previous samplers
            const prev = samplersRef.current
            if (prev) {
                (prev.melodic as { dispose?: () => void })?.dispose?.()
                ;(prev.percussion as { dispose?: () => void })?.dispose?.()
            }
            samplerUrlsRef.current.forEach(u => URL.revokeObjectURL(u))
            samplerUrlsRef.current = allUrls

            const next: SamplerPair = { melodic: null, percussion: null }
            const loadPromises: Promise<void>[] = []

            if (melodicUrl) {
                loadPromises.push(new Promise<void>((resolve, reject) => {
                    next.melodic = new Tone.Sampler({
                        urls: { "C4": melodicUrl },
                        release: 0.8,
                        onload: resolve,
                        onerror: (e: Error) => reject(e),
                    }).toDestination()
                }))
            }
            if (Object.keys(drumUrls).length > 0) {
                loadPromises.push(new Promise<void>((resolve, reject) => {
                    next.percussion = new Tone.Sampler({
                        urls: drumUrls,
                        release: 0.3,
                        onload: resolve,
                        onerror: (e: Error) => reject(e),
                    }).toDestination()
                }))
            }

            await Promise.all(loadPromises)
            if (!cancelled && mountedRef.current) {
                samplersRef.current = next
                setSamplersLoading(false)
                setSamplersReady(true)
            }
        }).catch((e) => {
            console.error("[MidiPlayer] sampler load failed:", e)
            if (!cancelled && mountedRef.current) setSamplersLoading(false)
        })

        return () => { cancelled = true }
    }, [status, clips, samples, assignedTypes])

    useEffect(() => () => {
        if (mp3Url) URL.revokeObjectURL(mp3Url)
    }, [mp3Url])

    const convertToMp3 = useCallback(async (autoDownload: boolean) => {
        if (isConverting || notesRef.current.length === 0) return
        setIsConverting(true)
        setConvertError(null)

        try {
            const buffer = await renderMidiToBuffer(notesRef.current)
            if (!mountedRef.current) return
            const blob = audioBufferToMp3(buffer)
            if (!mountedRef.current) return
            const nextUrl = URL.createObjectURL(blob)
            setMp3Url(nextUrl)
            if (autoDownload && !autoDownloadRef.current) {
                triggerDownload(nextUrl, MP3_FILENAME)
                autoDownloadRef.current = true
            }
        } catch (e: unknown) {
            if (!mountedRef.current) return
            setConvertError(e instanceof Error ? e.message : "Failed to render MP3")
        } finally {
            if (mountedRef.current) setIsConverting(false)
        }
    }, [isConverting])

    useEffect(() => {
        if (status !== "ready") return
        if (autoConvertRef.current) return
        if (notesRef.current.length === 0) return
        autoConvertRef.current = true
        void convertToMp3(true)
    }, [status, midiUrl, convertToMp3])

    // Draw piano roll
    const redraw = useCallback(() => {
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container || notesRef.current.length === 0) return
        const dpr = window.devicePixelRatio || 1
        const cssW = container.offsetWidth
        const W = Math.round(cssW * dpr)
        const H = Math.round(CANVAS_HEIGHT_PX * dpr)
        canvas.width = W; canvas.height = H
        canvas.style.width = `${cssW}px`
        canvas.style.height = `${CANVAS_HEIGHT_PX}px`

        const notes = notesRef.current
        const minPitch = notes.reduce((m, n) => Math.min(m, n.midi), 127) - PITCH_PAD
        const maxPitch = notes.reduce((m, n) => Math.max(m, n.midi), 0) + PITCH_PAD
        const rowH = H / (maxPitch - minPitch + 1)
        const totalS = notes.reduce((m, n) => Math.max(m, n.timeS + n.durationS), 0)

        const layout: RollLayout = { minPitch, maxPitch, totalS, W, H, rowH, dpr }
        rollLayoutRef.current = layout
        snapshotRef.current = drawRoll(canvas, notes, layout)

        if (progressRef.current > 0) {
            drawPlayhead(canvas.getContext("2d")!, snapshotRef.current, layout, progressRef.current)
        }
    }, [])

    useEffect(() => {
        if (status !== "ready") return
        redraw()
        const observer = new ResizeObserver(redraw)
        if (containerRef.current) observer.observe(containerRef.current)
        return () => observer.disconnect()
    }, [status, redraw])

    // rAF playhead loop
    useEffect(() => {
        if (!isPlaying) { cancelAnimationFrame(rafRef.current); return }
        const canvas = canvasRef.current
        if (!canvas) return

        async function tick() {
            const Tone = await import("tone")
            const layout = rollLayoutRef.current
            const snapshot = snapshotRef.current
            if (!layout || !snapshot || !canvas) return
            const ctx = canvas.getContext("2d")!
            const pos = Tone.getTransport().seconds / layout.totalS
            const clamped = Math.min(pos, 1)
            setProgress(clamped)
            drawPlayhead(ctx, snapshot, layout, clamped)
            if (clamped < 1) {
                rafRef.current = requestAnimationFrame(tick)
            } else {
                setIsPlaying(false)
                setProgress(0)
                Tone.getTransport().stop()
                Tone.getTransport().seconds = 0
                snapshotRef.current && ctx.drawImage(snapshotRef.current.dim, 0, 0)
            }
        }

        rafRef.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(rafRef.current)
    }, [isPlaying])

    // Teardown
    useEffect(() => {
        return () => {
            cancelAnimationFrame(rafRef.current)
            import("tone").then(Tone => { Tone.getTransport().stop(); Tone.getTransport().cancel() })
            ;(synthRef.current as { dispose?: () => void } | null)?.dispose?.()
            synthRef.current = null
            const s = samplersRef.current
            if (s) {
                (s.melodic as { dispose?: () => void })?.dispose?.()
                ;(s.percussion as { dispose?: () => void })?.dispose?.()
            }
            samplerUrlsRef.current.forEach(u => URL.revokeObjectURL(u))
        }
    }, [])

    const startPlayback = async () => {
        if (typeof window === "undefined") return
        const layout = rollLayoutRef.current
        if (!layout) return

        const Tone = await import("tone")
        await Tone.start()

        if (!synthRef.current) {
            synthRef.current = createSynth(Tone)
        }

        const transport = Tone.getTransport()
        transport.cancel()
        transport.stop()

        const offsetS = progressRef.current * layout.totalS
        transport.seconds = offsetS

        const notes = notesRef.current
        const synth = synthRef.current as InstanceType<typeof Tone.PolySynth>
        const samplers = samplersRef.current

        for (const note of notes) {
            if (note.timeS + note.durationS <= offsetS) continue
            const startDelay = Math.max(note.timeS - offsetS, 0)
            transport.schedule((time) => {
                const noteStr = Tone.Frequency(note.midi, "midi").toNote()
                const dur = Math.max(note.durationS - Math.max(offsetS - note.timeS, 0), 0.05)
                const vel = Math.min(Math.max(note.velocity, 0.1), 1)

                const sampler = (note.channel === 9
                    ? samplers?.percussion
                    : samplers?.melodic) as InstanceType<typeof Tone.Sampler> | null | undefined

                if (sampler) {
                    sampler.triggerAttackRelease(noteStr, dur, time, vel)
                } else {
                    synth.triggerAttackRelease(noteStr, dur, time, vel)
                }
            }, `+${startDelay}`)
        }

        transport.start()
        setIsPlaying(true)
    }

    const pausePlayback = async () => {
        const Tone = await import("tone")
        Tone.getTransport().pause()
        setIsPlaying(false)
    }

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const canvas = canvasRef.current
        const layout = rollLayoutRef.current
        const snapshot = snapshotRef.current
        if (!canvas || !layout || !snapshot) return
        const rect = e.currentTarget.getBoundingClientRect()
        const ratio = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1))
        setProgress(ratio)
        drawPlayhead(canvas.getContext("2d")!, snapshot, layout, ratio)
        if (isPlaying) {
            import("tone").then(Tone => { Tone.getTransport().seconds = ratio * layout.totalS })
        }
    }

    const currentMs = Math.round(progress * durationMs)

    return (
        <div
            className="w-full rounded-2xl overflow-hidden flex flex-col"
            style={{
                background: "rgba(167,100,255,0.13)",
                border: "1px solid rgba(167,100,255,0.18)",
                boxShadow: "0 8px 40px rgba(167,100,255,0.10), 0 0 0 1px rgba(167,100,255,0.04) inset",
            }}
        >
            <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: "1px solid rgba(167,100,255,0.08)" }}
            >
                <span className="monoMd text-violet">Generated Midi</span>
                <div className="flex items-center gap-3">
                    {samplersLoading && (
                        <span className="monoSm" style={{ color: "rgba(0,219,233,0.55)", fontSize: "10px" }}>
                            LOADING SAMPLES...
                        </span>
                    )}
                    {samplersReady && !samplersLoading && (
                        <span className="monoSm" style={{ color: "rgba(0,219,233,0.55)", fontSize: "10px" }}>
                            USING YOUR SAMPLES
                        </span>
                    )}
                    {status === "ready" && (
                        <span className="monoSm" style={{ color: "rgba(167,100,255,0.8)", fontSize: "10px" }}>
                            {formatTime(currentMs)}&thinsp;/&thinsp;{formatTime(durationMs)}
                        </span>
                    )}
                </div>
            </div>

            {status === "loading" && (
                <div className="flex flex-col items-center justify-center gap-4 py-16">
                    <div className="flex items-center gap-2.5">
                        {[0, 1, 2, 3].map(i => (
                            <motion.div
                                key={i}
                                className="w-1 rounded-full"
                                style={{ background: "rgba(0,219,233,0.7)", height: `${10 + i * 4}px` }}
                                animate={{ scaleY: [0.4, 1, 0.4] }}
                                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                            />
                        ))}
                    </div>
                    <span className="monoMd text-violet">PARSING MIDI...</span>
                </div>
            )}

            {status === "error" && (
                <div className="flex items-center gap-2 py-12 justify-center">
                    <span style={{ color: "rgba(255,80,80,0.7)" }}><MatIcon name="error" size="1rem" /></span>
                    <span className="monoSm" style={{ color: "rgba(255,80,80,0.7)" }}>{errorMsg}</span>
                </div>
            )}

            {status === "ready" && (
                <>
                    <div
                        ref={containerRef}
                        className="relative cursor-crosshair w-full"
                        onClick={handleSeek}
                    >
                        <canvas ref={canvasRef} style={{ display: "block" }} />
                    </div>

                    <div
                        className="flex items-center justify-center px-6 py-4"
                        style={{ borderTop: "1px solid rgba(0,219,233,0.06)" }}
                    >
                        <motion.button
                            onClick={isPlaying ? pausePlayback : startPlayback}
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            className="w-12 h-12 rounded-full flex items-center justify-center focus:outline-none"
                            style={{
                                background: isPlaying ? "rgba(255,80,80,0.10)" : "rgba(167,100,255,0.13)",
                                border: isPlaying ? "1px solid rgba(255,80,80,0.45)" : "1px solid rgba(167,100,255,0.5)",
                                boxShadow: isPlaying
                                    ? "0 0 24px rgba(255,80,80,0.18), inset 0 1px 0 rgba(255,255,255,0.07)"
                                    : "0 0 24px rgba(167,100,255,0.20), inset 0 1px 0 rgba(255,255,255,0.07)",
                                color: isPlaying ? "rgba(255,110,110,0.9)" : "rgba(167,100,255,0.9)",
                            }}
                        >
                            <MatIcon name={isPlaying ? "pause" : "play_arrow"} size="1.4rem" />
                        </motion.button>
                    </div>

                    <div
                        className="flex items-center justify-between gap-3 px-6 pb-5"
                        style={{ borderTop: "1px solid rgba(167,100,255,0.08)" }}
                    >
                        <div className="flex items-center gap-2">
                            <span className="monoSm text-violet">MP3 Export</span>
                            {isConverting && <span className="monoSm" style={{ color: "rgba(0,219,233,0.7)" }}>RENDERING...</span>}
                            {convertError && <span className="monoSm" style={{ color: "rgba(255,80,80,0.7)" }}>{convertError}</span>}
                            {mp3Url && !isConverting && !convertError && <span className="monoSm" style={{ color: "rgba(0,219,233,0.7)" }}>READY</span>}
                        </div>
                        {mp3Url ? (
                            <motion.a
                                href={mp3Url} download={MP3_FILENAME}
                                whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-full focus:outline-none monoSm"
                                style={{ border: "1px solid rgba(0,219,233,0.55)", color: "rgba(0,219,233,0.85)", background: "rgba(0,219,233,0.08)" }}
                            >
                                <MatIcon name="download" size="0.9rem" />DOWNLOAD MP3
                            </motion.a>
                        ) : (
                            <motion.button
                                onClick={() => convertToMp3(true)}
                                whileHover={isConverting ? {} : { scale: 1.04 }}
                                whileTap={isConverting ? {} : { scale: 0.96 }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-full focus:outline-none monoSm"
                                style={{
                                    border: "1px solid rgba(167,100,255,0.55)",
                                    color: "rgba(167,100,255,0.85)",
                                    background: "rgba(167,100,255,0.08)",
                                    opacity: isConverting ? 0.6 : 1,
                                    cursor: isConverting ? "default" : "pointer",
                                }}
                                disabled={isConverting}
                            >
                                <MatIcon name="graphic_eq" size="0.9rem" />
                                {convertError ? "RETRY MP3" : "EXPORT MP3"}
                            </motion.button>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

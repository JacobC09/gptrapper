"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { motion } from "motion/react"
import { formatTime } from "@/lib/audio"
import { MatIcon } from "@/components/MatIcon"
import lamejs from "lamejs"

type ToneNamespace = typeof import("tone")

type ParsedNote = { midi: number; timeS: number; durationS: number; velocity: number }

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
    [0,   219, 233],   // Primary cyan
    [100, 150, 255],   // Light blue
    [180,  80, 255],   // Purple
    [255,  60, 180],   // Magenta
]

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
    return new Blob(mp3Data, { type: "audio/mpeg" })
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

    return Tone.Offline(({ transport }) => {
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

export function MidiPlayer({ midiUrl }: { midiUrl: string }) {
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0)
    const [durationMs, setDurationMs] = useState(0)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [mp3Url, setMp3Url] = useState<string | null>(null)
    const [isConverting, setIsConverting] = useState(false)
    const [convertError, setConvertError] = useState<string | null>(null)

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const notesRef = useRef<ParsedNote[]>([])
    const rollLayoutRef = useRef<RollLayout | null>(null)
    const snapshotRef = useRef<RollSnapshots | null>(null)
    const synthRef = useRef<unknown>(null)
    const rafRef = useRef<number>(0)
    const progressRef = useRef(0)
    progressRef.current = progress
    const autoDownloadRef = useRef(false)
    const autoConvertRef = useRef(false)
    const mountedRef = useRef(true)

    useEffect(() => () => {
        mountedRef.current = false
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        setStatus("loading")
        setProgress(0)
        setIsPlaying(false)
        setErrorMsg(null)
        setMp3Url(null)
        setIsConverting(false)
        setConvertError(null)
        autoDownloadRef.current = false
        autoConvertRef.current = false

        (async () => {
            try {
                const res = await fetch(midiUrl, { signal: controller.signal })
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const buf = await res.arrayBuffer()
                const { Midi } = await import("@tonejs/midi")
                const midi = new Midi(buf)
                const notes: ParsedNote[] = []
                for (const track of midi.tracks) {
                    for (const note of track.notes) {
                        notes.push({
                            midi: note.midi,
                            timeS: note.time,
                            durationS: note.duration,
                            velocity: note.velocity ?? 0.8,
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

    // Effect 2: Draw piano roll when ready, and on resize
    const redraw = useCallback(() => {
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container || notesRef.current.length === 0) return
        const dpr = window.devicePixelRatio || 1
        const cssW = container.offsetWidth
        const cssH = CANVAS_HEIGHT_PX
        const W = Math.round(cssW * dpr)
        const H = Math.round(cssH * dpr)
        canvas.width = W
        canvas.height = H
        canvas.style.width = `${cssW}px`
        canvas.style.height = `${cssH}px`

        const notes = notesRef.current
        const minPitch = notes.reduce((m, n) => Math.min(m, n.midi), 127) - PITCH_PAD
        const maxPitch = notes.reduce((m, n) => Math.max(m, n.midi), 0) + PITCH_PAD
        const pitchRange = maxPitch - minPitch + 1
        const rowH = H / pitchRange
        const totalS = notes.reduce((m, n) => Math.max(m, n.timeS + n.durationS), 0)

        const layout: RollLayout = { minPitch, maxPitch, totalS, W, H, rowH, dpr }
        rollLayoutRef.current = layout
        snapshotRef.current = drawRoll(canvas, notes, layout)

        // Restore playhead if mid-song
        if (progressRef.current > 0) {
            const ctx = canvas.getContext("2d")!
            drawPlayhead(ctx, snapshotRef.current, layout, progressRef.current)
        }
    }, [])

    useEffect(() => {
        if (status !== "ready") return
        redraw()
        const observer = new ResizeObserver(redraw)
        if (containerRef.current) observer.observe(containerRef.current)
        return () => observer.disconnect()
    }, [status, redraw])

    // Effect 3: rAF playhead loop
    useEffect(() => {
        if (!isPlaying) {
            cancelAnimationFrame(rafRef.current)
            return
        }
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
                // Redraw without playhead
                snapshotRef.current && ctx.drawImage(snapshotRef.current.dim, 0, 0)
            }
        }

        rafRef.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(rafRef.current)
    }, [isPlaying])

    // Effect 4: Teardown
    useEffect(() => {
        return () => {
            cancelAnimationFrame(rafRef.current)
            import("tone").then(Tone => {
                Tone.getTransport().stop()
                Tone.getTransport().cancel()
            })
            const s = synthRef.current as { dispose?: () => void } | null
            s?.dispose?.()
            synthRef.current = null
        }
    }, [])

    const startPlayback = async () => {
        if (typeof window === "undefined") return
        const layout = rollLayoutRef.current
        if (!layout) return

        const Tone = await import("tone")
        await Tone.start()

        if (!synthRef.current) {
            const synth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" },
                envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.4 },
                volume: -12,
            })
            synth.toDestination()
            synthRef.current = synth
        }

        const transport = Tone.getTransport()
        transport.cancel()
        transport.stop()

        const offsetS = progressRef.current * layout.totalS
        transport.seconds = offsetS

        const notes = notesRef.current
        const synth = synthRef.current as InstanceType<typeof Tone.PolySynth>

        for (const note of notes) {
            if (note.timeS + note.durationS <= offsetS) continue
            const startDelay = Math.max(note.timeS - offsetS, 0)
            const noteStart = `+${startDelay}`
            transport.schedule((time) => {
                synth.triggerAttackRelease(
                    Tone.Frequency(note.midi, "midi").toNote(),
                    Math.max(note.durationS - Math.max(offsetS - note.timeS, 0), 0.05),
                    time
                )
            }, noteStart)
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
        const ctx = canvas.getContext("2d")!
        drawPlayhead(ctx, snapshot, layout, ratio)

        if (isPlaying) {
            import("tone").then(Tone => {
                Tone.getTransport().seconds = ratio * layout.totalS
            })
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
                <div className="flex items-center gap-2">
                    <span className="monoMd text-violet">Generated Midi</span>
                </div>
                {status === "ready" && (
                    <span className="monoSm" style={{ color: "rgba(167,100,255)", fontSize: "10px" }}>
                        {formatTime(currentMs)}&thinsp;/&thinsp;{formatTime(durationMs)}
                    </span>
                )}
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
                            {isConverting && (
                                <span className="monoSm" style={{ color: "rgba(0,219,233,0.7)" }}>RENDERING...</span>
                            )}
                            {convertError && (
                                <span className="monoSm" style={{ color: "rgba(255,80,80,0.7)" }}>{convertError}</span>
                            )}
                            {mp3Url && !isConverting && !convertError && (
                                <span className="monoSm" style={{ color: "rgba(0,219,233,0.7)" }}>READY</span>
                            )}
                        </div>

                        {mp3Url ? (
                            <motion.a
                                href={mp3Url}
                                download={MP3_FILENAME}
                                whileHover={{ scale: 1.06 }}
                                whileTap={{ scale: 0.94 }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-full focus:outline-none monoSm"
                                style={{
                                    border: "1px solid rgba(0,219,233,0.55)",
                                    color: "rgba(0,219,233,0.85)",
                                    background: "rgba(0,219,233,0.08)",
                                }}
                            >
                                <MatIcon name="download" size="0.9rem" />
                                DOWNLOAD MP3
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

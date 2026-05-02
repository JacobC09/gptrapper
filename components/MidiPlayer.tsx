"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { motion } from "motion/react"
import { formatTime, parseMidiNotes } from "@/lib/audio"
import type { ParsedNote } from "@/lib/audio"
import { MatIcon } from "@/components/MatIcon"

type RollLayout = {
    totalS: number
    W: number
    H: number
    rowH: number
    dpr: number
    pitchToRow: Map<number, number>
    numRows: number
}

const CANVAS_HEIGHT_PX = 500
const DIM_ALPHA = 0.28

type RollSnapshots = { dim: HTMLCanvasElement; bright: HTMLCanvasElement }

// Gradient: cyan → blue → purple → pink across all rows (top = high pitch)
function rowColor(rowIndex: number, numRows: number, alpha: number): string {
    const t = numRows > 1 ? rowIndex / (numRows - 1) : 0.5
    const stops: Array<[number, [number, number, number]]> = [
        [0,    [0,   219, 233]],
        [0.35, [80,  140, 255]],
        [0.65, [167, 100, 255]],
        [1.0,  [255,  60, 180]],
    ]
    let i = stops.findIndex(([s]) => t <= s)
    if (i <= 0) i = 1
    const [t0, c0] = stops[i - 1]
    const [t1, c1] = stops[i]
    const s = (t1 - t0) > 0 ? (t - t0) / (t1 - t0) : 0
    const r = Math.round(c0[0] + s * (c1[0] - c0[0]))
    const g = Math.round(c0[1] + s * (c1[1] - c0[1]))
    const b = Math.round(c0[2] + s * (c1[2] - c0[2]))
    return `rgba(${r},${g},${b},${alpha})`
}

function paintNotes(ctx: CanvasRenderingContext2D, notes: ParsedNote[], layout: RollLayout, alphaScale: number) {
    const { W, rowH, totalS, pitchToRow, numRows } = layout
    for (const note of notes) {
        const row = pitchToRow.get(note.midi) ?? 0
        const x = (note.timeS / totalS) * W
        const y = row * rowH + 2
        const w = Math.max((note.durationS / totalS) * W, 6)
        const h = Math.max(rowH - 4, 6)
        const rad = Math.min(h / 2, w / 2, 5)
        const col = rowColor(row, numRows, alphaScale)
        const glow = rowColor(row, numRows, 0.7 * alphaScale)

        ctx.save()
        ctx.shadowBlur = 18
        ctx.shadowColor = glow
        ctx.fillStyle = rowColor(row, numRows, 0.55 * alphaScale)
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, rad)
        ctx.fill()
        ctx.restore()

        // top-edge highlight shimmer
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, rad)
        ctx.clip()
        ctx.fillStyle = col
        ctx.globalAlpha = 0.45 * alphaScale
        ctx.fillRect(x, y, w, Math.max(h * 0.3, 3))
        ctx.restore()
    }
}

function drawRoll(canvas: HTMLCanvasElement, notes: ParsedNote[], layout: RollLayout): RollSnapshots {
    const { W, H, rowH, numRows, totalS } = layout

    function makeSnapshot(alphaScale: number): HTMLCanvasElement {
        const c = document.createElement("canvas")
        c.width = W; c.height = H
        const cctx = c.getContext("2d")!

        // Background
        cctx.fillStyle = "rgba(8,8,14,0.92)"
        cctx.fillRect(0, 0, W, H)

        // Row lanes with alternating subtle tint
        for (let row = 0; row < numRows; row++) {
            const y = row * rowH
            if (row % 2 === 1) {
                cctx.fillStyle = "rgba(255,255,255,0.018)"
                cctx.fillRect(0, y, W, rowH)
            }
            // Row separator
            cctx.fillStyle = "rgba(255,255,255,0.04)"
            cctx.fillRect(0, y + rowH - 1, W, 1)
        }

        // Vertical beat grid — 8 divisions
        const numDivs = 8
        for (let i = 1; i < numDivs; i++) {
            const x = Math.round((i / numDivs) * W)
            const isMajor = i % 2 === 0
            cctx.fillStyle = isMajor ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.025)"
            cctx.fillRect(x, 0, 1, H)
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
    ctx.shadowBlur = 16
    ctx.shadowColor = "rgba(0,219,233,0.9)"
    ctx.fillStyle = "rgba(0,219,233,0.95)"
    ctx.fillRect(playedW, 0, 2, layout.H)
    ctx.restore()
}

export function MidiPlayer({ midiUrl, audioUrl }: { midiUrl: string; audioUrl?: string }) {
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0)
    const [durationMs, setDurationMs] = useState(0)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const audioRef = useRef<HTMLAudioElement>(null)
    const notesRef = useRef<ParsedNote[]>([])
    const rollLayoutRef = useRef<RollLayout | null>(null)
    const snapshotRef = useRef<RollSnapshots | null>(null)
    const rafRef = useRef<number>(0)
    const progressRef = useRef(0)
    const audioDurationSRef = useRef(0)
    progressRef.current = progress

    // Parse MIDI for the piano roll visualization
    useEffect(() => {
        const controller = new AbortController()
        setStatus("loading")
        setProgress(0)
        setIsPlaying(false)
        setErrorMsg(null)

        void (async () => {
            try {
                const res = await fetch(midiUrl, { signal: controller.signal })
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const buf = await res.arrayBuffer()
                const notes = await parseMidiNotes(buf)
                if (notes.length === 0) throw new Error("No notes found in MIDI file")
                notesRef.current = notes
                if (!audioUrl) {
                    const totalDuration = notes.reduce((m, n) => Math.max(m, n.timeS + n.durationS), 0)
                    setDurationMs(totalDuration * 1000)
                }
                setStatus("ready")
            } catch (e: unknown) {
                if (e instanceof Error && e.name === "AbortError") return
                setErrorMsg(e instanceof Error ? e.message : "Failed to load MIDI")
                setStatus("error")
            }
        })()

        return () => { controller.abort() }
    }, [midiUrl, audioUrl])

    // Draw piano roll on ready / resize
    const redraw = useCallback(() => {
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container || notesRef.current.length === 0) return
        const dpr = window.devicePixelRatio || 1
        const cssW = container.offsetWidth
        const W = Math.round(cssW * dpr)
        const H = Math.round(CANVAS_HEIGHT_PX * dpr)
        canvas.width = W
        canvas.height = H
        canvas.style.width = `${cssW}px`
        canvas.style.height = `${CANVAS_HEIGHT_PX}px`

        const notes = notesRef.current

        // Sparse layout: only allocate rows for pitches that have at least one note.
        // Sort descending so row 0 = highest pitch (top of canvas).
        const uniquePitches = [...new Set(notes.map(n => n.midi))].sort((a, b) => b - a)
        const pitchToRow = new Map(uniquePitches.map((p, i) => [p, i]))
        const numRows = Math.max(uniquePitches.length, 1)
        const rowH = H / numRows

        const midiTotalS = notes.reduce((m, n) => Math.max(m, n.timeS + n.durationS), 0)
        // Use the WAV duration as the timeline reference so note positions stay in sync with audio playback
        const totalS = audioUrl && audioDurationSRef.current > 0 ? audioDurationSRef.current : midiTotalS

        const layout: RollLayout = { totalS, W, H, rowH, dpr, pitchToRow, numRows }
        rollLayoutRef.current = layout
        snapshotRef.current = drawRoll(canvas, notes, layout)

        if (progressRef.current > 0) {
            const ctx = canvas.getContext("2d")!
            drawPlayhead(ctx, snapshotRef.current, layout, progressRef.current)
        }
    }, [audioUrl])

    // Get duration from audio element when audioUrl is provided.
    // Runs after status="ready" so the <audio> element is in the DOM.
    useEffect(() => {
        if (!audioUrl || status !== "ready") return
        const audio = audioRef.current
        if (!audio) return
        const onMeta = () => {
            audioDurationSRef.current = audio.duration
            setDurationMs(audio.duration * 1000)
            // Re-draw now that we know the real audio duration so note positions align
            redraw()
        }
        audio.addEventListener("loadedmetadata", onMeta)
        if (!isNaN(audio.duration) && audio.duration > 0) {
            audioDurationSRef.current = audio.duration
            setDurationMs(audio.duration * 1000)
            redraw()
        }
        return () => audio.removeEventListener("loadedmetadata", onMeta)
    }, [audioUrl, status, redraw])

    useEffect(() => {
        if (status !== "ready") return
        redraw()
        const observer = new ResizeObserver(redraw)
        if (containerRef.current) observer.observe(containerRef.current)
        return () => observer.disconnect()
    }, [status, redraw])

    // rAF playhead loop
    useEffect(() => {
        if (!isPlaying) {
            cancelAnimationFrame(rafRef.current)
            return
        }
        const canvas = canvasRef.current
        if (!canvas) return

        const tick = () => {
            const layout = rollLayoutRef.current
            const snapshot = snapshotRef.current
            if (!layout || !snapshot) return
            const ctx = canvas.getContext("2d")!

            let pos: number
            if (audioUrl && audioRef.current) {
                const audio = audioRef.current
                pos = audio.duration ? audio.currentTime / audio.duration : 0
            } else {
                // Tone.js path (unused when audioUrl is set)
                pos = progressRef.current
            }

            const clamped = Math.min(pos, 1)
            setProgress(clamped)
            drawPlayhead(ctx, snapshot, layout, clamped)

            if (clamped < 1) {
                rafRef.current = requestAnimationFrame(tick)
            } else {
                setIsPlaying(false)
                setProgress(0)
                snapshot && ctx.drawImage(snapshot.dim, 0, 0)
            }
        }

        rafRef.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(rafRef.current)
    }, [isPlaying, audioUrl])

    // Teardown
    useEffect(() => {
        return () => {
            cancelAnimationFrame(rafRef.current)
            if (!audioUrl) {
                import("tone").then(Tone => {
                    try {
                        Tone.getTransport().stop()
                        Tone.getTransport().cancel()
                    } catch { /* already torn down */ }
                })
            }
        }
    }, [audioUrl])

    const startPlayback = async () => {
        const layout = rollLayoutRef.current
        if (!layout) return

        if (audioUrl && audioRef.current) {
            const audio = audioRef.current
            audio.currentTime = progressRef.current * audio.duration
            await audio.play()
            setIsPlaying(true)
            return
        }

        // Tone.js fallback (no audioUrl)
        const Tone = await import("tone")
        await Tone.start()
        const transport = Tone.getTransport()
        transport.cancel()
        transport.stop()
        const offsetS = progressRef.current * layout.totalS
        transport.seconds = offsetS
        const notes = notesRef.current
        const synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.4 },
            volume: -12,
        })
        synth.toDestination()
        for (const note of notes) {
            if (note.timeS + note.durationS <= offsetS) continue
            const startDelay = Math.max(note.timeS - offsetS, 0)
            transport.schedule((time) => {
                synth.triggerAttackRelease(
                    Tone.Frequency(note.midi, "midi").toNote(),
                    Math.max(note.durationS - Math.max(offsetS - note.timeS, 0), 0.05),
                    time
                )
            }, `+${startDelay}`)
        }
        transport.start()
        setIsPlaying(true)
    }

    const pausePlayback = async () => {
        if (audioUrl && audioRef.current) {
            audioRef.current.pause()
            setIsPlaying(false)
            return
        }
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

        if (audioUrl && audioRef.current) {
            audioRef.current.currentTime = ratio * audioRef.current.duration
        } else if (isPlaying) {
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
                background: "rgba(10,8,18,0.96)",
                border: "1px solid rgba(167,100,255,0.22)",
                boxShadow: "0 12px 60px rgba(167,100,255,0.15), 0 0 0 1px rgba(167,100,255,0.06) inset, 0 0 120px rgba(0,219,233,0.04) inset",
            }}
        >
            <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: "1px solid rgba(167,100,255,0.10)" }}
            >
                <div className="flex items-center gap-2">
                    <span className="monoSm uppercase tracking-[0.22em]" style={{ color: "rgba(167,100,255,0.5)", fontSize: "9px" }}>MIDI Roll</span>
                </div>
                {status === "ready" && (
                    <span className="monoSm" style={{ color: "rgba(167,100,255,0.55)", fontSize: "9px", letterSpacing: "0.12em" }}>
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
                    {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" />}

                    <div
                        ref={containerRef}
                        className="relative cursor-crosshair w-full"
                        onClick={handleSeek}
                    >
                        <canvas ref={canvasRef} style={{ display: "block" }} />
                    </div>

                    <div
                        className="flex items-center justify-center px-6 py-5"
                        style={{ borderTop: "1px solid rgba(167,100,255,0.08)" }}
                    >
                        <motion.button
                            onClick={isPlaying ? pausePlayback : startPlayback}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="w-14 h-14 rounded-full flex items-center justify-center focus:outline-none"
                            style={{
                                background: isPlaying ? "rgba(255,80,80,0.10)" : "rgba(167,100,255,0.16)",
                                border: isPlaying ? "1px solid rgba(255,80,80,0.5)" : "1px solid rgba(167,100,255,0.6)",
                                boxShadow: isPlaying
                                    ? "0 0 32px rgba(255,80,80,0.22), inset 0 1px 0 rgba(255,255,255,0.08)"
                                    : "0 0 32px rgba(167,100,255,0.28), 0 0 60px rgba(167,100,255,0.10), inset 0 1px 0 rgba(255,255,255,0.08)",
                                color: isPlaying ? "rgba(255,110,110,0.95)" : "rgba(167,100,255,0.95)",
                            }}
                        >
                            <MatIcon name={isPlaying ? "pause" : "play_arrow"} size="1.6rem" />
                        </motion.button>
                    </div>

                    {audioUrl && (
                        <div
                            className="flex items-center justify-between gap-3 px-6 pb-5"
                            style={{ borderTop: "1px solid rgba(167,100,255,0.08)" }}
                        >
                            <span className="monoSm text-violet">Your Beat</span>
                            <motion.a
                                href={audioUrl}
                                download="beat.wav"
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
                                DOWNLOAD WAV
                            </motion.a>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

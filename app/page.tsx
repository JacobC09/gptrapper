"use client"

import { useState, useRef, useCallback, useEffect, memo } from "react"
import { motion, AnimatePresence } from "motion/react"

import { toast } from "sonner"

type Clip = {
    id: string
    url: string
    bars: number[]
    durationMs: number
    ext: string
}

const BAR_COUNT = 50

const monoSm: React.CSSProperties = { font: "10px/1 'Courier New', monospace", letterSpacing: "0.12em" }
const monoMd: React.CSSProperties = { font: "11px/1 'Courier New', monospace", letterSpacing: "0.1em" }

function formatTime(ms: number): string {
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    const cs = Math.floor((ms % 1000) / 10)
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`
}

function extFromMime(mime: string): string {
    if (mime.includes("ogg")) return "ogg"
    if (mime.includes("mp4")) return "mp4"
    return "webm"
}

function drawWaveform(canvas: HTMLCanvasElement, bars: number[]) {
    const ctx = canvas.getContext("2d")!
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)
    if (bars.length === 0) return
    const count = Math.min(bars.length, W)
    const step = bars.length / count
    const bw = Math.max((W / count) * 0.75, 1)
    ctx.fillStyle = "rgba(0,219,233,0.55)"
    for (let i = 0; i < count; i++) {
        const start = Math.floor(i * step)
        const end = Math.floor((i + 1) * step)
        let peak = 0
        for (let j = start; j < end; j++) if (bars[j] > peak) peak = bars[j]
        const h = Math.max(Math.min(peak * H * 10, H - 2), 2)
        ctx.fillRect((i / count) * W, (H - h) / 2, bw, h)
    }
}

function MatIcon({ name, size = "0.9rem" }: { name: string; size?: string }) {
    return (
        <span className="material-symbols-outlined" style={{ fontSize: size, fontVariationSettings: "'FILL' 1" }}>
            {name}
        </span>
    )
}

function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false)
    const [elapsedMs, setElapsedMs] = useState(0)
    const [bars, setBars] = useState<number[]>(Array(BAR_COUNT).fill(0))

    const analyserRef = useRef<AnalyserNode | null>(null)
    const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const audioCtxRef = useRef<AudioContext | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const startTimeRef = useRef<number>(0)
    const chunksRef = useRef<BlobPart[]>([])
    const barsAccRef = useRef<number[]>([])
    const tickRef = useRef(0)

    const stop = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        streamRef.current?.getTracks().forEach(t => t.stop())
        audioCtxRef.current?.close()
        analyserRef.current = null
        dataArrayRef.current = null
        mediaRecorderRef.current?.stop()
    }, [])

    const start = useCallback(async (onClipReady: (clip: Clip) => void) => {
        try {
            barsAccRef.current = []
            tickRef.current = 0

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream

            const audioCtx = new AudioContext()
            audioCtxRef.current = audioCtx
            const analyser = audioCtx.createAnalyser()
            analyser.fftSize = 1024
            audioCtx.createMediaStreamSource(stream).connect(analyser)
            analyserRef.current = analyser
            dataArrayRef.current = new Uint8Array(analyser.fftSize)

            chunksRef.current = []
            const recorder = new MediaRecorder(stream)
            mediaRecorderRef.current = recorder

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            recorder.onstop = () => {
                const mime = recorder.mimeType
                const blob = new Blob(chunksRef.current, { type: mime })
                onClipReady({
                    id: crypto.randomUUID(),
                    url: URL.createObjectURL(blob),
                    bars: [...barsAccRef.current],
                    durationMs: Date.now() - startTimeRef.current,
                    ext: extFromMime(mime),
                })
                setBars(Array(BAR_COUNT).fill(0))
                setIsRecording(false)
            }

            recorder.start()
            startTimeRef.current = Date.now()
            setElapsedMs(0)
            setIsRecording(true)

            intervalRef.current = setInterval(() => {
                tickRef.current++
                if (tickRef.current % 5 !== 0) return
                const analyser = analyserRef.current
                const dataArray = dataArrayRef.current
                if (!analyser || !dataArray) return
                analyser.getByteTimeDomainData(dataArray)
                const rms = Math.sqrt(
                    dataArray.reduce((sum, v) => sum + (v - 128) ** 2, 0) / dataArray.length
                ) / 128
                barsAccRef.current.push(rms)
                setElapsedMs(Date.now() - startTimeRef.current)
                setBars(prev => [...prev.slice(1), rms])
            }, 10)
        } catch {
            console.error("Microphone access denied")
        }
    }, [])

    useEffect(() => () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        streamRef.current?.getTracks().forEach(t => t.stop())
        audioCtxRef.current?.close()
    }, [])

    return { isRecording, elapsedMs, bars, start, stop }
}

const Waveform = memo(function Waveform({ bars, isRecording }: { bars: number[]; isRecording: boolean }) {
    return (
        <div className="flex items-end gap-0.5 h-16 w-full">
            {bars.map((val, i) => (
                <motion.div
                    key={i}
                    className="flex-1 rounded-full"
                    style={{ backgroundColor: isRecording ? "rgba(255,80,80,0.55)" : "rgba(0,219,233,0.2)" }}
                    animate={{ height: `${Math.max(val * 1000, 2)}%` }}
                    transition={{ duration: 0.05 }}
                />
            ))}
        </div>
    )
})

function ClipButton({
    onClick, icon, label, active,
}: {
    onClick: () => void
    icon: string
    label: string
    active?: boolean
}) {
    const color = active ? "rgba(255,110,110,0.8)" : "rgba(0,219,233,0.7)"
    const border = active ? "1px solid rgba(255,80,80,0.4)" : "1px solid rgba(0,219,233,0.3)"
    return (
        <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="focus:outline-none flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ ...monoSm, border, color }}
        >
            <MatIcon name={icon} />
            {label}
        </motion.button>
    )
}

function RecordButton({ isRecording, onToggle }: { isRecording: boolean; onToggle: () => void }) {
    return (
        <div className="relative flex items-center justify-center">
            <AnimatePresence>
                {isRecording && <>
                    <motion.div
                        key="ring1"
                        className="absolute inset-0 rounded-full"
                        style={{ border: "1px solid rgba(255,55,55,0.6)" }}
                        initial={{ scale: 1, opacity: 0.5 }}
                        animate={{ scale: 1.18, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                        key="ring2"
                        className="absolute inset-0 rounded-full"
                        style={{ border: "1px solid rgba(255,55,55,0.4)" }}
                        initial={{ scale: 1, opacity: 0.5 }}
                        animate={{ scale: 1.18, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                    />
                </>}
            </AnimatePresence>
            <motion.button
                onClick={onToggle}
                className="relative w-30 h-30 rounded-full flex items-center justify-center focus:outline-none"
                animate={{
                    boxShadow: isRecording
                        ? "0 0 28px rgba(255,30,30,0.18), inset 0 0 24px rgba(255,30,30,0.06)"
                        : "0 0 28px rgba(0,219,233,0.08), inset 0 0 24px rgba(0,219,233,0.03)",
                    borderColor: isRecording ? "rgba(255,55,55,0.55)" : "rgba(0,219,233,0.2)",
                }}
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.5 }}
                style={{ background: "rgba(4,8,18,0.85)", border: "1px solid" }}
            >
                <motion.span
                    className="material-symbols-outlined"
                    animate={{ color: isRecording ? "rgba(255,110,110,0.9)" : "rgba(0,219,233,0.65)" }}
                    transition={{ duration: 0.5 }}
                    style={{ fontSize: "2.5rem", fontVariationSettings: "'FILL' 1" }}
                >
                    {isRecording ? "stop" : "mic"}
                </motion.span>
            </motion.button>
        </div>
    )
}

function ClipRow({ clip, index, onDelete }: { clip: Clip; index: number; onDelete: () => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const audioRef = useRef<HTMLAudioElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)

    useEffect(() => {
        if (canvasRef.current) drawWaveform(canvasRef.current, clip.bars)
    }, [clip.bars])

    const handlePlayPause = () => {
        const audio = audioRef.current
        if (!audio) return
        if (isPlaying) {
            audio.pause()
        } else {
            audio.play()
        }
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
            className="shrink-0 rounded-xl px-5 py-4 flex flex-col gap-3"
            style={{ border: "1px solid rgba(0,219,233,0.35)", background: "rgba(0,219,233,0.1)" }}
        >
            <audio
                ref={audioRef}
                src={clip.url}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
            />

            <div className="flex items-center justify-between">
                <span style={{ ...monoMd, color: "rgba(0,219,233,0.85)" }}>
                    CLIP {String(index + 1).padStart(2, "0")}
                </span>
                <span style={{ ...monoMd, color: "rgba(0,219,233,0.7)" }}>
                    {formatTime(clip.durationMs)}
                </span>
            </div>

            <div className="flex gap-4">
                <canvas ref={canvasRef} width={800} height={96} style={{ width: "100%", height: 48, display: "block", borderRadius: 4 }} />
                <div className="flex flex-col gap-2">
                    <ClipButton
                        onClick={handlePlayPause}
                        icon={isPlaying ? "pause" : "play_arrow"}
                        label={isPlaying ? "PAUSE" : "PLAY"}
                        active={isPlaying}
                    />
                    <motion.button
                        onClick={onDelete}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        className="focus:outline-none flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                        style={{ ...monoSm, border: "1px solid rgba(255,80,80,0.25)", color: "rgba(255,80,80,0.55)" }}
                    >
                        <MatIcon name="delete" />
                        DELETE
                    </motion.button>
                </div>
            </div>
        </motion.div>
    )
}

export default function Home() {
    const recorder = useAudioRecorder()
    const [clips, setClips] = useState<Clip[]>([])
    const clipsRef = useRef(clips)
    clipsRef.current = clips

    const handleToggle = () => {
        if (recorder.isRecording) {
            recorder.stop()
        } else {
            recorder.start((clip) => {
                if (clip.durationMs < 800) {
                    URL.revokeObjectURL(clip.url)
                    toast("Clip is too short", { duration: 2000 })
                    return
                }
                
                setClips(prev => [...prev, clip])
            })
        }
    }

    const handleDelete = useCallback((id: string) => {
        setClips(prev => {
            const clip = prev.find(c => c.id === id)
            if (clip) URL.revokeObjectURL(clip.url)
            return prev.filter(c => c.id !== id)
        })
    }, [])

    useEffect(() => () => {
        clipsRef.current.forEach(c => URL.revokeObjectURL(c.url))
    }, [])

    const hasClips = clips.length > 0

    return (
        <>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-surface-container-high/40 via-background to-background -z-10" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[32px_32px] pointer-events-none -z-10" />

            <main className="grow flex flex-col items-center px-6 py-12 relative z-10 w-full max-w-2xl mx-auto gap-6">

                <motion.div
                    layout
                    transition={{ layout: { type: "spring", damping: 28, stiffness: 220 } }}
                    className="flex flex-col items-center gap-6 w-full"
                    style={{
                        marginTop: hasClips ? 0 : 'auto',
                        marginBottom: hasClips ? 0 : 'auto',
                    }}
                >
                    <div className="w-full text-center pt-2 pb-4">
                        <h1 className="text-3xl font-bold font-headline-lg text-primary-container tracking-widest uppercase drop-shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                            GPT <span className="text-base">w</span>RAPPER
                        </h1>
                        <p className="font-label-sm text-outline mt-1 uppercase tracking-[0.2em]">
                            Turn random noise into a sick beat
                        </p>
                    </div>

                    <Waveform bars={recorder.bars} isRecording={recorder.isRecording} />

                    <div className="flex flex-col items-center gap-3">
                        <RecordButton isRecording={recorder.isRecording} onToggle={handleToggle} />
                        <div className="font-headline-md text-surface-tint tracking-widest drop-shadow-[0_0_8px_rgba(0,219,233,0.4)]">
                            {formatTime(recorder.elapsedMs)}
                        </div>
                    </div>
                </motion.div>

                <AnimatePresence>
                    {hasClips && (
                        <motion.div
                            layout
                            className="w-full flex flex-col gap-3 pb-4"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                        >
                            <AnimatePresence mode="popLayout">
                                <div className="space-y-4">
                                    {clips.map((clip, i) => (
                                        <ClipRow key={clip.id} clip={clip} index={i} onDelete={() => handleDelete(clip.id)} />
                                    ))}
                                </div>
                            </AnimatePresence>
                            <motion.button
                                layout
                                onClick={() => alert("submit")}
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                className="w-full py-3 rounded-xl focus:outline-none tracking-[0.2em] uppercase mt-2"
                                style={{ font: "11px/1 'Courier New', monospace", background: "rgba(0,219,233,0.18)", border: "1px solid rgba(0,219,233,0.7)", color: "#00dbe9" }}
                            >
                                Make A Beat
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>

            </main>
        </>
    )
}

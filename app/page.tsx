"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"
import { formatTime, clipFromAudioBuffer, audioBufferToWavBlob, parseMidiNotes } from "@/lib/audio"
import { useAudioRecorder } from "@/hooks/useAudioRecorder"
import { Waveform } from "@/components/Waveform"
import { RecordButton } from "@/components/RecordButton"
import { ClipRow } from "@/components/ClipRow"
import { ResultScreen } from "@/components/ResultScreen"
import GeneratingScreen from "@/components/GenerationScreen"
import BeatPromptScreen from "@/components/BeatPromptScreen"
import { MatIcon } from "@/components/MatIcon"
import type { Clip, BeatResult } from "@/lib/audio"

type AppStatus = "idle" | "prompting" | "generating" | "generating-sample" | "done"

export default function Home() {
    const recorder = useAudioRecorder()
    const [clips, setClips] = useState<Clip[]>([])
    const [appStatus, setAppStatus] = useState<AppStatus>("idle")
    const [result, setResult] = useState<BeatResult | null>(null)
    const clipsRef = useRef(clips)
    const fileInputRef = useRef<HTMLInputElement>(null)
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

    const handleUseExample = async () => {
        if (clipsRef.current.length === 0) {
            toast("Record some sounds first, then use them in an example beat", { duration: 3000 })
            return
        }
        if (recorder.isRecording) recorder.stop()
        setAppStatus("generating")

        try {
            const midiBuf = await fetch("/take-care.mid").then(r => r.arrayBuffer())
            const notes = await parseMidiNotes(midiBuf)
            if (notes.length === 0) throw new Error("No notes in MIDI file")

            const totalDuration = notes.reduce((m, n) => Math.max(m, n.timeS + n.durationS), 0)

            const clips = clipsRef.current
            const decodeCtx = new AudioContext()
            const clipBuffers = await Promise.all(
                clips.map(async c => {
                    const ab = await fetch(c.url).then(r => r.arrayBuffer())
                    return decodeCtx.decodeAudioData(ab)
                })
            )
            await decodeCtx.close()

            const SR = 44100
            const offCtx = new OfflineAudioContext(2, Math.ceil((totalDuration + 0.5) * SR), SR)
            const masterGain = offCtx.createGain()
            masterGain.gain.value = 0.35
            masterGain.connect(offCtx.destination)

            for (let i = 0; i < notes.length; i++) {
                const note = notes[i]
                const buf = clipBuffers[i % clipBuffers.length]
                const src = offCtx.createBufferSource()
                src.buffer = buf
                src.playbackRate.value = Math.pow(2, (note.midi - 60) / 12)
                src.connect(masterGain)
                src.start(note.timeS)
                src.stop(note.timeS + Math.min(note.durationS, buf.duration))
            }

            const rendered = await offCtx.startRendering()
            const wavBlob = audioBufferToWavBlob(rendered)
            const userSoundsUrl = URL.createObjectURL(wavBlob)
            const midiUrl = URL.createObjectURL(new Blob([midiBuf], { type: "audio/midi" }))

            setResult({ userSoundsUrl, midiUrl })
            setAppStatus("done")
            toast("Beat ready!", { duration: 2000 })
        } catch (e) {
            console.error(e)
            toast("Failed to render example beat", { duration: 2000 })
            setAppStatus("idle")
        }
    }

    const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        e.target.value = ""
        try {
            const arrayBuf = await file.arrayBuffer()
            const actx = new AudioContext()
            const decoded = await actx.decodeAudioData(arrayBuf)
            await actx.close()
            const clip = clipFromAudioBuffer(decoded)
            if (clip.durationMs < 800) {
                URL.revokeObjectURL(clip.url)
                toast("File is too short", { duration: 2000 })
                return
            }
            setClips(prev => [...prev, clip])
        } catch {
            toast("Could not decode audio file", { duration: 2000 })
        }
    }

    const handleSubmit = () => {
        if (recorder.isRecording) recorder.stop()
        setAppStatus("prompting")
    }

    const handleUseSampleBeat = () => {
        if (recorder.isRecording) recorder.stop()
        setResult({
            userSoundsUrl: "/pirates_picks_Ken_Hansen_Ibrahim.wav",
            midiUrl: "/pirates-of-the-caribbean.mid",
        })
        setAppStatus("done")
    }

    const handleCreateBeat = async (style: string, additional: string) => {
        setAppStatus("generating")

        try {
            const formData = new FormData()
            formData.append("prompt", "The style is: " + style + ". " + additional)

            await Promise.all(
                clipsRef.current.map(async (clip, i) => {
                    const res = await fetch(clip.url)
                    const blob = await res.blob()
                    formData.append("clips", blob, `clip_${i}.${clipsRef.current[i].ext}`)
                })
            )

            const res = await fetch("/api/generate", { method: "POST", body: formData })

            if (!res.ok) throw new Error(`Server responded ${res.status}`)

            const data = await res.json()

            const b64ToUrl = (b64: string, type: string) =>
                URL.createObjectURL(new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type }))

            const userSoundsUrl = b64ToUrl(data.userSounds, "audio/wav")
            const midiUrl = b64ToUrl(data.midi, "audio/midi")
            const originalUrl = data.original ? b64ToUrl(data.original, "audio/wav") : undefined

            setResult({ userSoundsUrl, midiUrl, originalUrl })
            setAppStatus("done")
            toast("Beat generated!", { duration: 2000 })
        } catch {
            toast("Failed to generate beat", { duration: 2000 })
            setAppStatus("idle")
        }
    }

    const handleReset = () => {
        setClips(prev => {
            prev.forEach(c => URL.revokeObjectURL(c.url))
            return []
        })
        setResult(prev => {
            if (prev) {
                URL.revokeObjectURL(prev.userSoundsUrl)
                URL.revokeObjectURL(prev.midiUrl)
                if (prev.originalUrl) URL.revokeObjectURL(prev.originalUrl)
            }
            return null
        })
        setAppStatus("idle")
    }


    useEffect(() => () => {
        clipsRef.current.forEach(c => URL.revokeObjectURL(c.url))
    }, [])

    const hasClips = clips.length > 0

    return (
        <>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-surface-container-high/40 via-background to-background -z-10" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[32px_32px] pointer-events-none -z-10" />

            <main className="grow flex flex-col items-center px-6 py-12 relative z-10 w-full mx-auto gap-8">

                <div className="w-full text-center pt-2 pb-4 shrink-0">
                    <h1 className="text-3xl font-bold font-headline-lg text-primary-container tracking-widest uppercase drop-shadow-[0_0_20px_rgba(0,240,255,0.8)]">
                        GPT <span className="text-base">w</span>RAPPER
                    </h1>
                    <p className="font-label-sm text-outline mt-1 uppercase tracking-[0.2em]">
                        Turn random noise into a sick beat
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {appStatus === "idle" && (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            transition={{ duration: 0.35 }}
                            className="flex-1 flex flex-col w-full gap-8 max-w-2xl"
                        >
                            <motion.div
                                layout
                                transition={{ layout: { type: "spring", damping: 28, stiffness: 220 } }}
                                className="flex flex-col items-center gap-6 w-full"
                                style={{
                                    marginTop: hasClips ? 0 : "auto",
                                    marginBottom: hasClips ? 0 : "auto",
                                }}
                            >
                                <Waveform bars={recorder.bars} isRecording={recorder.isRecording} />

                                <div className="flex flex-col items-center gap-4">
                                    <RecordButton isRecording={recorder.isRecording} onToggle={handleToggle} />
                                    <div className="font-headline-md text-primary-container/90 tracking-widest drop-shadow-[0_0_8px_rgba(167,100,255,0.4)]">
                                        {formatTime(recorder.elapsedMs)}
                                    </div>
                                    <div className="flex items-center gap-3 flex-wrap justify-center">
                                        <motion.button
                                            onClick={handleUseExample}
                                            disabled={recorder.isRecording}
                                            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full focus:outline-none monoSm"
                                            style={{
                                                border: "1px solid rgba(0,219,233,0.3)",
                                                color: "rgba(0,219,233,0.65)",
                                                opacity: recorder.isRecording ? 0.45 : 1,
                                            }}
                                        >
                                            <MatIcon name="music_note" size="0.85rem" />
                                            USE EXAMPLE
                                        </motion.button>
                                        <motion.button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={recorder.isRecording}
                                            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full focus:outline-none monoSm"
                                            style={{
                                                border: "1px solid rgba(0,219,233,0.3)",
                                                color: "rgba(0,219,233,0.65)",
                                                opacity: recorder.isRecording ? 0.45 : 1,
                                            }}
                                        >
                                            <MatIcon name="upload_file" size="0.85rem" />
                                            UPLOAD
                                        </motion.button>
                                        <motion.button
                                            onClick={handleUseSampleBeat}
                                            disabled={recorder.isRecording}
                                            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full focus:outline-none monoSm"
                                            style={{
                                                border: "1px solid rgba(167,100,255,0.45)",
                                                color: "rgba(167,100,255,0.8)",
                                                background: "rgba(167,100,255,0.08)",
                                                opacity: recorder.isRecording ? 0.45 : 1,
                                            }}
                                        >
                                            <MatIcon name="group" size="0.85rem" />
                                            PEOPLE BEAT
                                        </motion.button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="audio/*"
                                            className="hidden"
                                            onChange={handleUploadFile}
                                        />
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
                                        <div className="flex flex-col gap-4">
                                            <AnimatePresence mode="popLayout">
                                                {clips.map((clip, i) => (
                                                    <ClipRow key={clip.id} clip={clip} index={i} onDelete={() => handleDelete(clip.id)} />
                                                ))}
                                            </AnimatePresence>
                                        </div>
                                        <motion.button
                                            layout
                                            onClick={handleSubmit}
                                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                            className="w-full py-3 rounded-xl focus:outline-none tracking-[0.2em] uppercase mt-2 monoMd"
                                            style={{ background: "rgba(0,219,233,0.18)", border: "1px solid rgba(0,219,233,0.7)", color: "#00dbe9" }}
                                        >
                                            Make A Beat
                                        </motion.button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {appStatus === "prompting" && <BeatPromptScreen key="prompting" onConfirm={handleCreateBeat} />}

                    {appStatus === "generating" && <GeneratingScreen key="generating" />}
                    {appStatus === "generating-sample" && <GeneratingScreen key="generating-sample" mode="sample" />}

                    {appStatus === "done" && result && (
                        <ResultScreen key="done" result={result} onReset={handleReset} />
                    )}
                </AnimatePresence>

            </main>
        </>
    )
}

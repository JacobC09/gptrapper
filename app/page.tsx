"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"
import { formatTime } from "@/lib/audio"
import { useAudioRecorder } from "@/hooks/useAudioRecorder"
import { Waveform } from "@/components/Waveform"
import { RecordButton } from "@/components/RecordButton"
import { ClipRow } from "@/components/ClipRow"
import { ResultScreen } from "@/components/ResultScreen"
import GeneratingScreen from "@/components/GenerationScreen"
import BeatPromptScreen from "@/components/BeatPromptScreen"
import type { Clip } from "@/lib/audio"

type AppStatus = "idle" | "prompting" | "generating" | "done"

export default function Home() {
    const recorder = useAudioRecorder()
    const [clips, setClips] = useState<Clip[]>([])
    const [appStatus, setAppStatus] = useState<AppStatus>("idle")
    const [resultUrl, setResultUrl] = useState<string | null>(null)
    const [midiUrl] = useState<string | null>("/twinkle-twinkle-little-star.mid")
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

    const handleSubmit = () => {
        if (recorder.isRecording) recorder.stop()
        setAppStatus("prompting")
    }

    const handleBeatConfirm = async (_style: string, _additional: string) => {
        setAppStatus("generating")
        // await new Promise<void>(resolve => setTimeout(resolve, 4500))
        await new Promise<void>(resolve => setTimeout(resolve, 1000))
        setResultUrl(clipsRef.current[0]?.url ?? null)
        setAppStatus("done")
        toast("Beat generated!", { duration: 2000 })
    }

    const handleReset = () => {
        setClips(prev => {
            prev.forEach(c => URL.revokeObjectURL(c.url))
            return []
        })
        setResultUrl(null)
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

                    {appStatus === "prompting" && <BeatPromptScreen key="prompting" onConfirm={handleBeatConfirm} />}

                    {appStatus === "generating" && <GeneratingScreen key="generating" />}

                    {appStatus === "done" && (
                        <ResultScreen key="done" url={resultUrl} midiUrl={midiUrl} onReset={handleReset} />
                    )}
                </AnimatePresence>

            </main>
        </>
    )
}

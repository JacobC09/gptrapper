"use client"

import { useRef, useState } from "react"
import { motion } from "motion/react"
import { MatIcon } from "@/components/MatIcon"
import type { Clip } from "@/lib/audio"
import type { GenerateResponse, InstrumentType, Sample } from "@/lib/types"

const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
    aguitar:   "Acoustic Guitar",
    bguitar:   "Bass Guitar",
    eguitar:   "Electric Guitar",
    cello:     "Cello",
    violin:    "Violin",
    flute:     "Flute",
    trumpet:   "Trumpet",
    piano:     "Piano",
    kickdrum:  "Kick Drum",
    snaredrum: "Snare Drum",
    hihat:     "Hi-Hat",
}

const INSTRUMENT_TYPES = Object.keys(INSTRUMENT_LABELS) as InstrumentType[]

const INSTRUMENT_COLORS: Record<InstrumentType, [string, string]> = {
    kickdrum:  ["rgba(255,80,80,0.12)",   "rgba(255,80,80,0.85)"],
    snaredrum: ["rgba(255,120,60,0.12)",  "rgba(255,140,60,0.85)"],
    hihat:     ["rgba(255,200,60,0.12)",  "rgba(255,200,60,0.85)"],
    piano:     ["rgba(167,100,255,0.12)", "rgba(167,100,255,0.85)"],
    aguitar:   ["rgba(0,219,233,0.12)",   "rgba(0,219,233,0.85)"],
    bguitar:   ["rgba(0,180,210,0.12)",   "rgba(0,190,220,0.85)"],
    eguitar:   ["rgba(0,219,180,0.12)",   "rgba(0,219,180,0.85)"],
    cello:     ["rgba(80,200,130,0.12)",  "rgba(80,210,130,0.85)"],
    violin:    ["rgba(120,220,100,0.12)", "rgba(130,220,100,0.85)"],
    flute:     ["rgba(200,230,80,0.12)",  "rgba(210,230,80,0.85)"],
    trumpet:   ["rgba(255,200,60,0.12)",  "rgba(255,200,60,0.85)"],
}

function fmt(s: number) {
    return s.toFixed(2) + "s"
}

export function ResultScreen({ result, clips, onConfirm }: {
    result: GenerateResponse
    clips: Clip[]
    onConfirm: (types: InstrumentType[]) => void
}) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [playingIdx, setPlayingIdx] = useState<number | null>(null)
    const endTimeRef = useRef<number>(0)
    const [selectedTypes, setSelectedTypes] = useState<InstrumentType[]>(
        () => result.samples.map(s => s.type ?? "piano")
    )

    const updateType = (i: number, type: InstrumentType) => {
        setSelectedTypes(prev => prev.map((t, idx) => idx === i ? type : t))
    }

    const handleTimeUpdate = () => {
        const audio = audioRef.current
        if (!audio) return
        if (audio.currentTime >= endTimeRef.current) {
            audio.pause()
            setPlayingIdx(null)
        }
    }

    const togglePlay = (sampleIdx: number, sample: Sample) => {
        const audio = audioRef.current
        if (!audio) return
        const clip = clips[sample.clip_index]
        if (!clip) return

        if (playingIdx === sampleIdx) {
            audio.pause()
            setPlayingIdx(null)
        } else {
            endTimeRef.current = sample.start_s + sample.duration_s
            audio.src = clip.url
            audio.currentTime = sample.start_s
            audio.play()
            setPlayingIdx(sampleIdx)
        }
    }

    return (
        <motion.div
            key="result"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col w-full gap-6 max-w-3xl"
        >
            <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={() => setPlayingIdx(null)} />

            <div className="text-center py-3">
                <motion.h2
                    className="font-headline-lg text-2xl tracking-[0.28em] uppercase"
                    style={{ color: "#00dbe9" }}
                    animate={{
                        textShadow: [
                            "0 0 18px rgba(0,219,233,0.25)",
                            "0 0 48px rgba(0,219,233,0.75)",
                            "0 0 18px rgba(0,219,233,0.25)",
                        ],
                    }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                >
                    Label Your Samples
                </motion.h2>
                <p className="uppercase tracking-[0.25em] mt-2 monoSm" style={{ color: "rgba(0,219,233,0.42)" }}>
                    {result.clips_received} CLIPS — {result.samples.length} SAMPLES DETECTED
                </p>
            </div>

            <div
                className="w-full flex flex-col rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(0,219,233,0.18)", background: "rgba(0,219,233,0.02)" }}
            >
                {result.samples.length === 0 && (
                    <div className="py-12 text-center monoSm" style={{ color: "rgba(255,255,255,0.2)" }}>
                        NO SAMPLES DETECTED
                    </div>
                )}
                {result.samples.map((sample, i) => {
                    const currentType = selectedTypes[i]
                    const [bg, fg] = INSTRUMENT_COLORS[currentType]
                    const isPlaying = playingIdx === i
                    const borderColor = fg.replace("0.85)", "0.3)")

                    return (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.3, ease: "easeOut" }}
                            className="flex items-center gap-3 px-5 py-3.5"
                            style={{
                                borderBottom: i < result.samples.length - 1
                                    ? "1px solid rgba(255,255,255,0.04)"
                                    : undefined,
                                background: isPlaying ? "rgba(0,219,233,0.04)" : undefined,
                            }}
                        >
                            <span
                                className="monoSm shrink-0 px-2 py-0.5 rounded"
                                style={{
                                    background: "rgba(255,255,255,0.05)",
                                    color: "rgba(255,255,255,0.3)",
                                    fontSize: "10px",
                                    minWidth: "44px",
                                    textAlign: "center",
                                }}
                            >
                                CLIP {sample.clip_index}
                            </span>

                            <select
                                value={currentType}
                                onChange={(e) => updateType(i, e.target.value as InstrumentType)}
                                className="monoSm shrink-0 px-3 py-1 rounded-full uppercase tracking-widest focus:outline-none cursor-pointer"
                                style={{
                                    background: bg,
                                    color: fg,
                                    border: `1px solid ${borderColor}`,
                                    fontSize: "10px",
                                    appearance: "none",
                                    WebkitAppearance: "none",
                                }}
                            >
                                {INSTRUMENT_TYPES.map(type => (
                                    <option key={type} value={type} style={{ background: "#0a0a10", color: "#fff" }}>
                                        {INSTRUMENT_LABELS[type]}
                                    </option>
                                ))}
                            </select>

                            <span
                                className="monoSm ml-auto shrink-0"
                                style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px" }}
                            >
                                {fmt(sample.start_s)} — {fmt(sample.start_s + sample.duration_s)}
                            </span>

                            <motion.button
                                onClick={() => togglePlay(i, sample)}
                                whileHover={{ scale: 1.12 }}
                                whileTap={{ scale: 0.9 }}
                                className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center focus:outline-none"
                                style={{
                                    background: isPlaying ? "rgba(255,80,80,0.10)" : "rgba(0,219,233,0.08)",
                                    border: isPlaying ? "1px solid rgba(255,80,80,0.45)" : "1px solid rgba(0,219,233,0.3)",
                                    color: isPlaying ? "rgba(255,110,110,0.9)" : "rgba(0,219,233,0.7)",
                                }}
                            >
                                <MatIcon name={isPlaying ? "pause" : "play_arrow"} size="1rem" />
                            </motion.button>
                        </motion.div>
                    )
                })}
            </div>

            <motion.button
                onClick={() => onConfirm(selectedTypes)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl focus:outline-none tracking-[0.2em] uppercase monoMd"
                style={{ background: "rgba(0,219,233,0.18)", border: "1px solid rgba(0,219,233,0.7)", color: "#00dbe9" }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                Next — Choose Genre
            </motion.button>
        </motion.div>
    )
}

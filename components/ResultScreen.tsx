"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "motion/react"
import { BAR_COUNT, drawWaveform, formatTime } from "@/lib/audio"
import { MatIcon } from "@/components/MatIcon"
import { MidiPlayer } from "@/components/MidiPlayer"

export function ResultScreen({ url, midiUrl, onReset }: { url: string | null; midiUrl: string | null; onReset: () => void }) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0)
    const [durationMs, setDurationMs] = useState(0)
    const [waveformBars] = useState(() =>
        Array.from({ length: BAR_COUNT }, () => Math.random() * 0.1)
    )

    useEffect(() => {
        if (canvasRef.current) drawWaveform(canvasRef.current, waveformBars)
    }, [waveformBars])

    const handlePlayPause = () => {
        const audio = audioRef.current
        if (!audio || !url) return
        isPlaying ? audio.pause() : audio.play()
    }

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current
        if (!audio || !url) return
        const rect = e.currentTarget.getBoundingClientRect()
        const ratio = (e.clientX - rect.left) / rect.width
        audio.currentTime = ratio * audio.duration
    }

    return (
        <motion.div
            key="result"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col w-full gap-6 max-w-4xl"
        >
            <motion.div
                className="text-center py-3"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
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
                    Beat Ready
                </motion.h2>
                <p className="uppercase tracking-[0.25em] mt-2 monoSm" style={{ color: "rgba(0,219,233,0.42)" }}>
                    YOUR TRACK HAS BEEN GENERATED
                </p>
            </motion.div>

            <motion.div
                className="w-full rounded-2xl px-6 py-5 flex flex-col gap-5"
                style={{ border: "1px solid rgba(0,219,233,0.32)", background: "rgba(0,219,233,0.05)" }}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
                {url && (
                    <audio
                        ref={audioRef}
                        src={url}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => { setIsPlaying(false); setProgress(0) }}
                        onTimeUpdate={() => {
                            const a = audioRef.current!
                            setProgress(a.currentTime / (a.duration || 1))
                        }}
                        onLoadedMetadata={() => setDurationMs((audioRef.current!.duration || 0) * 1000)}
                    />
                )}

                <div className="flex items-center justify-between">
                    <span className="monoMd text-surface-tint text-lg">Generated Beat</span>
                    <span className="monoMd text-surface-tint/50">{formatTime(durationMs)}</span>
                </div>

                <div
                    className="relative rounded-md overflow-hidden cursor-pointer"
                    onClick={handleSeek}
                >
                    <canvas
                        ref={canvasRef}
                        width={800}
                        height={96}
                        style={{ width: "100%", height: 56, display: "block" }}
                    />
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: `linear-gradient(to right, rgba(0,219,233,0.13) ${progress * 100}%, transparent ${progress * 100}%)`,
                        }}
                    />
                    {progress > 0 && (
                        <div
                            className="absolute top-0 bottom-0 w-px pointer-events-none"
                            style={{
                                left: `${progress * 100}%`,
                                background: "rgba(0,219,233,0.9)",
                                boxShadow: "0 0 6px rgba(0,219,233,0.7)",
                            }}
                        />
                    )}
                </div>

                <div className="flex items-center justify-center gap-4">
                    <motion.button
                        onClick={handlePlayPause}
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.94 }}
                        className="focus:outline-none flex items-center gap-2 px-5 py-2 rounded-full monoSm"
                        style={{
                            border: isPlaying ? "1px solid rgba(255,80,80,0.45)" : "1px solid rgba(0,219,233,0.55)",
                            color: isPlaying ? "rgba(255,110,110,0.85)" : "rgba(0,219,233,0.85)",
                            background: isPlaying ? "rgba(255,80,80,0.07)" : "rgba(0,219,233,0.08)",
                        }}
                    >
                        <MatIcon name={isPlaying ? "pause" : "play_arrow"} size="1rem" />
                        {isPlaying ? "PAUSE" : "PLAY"}
                    </motion.button>

                    {url && (
                        <motion.a
                            href={url}
                            download="generated_beat"
                            whileHover={{ scale: 1.06 }}
                            whileTap={{ scale: 0.94 }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full focus:outline-none monoSm border border-primary-container/30 text-primary-container/65"
                        >
                            <MatIcon name="download" size="0.9rem" />
                            DOWNLOAD
                        </motion.a>
                    )}
                </div>
            </motion.div>

            {midiUrl && (
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                    <MidiPlayer midiUrl={midiUrl} />
                </motion.div>
            )}

            <motion.button
                onClick={onReset}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="self-center flex items-center gap-1.5 focus:outline-none mt-1 monoSm"
                style={{ color: "rgba(0,219,233,0.32)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
            >
                <MatIcon name="arrow_back" size="0.8rem" />
                MAKE ANOTHER BEAT
            </motion.button>
        </motion.div>
    )
}

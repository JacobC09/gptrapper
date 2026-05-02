"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "motion/react"
import { type Clip, drawWaveform, formatTime } from "@/lib/audio"
import { MatIcon } from "@/components/MatIcon"

function ClipButton({
    onClick, icon, label, active, danger,
}: {
    onClick: () => void
    icon: string
    label: string
    active?: boolean
    danger?: boolean
}) {
    const color = danger
        ? `rgba(var(--c-red), 0.55)`
        : active ? `rgba(var(--c-violet), 0.85)` : `rgba(var(--c-cyan), 0.7)`
    const border = danger
        ? `1px solid rgba(var(--c-red), 0.25)`
        : active ? `1px solid rgba(var(--c-violet), 0.45)` : `1px solid rgba(var(--c-cyan), 0.3)`
    return (
        <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="focus:outline-none flex items-center gap-1.5 px-3 py-1.5 rounded-full monoSm"
            style={{ border, color }}
        >
            <MatIcon name={icon} />
            {label}
        </motion.button>
    )
}

export function ClipRow({ clip, index, onDelete }: { clip: Clip; index: number; onDelete: () => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const audioRef = useRef<HTMLAudioElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)

    useEffect(() => {
        if (canvasRef.current) drawWaveform(canvasRef.current, clip.bars)
    }, [clip.bars])

    const handlePlayPause = () => {
        const audio = audioRef.current
        if (!audio) return
        isPlaying ? audio.pause() : audio.play()
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
            className="shrink-0 rounded-xl px-5 py-4 flex flex-col gap-3 border border-surface-tint/35 bg-surface-tint/10"
        >
            <audio
                ref={audioRef}
                src={clip.url}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
            />

            <div className="flex items-center justify-between">
                <span className="monoMd text-violet/85">
                    CLIP {String(index + 1).padStart(2, "0")}
                </span>
                <span className="monoMd text-surface-tint/70">
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
                    <ClipButton onClick={onDelete} icon="delete" label="DELETE" danger />
                </div>
            </div>
        </motion.div>
    )
}

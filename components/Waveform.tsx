"use client"

import { memo } from "react"
import { motion } from "motion/react"

export const Waveform = memo(function Waveform({ bars, isRecording }: { bars: number[]; isRecording: boolean }) {
    return (
        <div className="flex items-end gap-0.5 h-16 w-full">
            {bars.map((val, i) => (
                <motion.div
                    key={i}
                    className={`flex-1 rounded-full ${isRecording ? "bg-red-accent/55" : "bg-surface-tint/20"}`}
                    animate={{ height: `${Math.max(val * 1000, 2)}%` }}
                    transition={{ duration: 0.05 }}
                />
            ))}
        </div>
    )
})

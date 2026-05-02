"use client"

import { memo } from "react"
import { motion } from "motion/react"

export const Waveform = memo(function Waveform({ bars, isRecording }: { bars: number[]; isRecording: boolean }) {
    return (
        <div
            className="flex items-end gap-[2px] h-16 w-full rounded-xl px-2 py-2"
            style={{
                background: "rgba(10,10,16,0.85)",
                border: "1px solid rgba(0,219,233,0.10)",
            }}
        >
            {bars.map((val, i) => (
                <motion.div
                    key={i}
                    className="flex-1 rounded-full"
                    animate={{ height: `${Math.max(val * 1000, 3)}%` }}
                    transition={{ duration: 0.05 }}
                    style={{
                        background: isRecording ? "rgba(0,219,233,0.75)" : "rgba(0,219,233,0.38)",
                        boxShadow: isRecording ? "0 0 5px rgba(0,219,233,0.55)" : undefined,
                        minHeight: 2,
                    }}
                />
            ))}
        </div>
    )
})

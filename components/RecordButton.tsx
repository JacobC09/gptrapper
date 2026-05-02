"use client"

import { motion } from "motion/react"

const RINGS = [
    { border: "1px solid rgba(255,55,55,0.6)", delay: 0 },
    { border: "1px solid rgba(255,55,55,0.4)", delay: 1 },
]

export function RecordButton({ isRecording, onToggle }: { isRecording: boolean; onToggle: () => void }) {
    return (
        <div className="relative flex items-center justify-center">
            {RINGS.map((ring, i) => (
                <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full"
                    style={{ border: ring.border }}
                    animate={isRecording
                        ? { scale: [1, 1.18, 1],     opacity: [0.5, 0, 0] }
                        : { opacity: 0, scale: 1 }}
                    transition={isRecording
                        ? { duration: 2, repeat: Infinity, ease: "easeInOut", delay: ring.delay }
                        : { duration: 0.3 }}
                />
            ))}
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

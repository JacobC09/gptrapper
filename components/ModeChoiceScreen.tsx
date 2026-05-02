"use client"

import { motion } from "motion/react"
import { MatIcon } from "@/components/MatIcon"

export type GenerationMode = "beat" | "song"

const MODES: {
    id: GenerationMode
    label: string
    icon: string
    desc: string
    accent: string
    accentDim: string
}[] = [
    {
        id: "beat",
        label: "Make A Beat",
        icon: "graphic_eq",
        desc: "Generate an original MIDI beat from your samples",
        accent: "rgba(0,219,233,0.85)",
        accentDim: "rgba(0,219,233,0.18)",
    },
    {
        id: "song",
        label: "Replace A Song",
        icon: "library_music",
        desc: "Use your samples to play the notes of an existing song",
        accent: "rgba(167,100,255,0.85)",
        accentDim: "rgba(167,100,255,0.18)",
    },
]

export function ModeChoiceScreen({ onChoose }: {
    onChoose: (mode: GenerationMode) => void
}) {
    return (
        <motion.div
            key="mode-choice"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col w-full gap-6 max-w-2xl"
        >
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
                    Pick A Mode
                </motion.h2>
                <p className="uppercase tracking-[0.25em] mt-2 monoSm" style={{ color: "rgba(0,219,233,0.42)" }}>
                    What do you want to do with your samples?
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {MODES.map((mode, i) => (
                    <motion.button
                        key={mode.id}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.08 + i * 0.08 }}
                        onClick={() => onChoose(mode.id)}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        className="flex flex-col items-center gap-3 rounded-2xl px-5 py-8 focus:outline-none relative overflow-hidden"
                        style={{
                            border: `1px solid ${mode.accentDim.replace("0.18", "0.5")}`,
                            background: mode.accentDim.replace("0.18", "0.06"),
                        }}
                    >
                        <span
                            className="material-symbols-outlined"
                            style={{
                                fontSize: "2.4rem",
                                color: mode.accent,
                                fontVariationSettings: "'FILL' 1",
                                filter: `drop-shadow(0 0 16px ${mode.accentDim})`,
                            }}
                        >
                            {mode.icon}
                        </span>
                        <span
                            className="uppercase tracking-[0.18em] font-headline-md text-lg"
                            style={{ color: mode.accent }}
                        >
                            {mode.label}
                        </span>
                        <span
                            className="monoSm text-center leading-snug px-2"
                            style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem" }}
                        >
                            {mode.desc}
                        </span>
                        <div
                            className="flex items-center gap-1 mt-1 monoSm uppercase tracking-[0.2em]"
                            style={{ color: mode.accent, fontSize: "0.65rem" }}
                        >
                            Choose
                            <MatIcon name="arrow_forward" size="0.8rem" />
                        </div>
                    </motion.button>
                ))}
            </div>
        </motion.div>
    )
}

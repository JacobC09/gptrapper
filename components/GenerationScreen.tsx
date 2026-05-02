"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BAR_COUNT } from "@/lib/audio";

const GENERATING_STAGES = [
    "ANALYZING SAMPLES",
    "BUILDING RHYTHM GRID",
    "COMPOSING MELODY",
    "MIXING LAYERS",
    "FINALIZING BEAT",
] as const

export default function GeneratingScreen() {
    const [stageIdx, setStageIdx] = useState(0)
    const [barAnims] = useState(() =>
        Array.from({ length: BAR_COUNT }, () => ({
            a: Math.floor(Math.random() * 65 + 12),
            b: Math.floor(Math.random() * 65 + 12),
            duration: 0.45 + Math.random() * 0.75,
            delay: Math.random() * 0.5,
        }))
    )

    useEffect(() => {
        const id = setInterval(() => {
            setStageIdx(prev => (prev < GENERATING_STAGES.length - 1 ? prev + 1 : prev))
        }, 900)
        return () => clearInterval(id)
    }, [])

    return (
        <motion.div
            key="generating"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col w-full gap-8 max-w-2xl"
        >
            <div className="flex items-end gap-0.5 h-24 w-full">
                {barAnims.map((anim, i) => (
                    <motion.div
                        key={i}
                        className="flex-1 rounded-full"
                        style={{ backgroundColor: "rgba(0,219,233,0.5)" }}
                        animate={{ height: [`${anim.a}%`, `${anim.b}%`, `${anim.a}%`] }}
                        transition={{
                            duration: anim.duration,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: anim.delay,
                        }}
                    />
                ))}
            </div>

            <div className="flex flex-col items-center gap-3">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={stageIdx}
                        initial={{ opacity: 0, y: 7 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -7 }}
                        transition={{ duration: 0.22 }}
                        style={{ color: "rgba(0,219,233,0.92)" }}
                        className="uppercase tracking-[0.22em] monoMd"
                    >
                        {GENERATING_STAGES[stageIdx]}
                    </motion.p>
                </AnimatePresence>
                <div className="flex gap-2">
                    {[0, 1, 2].map(i => (
                        <motion.div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: "rgba(0,219,233,0.6)" }}
                            animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.3, 0.7] }}
                            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.28 }}
                        />
                    ))}
                </div>
            </div>

            <div
                className="rounded-xl px-5 py-4 flex flex-col gap-2.5"
                style={{ border: "1px solid rgba(0,219,233,0.15)", background: "rgba(0,219,233,0.04)" }}
            >
                {GENERATING_STAGES.map((stage, i) => (
                    <motion.div
                        key={stage}
                        className="flex items-center gap-3"
                        animate={{ opacity: i <= stageIdx ? 1 : 0.2 }}
                        transition={{ duration: 0.35 }}
                    >
                        <span
                            className="flex items-center justify-center shrink-0"
                            style={{ width: 18, height: 18, color: `rgba(var(--c-violet), 0.8)` }}
                        >
                            {i < stageIdx ? (
                                <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 18 }}
                                    className="material-symbols-outlined"
                                    style={{ fontSize: "0.9rem", fontVariationSettings: "'FILL' 1" }}
                                >
                                    check_circle
                                </motion.span>
                            ) : i === stageIdx ? (
                                <motion.div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: "rgba(0,219,233,0.85)" }}
                                    animate={{ scale: [1, 1.55, 1] }}
                                    transition={{ duration: 0.65, repeat: Infinity }}
                                />
                            ) : (
                                <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ border: "1px solid rgba(0,219,233,0.2)" }}
                                />
                            )}
                        </span>
                        <span
                            style={{
                                color: i < stageIdx
                                    ? `rgba(var(--c-violet), 0.55)`
                                    : i === stageIdx
                                        ? `rgba(var(--c-cyan), 0.92)`
                                        : `rgba(var(--c-cyan), 0.18)`,
                            }}
                            className="uppercase tracking-[0.16em] monoSm"
                        >
                            {stage}
                        </span>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    )
}

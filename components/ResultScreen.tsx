"use client"

import { motion } from "motion/react"
import { MatIcon } from "@/components/MatIcon"
import { MidiPlayer } from "@/components/MidiPlayer"
import type { BeatResult } from "@/lib/audio"

const SLOT_LABELS: Record<string, string> = {
    piano: "Piano", violin: "Violin", cello: "Cello", aguitar: "Ac. Guitar",
    eguitar: "El. Guitar", bguitar: "Bass", flute: "Flute", trumpet: "Trumpet",
    kickdrum: "Kick", snaredrum: "Snare", hihat: "Hi-Hat",
}

export function ResultScreen({ result, onReset }: { result: BeatResult; onReset: () => void }) {
    const assignments = result.assignments
    const hasAssignments = assignments && Object.keys(assignments).length > 0

    return (
        <motion.div
            key="result"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col w-full gap-6 max-w-6xl items-center"
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
                Your Beat is Ready
            </motion.h2>

            {hasAssignments && (
                <motion.div
                    className="w-full rounded-xl px-5 py-4 flex flex-col gap-2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    style={{ background: "rgba(167,100,255,0.07)", border: "1px solid rgba(167,100,255,0.15)" }}
                >
                    <span className="monoSm uppercase tracking-[0.18em]" style={{ color: "rgba(167,100,255,0.6)" }}>Cast</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {Object.entries(assignments).map(([slot, name]) => (
                            <div
                                key={slot}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-full monoSm"
                                style={{ background: "rgba(167,100,255,0.10)", border: "1px solid rgba(167,100,255,0.22)", color: "rgba(167,100,255,0.85)" }}
                            >
                                <span style={{ color: "rgba(0,219,233,0.7)", fontSize: "0.7rem" }}>{SLOT_LABELS[slot] ?? slot}</span>
                                <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
                                <span>{name}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}


<motion.div
                className="w-full"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
                <MidiPlayer midiUrl={result.midiUrl} audioUrl={result.userSoundsUrl} />
            </motion.div>

            <motion.button
                onClick={onReset}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-1.5 focus:outline-none mt-1 monoSm"
                style={{ color: "rgba(0,219,233,0.32)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
            >
                <MatIcon name="arrow_back" size="0.8rem" />
                MAKE ANOTHER BEAT
            </motion.button>
        </motion.div>
    )
}

"use client"

import { motion } from "motion/react"
import { MatIcon } from "@/components/MatIcon"
import { MidiPlayer } from "@/components/MidiPlayer"
import type { Clip } from "@/lib/audio"
import type { Sample, TrackMapping } from "@/lib/types"

export function SongResultScreen({
    midiUrl,
    clips,
    samples,
    trackMapping,
    onReset,
    onBackToMapping,
}: {
    midiUrl: string
    clips: Clip[]
    samples: Sample[]
    trackMapping: TrackMapping
    onReset: () => void
    onBackToMapping: () => void
}) {
    return (
        <motion.div
            key="song-result"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col w-full gap-6 max-w-3xl"
        >
            <div className="text-center py-3">
                <motion.h2
                    className="font-headline-lg text-2xl tracking-[0.28em] uppercase"
                    style={{ color: "rgba(167,100,255,0.95)" }}
                    animate={{
                        textShadow: [
                            "0 0 18px rgba(167,100,255,0.25)",
                            "0 0 48px rgba(167,100,255,0.75)",
                            "0 0 18px rgba(167,100,255,0.25)",
                        ],
                    }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                >
                    Song Replaced
                </motion.h2>
                <p className="uppercase tracking-[0.25em] mt-2 monoSm" style={{ color: "rgba(167,100,255,0.42)" }}>
                    Your samples are now playing the song&apos;s notes
                </p>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
                <MidiPlayer
                    midiUrl={midiUrl}
                    clips={clips}
                    samples={samples}
                    trackMapping={trackMapping}
                />
            </motion.div>

            <div className="flex items-center justify-center gap-4 mt-1">
                <motion.button
                    onClick={onBackToMapping}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-1.5 focus:outline-none monoSm"
                    style={{ color: "rgba(167,100,255,0.55)" }}
                >
                    <MatIcon name="tune" size="0.8rem" />
                    REMAP TRACKS
                </motion.button>
                <span style={{ color: "rgba(255,255,255,0.15)" }} className="monoSm">·</span>
                <motion.button
                    onClick={onReset}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-1.5 focus:outline-none monoSm"
                    style={{ color: "rgba(0,219,233,0.45)" }}
                >
                    <MatIcon name="arrow_back" size="0.8rem" />
                    START OVER
                </motion.button>
            </div>
        </motion.div>
    )
}

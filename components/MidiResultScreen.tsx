"use client"

import { motion } from "motion/react"
import { MatIcon } from "@/components/MatIcon"
import { MidiPlayer } from "@/components/MidiPlayer"
import type { Clip } from "@/lib/audio"
import type { InstrumentType, Sample } from "@/lib/types"

const PUBLIC_MIDI_URL = "/twinkle-twinkle-little-star.mid"

export function MidiResultScreen({ clips, samples, assignedTypes, onReset }: {
    clips: Clip[]
    samples: Sample[]
    assignedTypes: InstrumentType[]
    onReset: () => void
}) {
    return (
        <motion.div
            key="midi-result"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col w-full gap-6 max-w-3xl"
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
                    Beat Ready
                </motion.h2>
                <p className="uppercase tracking-[0.25em] mt-2 monoSm" style={{ color: "rgba(0,219,233,0.42)" }}>
                    YOUR TRACK HAS BEEN GENERATED
                </p>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
                <MidiPlayer
                    midiUrl={PUBLIC_MIDI_URL}
                    clips={clips}
                    samples={samples}
                    assignedTypes={assignedTypes}
                />
            </motion.div>

            <motion.button
                onClick={onReset}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="self-center flex items-center gap-1.5 focus:outline-none mt-1 monoSm"
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

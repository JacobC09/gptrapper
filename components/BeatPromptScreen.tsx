"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"

const PRESETS = [
    { id: "trap",      label: "Trap",       icon: "whatshot",      desc: "Hard 808s, hi-hat rolls" },
    { id: "lofi",      label: "Lo-Fi",      icon: "coffee",        desc: "Dusty samples, chill vibes" },
    { id: "drill",     label: "Drill",      icon: "bolt",          desc: "Dark slides, rolling bass" },
    { id: "house",     label: "House",      icon: "graphic_eq",    desc: "Four-on-the-floor kicks" },
    { id: "boombap",   label: "Boom Bap",   icon: "record_voice_over", desc: "Classic breaks, punch" },
    { id: "afrobeats", label: "Afrobeats",  icon: "sunny",         desc: "Percussive grooves, warmth" },
    { id: "dnb",       label: "Drum & Bass",icon: "speed",         desc: "Fast breaks, sub bass" },
    { id: "ambient",   label: "Ambient",    icon: "blur_on",       desc: "Textured pads, space" },
    { id: "hiphop",    label: "Hip-Hop",    icon: "speaker",       desc: "Sampled chops, groove" },
]

export default function BeatPromptScreen({ onConfirm }: { onConfirm: (style: string, additional: string) => void }) {
    const [ selected, setSelected ] = useState<string | null>(null);
    const [ additional, setAdditional] = useState<string>("");

    const valid = selected !== null || additional.trim().length > 0;

    return (
        <motion.div
            key="prompting"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col w-full gap-6 max-w-2xl"
        >
            <div className="text-center">
                <p className="uppercase tracking-[0.22em] monoMd" style={{ color: "rgba(var(--c-cyan),0.9)" }}>
                    Choose a Style
                </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 w-full">
                {PRESETS.map((preset, i) => (
                    <motion.button
                        key={preset.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                        onClick={() => selected == preset.id ? setSelected(null) : setSelected(preset.id)}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="flex flex-col items-center gap-2 rounded-xl px-2 py-4 focus:outline-none relative overflow-hidden"
                        style={{
                            border: selected === preset.id
                                ? "1px solid rgba(var(--c-violet),0.65)"
                                : "1px solid rgba(var(--c-cyan),0.15)",
                            background: selected === preset.id
                                ? "rgba(var(--c-violet),0.08)"
                                : "rgba(var(--c-cyan),0.03)",
                        }}
                    >
                        <AnimatePresence>
                            {selected === preset.id && (
                                <motion.div
                                    className="absolute inset-0 rounded-xl pointer-events-none"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    style={{ boxShadow: "inset 0 0 18px rgba(var(--c-violet),0.1)" }}
                                />
                            )}
                        </AnimatePresence>
                            <motion.span
                                className="material-symbols-outlined"
                                animate={{
                                    color: selected === preset.id ? "rgba(var(--c-violet),0.9)" : "rgba(var(--c-cyan),0.4)",
                                }}
                                transition={{ duration: 0.2 }}
                                style={{ fontSize: "1.6rem", fontVariationSettings: "'FILL' 1" }}
                            >
                                {preset.icon}
                            </motion.span>
                        <motion.span
                            className="uppercase tracking-[0.14em] monoSm text-center leading-tight"
                            animate={{
                                color: selected === preset.id ? "rgba(var(--c-violet),0.95)" : "rgba(var(--c-cyan),0.6)",
                            }}
                            transition={{ duration: 0.2 }}
                        >
                            {preset.label}
                        </motion.span>
                        <span className="monoSm text-center leading-tight" style={{ color: "rgba(var(--c-cyan),0.3)", fontSize: "0.6rem" }}>
                            {preset.desc}
                        </span>
                    </motion.button>
                ))}
            </div>

            <div className="text-center">
                <p className="uppercase tracking-[0.22em] monoMd" style={{ color: "rgba(var(--c-cyan),0.9)" }}>
                    Add Additional Instructions
                </p>
            </div>

            <motion.div 
                className="gap-2 rounded-xl px-2 focus:outline-none relative overflow-hidden border border-[rgba(var(--c-cyan),0.15)] bg-[rgba(var(--c-cyan),0.03)]"
            >
                <textarea 
                    name="additional"
                    value={additional}
                    onChange={(e) => setAdditional(e.target.value)}
                    placeholder="Describe your desired beat..." 
                    className="w-full bg-transparent border-none focus:outline-none monoSm py-4 px-2" 
                />
            </motion.div>
            
            <motion.button
                layout
                onClick={() => valid && onConfirm(selected ?? "", additional)}
                whileHover={valid ? { scale: 1.02 } : {}}
                whileTap={valid ? { scale: 0.97 } : {}}
                className="w-full py-3 rounded-xl focus:outline-none tracking-[0.2em] uppercase monoMd"
                animate={{
                    opacity: valid ? 1 : 0.35,
                }}
                transition={{ duration: 0.2 }}
                style={{
                    background: valid ? "rgba(var(--c-cyan),0.18)" : "rgba(var(--c-cyan),0.06)",
                    border: `1px solid ${valid ? "rgba(var(--c-cyan),0.7)" : "rgba(var(--c-cyan),0.2)"}`,
                    color: "#00dbe9",
                    cursor: valid ? "pointer" : "default",
                }}
            >
                Generate Beat
            </motion.button>
        </motion.div>
    )
}

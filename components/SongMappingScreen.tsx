"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"
import { MatIcon } from "@/components/MatIcon"
import type { Clip } from "@/lib/audio"
import type { InstrumentType, MidiTrackInfo, Sample, TrackMapping } from "@/lib/types"

type Preset = { id: string; url: string; label: string; icon: string }

const PRESETS: Preset[] = [
    { id: "pirates",  url: "/pirates-of-the-caribbean.mid", label: "Pirates of the Caribbean", icon: "sailing" },
    { id: "thickofit", url: "/thick-of-it.mid",              label: "Thick of It",              icon: "graphic_eq" },
]

const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
    aguitar:   "Acoustic Guitar",
    bguitar:   "Bass Guitar",
    eguitar:   "Electric Guitar",
    cello:     "Cello",
    violin:    "Violin",
    flute:     "Flute",
    trumpet:   "Trumpet",
    piano:     "Piano",
    kickdrum:  "Kick Drum",
    snaredrum: "Snare Drum",
    hihat:     "Hi-Hat",
}

type SongSource =
    | { kind: "preset"; presetId: string }
    | { kind: "upload"; name: string; url: string }

function formatTrackLabel(track: MidiTrackInfo): string {
    const name = (track.name || "").trim()
    if (name.length > 0) return name
    if (track.isDrums) return "Drums"
    return track.instrument || `Track ${track.index + 1}`
}

function emptyMapping(tracks: MidiTrackInfo[]): TrackMapping {
    const mapping: TrackMapping = {}
    for (const track of tracks) mapping[track.index] = null
    return mapping
}

export function SongMappingScreen({
    clips,
    samples,
    assignedTypes,
    onConfirm,
    onBack,
}: {
    clips: Clip[]
    samples: Sample[]
    assignedTypes: InstrumentType[]
    onConfirm: (midiUrl: string, mapping: TrackMapping) => void
    onBack: () => void
}) {
    const [source, setSource] = useState<SongSource>({ kind: "preset", presetId: PRESETS[0].id })
    const [tracks, setTracks] = useState<MidiTrackInfo[]>([])
    const [mapping, setMapping] = useState<TrackMapping>({})
    const [loading, setLoading] = useState(true)
    const [parseError, setParseError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const uploadedUrlRef = useRef<string | null>(null)

    const audioRef = useRef<HTMLAudioElement>(null)
    const [previewIdx, setPreviewIdx] = useState<number | null>(null)
    const previewEndRef = useRef(0)

    const midiUrl = source.kind === "preset"
        ? (PRESETS.find(p => p.id === source.presetId)?.url ?? PRESETS[0].url)
        : source.url

    // Parse MIDI whenever source changes
    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        setParseError(null)
        ;(async () => {
            try {
                const res = await fetch(midiUrl, { signal: controller.signal })
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const buf = await res.arrayBuffer()
                const { Midi } = await import("@tonejs/midi")
                const midi = new Midi(buf)
                const trackInfos: MidiTrackInfo[] = midi.tracks
                    .map((t, i) => ({
                        index: i,
                        name: t.name ?? "",
                        instrument: t.instrument?.name ?? "",
                        family: t.instrument?.family ?? "",
                        channel: t.channel ?? 0,
                        isDrums: (t.channel ?? 0) === 9,
                        noteCount: t.notes.length,
                    }))
                    .filter(t => t.noteCount > 0)
                if (trackInfos.length === 0) throw new Error("No playable tracks in MIDI file")
                setTracks(trackInfos)
                setMapping(emptyMapping(trackInfos))
                setLoading(false)
            } catch (e: unknown) {
                if (e instanceof Error && e.name === "AbortError") return
                setParseError(e instanceof Error ? e.message : "Failed to parse MIDI")
                setLoading(false)
            }
        })()
        return () => { controller.abort() }
    }, [midiUrl, samples, assignedTypes])

    // Cleanup uploaded blob URL on unmount or source replacement
    useEffect(() => {
        return () => {
            if (uploadedUrlRef.current) {
                URL.revokeObjectURL(uploadedUrlRef.current)
                uploadedUrlRef.current = null
            }
        }
    }, [])

    const handleFile = (file: File) => {
        if (!/\.midi?$/i.test(file.name)) {
            toast("Please upload a .mid file", { duration: 2000 })
            return
        }
        if (uploadedUrlRef.current) URL.revokeObjectURL(uploadedUrlRef.current)
        const url = URL.createObjectURL(file)
        uploadedUrlRef.current = url
        setSource({ kind: "upload", name: file.name, url })
    }

    const usePreset = (presetId: string) => {
        if (uploadedUrlRef.current) {
            URL.revokeObjectURL(uploadedUrlRef.current)
            uploadedUrlRef.current = null
        }
        setSource({ kind: "preset", presetId })
    }

    const updateMapping = (trackIdx: number, sampleIdx: number | null) => {
        setMapping(prev => ({ ...prev, [trackIdx]: sampleIdx }))
    }

    const handlePreview = (sampleIdx: number) => {
        const audio = audioRef.current
        const sample = samples[sampleIdx]
        const clip = sample ? clips[sample.clip_index] : undefined
        if (!audio || !sample || !clip) return
        if (previewIdx === sampleIdx) {
            audio.pause()
            setPreviewIdx(null)
            return
        }
        previewEndRef.current = sample.start_s + sample.duration_s
        audio.src = clip.url
        audio.currentTime = sample.start_s
        audio.play().catch(() => {})
        setPreviewIdx(sampleIdx)
    }

    const handleTimeUpdate = () => {
        const audio = audioRef.current
        if (!audio) return
        if (audio.currentTime >= previewEndRef.current) {
            audio.pause()
            setPreviewIdx(null)
        }
    }

    const handleConfirm = () => {
        const hasAtLeastOne = Object.values(mapping).some(v => v !== null && v !== undefined)
        if (!hasAtLeastOne) {
            toast("Assign at least one track", { duration: 2000 })
            return
        }
        onConfirm(midiUrl, mapping)
    }

    const sampleOptions = samples.map((sample, i) => {
        const type = assignedTypes[i] ?? "piano"
        return {
            value: i,
            label: `Sample ${i + 1} — ${INSTRUMENT_LABELS[type]}`,
        }
    })

    return (
        <motion.div
            key="song-mapping"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col w-full gap-6 max-w-3xl"
        >
            <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={() => setPreviewIdx(null)} />

            <div className="text-center py-1">
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
                    Replace A Song
                </motion.h2>
                <p className="uppercase tracking-[0.25em] mt-2 monoSm" style={{ color: "rgba(167,100,255,0.42)" }}>
                    Pick a song, map your samples to its tracks
                </p>
            </div>

            {/* Source picker */}
            <div className="flex flex-col gap-3">
                <p className="uppercase tracking-[0.22em] monoSm" style={{ color: "rgba(167,100,255,0.7)" }}>
                    1. Choose Song
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {PRESETS.map(preset => {
                        const active = source.kind === "preset" && source.presetId === preset.id
                        return (
                            <motion.button
                                key={preset.id}
                                onClick={() => usePreset(preset.id)}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex items-center gap-3 px-4 py-3.5 rounded-xl focus:outline-none text-left"
                                style={{
                                    border: active
                                        ? "1px solid rgba(167,100,255,0.65)"
                                        : "1px solid rgba(167,100,255,0.18)",
                                    background: active
                                        ? "rgba(167,100,255,0.10)"
                                        : "rgba(167,100,255,0.02)",
                                }}
                            >
                                <span
                                    className="material-symbols-outlined shrink-0"
                                    style={{
                                        fontSize: "1.4rem",
                                        color: active ? "rgba(167,100,255,0.95)" : "rgba(167,100,255,0.4)",
                                        fontVariationSettings: "'FILL' 1",
                                    }}
                                >
                                    {preset.icon}
                                </span>
                                <div className="flex flex-col gap-0.5 min-w-0">
                                    <span className="monoSm uppercase tracking-[0.16em]" style={{ color: active ? "rgba(167,100,255,0.95)" : "rgba(255,255,255,0.65)" }}>
                                        Preset
                                    </span>
                                    <span className="monoSm truncate" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem" }}>
                                        {preset.label}
                                    </span>
                                </div>
                            </motion.button>
                        )
                    })}

                    <motion.button
                        onClick={() => fileInputRef.current?.click()}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-3 px-4 py-3.5 rounded-xl focus:outline-none text-left"
                        style={{
                            border: source.kind === "upload"
                                ? "1px solid rgba(167,100,255,0.65)"
                                : "1px solid rgba(167,100,255,0.18)",
                            background: source.kind === "upload"
                                ? "rgba(167,100,255,0.10)"
                                : "rgba(167,100,255,0.02)",
                        }}
                    >
                        <span
                            className="material-symbols-outlined shrink-0"
                            style={{
                                fontSize: "1.4rem",
                                color: source.kind === "upload" ? "rgba(167,100,255,0.95)" : "rgba(167,100,255,0.4)",
                                fontVariationSettings: "'FILL' 1",
                            }}
                        >
                            upload_file
                        </span>
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="monoSm uppercase tracking-[0.16em]" style={{ color: source.kind === "upload" ? "rgba(167,100,255,0.95)" : "rgba(255,255,255,0.65)" }}>
                                Upload .mid
                            </span>
                            <span className="monoSm truncate" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem" }}>
                                {source.kind === "upload" ? source.name : "Browse for a MIDI file"}
                            </span>
                        </div>
                    </motion.button>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mid,.midi,audio/midi,audio/x-midi"
                    onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleFile(f)
                        e.target.value = ""
                    }}
                    className="hidden"
                />
            </div>

            {/* Track mapping */}
            <div className="flex flex-col gap-3">
                <p className="uppercase tracking-[0.22em] monoSm" style={{ color: "rgba(167,100,255,0.7)" }}>
                    2. Map Tracks To Samples
                </p>

                <div
                    className="w-full flex flex-col rounded-2xl overflow-hidden"
                    style={{ border: "1px solid rgba(167,100,255,0.18)", background: "rgba(167,100,255,0.02)" }}
                >
                    <AnimatePresence mode="wait">
                        {loading && (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="py-8 text-center monoSm"
                                style={{ color: "rgba(167,100,255,0.5)" }}
                            >
                                PARSING MIDI...
                            </motion.div>
                        )}
                        {!loading && parseError && (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="py-8 text-center monoSm flex items-center justify-center gap-2"
                                style={{ color: "rgba(255,80,80,0.7)" }}
                            >
                                <MatIcon name="error" size="1rem" /> {parseError}
                            </motion.div>
                        )}
                        {!loading && !parseError && tracks.map((track, i) => {
                            const assigned = mapping[track.index] ?? null
                            return (
                                <motion.div
                                    key={track.index}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.04, duration: 0.3 }}
                                    className="flex items-center gap-3 px-5 py-3.5"
                                    style={{
                                        borderBottom: i < tracks.length - 1
                                            ? "1px solid rgba(255,255,255,0.04)"
                                            : undefined,
                                    }}
                                >
                                    <span
                                        className="monoSm shrink-0 px-2 py-0.5 rounded"
                                        style={{
                                            background: "rgba(255,255,255,0.05)",
                                            color: "rgba(255,255,255,0.3)",
                                            fontSize: "10px",
                                            minWidth: "44px",
                                            textAlign: "center",
                                        }}
                                    >
                                        TRK {track.index + 1}
                                    </span>

                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="monoSm truncate" style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.8rem" }}>
                                            {formatTrackLabel(track)}
                                        </span>
                                        <span className="monoSm truncate" style={{ color: "rgba(255,255,255,0.32)", fontSize: "0.65rem" }}>
                                            {track.instrument || "—"} · {track.noteCount} notes{track.isDrums ? " · drums" : ""}
                                        </span>
                                    </div>

                                    <select
                                        value={assigned === null ? "" : String(assigned)}
                                        onChange={(e) => {
                                            const v = e.target.value
                                            updateMapping(track.index, v === "" ? null : Number(v))
                                        }}
                                        className="monoSm shrink-0 px-3 py-1.5 rounded-full uppercase tracking-widest focus:outline-none cursor-pointer"
                                        style={{
                                            background: assigned !== null ? "rgba(167,100,255,0.12)" : "rgba(255,255,255,0.04)",
                                            color: assigned !== null ? "rgba(167,100,255,0.85)" : "rgba(255,255,255,0.4)",
                                            border: `1px solid ${assigned !== null ? "rgba(167,100,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                                            fontSize: "10px",
                                            appearance: "none",
                                            WebkitAppearance: "none",
                                            maxWidth: "200px",
                                        }}
                                    >
                                        <option value="" style={{ background: "#0a0a10", color: "#fff" }}>
                                            — Pick a sample —
                                        </option>
                                        {sampleOptions.map(opt => (
                                            <option key={opt.value} value={opt.value} style={{ background: "#0a0a10", color: "#fff" }}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>

                                    <motion.button
                                        onClick={() => assigned !== null && handlePreview(assigned)}
                                        whileHover={assigned !== null ? { scale: 1.12 } : {}}
                                        whileTap={assigned !== null ? { scale: 0.9 } : {}}
                                        disabled={assigned === null}
                                        className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center focus:outline-none"
                                        style={{
                                            background: previewIdx === assigned && assigned !== null ? "rgba(255,80,80,0.10)" : "rgba(167,100,255,0.08)",
                                            border: previewIdx === assigned && assigned !== null
                                                ? "1px solid rgba(255,80,80,0.45)"
                                                : "1px solid rgba(167,100,255,0.3)",
                                            color: previewIdx === assigned && assigned !== null
                                                ? "rgba(255,110,110,0.9)"
                                                : "rgba(167,100,255,0.7)",
                                            opacity: assigned === null ? 0.3 : 1,
                                            cursor: assigned === null ? "default" : "pointer",
                                        }}
                                    >
                                        <MatIcon name={previewIdx === assigned && assigned !== null ? "pause" : "play_arrow"} size="1rem" />
                                    </motion.button>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                </div>
            </div>

            <div className="flex gap-3">
                <motion.button
                    onClick={onBack}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-xl focus:outline-none uppercase tracking-[0.18em] monoSm"
                    style={{
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "rgba(255,255,255,0.5)",
                    }}
                >
                    <MatIcon name="arrow_back" size="0.9rem" /> Back
                </motion.button>
                <motion.button
                    onClick={handleConfirm}
                    whileHover={loading || parseError ? {} : { scale: 1.02 }}
                    whileTap={loading || parseError ? {} : { scale: 0.97 }}
                    disabled={loading || !!parseError}
                    className="flex-1 py-3 rounded-xl focus:outline-none tracking-[0.2em] uppercase monoMd"
                    style={{
                        background: "rgba(167,100,255,0.18)",
                        border: "1px solid rgba(167,100,255,0.7)",
                        color: "rgba(167,100,255,0.95)",
                        opacity: loading || parseError ? 0.4 : 1,
                        cursor: loading || parseError ? "default" : "pointer",
                    }}
                >
                    Render Song
                </motion.button>
            </div>
        </motion.div>
    )
}

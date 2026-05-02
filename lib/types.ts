export type InstrumentType =
    | "aguitar" | "bguitar" | "eguitar"
    | "cello" | "violin"
    | "flute" | "trumpet"
    | "piano"
    | "kickdrum" | "snaredrum" | "hihat"

export type Sample = {
    clip_index: number
    start_s: number
    duration_s: number
    type?: InstrumentType
}

export type GenerateResponse = {
    status: string
    clips_received: number
    samples: Sample[]
}

// Maps a MIDI track index → sample index (in `samples[]`).
// `null` means "use the default synth for this track".
export type TrackMapping = Record<number, number | null>

export type MidiTrackInfo = {
    index: number
    name: string
    instrument: string
    family: string
    channel: number
    isDrums: boolean
    noteCount: number
}

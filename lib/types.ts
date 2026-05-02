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

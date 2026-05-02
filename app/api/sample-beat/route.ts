import { NextResponse } from "next/server"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { unzipSync } from "fflate"

// Best person per instrument slot (pre-computed from people-classifications.json)
const SLOT_ASSIGNMENTS: Record<string, string> = {
    piano: "Jacob",
    violin: "Atharv",
    cello: "University of Waterloo 25",
    trumpet: "Richard Mao",
    flute: "University of Waterloo 22",
    aguitar: "Adam",
    bguitar: "University of Waterloo 23",
    eguitar: "University of Waterloo 24",
    kickdrum: "John",
    snaredrum: "Dhinakn",
    hihat: "University of Waterloo 26",
}

// Instruments actually used in a typical pirates-style orchestral piece
const PIRATES_SLOTS = ["piano", "violin", "cello", "trumpet", "flute", "bguitar", "kickdrum", "snaredrum"] as const

export async function POST() {
    const backendUrl = process.env.BACKEND_URL
    if (!backendUrl) {
        return NextResponse.json({ error: "BACKEND_URL not configured" }, { status: 500 })
    }

    const wavDir = join(process.cwd(), "public", "people-wavs")
    const clips: Record<string, string> = {}
    const assignments: Record<string, string> = {}

    for (const slot of PIRATES_SLOTS) {
        const name = SLOT_ASSIGNMENTS[slot]
        if (!name) continue
        const wavPath = join(wavDir, `${name}.wav`)
        if (!existsSync(wavPath)) continue
        const bytes = readFileSync(wavPath)
        clips[`clip_${slot}`] = bytes.toString("base64")
        assignments[slot] = name
    }

    if (Object.keys(clips).length === 0) {
        return NextResponse.json({ error: "No people WAV files found" }, { status: 500 })
    }

    const res = await fetch(`${backendUrl}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt: "Swashbuckling pirate adventure orchestral piece in the style of Pirates of the Caribbean movie soundtrack. Dramatic, intense, with strings, brass, and percussion.",
            clips,
        }),
    })

    if (!res.ok) {
        const detail = await res.text().catch(() => `status ${res.status}`)
        return NextResponse.json({ error: `Backend error: ${detail}` }, { status: res.status })
    }

    const zipBytes = new Uint8Array(await res.arrayBuffer())
    const files = unzipSync(zipBytes)

    const toB64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64")

    return NextResponse.json({
        userSounds: toB64(files["user_sounds.wav"]),
        midi: toB64(files["song.mid"]),
        assignments,
    })
}

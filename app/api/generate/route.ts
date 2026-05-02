import { NextRequest, NextResponse } from "next/server"
import type { InstrumentType, Sample } from "@/lib/types"

type ClassifyResponse = {
    scores: Record<string, number>
    best_match: InstrumentType
}

type GenerateResponse = {
    status: string
    clips_received: number
    samples: Sample[]
}

export async function POST(req: NextRequest) {
    const backendUrl = process.env.BACKEND_URL
    if (!backendUrl) {
        return NextResponse.json(
            { error: "BACKEND_URL not configured" },
            { status: 500 },
        )
    }

    const incoming = await req.formData()
    const clipFiles = incoming.getAll("clips").filter((v): v is File => v instanceof File)
    const durations = incoming.getAll("durations_ms").map(v => Number(v))

    if (clipFiles.length === 0) {
        return NextResponse.json({ error: "No clips provided" }, { status: 400 })
    }

    const samples: Sample[] = []
    for (let i = 0; i < clipFiles.length; i++) {
        const fd = new FormData()
        fd.append("audio", clipFiles[i], clipFiles[i].name || `clip_${i}.webm`)

        const res = await fetch(`${backendUrl}/classify`, { method: "POST", body: fd })
        if (!res.ok) {
            const text = await res.text()
            console.error(`Backend /classify failed for clip ${i}:`, res.status, text)
            return NextResponse.json(
                { error: `Backend error ${res.status}` },
                { status: res.status },
            )
        }

        const json = await res.json() as ClassifyResponse
        const durationS = Number.isFinite(durations[i]) && durations[i] > 0
            ? durations[i] / 1000
            : 30 // generous fallback, MidiPlayer's slice() clamps to actual buffer length

        samples.push({
            clip_index: i,
            start_s: 0,
            duration_s: durationS,
            type: json.best_match,
        })
    }

    const response: GenerateResponse = {
        status: "ok",
        clips_received: clipFiles.length,
        samples,
    }
    return NextResponse.json(response)
}

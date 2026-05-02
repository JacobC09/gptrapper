import { NextRequest, NextResponse } from "next/server"
import { unzipSync } from "fflate"

export async function POST(req: NextRequest) {
    const backendUrl = process.env.BACKEND_URL

    const formData = await req.formData()
    const prompt = formData.get("prompt") as string
    const clips: Record<string, string> = {}

    let i = 1
    for (const value of formData.getAll("clips")) {
        if (value instanceof File) {
            const bytes = await value.arrayBuffer()
            clips[`clip${i}`] = Buffer.from(bytes).toString("base64")
            i++
        }
    }

    const res = await fetch(`${backendUrl}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, clips }),
    })

    if (!res.ok) {
        return NextResponse.json({ error: `Backend error ${res.status}` }, { status: res.status })
    }

    const zipBytes = new Uint8Array(await res.arrayBuffer())
    const files = unzipSync(zipBytes)

    const toB64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64")

    return NextResponse.json({
        original: toB64(files["original.wav"]),
        userSounds: toB64(files["user_sounds.wav"]),
        midi: toB64(files["song.mid"]),
    })
}

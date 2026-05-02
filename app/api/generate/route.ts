import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
    const backendUrl = process.env.BACKEND_URL

    const res = await fetch(`${backendUrl}/generate`, {
        method: "POST",
        body: req.body,
        headers: { "content-type": req.headers.get("content-type") ?? "" },
        // @ts-expect-error — required for streaming request bodies in Node.js
        duplex: "half",
    })

    if (!res.ok) {
        const text = await res.text()
        console.error("Backend error:", text)
        return NextResponse.json({ error: `Backend error ${res.status}` }, { status: res.status })
    }

    const json = await res.json()
    return NextResponse.json(json)
}

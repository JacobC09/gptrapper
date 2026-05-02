import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
    const backendUrl = process.env.BACKEND_URL

    try {
        const body = await req.json()
        const res = await fetch(`${backendUrl}/compose`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
        if (res.ok) {
            const json = await res.json()
            return NextResponse.json(json)
        }
    } catch {
        // Backend not yet implemented
    }

    return NextResponse.json({ status: "ok" })
}

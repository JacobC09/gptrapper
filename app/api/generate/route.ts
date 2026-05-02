import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
    const backendUrl = process.env.BACKEND_URL;

    const formData = await req.formData()

    console.log("Sent Request to Server")
    console.log(formData.keys())

    const res = await fetch(`${backendUrl}/generate`, {
        method: "POST",
        body: formData,
    })

    if (!res.ok) {
        return NextResponse.json({ error: `Backend error ${res.status}` }, { status: res.status })
    }

    const blob = await res.blob()
    return new NextResponse(blob, {
        headers: { "Content-Type": res.headers.get("Content-Type") ?? "audio/mpeg" },
    })
}

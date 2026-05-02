export const BAR_COUNT = 50

export type Clip = {
    id: string
    url: string
    bars: number[]
    durationMs: number
    ext: string
}

export function formatTime(ms: number): string {
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    const cs = Math.floor((ms % 1000) / 10)
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`
}

export function extFromMime(mime: string): string {
    if (mime.includes("ogg")) return "ogg"
    if (mime.includes("mp4")) return "mp4"
    return "webm"
}

export function drawWaveform(canvas: HTMLCanvasElement, bars: number[]) {
    console.log(bars)
    const ctx = canvas.getContext("2d")!
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)
    if (bars.length === 0) return
    // Stretch short clips to at least BAR_COUNT columns so they don't look blocky
    const count = Math.max(bars.length, BAR_COUNT)
    const bw = Math.max((W / count) * 0.75, 1)
    ctx.fillStyle = "rgba(0,219,233,0.55)"
    for (let i = 0; i < count; i++) {
        const t = bars.length <= 1 ? 0 : (i / (count - 1)) * (bars.length - 1)
        const lo = Math.floor(t)
        const hi = Math.min(lo + 1, bars.length - 1)
        const val = bars[lo] + (bars[hi] - bars[lo]) * (t - lo)
        const h = Math.max(Math.min(val * H * 10, H - 2), 2)
        ctx.fillRect((i / count) * W, (H - h) / 2, bw, h)
    }
}

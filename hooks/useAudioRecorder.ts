import { useState, useRef, useCallback, useEffect } from "react"
import { BAR_COUNT, extFromMime, type Clip } from "@/lib/audio"

export type { Clip }

export function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false)
    const [elapsedMs, setElapsedMs] = useState(0)
    const [bars, setBars] = useState<number[]>(Array(BAR_COUNT).fill(0))

    const analyserRef = useRef<AnalyserNode | null>(null)
    const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const audioCtxRef = useRef<AudioContext | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const startTimeRef = useRef<number>(0)
    const chunksRef = useRef<BlobPart[]>([])
    const barsAccRef = useRef<number[]>([])
    const tickRef = useRef(0)

    const stop = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        streamRef.current?.getTracks().forEach(t => t.stop())
        audioCtxRef.current?.close()
        analyserRef.current = null
        dataArrayRef.current = null
        mediaRecorderRef.current?.stop()
    }, [])

    const start = useCallback(async (onClipReady: (clip: Clip) => void) => {
        try {
            barsAccRef.current = []
            tickRef.current = 0

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream

            const audioCtx = new AudioContext()
            audioCtxRef.current = audioCtx
            const analyser = audioCtx.createAnalyser()
            analyser.fftSize = 1024
            audioCtx.createMediaStreamSource(stream).connect(analyser)
            analyserRef.current = analyser
            dataArrayRef.current = new Uint8Array(analyser.fftSize)

            chunksRef.current = []
            const recorder = new MediaRecorder(stream)
            mediaRecorderRef.current = recorder

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            recorder.onstop = () => {
                const mime = recorder.mimeType
                const blob = new Blob(chunksRef.current, { type: mime })
                onClipReady({
                    id: crypto.randomUUID(),
                    url: URL.createObjectURL(blob),
                    bars: [...barsAccRef.current],
                    durationMs: Date.now() - startTimeRef.current,
                    ext: extFromMime(mime),
                })
                setBars(Array(BAR_COUNT).fill(0))
                setIsRecording(false)
            }

            recorder.start()
            startTimeRef.current = Date.now()
            setElapsedMs(0)
            setIsRecording(true)

            intervalRef.current = setInterval(() => {
                tickRef.current++
                if (tickRef.current % 5 !== 0) return
                const analyser = analyserRef.current
                const dataArray = dataArrayRef.current
                if (!analyser || !dataArray) return
                analyser.getByteTimeDomainData(dataArray)
                let sumSq = 0
                for (let i = 0; i < dataArray.length; i++) {
                    const v = dataArray[i] - 128
                    sumSq += v * v
                }
                const rms = Math.sqrt(sumSq / dataArray.length) / 128
                barsAccRef.current.push(rms)
                setElapsedMs(Date.now() - startTimeRef.current)
                setBars(prev => [...prev.slice(1), rms])
            }, 10)
        } catch {
            console.error("Microphone access denied")
        }
    }, [])

    useEffect(() => () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        streamRef.current?.getTracks().forEach(t => t.stop())
        audioCtxRef.current?.close()
    }, [])

    return { isRecording, elapsedMs, bars, start, stop }
}

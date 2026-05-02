# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint (v9 flat config)
```

## Stack

- **Next.js 16** App Router, React 19, TypeScript 5
- **Tailwind CSS v4** (PostCSS plugin, no config file — theme defined entirely in `globals.css` via `@theme`)
- **shadcn/ui** (radix-nova style) — add components with `npx shadcn@latest add <component>`
- **motion/react** (not `framer-motion`) for animations — import from `"motion/react"`
- **sonner** for toasts — `<Toaster>` is in `app/layout.tsx`, call `toast()` from `"sonner"`

## Architecture

This is a single-page audio recorder app. All logic lives in `app/page.tsx` as a client component (`"use client"`).

**`useAudioRecorder()` hook** — owns all Web Audio API state: `AudioContext`, `MediaRecorder`, `AnalyserNode`, stream refs, and recording timer. Returns `{ isRecording, elapsedMs, bars, start, stop }`.

**`drawWaveform(canvas, bars)`** — renders 50-bar frequency visualization to a canvas element. Canvas is 800×H px internally but displayed smaller via inline style (CSS scaling).

**Clip management** — clips are stored as `{ id, url, duration }` in `useState`. URLs are `URL.createObjectURL` blobs; they're revoked on component unmount.

**`ClipRow`** — renders a single clip with a canvas waveform snapshot (drawn once on mount via `useEffect`), play/pause toggle through an `<audio>` ref, and a delete button.

## Styling Conventions

- **Theme tokens** are in `app/globals.css` under `@theme` — use `--color-surface-tint` (`#00dbe9`) for the primary cyan accent.
- The app is **dark-only** — `class="dark"` is hardcoded on `<html>` in `layout.tsx`.
- Neon/cyberpunk aesthetic: `rgba(0,219,233,...)` for cyan tints, `rgba(255,180,171,...)` for red/error accents.
- Inline `style` objects are used for fine-grained opacity control alongside Tailwind classes.
- Fonts: **Manrope** (`font-body-md`) for body text, **Space Grotesk** (`font-label-*`, `font-headline-*`) for labels, **Courier New** (inline) for monospace clip labels/timers.
- Material Symbols Outlined icons are loaded via Google Fonts in `layout.tsx` — use `<span className="material-symbols-outlined">icon_name</span>`.

## Project Description

This is the front end portion of an app where you can upload audio clips, the backend will parse the audio files and create a beat using the provided audio clips

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# RimChronicle — Storytelling Engine

A desktop app (Electron) for turning RimWorld playthrough logs into a living, AI-narrated colony wiki: articles, characters with traits & bionics, relationships, relics, and a Chronicle Timeline with Downtime Dice filler events.

## Run as a Desktop App

**Prerequisites:** Node.js and an [OpenCode Zen](https://opencode.ai/auth) API key.

1. Install dependencies:
   `npm install`
2. Set the `OPENCODE_API_KEY` in `.env` (copy `.env.example`). Optionally set `OPENCODE_PROVIDER` to `zen` (default) or `go`, and `OPENCODE_MODEL` to any model from the gateway catalog.
3. Build and launch the desktop window:
   `npm start`

RimChronicle is fully local: the renderer loads from `dist/` over `file://` and every AI request travels over Electron IPC to the backend in the main process — no HTTP server is started. Only calls to the OpenCode gateway itself leave your machine.

You can switch between OpenCode Zen and OpenCode Go — and pick any model from either catalog — live, using the dropdowns in the app header. Your choice is saved to your user data directory and survives restarts.

## Package Installers

Build distributable installers (NSIS `.exe`, `.dmg`, `.AppImage`, `.deb`) into `release/`:

    npm run package

## Advanced: Browser Development Mode

For UI-only iteration with Vite HMR (AI features require the desktop app, since the backend lives inside Electron):

    npm run dev

# Mekuri

A lightweight local comic/manga reader for macOS, built with Tauri.

## Features

- Open **CBZ**, **CBR**, **ZIP**, **RAR** files and **image folders**
- **RTL / LTR** reading direction toggle (manga / western comics)
- **Spread / Single** page view modes
- **Keyboard controls**: arrow keys, space, Home/End, ESC
- **Click navigation**: click left/right side of the screen to turn pages
- **Drag & drop** to open files
- **Reading history** with last-read page memory
- **Dark theme** optimized for reading

## Install

Download the latest `.dmg` from [Releases](https://github.com/piro0919/mekuri/releases).

## Development

```bash
pnpm install
pnpm tauri dev
```

## Build

```bash
APPLE_SIGNING_IDENTITY="-" pnpm tauri build
```

## Tech Stack

- **Tauri v2** (Rust backend)
- **React + Vite + TypeScript** (frontend)
- **pnpm** (package manager)
- **zip** / **unrar** crates for archive extraction

## License

MIT

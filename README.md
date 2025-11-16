# WebDav-UI

Modern WebDAV-powered file explorer and preview UI built with Next.js, React, and TypeScript. It provides a clean web interface for browsing shares, previewing files, and doing basic management (upload, delete, edit text) against a WebDAV server.

## Features

- **WebDAV-backed explorer**: Browse directories and files from a configured WebDAV share.
- **Rich previews**:
  - Images, audio, and video (including HLS streaming).
  - PDFs and common Office/doc formats.
  - Text/code with syntax highlighting and zoom.
- **Inline text editing**: Logged-in users can edit text files directly in the browser; changes are autosaved back to WebDAV.
- **File operations**:
  - Upload files into the current folder.
  - Toggle delete mode, select multiple files, and delete in one action without reloading the page.
- **Auth-aware UI**: Login/logout flow, with protected actions for authenticated users.
- **Responsive design**: Desktop and mobile-friendly layout with a mobile nav.
- **Theme toggle**: Switch between light and dark themes.

## Tech Stack

- **Framework**: Next.js `16.x` (App Router) with React `19.x`, TypeScript.
- **Styling**: SCSS Modules + custom theme variables.
- **WebDAV**: `webdav` client plus custom API routes in `app/api/webdav`.
- **Previews & utilities**:
  - `react-pdf` + `pdfjs-dist` for PDFs.
  - `react-syntax-highlighter` for text/code.
  - `docx-preview` and custom viewers for Office/doc formats.
  - `mime-types` for content detection.
  - `material-file-icons` for file icons.
  - `@ffmpeg-installer/ffmpeg` + `fluent-ffmpeg` for media handling.

## Project Layout

- `app/`
  - `page.tsx`: Landing page / share entry.
  - `[share]/[[...path]]/page.tsx`: Main file explorer for a given share.
  - `preview/[...filepath]/page.tsx`: Dedicated file preview route.
  - `api/webdav/`: WebDAV proxy + helpers (listing, file fetch, delete, upload, text-save, etc.).
  - `components/`: UI components (file explorer, previews, auth, theme toggle, etc.).
  - `context/AuthContext.tsx`: Simple auth status + login/logout hooks.
  - `styles/`: SCSS modules for explorer, previews, and common styles.
- `lib/`: WebDAV client/server/stream helpers.
- `public/`: Static assets.
- `tests/`: Jest tests for pages and WebDAV helpers.

## Getting Started

### Prerequisites

- Node.js `>= 18`.
- A reachable WebDAV server (URL and credentials).

### Installation

```bash
git clone https://github.com/enVId-tech/WebDav-UI.git
cd WebDav-UI
npm install
```

### Configuration

1. Copy the example env file and adjust it:

```bash
cp example.env.local .env.local
```

2. Open `.env.local` and set at least:

- `WEBDAV_URL` – base URL to your WebDAV server.
- Any auth-related secrets or credentials required by your deployment.

Refer to comments in `example.env.local` for all supported options.

### Development

Start the dev server:

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser. Use the main page to navigate into a share (e.g. `/etran`) and explore files.

### Tests

This repo is wired for Jest tests (see `tests/`), but Jest is not bundled globally. To run tests you may need to install it (e.g. `npm install --save-dev jest @types/jest ts-jest`) or adapt the test setup to your environment, then run:

```bash
npm test
```

## Production Build

Build and start the app in production mode:

```bash
npm run build
npm run start
```

## Docker

The included `Dockerfile` lets you build and run the app in a container:

```bash
docker build -t webdav-ui .
docker run -p 3000:3000 --env-file .env.local webdav-ui
```

## License

This project is licensed under the terms in the [`LICENSE`](LICENSE) file.

## Contributing

Bug reports, feature ideas, and pull requests are welcome. Please open an issue or PR in this repository.

# WebDav-UI

A modern, responsive, and feature-rich WebDAV file explorer and preview interface built with Next.js 16, React 19, and TypeScript. This application provides a seamless way to browse, manage, and preview files stored on any WebDAV-compliant server.

## Features

- **WebDAV Explorer**: Browse directories and files with a familiar, intuitive interface.
- **Rich File Previews**:
  - **Images**: Native preview support.
  - **Media**: Audio and Video playback (including HLS streaming support).
  - **Documents**: PDF rendering and Office document previews (DOCX, etc.).
  - **Code/Text**: Syntax highlighting with zoom capabilities.
  - **Databases**: SQLite file preview support.
- **Advanced Search**: 
  - Real-time search functionality.
  - **Pagination**: Efficiently handle large search results with adjustable items per page (25, 50, 100, 200).
  - **Filtering**: Quick filters for Folders, Videos, Images, Audio, and Documents.
- **Customizable View**:
  - **View Modes**: Switch between List and Grid views.
  - **Sizing**: Adjustable icon sizes (Small, Medium, Large).
  - **Sorting**: Sort by Name, Date, or Size.
  - **Themes**: Built-in Light and Dark mode toggle.
- **File Management**:
  - **Upload**: Drag-and-drop or file selection for uploads.
  - **Edit**: Inline text editor for code and text files with auto-save.
  - **Delete**: Batch delete functionality with selection mode.
- **Authentication & Security**:
  - Configurable Guest Access (Public/Private modes).
  - Admin dashboard for permissions management.
  - Protected write operations.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **UI Library**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: SCSS Modules with CSS Variables for theming.
- **WebDAV Client**: `webdav` library for protocol communication.
- **Media Processing**: `fluent-ffmpeg` for media handling.
- **PDF Rendering**: `react-pdf`.

## Project Structure

```
app/
├── [share]/            # Dynamic route for file browsing
├── admin/              # Admin dashboard
├── api/                # API routes (Auth, WebDAV proxy, Config)
├── components/         # Reusable UI components
│   ├── FileExplorer/   # Main explorer logic and UI
│   └── ...             # Previewers (PDF, Video, Text, etc.)
├── context/            # React Context (Auth)
├── login/              # Login page
├── preview/            # Standalone file preview route
└── styles/             # Global and module SCSS files
lib/                    # Utilities (WebDAV client, Auth helpers)
types/                  # TypeScript definitions
```

## Getting Started

### Prerequisites

- Node.js 18+ installed.
- Access to a WebDAV server (e.g., Nextcloud, Apache WebDAV, rclone serve).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/enVId-tech/WebDav-UI.git
    cd WebDav-UI
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment:**
    Copy the example environment file:
    ```bash
    cp example.env.local .env.local
    ```
    
    Edit `.env.local` and configure your WebDAV connection:
    ```env
    # WebDAV Server Configuration
    WEBDAV_URL=https://your-webdav-server.com/remote.php/dav/files/user/
    WEBDAV_USERNAME=your_username
    WEBDAV_PASSWORD=your_password

    # App Admin Credentials
    ADMIN_USERNAME=admin
    ADMIN_PASSWORD=secure_password

    # Security
    GUEST_ACCESS_ENABLED=true # Set to false to force login for all access
    ```

4.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Configuration Options

### Guest Access
- **Enabled (`true`)**: Public users can browse and view files. Write operations (Upload, Delete, Edit) require login.
- **Disabled (`false`)**: All access requires authentication. Users are redirected to login immediately.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

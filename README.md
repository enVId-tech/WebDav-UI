# WebDavUI - Modern WebDAV File Explorer

WebDavUI is a modern, responsive web application that provides an intuitive interface for accessing, browsing, and managing files through WebDAV protocol. Built with Next.js and React, it offers a seamless file exploration experience with rich file previewing capabilities.

## Features

- **WebDAV Integration**: Connect to any WebDAV-compatible server
- **File Explorer**: Browse directories and files with an intuitive UI
- **File Preview**: Preview various file types directly in the browser:
  - Images
  - Videos
  - Audio files
  - PDFs
  - Office documents
  - Text files with syntax highlighting
- **Responsive Design**: Works on desktop and mobile devices
- **Share System**: Access shared folders through simple URLs
- **Theme Toggle**: Switch between light and dark modes

## Tech Stack

- **Frontend**:
  - Next.js 15.x
  - React 19.x
  - TypeScript
  - SCSS Modules for styling

- **Libraries**:
  - `webdav`: For WebDAV protocol communication
  - `react-pdf`: PDF viewing
  - `react-syntax-highlighter`: Syntax highlighting for code files
  - `mime-types`: File type detection
  - `material-file-icons`: File icons
  - `pdfjs-dist`: PDF rendering

## Project Structure

- `/app`: Next.js app directory
  - `/page.tsx`: Homepage with share access
  - `/[share]/[[...path]]/page.tsx`: File explorer for a specific share
  - `/preview/[...filepath]/page.tsx`: File preview pages
  - `/api/webdav/`: API routes for WebDAV communication
  - `/components/`: React components for different file previews
  - `/styles/`: SCSS modules for styling
  - `/types/`: TypeScript type definitions

- `/lib`: WebDAV client and server utilities
- `/public`: Static assets 

## Getting Started

### Prerequisites

- Node.js (v18.x or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/webdavui.git
cd webdavui
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Run the development server
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Configuration

Configure your WebDAV server details in the appropriate configuration files.

## Building for Production

```bash
npm run build
npm run start
# or
yarn build
yarn start
```

## Docker Support

A Dockerfile is included for containerized deployment:

```bash
docker build -t webdavui .
docker run -p 3000:3000 webdavui
```

## License

This project is licensed under the terms included in the [LICENSE](LICENSE) file.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgements

- Built with [Next.js](https://nextjs.org/)
- WebDAV protocol handling with [webdav](https://www.npmjs.com/package/webdav)

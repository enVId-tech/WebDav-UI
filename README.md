# WebDAV File Explorer

A modern, web-based file explorer for browsing and managing WebDAV shares with an intuitive interface.

Accessible at [webdavui.etran.dev](https://webdevui.etran.dev)

## Features

- **Simple Share Access**: Easily connect to WebDAV shares by entering the share name
- **Dual-Pane Interface**: Folder hierarchy tree on the left, file list on the right
- **Intuitive Navigation**: Breadcrumb navigation and folder tree for quick access
- **File Preview**: Preview supported file types directly in the browser
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Clean, modern interface with gradient accents and card-based design

## Getting Started

### Prerequisites

- Node.js (v14.x or higher)
- npm or yarn
- A WebDAV server to connect to

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/webdav-explorer.git
   cd webdav-explorer
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your WebDAV configuration:
   ```
   WEBDAV_URL=https://your-webdav-server.com/
   ```

4. Start the development server
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. On the homepage, enter the name of your WebDAV share in the input field
2. Click "Access Files" to browse that share's contents
3. Navigate through folders using either:
    - The folder tree on the left sidebar
    - The file list on the right pane
    - The breadcrumb navigation at the top
4. Click on files to view or download them

## Technology Stack

- [Next.js](https://nextjs.org/) - React framework with file-based routing
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [SCSS Modules](https://github.com/css-modules/css-modules) - Component-scoped CSS
- [WebDAV Client](https://github.com/perry-mitchell/webdav-client) - WebDAV communication library

## Project Structure

```
├── app                  # Next.js app directory
│   ├── page.tsx         # Homepage
│   ├── [share]          # Dynamic routes for share browsing
│   │   └── [[...path]]  # Nested dynamic routes for folder paths
│   ├── homepage.module.scss  # Styles for homepage
│   └── fileserver.module.scss # Styles for file explorer
├── lib                  # Utility functions and services
│   └── webdav-client.ts # WebDAV client implementation
└── public               # Static assets
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
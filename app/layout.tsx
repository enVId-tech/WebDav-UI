import type { Metadata } from "next";

import "./globals.scss";
import WebDavLogoSrc from "@/public/webdavlogo.svg";
import { AuthProvider } from "./context/AuthContext";
import { geistSans, geistMono } from "./types/font";
import { Suspense } from "react";

export const metadata: Metadata = {
    title: "WebDav UI",
    description: `A web interface for WebDav servers, allowing users to browse, upload, download, and manage files seamlessly.\n\nCreated and developed by enVId Tech - Erick Tran`,
    // Helpful SEO keywords for search engines and suggestion lists
    keywords: [
        "WebDAV",
        "WebDAV client",
        "WebDAV UI",
        "Web file manager",
        "file explorer",
        "file preview",
        "document viewer",
        "video streaming",
        "audio streaming",
        "image preview",
        "Next.js",
        "React",
        "TypeScript",
        "file sharing",
        "upload download",
        "enVId Tech",
        "WebDAV server",
    ],
    authors: [
        { name: 'enVId Tech', url: 'https://github.com/enVId-tech' },
        { name: 'Erick Tran' }
    ],
    // OpenGraph for social sharing
    openGraph: {
        title: 'WebDav UI — web interface for WebDav servers',
        description: 'Manage files, preview documents, stream audio/video, and more via a clean web interface for WebDAV servers.',
        url: process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com',
        siteName: 'WebDav UI',
        images: [
            {
                url: WebDavLogoSrc.src,
                width: 800,
                height: 600,
                alt: 'WebDav UI Logo'
            }
        ],
        locale: 'en_US',
        type: 'website',
    },
    // Twitter card for tweets
    twitter: {
        card: 'summary_large_image',
        title: 'WebDav UI — web interface for WebDav servers',
        description: 'Manage files, preview documents, stream audio/video, and more via a clean web interface for WebDAV servers.',
        images: [WebDavLogoSrc.src],
    },
    viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1
        }
    },
    icons: {
        icon: WebDavLogoSrc.src,
        apple: WebDavLogoSrc.src,
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Add a HEAD-level preconnect/dns-prefetch for WebDAV server if it is configured
    const webdavUrl = process.env.NEXT_PUBLIC_WEBDAV_URL || process.env.WEBDAV_URL || '';
    let webdavOrigin: string | null = null;
    try {
        if (webdavUrl) {
            webdavOrigin = new URL(webdavUrl).origin;
        }
    } catch (e) {
        webdavOrigin = null;
    }
    
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                {webdavOrigin ? (
                    <>
                        <link rel="preconnect" href={webdavOrigin} crossOrigin="anonymous" />
                        <link rel="dns-prefetch" href={webdavOrigin} />
                    </>
                ) : null}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    const savedTheme = localStorage.getItem('theme');
                                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                                    const isDarkMode = savedTheme === 'dark' || (!savedTheme && prefersDark);
                                    
                                    if (isDarkMode) {
                                        document.documentElement.classList.add('dark');
                                        document.documentElement.classList.remove('light');
                                    } else {
                                        document.documentElement.classList.add('light');
                                        document.documentElement.classList.remove('dark');
                                    }
                                } catch (e) {
                                    // Fallback to light mode if any error occurs
                                    document.documentElement.classList.add('light');
                                    document.documentElement.classList.remove('dark');
                                }
                            })();
                        `,
                    }}
                />
                {/* Provide a small JSON-LD snippet for search engines */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "WebSite",
                            name: metadata.title,
                            url: process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com',
                            description: metadata.description,
                        }),
                    }}
                />
            </head>
            <body className={`${geistSans.variable} ${geistMono.variable}`}>
                <AuthProvider>
                    <Suspense>
                        {children}
                    </Suspense>
                </AuthProvider>
            </body>
        </html>
    );
}

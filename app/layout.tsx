import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.scss";
import WebDavLogoSrc from "@/public/webdavlogo.svg";
import Head from "next/head";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "WebDav UI",
    description: "Developed by Erick Tran",
    keywords: ["WebDav", "Web", "Dav", "UI"],
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
    return (
        <html lang="en">
        <Head>
            <link rel="apple-touch-icon" href={WebDavLogoSrc.src} />
            <link rel="icon" href={WebDavLogoSrc.src} />
            <link rel="manifest" href={WebDavLogoSrc.src} />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta name="theme-color" content="#000000" />
            <meta name="description" content="Developed by Erick Tran" />
            <meta name="keywords" content="WebDav, Web, Dav, UI" />
        </Head>
        <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        </body>
        </html>
    );
}
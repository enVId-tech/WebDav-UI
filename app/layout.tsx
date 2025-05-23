import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.scss";
import WebDavLogoSrc from "@/public/webdavlogo.svg";
import { AuthProvider } from "./context/AuthContext"; // Import AuthProvider

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
        <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AuthProvider> {/* Wrap children with AuthProvider */}
            {children}
        </AuthProvider>
        </body>
        </html>
    );
}


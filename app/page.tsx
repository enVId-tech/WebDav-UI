'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/app/homepage.module.scss';
import commonStyles from '@/app/styles/common.module.scss';
import ThemeToggle from '@/app/components/ThemeToggle';

export default function HomePage() {
    const router = useRouter();
    const [shareInput, setShareInput] = useState('');
    const [error, setError] = useState('');

    // Handle accessing a share
    const accessShare = (e: React.FormEvent): void => {
        e.preventDefault();

        if (!shareInput.trim()) {
            setError('Please enter a share name');
            return;
        }

        // Clean the input and navigate to the share
        const cleanedShare = shareInput.trim().replace(/[^a-zA-Z0-9-_]/g, '');
        router.push(`/${cleanedShare}`);
    };

    return (
        <div className={`${styles.homePage} ${commonStyles.themeVariables}`}>
            <ThemeToggle />
            <div className={styles.container}>
                <header className={styles.header}>
                    <h1>WebDav-UI</h1>
                    <p className={styles.subtitle}>Modern WebDAV-powered file management, reimagined for the web</p>
                </header>

                <section className={styles.heroSection}>
                    <div className={styles.heroContent}>
                        <h2>Transform how you interact with your files</h2>
                        <p>
                            Experience a powerful, browser-based file explorer built on Next.js and WebDAV. 
                            Navigate folder hierarchies with an intuitive tree view, preview rich media and 
                            documents without downloading, edit text files inline with autosave, and manage 
                            your content—all from any device with a modern web browser.
                        </p>

                        <form className={styles.accessForm} onSubmit={accessShare}>
                            <div className={styles.inputGroup}>
                                <input
                                    type="text"
                                    value={shareInput}
                                    onChange={(e) => setShareInput(e.target.value)}
                                    placeholder="Enter your WebDAV share name"
                                    className={styles.shareInput}
                                    aria-label="WebDAV share name"
                                />
                                <button type="submit" className={styles.accessButton}>
                                    Launch Explorer
                                </button>
                            </div>
                            {error && <div className={styles.errorMessage}>{error}</div>}
                            <p className={styles.inputHint}>
                                Enter the name of your configured WebDAV share to begin exploring
                            </p>
                        </form>
                    </div>
                    <div className={styles.heroImage}>
                        <div className={styles.fileExplorerImage}>
                            <div className={styles.mockTreeView}>
                                <div className={styles.mockFolder}>📁 Documents</div>
                                <div className={styles.mockFolder}>📁 Media</div>
                                <div className={styles.mockFolder}>📁 Projects</div>
                                <div className={styles.mockFolder}>📁 Archives</div>
                            </div>
                            <div className={styles.mockFileView}>
                                <div className={styles.mockFileRow}><span>📄</span> Presentation.pdf</div>
                                <div className={styles.mockFileRow}><span>📊</span> Analytics.xlsx</div>
                                <div className={styles.mockFileRow}><span>🎬</span> Demo.mp4</div>
                                <div className={styles.mockFileRow}><span>📝</span> README.md</div>
                                <div className={styles.mockFileRow}><span>🖼️</span> Banner.png</div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={styles.featuresSection}>
                    <h2>Powerful Features for Modern File Management</h2>
                    <div className={styles.featureGrid}>
                        <div className={styles.featureCard}>
                            <div className={styles.featureIcon}>🌲</div>
                            <h3>Hierarchical Navigation</h3>
                            <p>Explore your directory structure with a responsive tree view and breadcrumb navigation</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureIcon}>👁️</div>
                            <h3>Rich Media Previews</h3>
                            <p>View images, videos (HLS streaming), audio, PDFs, Office docs, and code with syntax highlighting</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureIcon}>✏️</div>
                            <h3>Inline Text Editing</h3>
                            <p>Edit text and code files directly in the browser with auto-save to WebDAV</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureIcon}>📤</div>
                            <h3>File Operations</h3>
                            <p>Upload multiple files, batch delete, and manage content without page reloads</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureIcon}>🔐</div>
                            <h3>Secure Authentication</h3>
                            <p>Login-protected actions with session management for secure file operations</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureIcon}>📱</div>
                            <h3>Fully Responsive</h3>
                            <p>Optimized for desktop and mobile with adaptive layouts and touch-friendly controls</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureIcon}>🎨</div>
                            <h3>Theme Support</h3>
                            <p>Switch between light and dark modes with smooth transitions and custom styling</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureIcon}>⚡</div>
                            <h3>Next.js Performance</h3>
                            <p>Built on Next.js 16 with React 19, TypeScript, and modern web standards</p>
                        </div>
                    </div>
                </section>

                <section className={styles.techSection}>
                    <h2>Built with Modern Technology</h2>
                    <div className={styles.techContent}>
                        <p>
                            WebDav-UI leverages cutting-edge web technologies to deliver a seamless experience. 
                            Powered by <strong>Next.js 16</strong> with the App Router, <strong>React 19</strong>, 
                            and <strong>TypeScript</strong>, it provides type-safe, server-rendered performance. 
                            Rich previews are enabled through specialized libraries including react-pdf, 
                            react-syntax-highlighter, and docx-preview, while FFmpeg handles media transcoding 
                            for adaptive streaming.
                        </p>
                        <div className={styles.techStack}>
                            <span className={styles.techBadge}>Next.js 16</span>
                            <span className={styles.techBadge}>React 19</span>
                            <span className={styles.techBadge}>TypeScript</span>
                            <span className={styles.techBadge}>WebDAV</span>
                            <span className={styles.techBadge}>SCSS Modules</span>
                            <span className={styles.techBadge}>HLS Streaming</span>
                        </div>
                    </div>
                </section>

                <section className={styles.quickStartSection}>
                    <h2>Get Started in Seconds</h2>
                    <div className={styles.quickStartSteps}>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>1</div>
                            <div className={styles.stepContent}>
                                <h3>Access Your Share</h3>
                                <p>Enter the name of your WebDAV share in the input field above and click "Launch Explorer"</p>
                            </div>
                        </div>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>2</div>
                            <div className={styles.stepContent}>
                                <h3>Navigate Intuitively</h3>
                                <p>Use the tree view sidebar or file list to browse directories and locate your content</p>
                            </div>
                        </div>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>3</div>
                            <div className={styles.stepContent}>
                                <h3>Preview & Manage</h3>
                                <p>Click files to preview them in-browser, upload new content, or edit text files inline with autosave</p>
                            </div>
                        </div>
                    </div>
                </section>

                <footer className={styles.footer}>
                    <p>WebDav-UI © {new Date().getFullYear()} Erick Tran • Built with Next.js & WebDAV</p>
                </footer>
            </div>
        </div>
    );
}
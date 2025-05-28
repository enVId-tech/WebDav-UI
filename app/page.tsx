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
                    <h1>WebDAV File Explorer</h1>
                    <p className={styles.subtitle}>Access, browse, and manage your files with ease</p>
                </header>

                <section className={styles.heroSection}>
                    <div className={styles.heroContent}>
                        <h2>Your files, anywhere, anytime</h2>
                        <p>
                            WebDAV File Explorer provides a simple and intuitive interface to access
                            your WebDAV shares. Browse directories, view files, and manage your content
                            from any device with a web browser.
                        </p>

                        <form className={styles.accessForm} onSubmit={accessShare}>
                            <div className={styles.inputGroup}>
                                <input
                                    type="text"
                                    value={shareInput}
                                    onChange={(e) => setShareInput(e.target.value)}
                                    placeholder="Enter share name"
                                    className={styles.shareInput}
                                />
                                <button type="submit" className={styles.accessButton}>
                                    Access Files
                                </button>
                            </div>
                            {error && <div className={styles.errorMessage}>{error}</div>}
                        </form>
                    </div>
                    <div className={styles.heroImage}>
                        <div className={styles.fileExplorerImage}>
                            <div className={styles.mockTreeView}>
                                <div className={styles.mockFolder}>📁 Documents</div>
                                <div className={styles.mockFolder}>📁 Images</div>
                                <div className={styles.mockFolder}>📁 Projects</div>
                            </div>
                            <div className={styles.mockFileView}>
                                <div className={styles.mockFileRow}><span>📄</span> Report.pdf</div>
                                <div className={styles.mockFileRow}><span>📊</span> Data.xlsx</div>
                                <div className={styles.mockFileRow}><span>🖼️</span> Image.jpg</div>
                                <div className={styles.mockFileRow}><span>📝</span> Notes.docx</div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={styles.featuresSection}>
                    <h2>Key Features</h2>
                    <div className={styles.featureGrid}>
                        <div className={styles.featureCard}>
                            <div className={styles.featureIcon}>🌲</div>
                            <h3>Folder Hierarchy</h3>
                            <p>Navigate through your folder structure with an intuitive tree view</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureIcon}>🔍</div>
                            <h3>File Preview</h3>
                            <p>Preview files directly in your browser without downloading</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureIcon}>📱</div>
                            <h3>Responsive Design</h3>
                            <p>Access your files from any device with a consistent experience</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureIcon}>🔒</div>
                            <h3>Secure Access</h3>
                            <p>Your files are accessed securely through WebDAV protocol</p>
                        </div>
                    </div>
                </section>

                <section className={styles.quickStartSection}>
                    <h2>Quick Start</h2>
                    <div className={styles.quickStartSteps}>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>1</div>
                            <div className={styles.stepContent}>
                                <h3>Enter Share Name</h3>
                                <p>Type the name of your WebDAV share in the input field above</p>
                            </div>
                        </div>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>2</div>
                            <div className={styles.stepContent}>
                                <h3>Browse Your Files</h3>
                                <p>Navigate through folders using the tree view or file list</p>
                            </div>
                        </div>
                        <div className={styles.step}>
                            <div className={styles.stepNumber}>3</div>
                            <div className={styles.stepContent}>
                                <h3>Access Your Content</h3>
                                <p>View, download, or interact with your files directly in the browser</p>
                            </div>
                        </div>
                    </div>
                </section>

                <footer className={styles.footer}>
                    <p>Erick Tran © {new Date().getFullYear()}</p>
                </footer>
            </div>
        </div>
    );
}
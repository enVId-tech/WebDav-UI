// app/files/[[[...path]]]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getDirectoryContents } from '@/lib/webdav-client';
import styles from '@/app/FileServer.module.scss';

export default function FileBrowser() {
    const router = useRouter();
    const pathname = usePathname();
    const [currentData, setCurrentData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Extract path from URL
    const currentPath = pathname?.replace('/files', '') || '/';

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await getDirectoryContents(currentPath);
                setCurrentData(data);
                setError(null);
            } catch (err) {
                setError('Failed to load directory contents');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentPath]);

    // Format file size to human-readable format
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Format date
    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Navigate to a folder
    const navigateToFolder = (folderPath: string) => {
        router.push(`/files${folderPath}`);
    };

    // Navigate up one level
    const navigateUp = () => {
        if (currentPath === '/') return;

        const pathParts = currentPath.split('/').filter(Boolean);
        const newPath = pathParts.length > 1
            ? `/${pathParts.slice(0, -1).join('/')}`
            : '/';

        router.push(`/files${newPath}`);
    };

    // Get file icon based on extension
    const getFileIcon = (filename: string): string => {
        const extension = filename.split('.').pop()?.toLowerCase() || '';
        switch (extension) {
            case 'pdf': return '📄';
            case 'docx': case 'doc': return '📝';
            case 'xlsx': case 'xls': return '📊';
            case 'png': case 'jpg': case 'jpeg': case 'gif': return '🖼️';
            default: return '📄';
        }
    };

    // Generate breadcrumbs from path
    const renderBreadcrumbs = () => {
        const parts = currentPath.split('/').filter(Boolean);

        return (
            <div className={styles.breadcrumb}>
        <span
            className={styles.breadcrumbItem}
            onClick={() => router.push('/files')}
        >
          Home
        </span>

                {parts.map((part, index) => {
                    const partialPath = `/${parts.slice(0, index + 1).join('/')}`;
                    return (
                        <span key={index}>
              <span className={styles.separator}>/</span>
              <span
                  className={styles.breadcrumbItem}
                  onClick={() => router.push(`/files${partialPath}`)}
              >
                {part}
              </span>
            </span>
                    );
                })}
            </div>
        );
    };

    if (loading) return <div className={styles.loading}>Loading...</div>;
    if (error) return <div className={styles.error}>{error}</div>;

    return (
        <div className={styles.fileServer}>
            <div className={styles.header}>
                <h1>WebDAV File Browser</h1>
                {renderBreadcrumbs()}
            </div>

            {currentPath !== '/' && (
                <button className={styles.navButton} onClick={navigateUp}>
                    ↑ Up
                </button>
            )}

            <div className={styles.fileList}>
                <div className={styles.fileHeader}>
                    <div className={styles.nameColumn}>Name</div>
                    <div className={styles.dateColumn}>Modified</div>
                    <div className={styles.sizeColumn}>Size</div>
                </div>

                {currentData.map((item) => (
                    <div key={item.filename} className={styles.fileItem}>
                        {item.type === 'directory' ? (
                            <div
                                className={styles.folderRow}
                                onClick={() => navigateToFolder(item.filename)}
                            >
                                <div className={styles.nameColumn}>
                                    <span className={styles.icon}>📁</span>
                                    <span>{item.basename}</span>
                                </div>
                                <div className={styles.dateColumn}>
                                    {formatDate(item.lastmod)}
                                </div>
                                <div className={styles.sizeColumn}>-</div>
                            </div>
                        ) : (
                            <a
                                href={`${process.env.NEXT_PUBLIC_WEBDAV_URL}${process.env.NEXT_PUBLIC_WEBDAV_BASE_PATH || '/etran'}${item.filename.replace(process.env.NEXT_PUBLIC_WEBDAV_BASE_PATH || '/etran', '')}`}
                                className={styles.fileRow}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <div className={styles.nameColumn}>
                                    <span className={styles.icon}>{getFileIcon(item.basename)}</span>
                                    <span>{item.basename}</span>
                                </div>
                                <div className={styles.dateColumn}>
                                    {formatDate(item.lastmod)}
                                </div>
                                <div className={styles.sizeColumn}>
                                    {formatFileSize(item.size)}
                                </div>
                            </a>
                        )}
                    </div>
                ))}

                {currentData.length === 0 && (
                    <div className={styles.emptyFolder}>This folder is empty</div>
                )}
            </div>
        </div>
    );
}
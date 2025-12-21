'use client';

import React, { useEffect, useState } from 'react';
import styles from '@/app/styles/videoPreview.module.scss';

interface VideoPreviewProps {
    src: string;
    mimeType: string;
    fileName: string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ src, mimeType, fileName }) => {
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    
    // Decode the filename for display (convert %20 back to spaces, etc.)
    const displayFileName = decodeURIComponent(fileName);

    useEffect(() => {
        // Fetch WebDAV base URL from config API
        fetch('/api/config')
            .then(res => res.json())
            .then(config => {
                const webdavBaseUrl = config.webdavUrl;
                // Extract the path from the src (remove /api/webdav part)
                const pathMatch = src.match(/path=([^&]+)/);
                if (pathMatch) {
                    const filePath = decodeURIComponent(pathMatch[1]);
                    // Construct direct WebDAV URL
                    const directUrl = `${webdavBaseUrl}/${filePath}`;
                    setVideoUrl(directUrl);
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Failed to construct video URL:', err);
                setIsLoading(false);
            });
    }, [src]);

    if (isLoading) {
        return (
            <div className={styles.videoPreviewContainer}>
                <div className={styles.videoHeader}>
                    <h2 className={styles.fileName}>{displayFileName}</h2>
                </div>
                <div className={styles.videoContentContainer}>
                    <div>Loading video...</div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.videoPreviewContainer}>
            <div className={styles.videoHeader}>
                <h2 className={styles.fileName}>{displayFileName}</h2>
            </div>

            <div className={styles.videoContentContainer}>
                <video
                    controls
                    className={styles.videoPlayer}
                    playsInline
                    preload="auto"
                    src={videoUrl}
                >
                    Your browser does not support video playback.
                </video>
            </div>
        </div>
    );
};

export default VideoPreview;
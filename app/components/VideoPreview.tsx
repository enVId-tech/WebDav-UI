import React, { useEffect, useState, useRef } from 'react';
import styles from '@/app/fileserver.module.scss';

interface VideoPreviewProps {
    src: string;
    mimeType: string;
    fileName: string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ src, mimeType, fileName }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [fallbackMode, setFallbackMode] = useState(false);

    useEffect(() => {
        // Test if we can connect to the video source
        fetch(src, { method: 'HEAD' })
            .then(response => {
                if (!response.ok) {
                    console.error('Video source response error:', response.status, response.statusText);
                    setError(`Server error: ${response.status} ${response.statusText}`);
                }
            })
            .catch(err => {
                console.error('Error connecting to video source:', err);
                setError('Failed to connect to video source');
            });
    }, [src]);

    const handleVideoError = () => {
        setError('Video playback error. Switching to fallback player.');
        setFallbackMode(true);
    };

    const openInNewTab = () => {
        window.open(src, '_blank');
    };

    const downloadVideo = () => {
        window.open(`${src}&download=true`, '_blank');
    };

    if (error || fallbackMode) {
        return (
            <div className={styles.videoWrapper}>
                {error && <div className={styles.videoError}>{error}</div>}

                <div className={styles.fallbackPlayer}>
                    <p>Using browser's built-in video controls:</p>
                    <video
                        controls
                        src={src}
                        className={styles.videoPlayer}
                        crossOrigin="anonymous"
                        playsInline
                        onError={handleVideoError}
                    >
                        <source src={src} type={mimeType} />
                        Your browser does not support video playback.
                    </video>

                    <div className={styles.actionButtons}>
                        <button onClick={openInNewTab} className={styles.actionButton}>
                            Open in new tab
                        </button>
                        <button onClick={downloadVideo} className={styles.actionButton}>
                            Download video
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Simple player with fallback */}
            <video
                ref={videoRef}
                controls
                className={styles.videoPlayer}
                onError={handleVideoError}
                playsInline
                crossOrigin="anonymous"
            >
                <source src={src} type={mimeType} />
                Your browser does not support video playback.
            </video>

            <div className={styles.actionButtons}>
                <button onClick={() => setFallbackMode(true)} className={styles.actionButton}>
                    Try alternate player
                </button>
                <button onClick={openInNewTab} className={styles.actionButton}>
                    Open in new tab
                </button>
                <button onClick={downloadVideo} className={styles.actionButton}>
                    Download video
                </button>
            </div>
        </div>
    );
};

export default VideoPreview;
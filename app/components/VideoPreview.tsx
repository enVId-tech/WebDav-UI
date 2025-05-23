import React, { useEffect, useState, useRef } from 'react';
import styles from '@/app/styles/videoPreview.module.scss';

interface VideoPreviewProps {
    src: string;
    mimeType: string;
    fileName: string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ src, mimeType, fileName }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [fallbackMode, setFallbackMode] = useState(false);
    const [quality, setQuality] = useState<string>('auto');
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [isCompressed, setIsCompressed] = useState<boolean | null>(null);
    const [originalSize, setOriginalSize] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);

    // Parse base URL without quality parameter
    const getBaseUrl = (url: string) => {
        const urlObj = new URL(url, window.location.origin);
        urlObj.searchParams.delete('quality');
        return urlObj.toString();
    };

    // Generate video source URL with quality parameter
    const getVideoUrl = (baseUrl: string, qualitySetting: string) => {
        const urlObj = new URL(baseUrl, window.location.origin);
        urlObj.searchParams.set('quality', qualitySetting);
        return urlObj.toString();
    };

    const [baseUrl] = useState(getBaseUrl(src));
    const [videoSrc, setVideoSrc] = useState(getVideoUrl(baseUrl, quality));

    // Change quality, preserving playback position
    const changeQuality = (newQuality: string) => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
        setQuality(newQuality);
        setVideoSrc(getVideoUrl(baseUrl, newQuality));
        setShowQualityMenu(false);
    };

    // Restore playback position after source change
    useEffect(() => {
        if (videoRef.current && currentTime > 0) {
            const handleCanPlay = () => {
                if (videoRef.current) {
                    videoRef.current.currentTime = currentTime;
                    videoRef.current.removeEventListener('canplay', handleCanPlay);
                }
            };
            videoRef.current.addEventListener('canplay', handleCanPlay);
        }
    }, [videoSrc, currentTime]);

    // Check compression status when video loads
    useEffect(() => {
        const checkCompression = async () => {
            try {
                const response = await fetch(videoSrc, { method: 'HEAD' });
                setIsCompressed(response.headers.get('X-Video-Compressed') === 'true');
                const originalSizeHeader = response.headers.get('X-Original-Size');
                if (originalSizeHeader) {
                    // Convert bytes to MB for display
                    const sizeMB = (parseInt(originalSizeHeader) / (1024 * 1024)).toFixed(1);
                    setOriginalSize(sizeMB);
                }
            } catch (err) {
                console.error('Error checking compression:', err);
            }
        };

        checkCompression();
    }, [videoSrc]);

    useEffect(() => {
        // Test if we can connect to the video source
        fetch(videoSrc, { method: 'HEAD' })
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
    }, [videoSrc]);

    const handleVideoError = () => {
        setError('Video playback error. Switching to fallback player.');
        setFallbackMode(true);
    };

    const openInNewTab = () => {
        window.open(videoSrc, '_blank');
    };

    const downloadVideo = () => {
        window.open(`${videoSrc}&download=true`, '_blank');
    };

    // Render quality indicator and selector
    const renderQualityControls = () => {
        return (
            <div className={styles.qualityControls}>
                <button
                    className={styles.qualityButton}
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                >
                    <span className={styles.qualityLabel}>
                        {quality === 'auto' ? 'Auto' : quality.charAt(0).toUpperCase() + quality.slice(1)}
                    </span>
                    <span className={styles.qualityIcon}>⚙️</span>
                </button>

                {isCompressed && (
                    <span className={styles.compressedIndicator} title={originalSize ? `Original: ${originalSize}MB` : ''}>
                        Compressed
                    </span>
                )}

                {showQualityMenu && (
                    <div className={styles.qualityMenu}>
                        <div className={styles.qualityMenuTitle}>Quality</div>
                        {['auto', 'low', 'medium', 'high', 'original'].map((option) => (
                            <div
                                key={option}
                                className={`${styles.qualityOption} ${quality === option ? styles.active : ''}`}
                                onClick={() => changeQuality(option)}
                            >
                                {option === 'auto' ? 'Auto' : option.charAt(0).toUpperCase() + option.slice(1)}
                                {option === quality && <span className={styles.checkmark}>✓</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (error || fallbackMode) {
        return (
            <div className={styles.videoWrapper}>
                {error && <div className={styles.videoError}>{error}</div>}

                <div className={styles.fallbackPlayer}>
                    <p>Using browser's built-in video controls:</p>
                    <video
                        controls
                        src={videoSrc}
                        className={styles.videoPlayer}
                        crossOrigin="anonymous"
                        playsInline
                        onError={handleVideoError}
                    >
                        <source src={videoSrc} type={mimeType} />
                        Your browser does not support video playback.
                    </video>

                    {renderQualityControls()}

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
        <div className={styles.videoContainer}>
            <video
                ref={videoRef}
                controls
                className={styles.videoPlayer}
                onError={handleVideoError}
                playsInline
                crossOrigin="anonymous"
            >
                <source src={videoSrc} type={mimeType} />
                Your browser does not support video playback.
            </video>

            {renderQualityControls()}

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
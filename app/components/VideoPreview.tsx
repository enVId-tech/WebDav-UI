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
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [skipAmount, setSkipAmount] = useState(10); // Default 10 seconds skip
    const [showSkipSettings, setShowSkipSettings] = useState(false);
    const [videoDetails, setVideoDetails] = useState<{
        width: number;
        height: number;
        duration: string;
        codec: string | null;
    }>({
        width: 0,
        height: 0,
        duration: '00:00',
        codec: null
    });

    // Decode the filename for display (convert %20 back to spaces, etc.)
    const displayFileName = decodeURIComponent(fileName);

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

    // Format time in mm:ss or hh:mm:ss format
    const formatTime = (timeInSeconds: number): string => {
        if (isNaN(timeInSeconds)) return "00:00";

        const hours = Math.floor(timeInSeconds / 3600);
        const minutes = Math.floor((timeInSeconds % 3600) / 60);
        const seconds = Math.floor(timeInSeconds % 60);

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // Skip forward or backward
    const handleSkip = (seconds: number) => {
        if (!videoRef.current) {
            console.log("Video ref is not available");
            return;
        }

        try {
            // Get current time and calculate new time with bounds checking
            const video = videoRef.current;

            // Make sure video is ready
            if (!video.readyState) {
                console.log("Video not ready yet");
                return;
            }

            const currentVideoTime = video.currentTime;
            const maxDuration = video.duration || 0;
            const newTime = Math.max(0, Math.min(currentVideoTime + seconds, maxDuration));

            // Set the new time directly on the video element
            video.currentTime = newTime;

            // Also update the state
            setCurrentTime(newTime);

            console.log(`Skip ${seconds > 0 ? 'forward' : 'backward'} ${Math.abs(seconds)}s: ${currentVideoTime.toFixed(1)} → ${newTime.toFixed(1)}`);
        } catch (err) {
            console.error("Error while trying to skip video:", err);
        }
    };

    // Reset video to beginning
    const handleReset = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!videoRef.current) return;

        try {
            videoRef.current.currentTime = 0;
            setCurrentTime(1E-6); // Note: Do not set to 0, as it causes browser to not recognize start time.
            console.log("Video reset to beginning");
        } catch (err) {
            console.error("Error resetting video:", err);
        }
    };

    // Change skip amount
    const changeSkipAmount = (amount: number) => {
        setSkipAmount(amount);
        setShowSkipSettings(false);
    };

    // Toggle play/pause
    const togglePlayPause = () => {
        if (!videoRef.current) return;

        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play();
        }
    };

    // Change quality, preserving playback position
    const changeQuality = (newQuality: string) => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
            setIsPlaying(!videoRef.current.paused);
        }
        setQuality(newQuality);
        setVideoSrc(getVideoUrl(baseUrl, newQuality));
        setShowQualityMenu(false);
    };

    // Update playing status when video state changes
    const handlePlayingStateChange = () => {
        if (videoRef.current) {
            setIsPlaying(!videoRef.current.paused);
        }
    };

    // Handle time updates during playback to keep track of current position
    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    // Handle metadata loaded
    const handleMetadataLoaded = () => {
        if (!videoRef.current) return;

        const video = videoRef.current;
        setDuration(video.duration);

        // Get video dimensions
        const width = video.videoWidth;
        const height = video.videoHeight;

        // Format duration
        const durationFormatted = formatTime(video.duration);

        setVideoDetails({
            width,
            height,
            duration: durationFormatted,
            codec: null // Will be updated later if possible
        });
    };

    // Close dropdowns when clicking outside of them
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Close quality menu if clicking outside
            if (showQualityMenu) {
                const qualityControls = document.querySelector(`.${styles.qualityControls}`);
                if (qualityControls && !qualityControls.contains(event.target as Node)) {
                    setShowQualityMenu(false);
                }
            }

            // Close skip settings menu if clicking outside
            if (showSkipSettings) {
                const skipSettingsContainer = document.querySelector(`.${styles.skipSettingsContainer}`);
                if (skipSettingsContainer && !skipSettingsContainer.contains(event.target as Node)) {
                    setShowSkipSettings(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showQualityMenu, showSkipSettings]);

    // Restore playback position after source change (quality change)
    useEffect(() => {
        if (!videoRef.current) return;
        
        // Only restore position when video source actually changes (quality change)
        // Don't interfere with normal playback
        const video = videoRef.current;
        
        const handleCanPlay = () => {
            if (videoRef.current && currentTime > 0) {
                // Only restore if we're changing quality, not during normal playback
                const timeDifference = Math.abs(videoRef.current.currentTime - currentTime);
                
                // If the time difference is significant, it means we're restoring after quality change
                if (timeDifference > 1) {
                    videoRef.current.currentTime = currentTime;
                    
                    // Also restore play state if it was playing
                    if (isPlaying) {
                        videoRef.current.play().catch(err => {
                            console.error("Failed to resume playback:", err);
                        });
                    }
                }
            }
            
            if (videoRef.current) {
                videoRef.current.removeEventListener('canplay', handleCanPlay);
            }
        };
        
        video.addEventListener('canplay', handleCanPlay);
        
        return () => {
            video.removeEventListener('canplay', handleCanPlay);
        };
    }, [videoSrc]); // Only trigger on videoSrc change, not currentTime

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

                // Check for video codec info
                const codecInfo = response.headers.get('X-Video-Codec');
                if (codecInfo) {
                    setVideoDetails(prev => ({
                        ...prev,
                        codec: codecInfo
                    }));
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
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowQualityMenu(!showQualityMenu);
                        // Close other menus
                        if (showSkipSettings) setShowSkipSettings(false);
                    }}
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

    // Render skip controls
    const renderSkipControls = () => {
        return (
            <div className={styles.skipControls}>
                <button
                    className={styles.skipButton}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleSkip(-skipAmount);
                    }}
                    title={`Back ${skipAmount} seconds`}
                >
                    <span className={styles.skipIcon}>⏪</span>
                    <span className={styles.skipAmount}>-{skipAmount}s</span>
                </button>

                <div className={styles.skipSettingsContainer}>
                    <button
                        className={styles.skipSettingsButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowSkipSettings(!showSkipSettings);
                            // Close other menus
                            if (showQualityMenu) setShowQualityMenu(false);
                        }}
                        title="Skip settings"
                    >
                        ⚙️
                    </button>

                    {showSkipSettings && (
                        <div className={styles.skipSettingsMenu}>
                            <div className={styles.skipSettingsTitle}>Skip Amount</div>
                            {[5, 10, 15, 30, 60].map((seconds) => (
                                <div
                                    key={seconds}
                                    className={`${styles.skipOption} ${skipAmount === seconds ? styles.active : ''}`}
                                    onClick={() => changeSkipAmount(seconds)}
                                >
                                    {seconds} seconds
                                    {skipAmount === seconds && <span className={styles.checkmark}>✓</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <button
                    className={styles.skipButton}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleSkip(skipAmount);
                    }}
                    title={`Forward ${skipAmount} seconds`}
                >
                    <span className={styles.skipIcon}>⏩</span>
                    <span className={styles.skipAmount}>+{skipAmount}s</span>
                </button>

                <button
                    className={`${styles.skipButton} ${styles.resetButton}`}
                    onClick={handleReset}
                    title="Reset to beginning"
                >
                    <span className={styles.resetIcon}>⏮</span>
                    <span className={styles.resetLabel}>Reset</span>
                </button>
            </div>
        );
    };

    // Video details display
    const renderVideoDetails = () => {
        if (videoDetails.width === 0) return null;

        return (
            <div className={styles.videoDetailsContainer}>
                <div className={styles.videoDetailItem}>
                    <span className={styles.videoDetailLabel}>Resolution:</span>
                    <span className={styles.videoDetailValue}>{videoDetails.width} × {videoDetails.height}</span>
                </div>
                <div className={styles.videoDetailItem}>
                    <span className={styles.videoDetailLabel}>Duration:</span>
                    <span className={styles.videoDetailValue}>{videoDetails.duration}</span>
                </div>
                {videoDetails.codec && (
                    <div className={styles.videoDetailItem}>
                        <span className={styles.videoDetailLabel}>Codec:</span>
                        <span className={styles.videoDetailValue}>{videoDetails.codec}</span>
                    </div>
                )}
                {isCompressed && originalSize && (
                    <div className={styles.videoDetailItem}>
                        <span className={styles.videoDetailLabel}>Original Size:</span>
                        <span className={styles.videoDetailValue}>{originalSize} MB</span>
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
                    <div className={styles.videoHeader}>
                        <h2 className={styles.fileName}>{displayFileName} - Using browser's built-in video controls</h2>
                    </div>

                    <video
                        controls
                        src={videoSrc}
                        className={styles.videoPlayer}
                        crossOrigin="anonymous"
                        playsInline
                        preload="metadata"
                        onError={handleVideoError}
                        onPlay={handlePlayingStateChange}
                        onPause={handlePlayingStateChange}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleMetadataLoaded}
                        ref={videoRef}
                    >
                        <source src={videoSrc} type={mimeType} />
                        Your browser does not support video playback.
                    </video>

                    {renderSkipControls()}
                    {renderQualityControls()}
                    {renderVideoDetails()}

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
        <div className={styles.videoPreviewContainer}>
            <div className={styles.videoHeader}>
                <h2 className={styles.fileName}>{displayFileName}</h2>
            </div>

            <div className={styles.videoContentContainer}>
                {/* Video element automatically uses HTTP Range requests for chunked streaming.
                    The server responds with 206 Partial Content, allowing the browser to:
                    - Start playback quickly without downloading the entire video
                    - Seek to any position efficiently
                    - Download chunks as needed based on playback and user interaction */}
                <video
                    ref={videoRef}
                    controls
                    className={styles.videoPlayer}
                    onError={handleVideoError}
                    playsInline
                    preload="metadata"
                    crossOrigin="anonymous"
                    onPlay={handlePlayingStateChange}
                    onPause={handlePlayingStateChange}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleMetadataLoaded}
                >
                    <source src={videoSrc} type={mimeType} />
                    Your browser does not support video playback.
                </video>

                {renderQualityControls()}
                {renderSkipControls()}
                {renderVideoDetails()}

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
        </div>
    );
};

export default VideoPreview;
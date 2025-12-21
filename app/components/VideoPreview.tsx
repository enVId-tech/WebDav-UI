'use client';

import React, { useEffect, useState, useRef } from 'react';
import styles from '@/app/styles/videoPreview.module.scss';

interface VideoPreviewProps {
    src: string;
    mimeType: string;
    fileName: string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ src, mimeType, fileName }) => {
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isDownloading, setIsDownloading] = useState(false);
    
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

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
    };

    const skip = (seconds: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime += seconds;
        }
    };

    const changePlaybackRate = () => {
        const rates = [0.5, 1, 1.5, 2];
        const nextRateIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
        const nextRate = rates[nextRateIndex];
        setPlaybackRate(nextRate);
        if (videoRef.current) {
            videoRef.current.playbackRate = nextRate;
        }
    };

    const downloadVideo = async () => {
        // Use the proxy URL (src) for download to avoid CORS issues with direct WebDAV URL
        if (!src) return;

        setIsDownloading(true);
        try {
            // Append download=true to the URL if not present
            const downloadUrl = src.includes('?') 
                ? `${src}&download=true` 
                : `${src}?download=true`;

            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error('Download failed');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            // Fallback to direct URL if proxy fails (though likely to have CORS issues too)
            const link = document.createElement('a');
            link.href = videoUrl || src;
            link.download = fileName;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } finally {
            setIsDownloading(false);
        }
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

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
                    ref={videoRef}
                    className={styles.videoPlayer}
                    playsInline
                    preload="auto"
                    src={videoUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={handleEnded}
                    onClick={togglePlay}
                >
                    Your browser does not support video playback.
                </video>

                <div className={styles.customControls}>
                    <div className={styles.timeLabel}>
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                    
                    <button className={styles.controlButton} onClick={() => skip(-10)} title="Skip Backward 10s">
                        🡠
                    </button>
                    
                    <button className={styles.controlButton} onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
                        {isPlaying ? "⏸" : "▶"}
                    </button>
                    
                    <button className={styles.controlButton} onClick={() => skip(10)} title="Skip Forward 10s">
                        🡢
                    </button>

                    <button className={styles.controlButton} onClick={changePlaybackRate} title="Playback Speed">
                        {playbackRate}x
                    </button>

                    <button className={styles.controlButton} onClick={downloadVideo} title="Download Video" disabled={isDownloading}>
                        {isDownloading ? '⊘' : '⭳'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VideoPreview;
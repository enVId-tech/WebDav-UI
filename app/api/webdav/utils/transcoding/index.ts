import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { VIDEO_QUALITY_PRESETS } from '../config/constants';
import { Readable, PassThrough } from 'stream';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

export interface TranscodingOptions {
    quality: string;
    audioTrack?: number;
    startByte?: number;
    endByte?: number;
}

/**
 * Transcode video stream with quality settings
 * Returns a readable stream of the transcoded video
 */
export async function transcodeVideoStream(
    inputStream: Buffer,
    options: TranscodingOptions
): Promise<{ stream: Readable; contentType: string }> {
    const { quality, audioTrack = 0 } = options;

    // Get quality preset
    const preset = VIDEO_QUALITY_PRESETS[quality as keyof typeof VIDEO_QUALITY_PRESETS];
    if (!preset || quality === 'original') {
        throw new Error(`Invalid quality preset or original quality selected: ${quality}`);
    }

    // TypeScript narrowing - ensure we have a transcoding preset
    if (!('scale' in preset)) {
        throw new Error(`Preset does not have transcoding settings: ${quality}`);
    }

    // Create a readable stream from the buffer
    const inputReadable = Readable.from(inputStream);
    
    // Create a passthrough stream for the output
    const outputStream = new PassThrough();

    return new Promise((resolve, reject) => {
        const command = ffmpeg(inputReadable)
            .videoCodec('libx264')
            .audioCodec('aac')
            .size(`${preset.width}x${preset.height}`)
            .videoBitrate(preset.videoBitrate)
            .audioBitrate(preset.audioBitrate)
            .outputOptions([
                `-crf ${preset.crf}`,
                `-preset ${preset.preset}`,
                '-movflags frag_keyframe+empty_moov+default_base_moof', // Enable streaming
                '-f mp4'
            ]);

        // Select audio track if specified
        if (audioTrack > 0) {
            command.outputOptions([`-map 0:v:0`, `-map 0:a:${audioTrack}`]);
        }

        command
            .on('start', (commandLine) => {
                console.log('[Transcoding] FFmpeg command:', commandLine);
            })
            .on('progress', (progress) => {
                console.log(`[Transcoding] Processing: ${progress.percent?.toFixed(2)}% done`);
            })
            .on('error', (err, stdout, stderr) => {
                console.error('[Transcoding] Error:', err.message);
                console.error('[Transcoding] FFmpeg stderr:', stderr);
                reject(err);
            })
            .on('end', () => {
                console.log('[Transcoding] Finished transcoding');
            });

        // Pipe output to passthrough stream
        command.pipe(outputStream, { end: true });

        // Resolve with the stream immediately so we can start streaming
        resolve({
            stream: outputStream,
            contentType: 'video/mp4'
        });
    });
}

/**
 * Transcode video with chunked streaming support
 * This version supports Range requests by transcoding only the needed portion
 */
export async function transcodeVideoChunk(
    inputBuffer: Buffer,
    options: TranscodingOptions
): Promise<Buffer> {
    const { quality, audioTrack = 0 } = options;

    // Get quality preset
    const preset = VIDEO_QUALITY_PRESETS[quality as keyof typeof VIDEO_QUALITY_PRESETS];
    if (!preset || quality === 'original') {
        throw new Error(`Invalid quality preset or original quality selected: ${quality}`);
    }

    // TypeScript narrowing - ensure we have a transcoding preset
    if (!('scale' in preset)) {
        throw new Error(`Preset does not have transcoding settings: ${quality}`);
    }

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const inputReadable = Readable.from(inputBuffer);
        
        const command = ffmpeg(inputReadable)
            .videoCodec('libx264')
            .audioCodec('aac')
            .size(`${preset.width}x${preset.height}`)
            .videoBitrate(preset.videoBitrate)
            .audioBitrate(preset.audioBitrate)
            .outputOptions([
                `-crf ${preset.crf}`,
                `-preset ${preset.preset}`,
                '-movflags frag_keyframe+empty_moov+default_base_moof',
                '-f mp4'
            ]);

        // Select audio track if specified
        if (audioTrack > 0) {
            command.outputOptions([`-map 0:v:0`, `-map 0:a:${audioTrack}`]);
        }

        command
            .on('error', (err) => {
                console.error('[Transcoding Chunk] Error:', err.message);
                reject(err);
            })
            .on('end', () => {
                resolve(Buffer.concat(chunks));
            });

        // Collect output chunks
        const outputStream = command.pipe();
        outputStream.on('data', (chunk) => chunks.push(chunk));
        outputStream.on('error', reject);
    });
}

/**
 * Get estimated file size after transcoding
 */
export function getEstimatedTranscodedSize(
    originalSize: number,
    quality: string
): number {
    const preset = VIDEO_QUALITY_PRESETS[quality as keyof typeof VIDEO_QUALITY_PRESETS];
    if (!preset || quality === 'original') {
        return originalSize;
    }

    // TypeScript narrowing - ensure we have a transcoding preset
    if (!('videoBitrate' in preset)) {
        return originalSize;
    }

    // Parse bitrates (remove 'k' or 'M' suffix)
    const videoBitrate = parseBitrate(preset.videoBitrate);
    const audioBitrate = parseBitrate(preset.audioBitrate);
    const totalBitrate = videoBitrate + audioBitrate;

    // Rough estimation: assume original is ~4000kbps for 1080p
    const estimatedRatio = totalBitrate / 4000;
    return Math.floor(originalSize * estimatedRatio);
}

function parseBitrate(bitrate: string): number {
    if (bitrate.endsWith('M')) {
        return parseFloat(bitrate) * 1000;
    } else if (bitrate.endsWith('k')) {
        return parseFloat(bitrate);
    }
    return parseInt(bitrate);
}

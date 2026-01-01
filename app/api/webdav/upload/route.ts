import { NextRequest, NextResponse } from 'next/server';
import webdavService from '@/lib/webdav-server';
import { getSessionFromRequest } from '@/lib/session';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Increase maximum file size for uploads (e.g., 500MB)
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for uploads

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    
    try {
        // Check authentication
        const session = getSessionFromRequest(request);
        
        if (!session) {
            console.log('[upload] No valid session found');
            return NextResponse.json(
                { error: 'Unauthorized', message: 'Please log in to upload files' },
                { status: 401 }
            );
        }
        
        console.log('[upload] Authenticated user:', session.username);

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const path = formData.get('path') as string | null;
        const sharePath = formData.get('sharePath') as string | null;

        if (!file || !path || !sharePath) {
            return NextResponse.json({ 
                error: 'Missing required fields', 
                message: 'File, path, and sharePath are required',
                details: {
                    hasFile: !!file,
                    hasPath: !!path,
                    hasSharePath: !!sharePath
                }
            }, { status: 400 });
        }

        // Validate file
        const fileSize = file.size;
        const fileName = file.name;
        
        console.log(`[upload] Processing file: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`[upload] Upload params - path: ${path}, sharePath: ${sharePath}`);

        // Construct the WebDAV client's target directory URL (same as delete route)
        // Build the full directory URL where the file will be uploaded
        let clientTargetDirectoryUrl = `${process.env.WEBDAV_URL}/${sharePath}`;
        
        // Remove leading slash from sharePath to avoid double slashes
        const cleanSharePath = sharePath.startsWith('/') ? sharePath.substring(1) : sharePath;
        clientTargetDirectoryUrl = `${process.env.WEBDAV_URL}/${cleanSharePath}`;
        
        // Add the path within the share if not root
        if (path && path !== '/') {
            const cleanPath = path.startsWith('/') ? path : `/${path}`;
            clientTargetDirectoryUrl += cleanPath;
        }

        // Ensure the client target directory URL ends with a slash
        if (!clientTargetDirectoryUrl.endsWith('/')) {
            clientTargetDirectoryUrl += '/';
        }

        console.log(`[upload] Target directory URL: ${clientTargetDirectoryUrl}`);
        console.log(`[upload] Target directory URL: ${clientTargetDirectoryUrl}`);
        console.log(`[upload] Filename: ${fileName}`);
        console.log(`[upload] WebDAV base URL: ${process.env.WEBDAV_URL}`);
        
        // Update the WebDAV client to point to the target directory
        webdavService.updateUrl(clientTargetDirectoryUrl);

        // Convert file to buffer efficiently using streams for large files
        const bufferStartTime = Date.now();
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const bufferTime = Date.now() - bufferStartTime;
        
        console.log(`[upload] Buffer conversion took ${bufferTime}ms for ${fileName}`);
        console.log(`[upload] Buffer size: ${fileBuffer.length} bytes`);

        // Upload the file (just the filename, since client URL is set to directory)
        const uploadStartTime = Date.now();
        await webdavService.uploadFile(fileName, fileBuffer);
        const uploadTime = Date.now() - uploadStartTime;
        
        const totalTime = Date.now() - startTime;
        const uploadSpeedMBps = (fileSize / 1024 / 1024) / (uploadTime / 1000);

        console.log(`[upload] Upload completed in ${uploadTime}ms (${uploadSpeedMBps.toFixed(2)} MB/s)`);

        return NextResponse.json({ 
            success: true,
            message: 'File uploaded successfully',
            details: {
                fileName,
                fileSize,
                fileSizeMB: (fileSize / 1024 / 1024).toFixed(2),
                uploadTimeMs: uploadTime,
                totalTimeMs: totalTime,
                uploadSpeedMBps: uploadSpeedMBps.toFixed(2),
                targetPath: `${clientTargetDirectoryUrl}${fileName}`
            }
        });
    } catch (error: any) {
        const totalTime = Date.now() - startTime;
        console.error('[upload] Error in POST handler:', error);
        
        const status = error.status || error.response?.status || 500;
        const message = error.message || 'Internal Server Error';
        
        // Provide detailed error information
        const errorResponse: any = {
            success: false,
            error: message,
            errorType: error.name || 'UnknownError',
            totalTimeMs: totalTime,
        };

        // Add additional context if available
        if (error.response) {
            errorResponse.httpStatus = error.response.status;
            errorResponse.statusText = error.response.statusText;
        }
        
        if (error.cause) {
            errorResponse.cause = String(error.cause);
        }

        // Check for specific error types
        if (error.code === 'ECONNREFUSED') {
            errorResponse.userMessage = 'Cannot connect to WebDAV server. Please check server availability.';
        } else if (error.code === 'ETIMEDOUT') {
            errorResponse.userMessage = 'Upload timed out. Please try again or upload a smaller file.';
        } else if (status === 403) {
            errorResponse.userMessage = 'Permission denied. You do not have write access to this directory.';
        } else if (status === 409) {
            errorResponse.userMessage = 'File conflict. The file may already exist or the directory is locked.';
        } else if (status === 507) {
            errorResponse.userMessage = 'Server storage is full. Cannot upload file.';
        } else {
            errorResponse.userMessage = 'An error occurred during upload. Please try again.';
        }

        console.error(`[upload] Responding with status ${status}:`, errorResponse);
        return NextResponse.json(errorResponse, { status });
    }
}


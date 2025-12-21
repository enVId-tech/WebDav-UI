import { NextRequest, NextResponse } from 'next/server';
import webdavService from '@/lib/webdav-server';
import { getSessionFromRequest } from '@/lib/session';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for batch deletes

interface DeleteResult {
    fileName: string;
    success: boolean;
    error?: string;
    timeMs?: number;
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    
    try {
        // Check authentication
        const session = getSessionFromRequest(request);
        
        if (!session) {
            console.log('[delete] No valid session found');
            return NextResponse.json(
                { error: 'Unauthorized', message: 'Please log in to delete files' },
                { status: 401 }
            );
        }
        
        console.log('[delete] Authenticated user:', session.username);

        const body = await request.json();
        const { path, paths, sharePath } = body;

        // Support both single file delete (path) and batch delete (paths)
        const filePaths = paths || (path ? [path] : []);

        if (filePaths.length === 0 || !sharePath) {
            return NextResponse.json({ 
                error: 'Missing required fields',
                message: 'At least one file path and sharePath are required',
                details: {
                    pathsCount: filePaths.length,
                    hasSharePath: !!sharePath
                }
            }, { status: 400 });
        }

        console.log(`[delete] Deleting ${filePaths.length} file(s) from share: ${sharePath}`);

        const results: DeleteResult[] = [];
        let successCount = 0;
        let failureCount = 0;

        // Process deletions with individual error handling
        for (const filePath of filePaths) {
            const fileStartTime = Date.now();
            
            try {
                // Extract filename and directory path within the share
                const lastSlashIndex = filePath.lastIndexOf('/');
                const fileName = filePath.substring(lastSlashIndex + 1);
                let directoryPathWithinShare = filePath.substring(0, lastSlashIndex);

                if (directoryPathWithinShare === "") {
                    directoryPathWithinShare = "/";
                }

                // Construct the WebDAV client's target directory URL
                let clientTargetDirectoryUrl = `${process.env.WEBDAV_URL}/${sharePath}`;
                if (directoryPathWithinShare && directoryPathWithinShare !== '/') {
                    clientTargetDirectoryUrl += directoryPathWithinShare.startsWith('/') 
                        ? directoryPathWithinShare 
                        : `/${directoryPathWithinShare}`;
                }

                // Ensure the client target directory URL ends with a slash
                if (!clientTargetDirectoryUrl.endsWith('/')) {
                    clientTargetDirectoryUrl += '/';
                }

                console.log(`[delete] Updating WebDAV client URL to directory: ${clientTargetDirectoryUrl}`);
                webdavService.updateUrl(clientTargetDirectoryUrl);

                console.log(`[delete] Deleting file: "${fileName}" from ${clientTargetDirectoryUrl}`);
                await webdavService.deleteFile(fileName);
                
                const fileTime = Date.now() - fileStartTime;
                
                results.push({
                    fileName,
                    success: true,
                    timeMs: fileTime
                });
                
                successCount++;
                console.log(`[delete] Successfully deleted "${fileName}" in ${fileTime}ms`);
                
            } catch (error: any) {
                const fileTime = Date.now() - fileStartTime;
                const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
                
                console.error(`[delete] Failed to delete "${fileName}":`, error.message);
                
                results.push({
                    fileName,
                    success: false,
                    error: error.message || 'Unknown error',
                    timeMs: fileTime
                });
                
                failureCount++;
            }
        }

        const totalTime = Date.now() - startTime;
        const allSuccessful = failureCount === 0;

        const response = {
            success: allSuccessful,
            message: allSuccessful 
                ? `Successfully deleted ${successCount} file(s)` 
                : `Deleted ${successCount} file(s), failed to delete ${failureCount} file(s)`,
            details: {
                total: filePaths.length,
                successful: successCount,
                failed: failureCount,
                totalTimeMs: totalTime,
                averageTimeMs: Math.round(totalTime / filePaths.length),
                results
            }
        };

        console.log(`[delete] Operation complete: ${successCount} successful, ${failureCount} failed in ${totalTime}ms`);

        // Return 207 Multi-Status if some deletions failed, 200 if all successful
        return NextResponse.json(response, { 
            status: allSuccessful ? 200 : 207 
        });

    } catch (error: any) {
        const totalTime = Date.now() - startTime;
        console.error('[delete] Error in POST handler:', error);
        
        const status = error.status || error.response?.status || 500;
        const message = error.message || 'Internal Server Error';
        
        const errorResponse: any = {
            success: false,
            error: message,
            errorType: error.name || 'UnknownError',
            totalTimeMs: totalTime,
        };

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
            errorResponse.userMessage = 'Delete operation timed out. Please try again.';
        } else if (status === 403) {
            errorResponse.userMessage = 'Permission denied. You do not have delete access to this directory.';
        } else if (status === 404) {
            errorResponse.userMessage = 'File not found. It may have already been deleted.';
        } else if (status === 423) {
            errorResponse.userMessage = 'File is locked and cannot be deleted.';
        } else {
            errorResponse.userMessage = 'An error occurred during deletion. Please try again.';
        }

        console.error(`[delete] Responding with status ${status}:`, errorResponse);
        return NextResponse.json(errorResponse, { status });
    }
}


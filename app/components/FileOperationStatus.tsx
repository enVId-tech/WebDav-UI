'use client';

import React from 'react';
import styles from '../styles/fileOperationStatus.module.scss';

export interface OperationStatus {
  type: 'upload' | 'delete';
  fileName: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  progress?: number;
  speed?: string;
  eta?: string;
  error?: string;
  startTime?: number;
}

interface FileOperationStatusProps {
  operations: OperationStatus[];
  onClose?: () => void;
}

const FileOperationStatus: React.FC<FileOperationStatusProps> = ({ operations, onClose }) => {
  if (operations.length === 0) return null;

  const activeOperations = operations.filter(op => 
    op.status === 'pending' || op.status === 'processing'
  );
  const completedOperations = operations.filter(op => 
    op.status === 'success' || op.status === 'error'
  );

  const getStatusIcon = (status: OperationStatus['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'processing': return '⚙️';
      case 'success': return '✅';
      case 'error': return '❌';
      default: return '📄';
    }
  };

  const getStatusText = (operation: OperationStatus) => {
    const verb = operation.type === 'upload' ? 'Uploading' : 'Deleting';
    switch (operation.status) {
      case 'pending': return `Waiting to ${operation.type}...`;
      case 'processing': return `${verb}...`;
      case 'success': return `${operation.type === 'upload' ? 'Uploaded' : 'Deleted'} successfully`;
      case 'error': return operation.error || `Failed to ${operation.type}`;
      default: return '';
    }
  };

  const formatElapsedTime = (startTime?: number) => {
    if (!startTime) return '';
    const elapsed = Date.now() - startTime;
    if (elapsed < 1000) return `${elapsed}ms`;
    if (elapsed < 60000) return `${(elapsed / 1000).toFixed(1)}s`;
    return `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`;
  };

  return (
    <div className={styles.operationStatusContainer}>
      <div className={styles.statusHeader}>
        <h3>File Operations</h3>
        {completedOperations.length > 0 && activeOperations.length === 0 && (
          <button onClick={onClose} className={styles.closeButton}>×</button>
        )}
      </div>

      <div className={styles.operationsList}>
        {operations.map((operation, index) => (
          <div 
            key={`${operation.fileName}-${index}`} 
            className={`${styles.operationItem} ${styles[operation.status]}`}
          >
            <div className={styles.operationHeader}>
              <span className={styles.statusIcon}>{getStatusIcon(operation.status)}</span>
              <span className={styles.fileName}>{operation.fileName}</span>
            </div>
            
            <div className={styles.operationDetails}>
              <span className={styles.statusText}>{getStatusText(operation)}</span>
              {operation.status === 'processing' && (
                <div className={styles.progressInfo}>
                  {operation.speed && <span className={styles.speed}>{operation.speed}</span>}
                  {operation.eta && <span className={styles.eta}>ETA: {operation.eta}</span>}
                  {operation.startTime && (
                    <span className={styles.elapsed}>
                      {formatElapsedTime(operation.startTime)}
                    </span>
                  )}
                </div>
              )}
              {operation.status === 'success' && operation.startTime && (
                <span className={styles.elapsed}>
                  Completed in {formatElapsedTime(operation.startTime)}
                </span>
              )}
            </div>

            {operation.status === 'processing' && operation.progress !== undefined && (
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${operation.progress}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {activeOperations.length > 0 && (
        <div className={styles.summaryFooter}>
          <span>
            {activeOperations.length} operation{activeOperations.length !== 1 ? 's' : ''} in progress
          </span>
        </div>
      )}

      {completedOperations.length > 0 && activeOperations.length === 0 && (
        <div className={styles.summaryFooter}>
          <span>
            {completedOperations.filter(op => op.status === 'success').length} succeeded, {' '}
            {completedOperations.filter(op => op.status === 'error').length} failed
          </span>
        </div>
      )}
    </div>
  );
};

export default FileOperationStatus;

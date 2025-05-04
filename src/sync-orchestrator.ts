import { Notice, TFile } from 'obsidian';
import type { FileStat } from 'webdav';
import type DementorSyncPlugin from './main';
import { FileMetadata } from './state-manager';

export class SyncOrchestrator {
    private plugin: DementorSyncPlugin;

    constructor(plugin: DementorSyncPlugin) {
        this.plugin = plugin;
    }

    /**
     * Perform a complete synchronization operation
     */
    public async performSync(): Promise<void> {
        try {
            // Initialize encryption module
            await this.plugin.encryptionModule.initialize();
            
            // 1. Process pending changes from local event monitoring
            await this.processPendingChanges();
            
            // 2. Scan remote files and compare with local state
            await this.synchronizeWithRemote();
            
            // Update last sync time
            await this.plugin.stateManager.updateLastSyncTime();
            
            // Clear pending changes after successful sync
            this.plugin.changeDetector.clearPendingChanges();
            
        } catch (error) {
            console.error('Sync failed:', error);
            throw error;
        }
    }

    /**
     * Process pending changes detected by the change detector
     */
    private async processPendingChanges(): Promise<void> {
        const pendingChanges = this.plugin.changeDetector.getPendingChanges();
        
        if (pendingChanges.size === 0) {
            console.log('No pending changes to process');
            return;
        }
        
        console.log(`Processing ${pendingChanges.size} pending changes`);
        
        for (const [path, changeType] of pendingChanges.entries()) {
            try {
                switch (changeType) {
                    case 'create':
                    case 'modify': {
                        const file = this.plugin.app.vault.getAbstractFileByPath(path);
                        if (file instanceof TFile) {
                            await this.uploadFile(file);
                        } else {
                            console.warn(`File not found for path: ${path}`);
                        }
                        break;
                    }
                    case 'delete':
                        await this.deleteFile(path);
                        break;
                }
            } catch (error) {
                console.error(`Error processing change for ${path}:`, error);
                new Notice(`Failed to sync ${path}: ${error.message}`);
                // Continue with other files
            }
        }
    }

    /**
     * Upload a file to the remote server
     */
    private async uploadFile(file: TFile): Promise<void> {
        console.log(`Uploading file: ${file.path}`);
        
        try {
            // Read file content
            const content = await this.plugin.app.vault.readBinary(file);
            
            // Encrypt file content
            const { encryptedData, encryptedName, iv } = await this.plugin.encryptionModule.encryptFile(
                content, file.path
            );
            
            // Upload to WebDAV server
            await this.plugin.webdavClient.uploadFile(file.path, encryptedData, encryptedName);
            
            // Update file metadata in state
            await this.plugin.stateManager.storeFileMetadata(file.path, {
                encryptedName,
                lastModified: file.stat.mtime,
                size: file.stat.size,
                iv
            });
            
            console.log(`Successfully uploaded ${file.path}`);
        } catch (error) {
            console.error(`Upload failed for ${file.path}:`, error);
            throw new Error(`Upload failed for ${file.path}: ${error.message}`);
        }
    }

    /**
     * Delete a file from the remote server
     */
    private async deleteFile(path: string): Promise<void> {
        console.log(`Deleting file: ${path}`);
        
        try {
            // Get the encrypted name from state
            const metadata = this.plugin.stateManager.getFileMetadata(path);
            
            if (!metadata) {
                console.warn(`No metadata found for ${path}, skipping remote deletion`);
                return;
            }
            
            // Delete from WebDAV server
            await this.plugin.webdavClient.deleteFile(metadata.encryptedName);
            
            // Remove from state
            await this.plugin.stateManager.removeFileMetadata(path);
            
            console.log(`Successfully deleted ${path}`);
        } catch (error) {
            console.error(`Deletion failed for ${path}:`, error);
            throw new Error(`Deletion failed for ${path}: ${error.message}`);
        }
    }

    /**
     * Synchronize with remote server (download changes, resolve conflicts)
     */
    private async synchronizeWithRemote(): Promise<void> {
        console.log('Synchronizing with remote server...');
        
        try {
            // 1. Get list of all remote files
            const remoteFiles = await this.plugin.webdavClient.listFiles();
            
            // 2. Process remote files
            await this.processRemoteFiles(remoteFiles);
            
        } catch (error) {
            console.error('Error synchronizing with remote:', error);
            throw new Error(`Remote synchronization failed: ${error.message}`);
        }
    }

    /**
     * Process the list of remote files
     */
    private async processRemoteFiles(remoteFiles: FileStat[]): Promise<void> {
        // Map of encrypted names to stats, for quick lookup
        const remoteFileMap = new Map<string, FileStat>();
        for (const file of remoteFiles) {
            // Extract just the filename, not the full path
            const fileName = file.basename || file.filename;
            remoteFileMap.set(fileName, file);
        }
        
        // Get all locally tracked files
        const localFiles = this.plugin.stateManager.getAllFiles();
        
        // Track which remote files we've processed
        const processedFiles = new Set<string>();
        
        // Check for files that exist locally but may be updated or deleted remotely
        for (const [localPath, metadata] of Object.entries(localFiles)) {
            const remoteFile = remoteFileMap.get(metadata.encryptedName);
            
            // File exists remotely and locally
            if (remoteFile) {
                processedFiles.add(metadata.encryptedName);
                
                // Check if remote file is newer
                if (remoteFile.lastmod && new Date(remoteFile.lastmod).getTime() > metadata.lastModified) {
                    await this.downloadFile(metadata.encryptedName, localPath);
                }
            } 
            // File exists locally but not remotely (deleted remotely)
            else {
                await this.handleRemotelyDeletedFile(localPath);
            }
        }
        
        // Process new remote files (those not yet processed)
        for (const [encryptedName, fileStat] of remoteFileMap.entries()) {
            if (!processedFiles.has(encryptedName)) {
                await this.handleNewRemoteFile(encryptedName);
            }
        }
    }
    
    /**
     * Download a file from the remote server
     */
    private async downloadFile(encryptedName: string, localPath: string): Promise<void> {
        console.log(`Downloading file: ${encryptedName} to ${localPath}`);
        
        try {
            // Get file metadata
            const metadata = this.plugin.stateManager.getFileMetadata(localPath);
            
            if (!metadata) {
                throw new Error(`No metadata found for ${localPath}`);
            }
            
            // Download encrypted file
            const encryptedData = await this.plugin.webdavClient.downloadFile(encryptedName);
            
            // Decrypt the file
            const decryptedData = await this.plugin.encryptionModule.decryptFile(encryptedData, metadata.iv);
            
            // Create parent folders if needed
            const pathParts = localPath.split('/');
            pathParts.pop(); // Remove filename
            
            if (pathParts.length > 0) {
                const parentFolder = pathParts.join('/');
                if (!await this.plugin.app.vault.adapter.exists(parentFolder)) {
                    await this.plugin.app.vault.createFolder(parentFolder);
                }
            }
            
            // Write to local vault
            const existingFile = this.plugin.app.vault.getAbstractFileByPath(localPath);
            
            if (existingFile instanceof TFile) {
                await this.plugin.app.vault.modifyBinary(existingFile, decryptedData);
            } else {
                await this.plugin.app.vault.createBinary(localPath, decryptedData);
            }
            
            // Update file metadata in state with new last modified time
            const file = this.plugin.app.vault.getAbstractFileByPath(localPath);
            if (file instanceof TFile) {
                await this.plugin.stateManager.storeFileMetadata(localPath, {
                    encryptedName,
                    lastModified: file.stat.mtime,
                    size: file.stat.size,
                    iv: metadata.iv
                });
            }
            
            console.log(`Successfully downloaded ${encryptedName} to ${localPath}`);
        } catch (error) {
            console.error(`Download failed for ${encryptedName}:`, error);
            throw new Error(`Download failed for ${encryptedName}: ${error.message}`);
        }
    }
    
    /**
     * Handle a file that exists remotely but not locally
     */
    private async handleNewRemoteFile(encryptedName: string): Promise<void> {
        console.log(`Handling new remote file: ${encryptedName}`);
        
        try {
            // Download encrypted file
            const encryptedData = await this.plugin.webdavClient.downloadFile(encryptedName);
            
            // Create a temporary path for files we don't know the original name of
            const tempPath = `dementor-sync-new/${encryptedName}.md`;
            
            // Generate a random IV for initial setup
            // In a real implementation we would need to store the IV with the file metadata
            // on the server or derive it deterministically
            const iv = Array.from(crypto.getRandomValues(new Uint8Array(12)));
            
            // Decrypt the file
            const decryptedData = await this.plugin.encryptionModule.decryptFile(encryptedData, iv);
            
            // Create parent folder if needed
            const parentFolder = 'dementor-sync-new';
            if (!await this.plugin.app.vault.adapter.exists(parentFolder)) {
                await this.plugin.app.vault.createFolder(parentFolder);
            }
            
            // Write to local vault
            await this.plugin.app.vault.createBinary(tempPath, decryptedData);
            
            // Update file metadata in state
            const file = this.plugin.app.vault.getAbstractFileByPath(tempPath);
            if (file instanceof TFile) {
                await this.plugin.stateManager.storeFileMetadata(tempPath, {
                    encryptedName,
                    lastModified: file.stat.mtime,
                    size: file.stat.size,
                    iv
                });
            }
            
            console.log(`Successfully imported new file ${encryptedName} as ${tempPath}`);
            new Notice(`New file from sync saved as ${tempPath}`);
        } catch (error) {
            console.error(`Import failed for ${encryptedName}:`, error);
            new Notice(`Failed to import new file: ${error.message}`);
        }
    }
    
    /**
     * Handle a file that was deleted remotely but exists locally
     */
    private async handleRemotelyDeletedFile(localPath: string): Promise<void> {
        console.log(`Handling remotely deleted file: ${localPath}`);
        
        // In this simple implementation, we just remove the file locally
        // A more sophisticated approach would ask the user or use conflict resolution rules
        
        try {
            const file = this.plugin.app.vault.getAbstractFileByPath(localPath);
            
            if (file instanceof TFile) {
                await this.plugin.app.vault.delete(file);
                console.log(`Deleted local file ${localPath} to match remote deletion`);
            } else {
                console.warn(`Local file ${localPath} not found, just removing from state`);
            }
            
            // Remove from state
            await this.plugin.stateManager.removeFileMetadata(localPath);
            
        } catch (error) {
            console.error(`Failed to handle remote deletion for ${localPath}:`, error);
            new Notice(`Failed to sync deletion: ${error.message}`);
        }
    }
}
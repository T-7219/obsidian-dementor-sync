import { Notice, requestUrl, RequestUrlResponse } from 'obsidian';
import { createClient, WebDAVClient as WebDAVClientType, FileStat } from 'webdav';
import type DementorSyncPlugin from './main';

export class WebDAVClient {
    private client: WebDAVClientType | null = null;
    private plugin: DementorSyncPlugin;
    private basePath: string = '/dementor-sync/';

    constructor(plugin: DementorSyncPlugin) {
        this.plugin = plugin;
        this.updateConfig();
    }

    public updateConfig() {
        const { webdavUrl, webdavUsername, webdavPassword } = this.plugin.settings;
        
        if (webdavUrl && webdavUsername && webdavPassword) {
            // Make sure URL ends with a trailing slash
            const url = webdavUrl.endsWith('/') ? webdavUrl : webdavUrl + '/';
            
            this.client = createClient(url, {
                username: webdavUsername,
                password: webdavPassword
            });
            
            console.log('WebDAV client configured');
        } else {
            this.client = null;
            console.log('WebDAV client not configured due to missing settings');
        }
    }

    private ensureClient() {
        if (!this.client) {
            throw new Error('WebDAV client is not configured. Please check your settings.');
        }
    }

    public async testConnection(): Promise<boolean> {
        try {
            this.ensureClient();
            
            // Try to get directory contents or create directory if it doesn't exist
            const exists = await this.client!.exists(this.basePath);
            
            if (!exists) {
                await this.client!.createDirectory(this.basePath);
                console.log(`Created base directory: ${this.basePath}`);
            }
            
            return true;
        } catch (error) {
            console.error('WebDAV connection test failed:', error);
            return false;
        }
    }

    public async listFiles(): Promise<FileStat[]> {
        try {
            this.ensureClient();
            
            // Ensure base path exists
            const exists = await this.client!.exists(this.basePath);
            if (!exists) {
                await this.client!.createDirectory(this.basePath);
            }
            
            // Get directory contents
            const contents = await this.client!.getDirectoryContents(this.basePath);
            
            // Handle both array and response data detailed formats
            const items = Array.isArray(contents) ? contents : contents.data;
            
            // Filter out directories, we only want files
            return items.filter((item: FileStat) => !item.type.includes('directory')) as FileStat[];
        } catch (error) {
            console.error('Failed to list files from WebDAV:', error);
            throw new Error(`Failed to list files: ${error.message}`);
        }
    }

    public async uploadFile(localPath: string, encryptedContent: ArrayBuffer, encryptedName: string): Promise<void> {
        try {
            this.ensureClient();
            
            // Ensure base path exists
            const exists = await this.client!.exists(this.basePath);
            if (!exists) {
                await this.client!.createDirectory(this.basePath);
            }
            
            // Upload the file
            const remotePath = this.basePath + encryptedName;
            await this.client!.putFileContents(remotePath, encryptedContent);
            
            console.log(`Uploaded file: ${localPath} -> ${remotePath}`);
        } catch (error) {
            console.error(`Failed to upload file ${localPath}:`, error);
            throw new Error(`Failed to upload file ${localPath}: ${error.message}`);
        }
    }

    public async downloadFile(encryptedName: string): Promise<ArrayBuffer> {
        try {
            this.ensureClient();
            
            const remotePath = this.basePath + encryptedName;
            
            // Check if file exists
            const exists = await this.client!.exists(remotePath);
            if (!exists) {
                throw new Error(`File not found on server: ${remotePath}`);
            }
            
            // Download file content
            const content = await this.client!.getFileContents(remotePath, { format: 'binary' });
            
            console.log(`Downloaded file: ${remotePath}`);
            return content as ArrayBuffer;
        } catch (error) {
            console.error(`Failed to download file ${encryptedName}:`, error);
            throw new Error(`Failed to download file: ${error.message}`);
        }
    }

    public async deleteFile(encryptedName: string): Promise<void> {
        try {
            this.ensureClient();
            
            const remotePath = this.basePath + encryptedName;
            
            // Check if file exists
            const exists = await this.client!.exists(remotePath);
            if (!exists) {
                console.log(`File ${remotePath} does not exist on server, skipping delete`);
                return;
            }
            
            // Delete file
            await this.client!.deleteFile(remotePath);
            
            console.log(`Deleted file: ${remotePath}`);
        } catch (error) {
            console.error(`Failed to delete file ${encryptedName}:`, error);
            throw new Error(`Failed to delete file: ${error.message}`);
        }
    }
}
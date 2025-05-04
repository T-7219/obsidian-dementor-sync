import { Notice, requestUrl, RequestUrlResponse } from 'obsidian';
import { createClient, WebDAVClient as WebDAVClientType, FileStat } from 'webdav';
import type DementorSyncPlugin from './main';

export class WebDAVClient {
    private client: WebDAVClientType | null = null;
    private plugin: DementorSyncPlugin;
    // Make basePath configurable with a default
    private basePath: string = '/dementor-sync/';
    
    // Yandex WebDAV requires specific handling
    private isYandexWebDAV: boolean = false;

    constructor(plugin: DementorSyncPlugin) {
        this.plugin = plugin;
        this.updateConfig();
    }

    public updateConfig() {
        const { webdavUrl, webdavUsername, webdavPassword } = this.plugin.settings;
        
        if (webdavUrl && webdavUsername && webdavPassword) {
            // Make sure URL ends with a trailing slash
            const url = webdavUrl.endsWith('/') ? webdavUrl : webdavUrl + '/';
            
            // Check if this is Yandex WebDAV
            this.isYandexWebDAV = url.includes('webdav.yandex');
            
            // For Yandex WebDAV, use a special path structure
            if (this.isYandexWebDAV) {
                // Yandex WebDAV works better with disk:/ prefix
                this.basePath = 'disk:/ObsidianSync/';
                console.log('Yandex WebDAV detected, using special path:', this.basePath);
            } else {
                this.basePath = '/dementor-sync/';
            }
            
            // Configure the client with authentication
            this.client = createClient(url, {
                username: webdavUsername,
                password: webdavPassword,
                // Add a longer timeout for slower connections
                maxBodyLength: 100 * 1024 * 1024, // 100 MB
                maxContentLength: 100 * 1024 * 1024 // 100 MB
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

    // New diagnostic function for detailed connection testing
    public async diagnoseBadConnection(): Promise<string> {
        try {
            const { webdavUrl, webdavUsername, webdavPassword } = this.plugin.settings;
            
            if (!webdavUrl || !webdavUsername || !webdavPassword) {
                return "Missing WebDAV configuration (URL, username, or password)";
            }
            
            // For Yandex, try special direct test first
            if (webdavUrl.includes('webdav.yandex')) {
                const yandexResult = await this.testYandexWebDAV();
                if (!yandexResult.includes('successful')) {
                    return `Yandex WebDAV test: ${yandexResult}`;
                }
            }
            
            // Test connection to the root first (without our basePath)
            try {
                const url = webdavUrl.endsWith('/') ? webdavUrl : webdavUrl + '/';
                const rootClient = createClient(url, {
                    username: webdavUsername,
                    password: webdavPassword
                });
                
                // Just try to check the root exists
                await rootClient.exists('/');
                console.log('Connection to WebDAV root successful');
            } catch (rootError) {
                return `Cannot connect to WebDAV root: ${rootError.message || 'Unknown error'}. Check URL, username and password.`;
            }
            
            // If we got here, root connection works, so the issue is with the path
            try {
                this.ensureClient();
                await this.client!.exists(this.basePath);
            } catch (pathError) {
                return `Connected to server, but cannot access path ${this.basePath}: ${pathError.message || 'Unknown error'}`;
            }
            
            // Test creating directory
            try {
                await this.client!.createDirectory(this.basePath);
            } catch (dirError) {
                return `Connected to server, but cannot create directory ${this.basePath}: ${dirError.message || 'Unknown error'}`;
            }
            
            return "All diagnostics passed successfully. If you still have issues, try with a different base path.";
        } catch (error) {
            return `Diagnostic error: ${error.message || 'Unknown error'}`;
        }
    }

    // New method to test Yandex.WebDAV with direct HTTP request
    public async testYandexWebDAV(): Promise<string> {
        try {
            const { webdavUrl, webdavUsername, webdavPassword } = this.plugin.settings;
            
            if (!webdavUrl || !webdavUsername || !webdavPassword) {
                return "Missing WebDAV configuration";
            }

            // Test with direct HTTP request using Obsidian's requestUrl
            try {
                const url = webdavUrl.endsWith('/') ? webdavUrl : webdavUrl + '/';
                
                // Use PROPFIND method to check server availability
                const response = await requestUrl({
                    url: url,
                    method: 'PROPFIND',
                    headers: {
                        'Authorization': 'Basic ' + btoa(webdavUsername + ':' + webdavPassword),
                        'Depth': '0',
                        'Content-Type': 'application/xml'
                    }
                });
                
                if (response.status >= 200 && response.status < 300) {
                    return `Server responded with status ${response.status}. Connection successful!`;
                } else {
                    return `Server responded with error status ${response.status}: ${response.text}`;
                }
            } catch (httpError) {
                return `HTTP request failed: ${httpError.message}. This might indicate network issues or server unavailability.`;
            }
        } catch (error) {
            return `Test error: ${error.message || 'Unknown error'}`;
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
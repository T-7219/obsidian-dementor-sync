import type DementorSyncPlugin from './main';
import { TFile } from 'obsidian';

export interface SyncState {
    version: number;
    salt?: number[];
    files: Record<string, FileMetadata>;
    lastSyncTime?: number;
}

export interface FileMetadata {
    encryptedName: string;
    lastModified: number;
    iv: number[];
    size: number;
}

export class StateManager {
    private plugin: DementorSyncPlugin;
    private state: SyncState;
    private readonly STATE_VERSION = 1;

    constructor(plugin: DementorSyncPlugin) {
        this.plugin = plugin;
        this.state = {
            version: this.STATE_VERSION,
            files: {}
        };
        this.loadState();
    }

    /**
     * Load the sync state from disk
     */
    private async loadState() {
        try {
            const loadedState = await this.plugin.loadData();
            if (loadedState) {
                // Check version and handle migrations if needed
                if (loadedState.version !== this.STATE_VERSION) {
                    console.log(`State version mismatch (got ${loadedState.version}, expected ${this.STATE_VERSION}), migrating...`);
                    // Handle migrations here if needed in the future
                }
                
                this.state = {
                    ...loadedState,
                    version: this.STATE_VERSION
                };
            }
            
            console.log(`Loaded sync state with ${Object.keys(this.state.files || {}).length} files`);
        } catch (error) {
            console.error('Failed to load sync state:', error);
            // Initialize with empty state
            this.state = {
                version: this.STATE_VERSION,
                files: {}
            };
        }
    }

    /**
     * Save the current sync state to disk
     */
    public async saveState() {
        try {
            await this.plugin.saveData(this.state);
            console.log(`Saved sync state with ${Object.keys(this.state.files).length} files`);
        } catch (error) {
            console.error('Failed to save sync state:', error);
            throw new Error(`Failed to save sync state: ${error.message}`);
        }
    }

    /**
     * Reset the sync state completely
     */
    public async resetState() {
        // Preserve the salt for encryption consistency
        const { salt } = this.state;
        
        this.state = {
            version: this.STATE_VERSION,
            salt,
            files: {}
        };
        
        await this.saveState();
        console.log('Sync state has been reset');
    }

    /**
     * Get the encryption salt
     */
    public async getSalt(): Promise<number[] | undefined> {
        return this.state.salt;
    }

    /**
     * Store the encryption salt
     */
    public async storeSalt(salt: number[]) {
        this.state.salt = salt;
        await this.saveState();
    }

    /**
     * Get metadata for a specific file
     */
    public getFileMetadata(path: string): FileMetadata | undefined {
        return this.state.files[path];
    }

    /**
     * Store metadata for a file
     */
    public async storeFileMetadata(path: string, metadata: FileMetadata) {
        this.state.files[path] = metadata;
        await this.saveState();
    }

    /**
     * Remove metadata for a file
     */
    public async removeFileMetadata(path: string) {
        delete this.state.files[path];
        await this.saveState();
    }

    /**
     * Get all tracked files
     */
    public getAllFiles(): Record<string, FileMetadata> {
        return { ...this.state.files };
    }

    /**
     * Get the timestamp of the last sync
     */
    public getLastSyncTime(): number | undefined {
        return this.state.lastSyncTime;
    }

    /**
     * Update the last sync timestamp to now
     */
    public async updateLastSyncTime() {
        this.state.lastSyncTime = Date.now();
        await this.saveState();
    }

    /**
     * Find the local file path corresponding to an encrypted name
     */
    public findLocalPathByEncryptedName(encryptedName: string): string | undefined {
        for (const [path, metadata] of Object.entries(this.state.files)) {
            if (metadata.encryptedName === encryptedName) {
                return path;
            }
        }
        return undefined;
    }

    /**
     * Check if a file should be excluded from sync
     */
    public isExcluded(path: string): boolean {
        return this.plugin.settings.excludedPaths.some(pattern => {
            if (pattern.endsWith('*')) {
                const prefix = pattern.slice(0, -1);
                return path.startsWith(prefix);
            }
            return path === pattern;
        });
    }

    /**
     * Check if a file has been modified since last sync
     */
    public async hasFileChanged(file: TFile): Promise<boolean> {
        const metadata = this.getFileMetadata(file.path);
        
        // If we have no record, it's a new file
        if (!metadata) {
            return true;
        }
        
        // Check if modification time or size has changed
        return metadata.lastModified !== file.stat.mtime || 
               metadata.size !== file.stat.size;
    }
}
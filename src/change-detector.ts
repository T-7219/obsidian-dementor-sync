import { TAbstractFile, TFile, TFolder, Vault } from 'obsidian';
import type DementorSyncPlugin from './main';

export class ChangeDetector {
    private plugin: DementorSyncPlugin;
    private pendingChanges: Map<string, 'create' | 'modify' | 'delete'> = new Map();

    constructor(plugin: DementorSyncPlugin) {
        this.plugin = plugin;
    }

    /**
     * Handle a file creation event
     */
    public handleFileCreated(file: TAbstractFile) {
        // Only track regular files, not folders
        if (!(file instanceof TFile)) {
            return;
        }

        // Check exclusion
        if (this.plugin.stateManager.isExcluded(file.path)) {
            console.log(`File ${file.path} is excluded, ignoring creation`);
            return;
        }

        console.log(`File created: ${file.path}`);
        this.pendingChanges.set(file.path, 'create');
    }

    /**
     * Handle a file modification event
     */
    public handleFileModified(file: TAbstractFile) {
        // Only track regular files, not folders
        if (!(file instanceof TFile)) {
            return;
        }

        // Check exclusion
        if (this.plugin.stateManager.isExcluded(file.path)) {
            console.log(`File ${file.path} is excluded, ignoring modification`);
            return;
        }

        console.log(`File modified: ${file.path}`);
        
        // If we already have a pending create, don't overwrite it
        if (!this.pendingChanges.has(file.path) || this.pendingChanges.get(file.path) !== 'create') {
            this.pendingChanges.set(file.path, 'modify');
        }
    }

    /**
     * Handle a file deletion event
     */
    public handleFileDeleted(file: TAbstractFile) {
        // Check exclusion
        if (this.plugin.stateManager.isExcluded(file.path)) {
            console.log(`File ${file.path} is excluded, ignoring deletion`);
            return;
        }

        console.log(`File deleted: ${file.path}`);
        
        // If this is a file we're tracking, mark it for deletion
        if (this.plugin.stateManager.getFileMetadata(file.path)) {
            this.pendingChanges.set(file.path, 'delete');
        } else {
            // If the file wasn't tracked, just remove it from pending changes
            this.pendingChanges.delete(file.path);
        }
    }

    /**
     * Handle a file rename event
     */
    public handleFileRenamed(file: TAbstractFile, oldPath: string) {
        // Check exclusion for both paths
        const oldExcluded = this.plugin.stateManager.isExcluded(oldPath);
        const newExcluded = this.plugin.stateManager.isExcluded(file.path);

        // Handle various exclusion scenarios
        if (oldExcluded && newExcluded) {
            console.log(`Both paths are excluded, ignoring rename: ${oldPath} -> ${file.path}`);
            return;
        }

        console.log(`File renamed: ${oldPath} -> ${file.path}`);

        // Handle as a delete of old path and create of new path
        if (!oldExcluded) {
            this.pendingChanges.set(oldPath, 'delete');
        }

        if (!newExcluded && file instanceof TFile) {
            this.pendingChanges.set(file.path, 'create');
        }
    }

    /**
     * Get all detected changes for sync
     */
    public getPendingChanges(): Map<string, 'create' | 'modify' | 'delete'> {
        return new Map(this.pendingChanges);
    }

    /**
     * Clear all pending changes after they've been processed
     */
    public clearPendingChanges() {
        this.pendingChanges.clear();
    }

    /**
     * Scan the vault for all files that should be synced
     */
    public async scanVault(): Promise<{
        toCreate: TFile[];
        toUpdate: TFile[];
        toDelete: string[];
    }> {
        const vault = this.plugin.app.vault;
        const stateManager = this.plugin.stateManager;
        
        // Files to sync (create or update)
        const toCreate: TFile[] = [];
        const toUpdate: TFile[] = [];
        
        // Get all tracked files from state
        const trackedPaths = new Set(Object.keys(stateManager.getAllFiles()));
        const currentPaths = new Set<string>();
        
        // Scan all files in vault
        for (const file of vault.getFiles()) {
            // Skip excluded files
            if (stateManager.isExcluded(file.path)) {
                continue;
            }
            
            currentPaths.add(file.path);
            
            // Check if file is new or modified
            if (!trackedPaths.has(file.path)) {
                toCreate.push(file);
            } else if (await stateManager.hasFileChanged(file)) {
                toUpdate.push(file);
            }
        }
        
        // Find files that exist in state but not in vault (deleted)
        const toDelete: string[] = [];
        for (const path of trackedPaths) {
            if (!currentPaths.has(path)) {
                toDelete.push(path);
            }
        }
        
        return { toCreate, toUpdate, toDelete };
    }
}
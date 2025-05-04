import { setIcon } from 'obsidian';
import type DementorSyncPlugin from '../main';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'testing';

export class SyncStatusBar {
    private statusBarEl: HTMLElement;
    private plugin: DementorSyncPlugin;
    private currentStatus: SyncStatus = 'idle';

    constructor(plugin: DementorSyncPlugin) {
        this.plugin = plugin;
        this.statusBarEl = this.plugin.addStatusBarItem();
        this.setStatus('idle');
    }

    public setStatus(status: SyncStatus): void {
        this.currentStatus = status;
        
        // Clear the element
        this.statusBarEl.empty();
        
        // Add icon and text based on status
        const containerEl = this.statusBarEl.createDiv({
            cls: 'dementor-sync-status'
        });
        
        const iconEl = containerEl.createDiv({
            cls: 'dementor-sync-icon'
        });
        
        const textEl = containerEl.createDiv({
            cls: 'dementor-sync-text'
        });
        
        switch (status) {
            case 'idle':
                setIcon(iconEl, 'cloud-check');
                textEl.textContent = 'Sync ready';
                containerEl.addClass('dementor-sync-idle');
                break;
                
            case 'syncing':
                setIcon(iconEl, 'cloud-sync');
                textEl.textContent = 'Syncing...';
                containerEl.addClass('dementor-sync-active');
                this.animateIcon(iconEl);
                break;
                
            case 'error':
                setIcon(iconEl, 'cloud-off');
                textEl.textContent = 'Sync error';
                containerEl.addClass('dementor-sync-error');
                break;
                
            case 'testing':
                setIcon(iconEl, 'cloud-cog');
                textEl.textContent = 'Testing connection...';
                containerEl.addClass('dementor-sync-active');
                this.animateIcon(iconEl);
                break;
        }
    }
    
    private animateIcon(iconEl: HTMLElement): void {
        // Simple animation by rotating the icon
        iconEl.style.animation = 'dementor-sync-spin 2s linear infinite';
    }
    
    public getStatus(): SyncStatus {
        return this.currentStatus;
    }
}
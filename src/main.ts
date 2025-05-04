import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { DementorSyncSettings, DEFAULT_SETTINGS } from './settings';
import { WebDAVClient } from './webdav-client';
import { EncryptionModule } from './encryption';
import { StateManager } from './state-manager';
import { ChangeDetector } from './change-detector';
import { SyncOrchestrator } from './sync-orchestrator';
import { SyncStatusBar } from './ui/status-bar';

export default class DementorSyncPlugin extends Plugin {
	settings: DementorSyncSettings;
	webdavClient: WebDAVClient;
	encryptionModule: EncryptionModule;
	stateManager: StateManager;
	changeDetector: ChangeDetector;
	syncOrchestrator: SyncOrchestrator;
	statusBar: SyncStatusBar;
	syncInProgress: boolean = false;
	autoSyncIntervalId: number | null = null;

	async onload() {
		await this.loadSettings();

		// Initialize components
		this.stateManager = new StateManager(this);
		this.encryptionModule = new EncryptionModule(this);
		this.webdavClient = new WebDAVClient(this);
		this.changeDetector = new ChangeDetector(this);
		this.syncOrchestrator = new SyncOrchestrator(this);
		this.statusBar = new SyncStatusBar(this);

		// Add ribbon icon for manual synchronization
		this.addRibbonIcon('sync', 'Dementor Sync', async () => {
			if (this.syncInProgress) {
				new Notice('Sync already in progress, please wait');
				return;
			}

			if (!this.settings.webdavUrl || !this.settings.webdavUsername || !this.settings.webdavPassword || !this.settings.encryptionPassword) {
				new Notice('Please configure Dementor Sync settings first');
					// Open settings
				this.openSettingTab();
				return;
			}

			this.syncNow();
		});

		// Add settings tab
		this.addSettingTab(new DementorSyncSettingTab(this.app, this));

		// Register for file events
		this.registerVaultEvents();

		// Start auto-sync if enabled
		this.setupAutoSync();

		console.log('Dementor Sync plugin loaded');
	}

	onunload() {
		// Clear auto-sync interval if set
		if (this.autoSyncIntervalId) {
			window.clearInterval(this.autoSyncIntervalId);
			this.autoSyncIntervalId = null;
		}
		
		console.log('Dementor Sync plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		
		// Update components that might depend on settings
		if (this.webdavClient) {
			this.webdavClient.updateConfig();
		}
		
		// Reconfigure auto-sync
		this.setupAutoSync();
	}
	
	setupAutoSync() {
		// Clear existing auto-sync interval if any
		if (this.autoSyncIntervalId) {
			window.clearInterval(this.autoSyncIntervalId);
			this.autoSyncIntervalId = null;
		}
		
		// Set up new auto-sync interval if enabled
		if (this.settings.autoSyncEnabled && this.settings.autoSyncInterval > 0) {
			const intervalMs = this.settings.autoSyncInterval * 60 * 1000; // Convert minutes to milliseconds
			this.autoSyncIntervalId = window.setInterval(() => {
				this.syncNow();
			}, intervalMs);
			
			console.log(`Auto-sync set up with interval ${this.settings.autoSyncInterval} minutes`);
		}
	}
	
	registerVaultEvents() {
		// Monitor file creation
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (!this.syncInProgress) {
					this.changeDetector.handleFileCreated(file);
				}
			})
		);
		
		// Monitor file modification
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (!this.syncInProgress) {
					this.changeDetector.handleFileModified(file);
				}
			})
		);
		
		// Monitor file deletion
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (!this.syncInProgress) {
					this.changeDetector.handleFileDeleted(file);
				}
			})
		);
		
		// Monitor file renaming
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (!this.syncInProgress) {
					this.changeDetector.handleFileRenamed(file, oldPath);
				}
			})
		);
	}
	
	async syncNow() {
		if (this.syncInProgress) {
			console.log('Sync already in progress, ignoring request');
			return;
		}
		
		// Validate settings
		if (!this.settings.webdavUrl || !this.settings.webdavUsername || !this.settings.webdavPassword || !this.settings.encryptionPassword) {
			new Notice('Please configure Dementor Sync settings first');
			return;
		}
		
		try {
			this.syncInProgress = true;
			this.statusBar.setStatus('syncing');
			
			// Perform the synchronization
			await this.syncOrchestrator.performSync();
			
			this.statusBar.setStatus('idle');
			new Notice('Dementor Sync: Synchronization completed successfully');
		} catch (error) {
			console.error('Sync error:', error);
			this.statusBar.setStatus('error');
			new Notice(`Dementor Sync: Synchronization failed - ${error.message}`);
		} finally {
			this.syncInProgress = false;
		}
	}
	
	async testConnection(): Promise<boolean> {
		try {
			this.statusBar.setStatus('testing');
			const isConnected = await this.webdavClient.testConnection();
			this.statusBar.setStatus('idle');
			return isConnected;
		} catch (error) {
			console.error('Connection test error:', error);
			this.statusBar.setStatus('error');
			throw error;
		}
	}
	
	async resetSyncState() {
		try {
			await this.stateManager.resetState();
			new Notice('Dementor Sync: Sync state has been reset');
		} catch (error) {
			console.error('Failed to reset sync state:', error);
			new Notice(`Dementor Sync: Failed to reset sync state - ${error.message}`);
		}
	}
	
	openSettingTab() {
			// Use a type assertion to work around the TypeScript error
			// This is a common pattern when the TypeScript definitions don't match the actual API
			const appWithSetting = this.app as any;
			appWithSetting.setting.open();
		}
}

class DementorSyncSettingTab extends PluginSettingTab {
	plugin: DementorSyncPlugin;

	constructor(app: App, plugin: DementorSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Dementor Sync Settings' });

		// WebDAV Server Settings
		containerEl.createEl('h3', { text: 'WebDAV Server' });
		
		new Setting(containerEl)
			.setName('WebDAV URL')
			.setDesc('URL of your WebDAV server (e.g., https://example.com/webdav/)')
			.addText(text => text
				.setPlaceholder('https://example.com/webdav/')
				.setValue(this.plugin.settings.webdavUrl)
				.onChange(async (value: string) => {
					this.plugin.settings.webdavUrl = value.trim();
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('WebDAV Username')
			.setDesc('Username for WebDAV authentication')
			.addText(text => text
				.setPlaceholder('username')
				.setValue(this.plugin.settings.webdavUsername)
				.onChange(async (value: string) => {
					this.plugin.settings.webdavUsername = value.trim();
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('WebDAV Password')
			.setDesc('Password for WebDAV authentication')
			.addText(text => {
				text.setPlaceholder('password')
					.setValue(this.plugin.settings.webdavPassword)
					.onChange(async (value: string) => {
						this.plugin.settings.webdavPassword = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
				return text;
			});
		
		new Setting(containerEl)
			.setName('Test Connection')
			.setDesc('Test the connection to your WebDAV server')
			.addButton(button => button
				.setButtonText('Test')
				.setCta()
				.onClick(async () => {
					try {
						button.setDisabled(true);
						button.setButtonText('Testing...');
						
						// First try normal connection
						const isConnected = await this.plugin.testConnection();
						
						if (isConnected) {
							new Notice('Connection to WebDAV server successful!');
						} else {
							// If failed, run diagnostics
							button.setButtonText('Diagnosing...');
							const diagnosticResult = await this.plugin.webdavClient.diagnoseBadConnection();
							
							// Display detailed error in a persistent notice
							new Notice(`Connection to WebDAV server failed: ${diagnosticResult}`, 10000);
							console.error('WebDAV connection diagnostic:', diagnosticResult);
						}
					} catch (error) {
						new Notice(`Connection test failed: ${error.message}`, 10000);
					} finally {
						button.setDisabled(false);
						button.setButtonText('Test');
					}
				}));
		
		// Encryption Settings
		containerEl.createEl('h3', { text: 'Encryption' });
		
		const warningEl = containerEl.createEl('div', {
			cls: 'dementor-sync-warning',
			text: '⚠️ WARNING: If you lose this password, your synced data CANNOT be recovered! Store it securely.'
		});
		warningEl.style.color = 'red';
		warningEl.style.fontWeight = 'bold';
		warningEl.style.marginBottom = '1em';
		
		new Setting(containerEl)
			.setName('Encryption Password')
			.setDesc('Password used to encrypt your data (never sent to the server)')
			.addText(text => {
				text.setPlaceholder('secure encryption password')
					.setValue(this.plugin.settings.encryptionPassword)
					.onChange(async (value: string) => {
						this.plugin.settings.encryptionPassword = value;
						await this.plugin.saveSettings();
					});
				// Fix: Set input type directly on the element
				text.inputEl.type = 'password';
				return text;
			});
		
		new Setting(containerEl)
			.setName('Confirm Password')
			.setDesc('Confirm your encryption password')
			.addText(text => {
				text.setPlaceholder('confirm password')
					.setValue(this.plugin.settings.encryptionPassword);
				// Fix: Set input type directly on the element
				text.inputEl.type = 'password';
				return text;
			});
		
		// Sync Settings
		containerEl.createEl('h3', { text: 'Synchronization' });
		
		new Setting(containerEl)
			.setName('Enable Auto-Sync')
			.setDesc('Automatically synchronize at regular intervals')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSyncEnabled)
				.onChange(async (value) => {
					this.plugin.settings.autoSyncEnabled = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('Auto-Sync Interval')
			.setDesc('How often to perform automatic synchronization (in minutes)')
			.addSlider(slider => slider
				.setLimits(5, 120, 5)
				.setValue(this.plugin.settings.autoSyncInterval)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.autoSyncInterval = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Excluded Paths')
			.setDesc('Files and folders to exclude from sync (comma-separated, e.g., .trash, .obsidian/plugins)')
			.addText(text => text
				.setPlaceholder('.trash, .obsidian/plugins')
				.setValue(this.plugin.settings.excludedPaths.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.excludedPaths = value
						.split(',')
						.map(path => path.trim())
						.filter(path => path.length > 0);
					await this.plugin.saveSettings();
				}));
		
		// Advanced Settings
		containerEl.createEl('h3', { text: 'Advanced' });
		
		new Setting(containerEl)
			.setName('Reset Sync State')
			.setDesc('Clear the cached sync state and force a full resynchronization on next sync')
			.addButton(button => button
				.setButtonText('Reset')
				.setWarning()
				.onClick(async () => {
					button.setDisabled(true);
					await this.plugin.resetSyncState();
					button.setDisabled(false);
				}));
	}
}
export interface DementorSyncSettings {
    webdavUrl: string;
    webdavUsername: string;
    webdavPassword: string;
    encryptionPassword: string;
    autoSyncEnabled: boolean;
    autoSyncInterval: number;
    excludedPaths: string[];
}

export const DEFAULT_SETTINGS: DementorSyncSettings = {
    webdavUrl: '',
    webdavUsername: '',
    webdavPassword: '',
    encryptionPassword: '',
    autoSyncEnabled: false,
    autoSyncInterval: 30,
    excludedPaths: ['.trash', '.obsidian/plugins', '.obsidian/workspace.json']
};
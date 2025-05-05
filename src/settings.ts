export type SyncMethod = 'webdav' | 's3';

export interface DementorSyncSettings {
    syncMethod: SyncMethod;
    
    // WebDAV настройки
    webdavUrl: string;
    webdavUsername: string;
    webdavPassword: string;
    
    // S3 настройки
    s3Url: string;
    s3Bucket: string;
    s3AccessKey: string;
    s3SecretKey: string;
    s3Region: string; // Добавлен параметр региона S3
    
    // Общие настройки
    encryptionPassword: string;
    autoSyncEnabled: boolean;
    autoSyncInterval: number;
    excludedPaths: string[];
}

export const DEFAULT_SETTINGS: DementorSyncSettings = {
    syncMethod: 'webdav',
    
    // WebDAV настройки
    webdavUrl: '',
    webdavUsername: '',
    webdavPassword: '',
    
    // S3 настройки
    s3Url: '',
    s3Bucket: '',
    s3AccessKey: '',
    s3SecretKey: '',
    s3Region: 'us-east-1', // Значение по умолчанию для региона
    
    // Общие настройки
    encryptionPassword: '',
    autoSyncEnabled: false,
    autoSyncInterval: 30,
    excludedPaths: ['.trash', '.obsidian/plugins', '.obsidian/workspace.json']
};
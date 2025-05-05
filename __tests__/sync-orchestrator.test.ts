import { SyncOrchestrator } from '../src/sync-orchestrator';
import { WebDAVClient } from '../src/webdav-client';
import { S3Client } from '../src/s3-client';
import { Encryption } from '../src/encryption';
import { StateManager } from '../src/state-manager';
import { ChangeDetector } from '../src/change-detector';
import { SyncStatus, SyncType } from '../src/types';
import type DementorSyncPlugin from '../src/main';
import { TFile, TFolder, Vault, Notice } from 'obsidian';

// Моки для всех зависимостей
jest.mock('../src/webdav-client');
jest.mock('../src/s3-client');
jest.mock('../src/encryption');
jest.mock('../src/state-manager');
jest.mock('../src/change-detector');
jest.mock('obsidian', () => {
  return {
    Notice: jest.fn(),
    TFile: jest.fn(),
    TFolder: jest.fn(),
    Vault: {
      getName: jest.fn().mockReturnValue('test-vault'),
      getFiles: jest.fn().mockReturnValue([]),
      read: jest.fn().mockResolvedValue('file content'),
      getAbstractFileByPath: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    requestUrl: jest.fn(),
  };
});

describe('SyncOrchestrator', () => {
  // Создаем моки для всех зависимостей
  const mockWebDAVClient = new WebDAVClient(null as unknown as DementorSyncPlugin);
  const mockS3Client = new S3Client(null as unknown as DementorSyncPlugin);
  const mockEncryption = new Encryption();
  const mockStateManager = new StateManager();
  const mockChangeDetector = new ChangeDetector();
  const mockPlugin = {
    settings: {
      encryptionKey: 'test-encryption-key',
      cloudLocation: 'webdav',
      remoteFilesDeletedLocally: [],
      excludedFolders: [],
      excludedFiles: []
    },
    manifest: {
      version: '1.0.0'
    },
    vault: Vault,
    syncStatus: SyncStatus.IDLE,
    setSyncStatus: jest.fn(),
    updateStatusBar: jest.fn(),
    webdavClient: mockWebDAVClient,
    s3Client: mockS3Client,
    encryption: mockEncryption,
    stateManager: mockStateManager,
    changeDetector: mockChangeDetector
  } as unknown as DementorSyncPlugin;

  let syncOrchestrator: SyncOrchestrator;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Настраиваем базовые моки
    (mockWebDAVClient.testConnection as jest.Mock).mockResolvedValue(true);
    (mockWebDAVClient.listFiles as jest.Mock).mockResolvedValue([]);
    (mockWebDAVClient.uploadFile as jest.Mock).mockResolvedValue(undefined);
    (mockWebDAVClient.downloadFile as jest.Mock).mockResolvedValue(new ArrayBuffer(10));
    (mockWebDAVClient.deleteFile as jest.Mock).mockResolvedValue(undefined);
    
    (mockS3Client.testConnection as jest.Mock).mockResolvedValue(true);
    (mockS3Client.listFiles as jest.Mock).mockResolvedValue([]);
    (mockS3Client.uploadFile as jest.Mock).mockResolvedValue(undefined);
    (mockS3Client.downloadFile as jest.Mock).mockResolvedValue(new ArrayBuffer(10));
    (mockS3Client.deleteFile as jest.Mock).mockResolvedValue(undefined);
    
    (mockEncryption.encryptContent as jest.Mock).mockResolvedValue(new ArrayBuffer(10));
    (mockEncryption.decryptContent as jest.Mock).mockResolvedValue('decrypted content');
    (mockEncryption.generateFileName as jest.Mock).mockImplementation((name) => `${name}.enc`);
    
    (mockStateManager.getLastSyncedFiles as jest.Mock).mockResolvedValue({});
    (mockStateManager.updateLastSynced as jest.Mock).mockResolvedValue(undefined);
    
    (mockChangeDetector.detectLocalChanges as jest.Mock).mockResolvedValue({
      new: [],
      modified: [],
      deleted: []
    });
    (mockChangeDetector.detectRemoteChanges as jest.Mock).mockResolvedValue({
      new: [],
      modified: [],
      deleted: []
    });
    (mockChangeDetector.detectConflicts as jest.Mock).mockResolvedValue([]);
    
    // Инициализируем оркестратор
    syncOrchestrator = new SyncOrchestrator(mockPlugin);
  });
  
  test('should initialize correctly', () => {
    expect(syncOrchestrator).toBeDefined();
  });
  
  test('should handle WebDAV client for cloud sync', async () => {
    // Настраиваем плагин для использования WebDAV
    mockPlugin.settings.cloudLocation = 'webdav';
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что был использован WebDAV клиент
    expect(mockWebDAVClient.testConnection).toHaveBeenCalled();
    expect(mockS3Client.testConnection).not.toHaveBeenCalled();
  });
  
  test('should handle S3 client for cloud sync', async () => {
    // Настраиваем плагин для использования S3
    mockPlugin.settings.cloudLocation = 's3';
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что был использован S3 клиент
    expect(mockS3Client.testConnection).toHaveBeenCalled();
    expect(mockWebDAVClient.testConnection).not.toHaveBeenCalled();
  });
  
  test('should handle no cloud location configured', async () => {
    // Настраиваем плагин без настроек облака
    mockPlugin.settings.cloudLocation = '';
    
    // Вызываем метод синхронизации
    await expect(syncOrchestrator.synchronize(SyncType.MANUAL)).rejects.toThrow();
    
    // Проверяем, что ни один клиент не был использован
    expect(mockWebDAVClient.testConnection).not.toHaveBeenCalled();
    expect(mockS3Client.testConnection).not.toHaveBeenCalled();
  });
  
  test('should handle no encryption key configured', async () => {
    // Настраиваем плагин без ключа шифрования
    mockPlugin.settings.encryptionKey = '';
    
    // Вызываем метод синхронизации
    await expect(syncOrchestrator.synchronize(SyncType.MANUAL)).rejects.toThrow();
  });
  
  test('should detect and upload new local files', async () => {
    // Настраиваем мок для обнаружения новых локальных файлов
    const mockNewFile = new TFile();
    mockNewFile.path = 'test-file.md';
    (mockChangeDetector.detectLocalChanges as jest.Mock).mockResolvedValueOnce({
      new: [mockNewFile],
      modified: [],
      deleted: []
    });
    (Vault.read as jest.Mock).mockResolvedValueOnce('new file content');
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что файл был зашифрован и загружен
    expect(mockEncryption.encryptContent).toHaveBeenCalledWith('new file content');
    expect(mockWebDAVClient.uploadFile).toHaveBeenCalled();
  });
  
  test('should detect and update modified local files', async () => {
    // Настраиваем мок для обнаружения измененных локальных файлов
    const mockModifiedFile = new TFile();
    mockModifiedFile.path = 'modified-file.md';
    (mockChangeDetector.detectLocalChanges as jest.Mock).mockResolvedValueOnce({
      new: [],
      modified: [mockModifiedFile],
      deleted: []
    });
    (Vault.read as jest.Mock).mockResolvedValueOnce('modified file content');
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что файл был зашифрован и загружен
    expect(mockEncryption.encryptContent).toHaveBeenCalledWith('modified file content');
    expect(mockWebDAVClient.uploadFile).toHaveBeenCalled();
  });
  
  test('should detect and handle deleted local files', async () => {
    // Настраиваем мок для обнаружения удаленных локальных файлов
    (mockChangeDetector.detectLocalChanges as jest.Mock).mockResolvedValueOnce({
      new: [],
      modified: [],
      deleted: ['deleted-file.md']
    });
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что файл был удален удаленно
    expect(mockWebDAVClient.deleteFile).toHaveBeenCalled();
  });
  
  test('should detect and download new remote files', async () => {
    // Настраиваем мок для обнаружения новых удаленных файлов
    (mockChangeDetector.detectRemoteChanges as jest.Mock).mockResolvedValueOnce({
      new: [{
        basename: 'new-remote-file.enc',
        filename: 'new-remote-file.enc',
        size: 100,
        lastModified: new Date()
      }],
      modified: [],
      deleted: []
    });
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что файл был скачан и расшифрован
    expect(mockWebDAVClient.downloadFile).toHaveBeenCalledWith('new-remote-file.enc');
    expect(mockEncryption.decryptContent).toHaveBeenCalled();
  });
  
  test('should detect and update modified remote files', async () => {
    // Настраиваем мок для обнаружения измененных удаленных файлов
    (mockChangeDetector.detectRemoteChanges as jest.Mock).mockResolvedValueOnce({
      new: [],
      modified: [{
        basename: 'modified-remote-file.enc',
        filename: 'modified-remote-file.enc',
        size: 100,
        lastModified: new Date()
      }],
      deleted: []
    });
    (mockEncryption.getOriginalFileName as jest.Mock).mockReturnValueOnce('modified-remote-file.md');
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что файл был скачан и расшифрован
    expect(mockWebDAVClient.downloadFile).toHaveBeenCalledWith('modified-remote-file.enc');
    expect(mockEncryption.decryptContent).toHaveBeenCalled();
  });
  
  test('should detect and handle deleted remote files', async () => {
    // Настраиваем мок для обнаружения удаленных удаленных файлов
    (mockChangeDetector.detectRemoteChanges as jest.Mock).mockResolvedValueOnce({
      new: [],
      modified: [],
      deleted: ['deleted-remote-file.enc']
    });
    (mockEncryption.getOriginalFileName as jest.Mock).mockReturnValueOnce('deleted-remote-file.md');
    
    // Настраиваем мок для поиска файла в хранилище
    const mockDeletedFile = new TFile();
    (Vault.getAbstractFileByPath as jest.Mock).mockReturnValueOnce(mockDeletedFile);
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что файл был удален локально
    expect(Vault.delete).toHaveBeenCalledWith(mockDeletedFile);
  });
  
  test('should handle conflicts with remote version winning', async () => {
    // Настраиваем мок для обнаружения конфликтов
    const mockLocalFile = new TFile();
    mockLocalFile.path = 'conflict-file.md';
    const mockRemoteFile = {
      basename: 'conflict-file.enc',
      filename: 'conflict-file.enc',
      size: 100,
      lastModified: new Date()
    };
    
    (mockChangeDetector.detectConflicts as jest.Mock).mockResolvedValueOnce([
      { local: mockLocalFile, remote: mockRemoteFile }
    ]);
    
    // Настраиваем плагин для выбора удаленной версии при конфликтах
    mockPlugin.settings.conflictResolutionStrategy = 'remote';
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что удаленный файл был скачан и расшифрован
    expect(mockWebDAVClient.downloadFile).toHaveBeenCalledWith('conflict-file.enc');
    expect(mockEncryption.decryptContent).toHaveBeenCalled();
  });
  
  test('should handle conflicts with local version winning', async () => {
    // Настраиваем мок для обнаружения конфликтов
    const mockLocalFile = new TFile();
    mockLocalFile.path = 'conflict-file.md';
    const mockRemoteFile = {
      basename: 'conflict-file.enc',
      filename: 'conflict-file.enc',
      size: 100,
      lastModified: new Date()
    };
    
    (mockChangeDetector.detectConflicts as jest.Mock).mockResolvedValueOnce([
      { local: mockLocalFile, remote: mockRemoteFile }
    ]);
    
    // Настраиваем плагин для выбора локальной версии при конфликтах
    mockPlugin.settings.conflictResolutionStrategy = 'local';
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что локальный файл был зашифрован и загружен
    expect(Vault.read).toHaveBeenCalledWith(mockLocalFile);
    expect(mockEncryption.encryptContent).toHaveBeenCalled();
    expect(mockWebDAVClient.uploadFile).toHaveBeenCalled();
  });
  
  test('should handle conflicts with newest version winning', async () => {
    // Настраиваем мок для обнаружения конфликтов
    const mockLocalFile = new TFile();
    mockLocalFile.path = 'conflict-file.md';
    mockLocalFile.stat = {
      mtime: Date.now() - 3600000 // 1 hour ago
    };
    
    const mockRemoteFile = {
      basename: 'conflict-file.enc',
      filename: 'conflict-file.enc',
      size: 100,
      lastModified: new Date() // Now (newer than local)
    };
    
    (mockChangeDetector.detectConflicts as jest.Mock).mockResolvedValueOnce([
      { local: mockLocalFile, remote: mockRemoteFile }
    ]);
    
    // Настраиваем плагин для выбора новейшей версии при конфликтах
    mockPlugin.settings.conflictResolutionStrategy = 'newest';
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что удаленный файл был скачан и расшифрован (так как он новее)
    expect(mockWebDAVClient.downloadFile).toHaveBeenCalledWith('conflict-file.enc');
    expect(mockEncryption.decryptContent).toHaveBeenCalled();
  });
  
  test('should handle conflicts with ask strategy by using default', async () => {
    // Настраиваем мок для обнаружения конфликтов
    const mockLocalFile = new TFile();
    mockLocalFile.path = 'conflict-file.md';
    const mockRemoteFile = {
      basename: 'conflict-file.enc',
      filename: 'conflict-file.enc',
      size: 100,
      lastModified: new Date()
    };
    
    (mockChangeDetector.detectConflicts as jest.Mock).mockResolvedValueOnce([
      { local: mockLocalFile, remote: mockRemoteFile }
    ]);
    
    // Настраиваем плагин для стратегии "спрашивать" при конфликтах
    // В автоматических тестах это должно использовать стандартную стратегию
    mockPlugin.settings.conflictResolutionStrategy = 'ask';
    mockPlugin.settings.defaultConflictResolution = 'local';
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.AUTO);
    
    // Проверяем, что локальный файл был зашифрован и загружен (используя стандартную стратегию)
    expect(Vault.read).toHaveBeenCalledWith(mockLocalFile);
    expect(mockEncryption.encryptContent).toHaveBeenCalled();
    expect(mockWebDAVClient.uploadFile).toHaveBeenCalled();
  });
  
  test('should handle sync with excluded folders', async () => {
    // Настраиваем исключенные папки
    mockPlugin.settings.excludedFolders = ['excluded-folder'];
    
    // Настраиваем мок для нового файла в исключенной папке
    const mockExcludedFile = new TFile();
    mockExcludedFile.path = 'excluded-folder/test-file.md';
    
    // Настраиваем мок для обнаружения новых локальных файлов
    (mockChangeDetector.detectLocalChanges as jest.Mock).mockResolvedValueOnce({
      new: [mockExcludedFile],
      modified: [],
      deleted: []
    });
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что файл не был зашифрован и загружен
    expect(mockEncryption.encryptContent).not.toHaveBeenCalled();
    expect(mockWebDAVClient.uploadFile).not.toHaveBeenCalled();
  });
  
  test('should handle sync with excluded files', async () => {
    // Настраиваем исключенные файлы
    mockPlugin.settings.excludedFiles = ['excluded-file.md'];
    
    // Настраиваем мок для исключенного файла
    const mockExcludedFile = new TFile();
    mockExcludedFile.path = 'excluded-file.md';
    
    // Настраиваем мок для обнаружения новых локальных файлов
    (mockChangeDetector.detectLocalChanges as jest.Mock).mockResolvedValueOnce({
      new: [mockExcludedFile],
      modified: [],
      deleted: []
    });
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что файл не был зашифрован и загружен
    expect(mockEncryption.encryptContent).not.toHaveBeenCalled();
    expect(mockWebDAVClient.uploadFile).not.toHaveBeenCalled();
  });
  
  test('should handle sync errors gracefully', async () => {
    // Настраиваем мок ошибки тестирования соединения
    (mockWebDAVClient.testConnection as jest.Mock).mockResolvedValueOnce(false);
    
    // Вызываем метод синхронизации
    await expect(syncOrchestrator.synchronize(SyncType.MANUAL)).rejects.toThrow();
    
    // Проверяем, что статус синхронизации изменился на ERROR
    expect(mockPlugin.setSyncStatus).toHaveBeenCalledWith(SyncStatus.ERROR);
  });
  
  test('should update sync status before and after synchronization', async () => {
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что статус синхронизации изменился на SYNCING и затем на IDLE
    expect(mockPlugin.setSyncStatus).toHaveBeenCalledWith(SyncStatus.SYNCING);
    expect(mockPlugin.setSyncStatus).toHaveBeenCalledWith(SyncStatus.IDLE);
  });
  
  test('should not sync when already syncing', async () => {
    // Настраиваем статус синхронизации
    mockPlugin.syncStatus = SyncStatus.SYNCING;
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что синхронизация не выполнилась
    expect(mockWebDAVClient.testConnection).not.toHaveBeenCalled();
    expect(mockS3Client.testConnection).not.toHaveBeenCalled();
  });
  
  test('should handle errors during file upload', async () => {
    // Настраиваем мок для обнаружения новых локальных файлов
    const mockNewFile = new TFile();
    mockNewFile.path = 'test-file.md';
    (mockChangeDetector.detectLocalChanges as jest.Mock).mockResolvedValueOnce({
      new: [mockNewFile],
      modified: [],
      deleted: []
    });
    
    // Настраиваем мок для ошибки загрузки
    (mockWebDAVClient.uploadFile as jest.Mock).mockRejectedValueOnce(new Error('Upload error'));
    
    // Вызываем метод синхронизации с обработкой ошибок
    await expect(syncOrchestrator.synchronize(SyncType.MANUAL)).rejects.toThrow('Upload error');
    
    // Проверяем, что статус синхронизации изменился на ERROR
    expect(mockPlugin.setSyncStatus).toHaveBeenCalledWith(SyncStatus.ERROR);
  });

  test('should create a backup of the vault before full sync', async () => {
    // Настраиваем плагин для создания резервных копий
    mockPlugin.settings.createBackupBeforeSync = true;
    
    // Настроим мок для определения полной синхронизации
    (mockStateManager.getLastSyncedFiles as jest.Mock).mockResolvedValueOnce({});
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что был вызван метод для создания резервной копии
    // Обычно это был бы отдельный мок для метода createBackup или подобного
    // В данном случае мы проверим, что появилась соответствующая запись в логе или уведомление
    expect(Notice).toHaveBeenCalledWith(expect.stringContaining('резервн'), expect.any(Number));
  });
  
  test('should handle sync with empty vault', async () => {
    // Настраиваем мок для пустого хранилища
    (Vault.getFiles as jest.Mock).mockReturnValueOnce([]);
    (mockChangeDetector.detectLocalChanges as jest.Mock).mockResolvedValueOnce({
      new: [],
      modified: [],
      deleted: []
    });
    (mockChangeDetector.detectRemoteChanges as jest.Mock).mockResolvedValueOnce({
      new: [],
      modified: [],
      deleted: []
    });
    
    // Вызываем метод синхронизации
    await syncOrchestrator.synchronize(SyncType.MANUAL);
    
    // Проверяем, что синхронизация завершилась успешно
    expect(mockPlugin.setSyncStatus).toHaveBeenCalledWith(SyncStatus.IDLE);
    // Должно быть какое-то уведомление о том, что нет изменений
    expect(Notice).toHaveBeenCalledWith(expect.stringContaining('нет изменений'), expect.any(Number));
  });
  
  test('should perform quick sync for regular auto sync', async () => {
    // Настраиваем мок для быстрой синхронизации
    const mockQuickSyncFile = new TFile();
    mockQuickSyncFile.path = 'quick-sync-file.md';
    (mockChangeDetector.detectLocalChanges as jest.Mock).mockResolvedValueOnce({
      new: [mockQuickSyncFile],
      modified: [],
      deleted: []
    });
    
    // Вызываем метод автоматической синхронизации
    await syncOrchestrator.synchronize(SyncType.AUTO);
    
    // Проверяем, что был выполнен быстрый анализ без полной проверки удаленных файлов
    expect(mockWebDAVClient.listFiles).toHaveBeenCalled();
    expect(mockStateManager.updateLastSynced).toHaveBeenCalled();
  });
});
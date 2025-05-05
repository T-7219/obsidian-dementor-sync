import { WebDAVClient } from '../src/webdav-client';
import type DementorSyncPlugin from '../src/main';
import { requestUrl } from 'obsidian';

// Мокаем библиотеку webdav
jest.mock('webdav', () => {
  return {
    createClient: jest.fn(() => ({
      exists: jest.fn(),
      createDirectory: jest.fn(),
      getDirectoryContents: jest.fn(),
      putFileContents: jest.fn(),
      getFileContents: jest.fn(),
      deleteFile: jest.fn()
    }))
  };
});

// Мок для requestUrl из Obsidian
jest.mock('obsidian', () => {
  return {
    requestUrl: jest.fn(),
    Notice: jest.fn()
  };
});

// Импортируем мокированную функцию createClient
import { createClient } from 'webdav';

describe('WebDAVClient', () => {
  // Мок для плагина
  const mockPlugin = {
    settings: {
      webdavUrl: 'https://webdav.example.com',
      webdavUsername: 'test-user',
      webdavPassword: 'test-password',
      webdavPath: '/obsidian-sync/'
    }
  } as unknown as DementorSyncPlugin;
  
  let webdavClient: WebDAVClient;
  let mockWebDAVClientMethods: any;
  
  beforeEach(() => {
    // Сбрасываем моки перед каждым тестом
    jest.clearAllMocks();
    
    // Создаем экземпляр WebDAVClient с мок-плагином
    webdavClient = new WebDAVClient(mockPlugin);
    
    // Получаем ссылку на мок-методы после создания клиента
    mockWebDAVClientMethods = (createClient as jest.Mock).mock.results[0].value;
  });
  
  test('should initialize with correct configuration', () => {
    // Проверяем, что createClient был вызван с правильными параметрами
    expect(createClient).toHaveBeenCalledWith(
      expect.stringContaining('https://webdav.example.com'),
      expect.objectContaining({
        username: 'test-user',
        password: 'test-password'
      })
    );
  });
  
  test('should handle Yandex WebDAV specially', () => {
    // Создаем новый клиент с URL Yandex WebDAV
    mockPlugin.settings.webdavUrl = 'https://webdav.yandex.ru';
    const yandexClient = new WebDAVClient(mockPlugin);
    
    // Проверяем, что был создан клиент с правильной конфигурацией
    expect(createClient).toHaveBeenLastCalledWith(
      expect.stringContaining('webdav.yandex'),
      expect.any(Object)
    );
    
    // Проверяем, что basePath настроен правильно для Yandex
    // @ts-ignore - доступ к приватному свойству для тестирования
    expect(yandexClient.basePath).toContain('disk:/');
    // @ts-ignore - доступ к приватному свойству для тестирования
    expect(yandexClient.isYandexWebDAV).toBe(true);
  });
  
  test('should reset client when configuration is incomplete', () => {
    // Сбрасываем настройки
    mockPlugin.settings.webdavUrl = '';
    webdavClient.updateConfig();
    
    // Проверяем, что клиент был сброшен
    // @ts-ignore - доступ к приватному свойству для тестирования
    expect(webdavClient.client).toBeNull();
  });
  
  test('should test connection successfully', async () => {
    // Настраиваем мок успешного ответа
    mockWebDAVClientMethods.exists.mockResolvedValue(true);
    
    // Вызываем тестирование соединения
    const result = await webdavClient.testConnection();
    
    // Проверяем результат
    expect(result).toBe(true);
    expect(mockWebDAVClientMethods.exists).toHaveBeenCalled();
  });
  
  test('should handle connection errors during test', async () => {
    // Настраиваем мок ошибки
    mockWebDAVClientMethods.exists.mockRejectedValue(new Error('Connection failed'));
    
    // Вызываем тестирование соединения
    const result = await webdavClient.testConnection();
    
    // Проверяем результат
    expect(result).toBe(false);
  });
  
  test('should provide detailed diagnostic information', async () => {
    // Настраиваем мок для сбоев с разными кодами ошибок
    mockWebDAVClientMethods.exists.mockRejectedValue({ status: 401 });
    
    // Вызываем диагностику
    const diagnosticResult = await webdavClient.diagnoseBadConnection();
    
    // Проверяем результат
    expect(diagnosticResult).toContain('401');
    expect(diagnosticResult).toContain('ошибка авторизации');
  });
  
  test('should create directory if it does not exist', async () => {
    // Настраиваем мок для проверки существования директории
    mockWebDAVClientMethods.exists.mockResolvedValue(false);
    
    // Вызываем метод
    await webdavClient.ensureSyncDirectoryExists();
    
    // Проверяем, что была создана директория
    expect(mockWebDAVClientMethods.createDirectory).toHaveBeenCalledWith(
      expect.stringContaining('/obsidian-sync/')
    );
  });
  
  test('should not create directory if it already exists', async () => {
    // Настраиваем мок для проверки существования директории
    mockWebDAVClientMethods.exists.mockResolvedValue(true);
    
    // Вызываем метод
    await webdavClient.ensureSyncDirectoryExists();
    
    // Проверяем, что директория не создавалась
    expect(mockWebDAVClientMethods.createDirectory).not.toHaveBeenCalled();
  });
  
  test('should list files correctly', async () => {
    // Настраиваем мок для списка файлов
    mockWebDAVClientMethods.getDirectoryContents.mockResolvedValue([
      {
        basename: 'file1.enc',
        filename: '/obsidian-sync/file1.enc',
        lastmod: new Date().toISOString(),
        size: 100,
        type: 'file'
      },
      {
        basename: 'file2.enc',
        filename: '/obsidian-sync/file2.enc',
        lastmod: new Date().toISOString(),
        size: 200,
        type: 'file'
      },
      {
        basename: 'subfolder',
        filename: '/obsidian-sync/subfolder',
        lastmod: new Date().toISOString(),
        size: 0,
        type: 'directory'
      }
    ]);
    
    // Вызываем метод
    const files = await webdavClient.listFiles();
    
    // Проверяем результат
    expect(files.length).toBe(2); // Только файлы, без директорий
    expect(files[0]).toHaveProperty('basename', 'file1.enc');
    expect(files[1]).toHaveProperty('basename', 'file2.enc');
  });
  
  test('should handle empty directory when listing files', async () => {
    // Настраиваем мок для пустого списка файлов
    mockWebDAVClientMethods.getDirectoryContents.mockResolvedValue([]);
    
    // Вызываем метод
    const files = await webdavClient.listFiles();
    
    // Проверяем результат
    expect(files).toEqual([]);
  });
  
  test('should handle errors when listing files', async () => {
    // Настраиваем мок для ошибки
    mockWebDAVClientMethods.getDirectoryContents.mockRejectedValue(new Error('Permission denied'));
    
    // Проверяем, что метод корректно обрабатывает ошибку
    await expect(webdavClient.listFiles()).rejects.toThrow('Permission denied');
  });
  
  test('should upload file correctly', async () => {
    // Настраиваем мок для успешной загрузки
    mockWebDAVClientMethods.putFileContents.mockResolvedValue(undefined);
    
    // Создаем тестовый буфер
    const buffer = new ArrayBuffer(10);
    
    // Вызываем метод
    await webdavClient.uploadFile('test-file.md', buffer, 'encrypted-name.enc');
    
    // Проверяем, что были вызваны правильные методы
    expect(mockWebDAVClientMethods.putFileContents).toHaveBeenCalledWith(
      expect.stringContaining('/obsidian-sync/encrypted-name.enc'),
      buffer,
      expect.objectContaining({ overwrite: true })
    );
  });
  
  test('should handle upload errors', async () => {
    // Настраиваем мок для ошибки загрузки
    mockWebDAVClientMethods.putFileContents.mockRejectedValue(new Error('Upload failed'));
    
    // Создаем тестовый буфер
    const buffer = new ArrayBuffer(10);
    
    // Проверяем, что метод корректно обрабатывает ошибку
    await expect(webdavClient.uploadFile('test-file.md', buffer, 'encrypted-name.enc')).rejects.toThrow('Upload failed');
  });
  
  test('should download file correctly', async () => {
    // Создаем тестовый буфер
    const buffer = new ArrayBuffer(10);
    
    // Настраиваем мок для успешного скачивания
    mockWebDAVClientMethods.getFileContents.mockResolvedValue(buffer);
    
    // Вызываем метод
    const result = await webdavClient.downloadFile('encrypted-name.enc');
    
    // Проверяем результат
    expect(result).toBe(buffer);
    expect(mockWebDAVClientMethods.getFileContents).toHaveBeenCalledWith(
      expect.stringContaining('/obsidian-sync/encrypted-name.enc'),
      expect.objectContaining({ format: 'binary' })
    );
  });
  
  test('should handle download errors', async () => {
    // Настраиваем мок для ошибки скачивания
    mockWebDAVClientMethods.getFileContents.mockRejectedValue(new Error('Download failed'));
    
    // Проверяем, что метод корректно обрабатывает ошибку
    await expect(webdavClient.downloadFile('encrypted-name.enc')).rejects.toThrow('Download failed');
  });
  
  test('should delete file correctly', async () => {
    // Настраиваем мок для успешного удаления
    mockWebDAVClientMethods.deleteFile.mockResolvedValue(undefined);
    
    // Вызываем метод
    await webdavClient.deleteFile('encrypted-name.enc');
    
    // Проверяем, что метод был вызван с правильными параметрами
    expect(mockWebDAVClientMethods.deleteFile).toHaveBeenCalledWith(
      expect.stringContaining('/obsidian-sync/encrypted-name.enc')
    );
  });
  
  test('should handle deletion errors', async () => {
    // Настраиваем мок для ошибки удаления
    mockWebDAVClientMethods.deleteFile.mockRejectedValue(new Error('Delete failed'));
    
    // Проверяем, что метод корректно обрабатывает ошибку
    await expect(webdavClient.deleteFile('encrypted-name.enc')).rejects.toThrow('Delete failed');
  });
  
  test('should handle Yandex WebDAV specific paths', async () => {
    // Создаем новый клиент с URL Yandex WebDAV
    mockPlugin.settings.webdavUrl = 'https://webdav.yandex.ru';
    const yandexClient = new WebDAVClient(mockPlugin);
    
    // Получаем ссылку на мок-методы после создания клиента
    const yandexMockClient = (createClient as jest.Mock).mock.results[1].value;
    
    // Настраиваем мок для успешной загрузки
    yandexMockClient.putFileContents.mockResolvedValue(undefined);
    
    // Создаем тестовый буфер
    const buffer = new ArrayBuffer(10);
    
    // Вызываем метод
    await yandexClient.uploadFile('test-file.md', buffer, 'encrypted-name.enc');
    
    // Проверяем, что путь содержит диск Yandex
    expect(yandexMockClient.putFileContents).toHaveBeenCalledWith(
      expect.stringContaining('disk:/obsidian-sync/encrypted-name.enc'),
      buffer,
      expect.any(Object)
    );
  });
  
  test('should handle empty or incorrect configuration', async () => {
    // Создаем клиент с пустыми настройками
    const emptyPlugin = {
      settings: {
        webdavUrl: '',
        webdavUsername: '',
        webdavPassword: '',
        webdavPath: ''
      }
    } as unknown as DementorSyncPlugin;
    
    const emptyClient = new WebDAVClient(emptyPlugin);
    
    // Проверяем, что методы корректно обрабатывают отсутствие конфигурации
    expect(await emptyClient.testConnection()).toBe(false);
    await expect(emptyClient.uploadFile('test-file.md', new ArrayBuffer(10), 'encrypted-name.enc')).rejects.toThrow();
    await expect(emptyClient.downloadFile('encrypted-name.enc')).rejects.toThrow();
    await expect(emptyClient.deleteFile('encrypted-name.enc')).rejects.toThrow();
    await expect(emptyClient.listFiles()).rejects.toThrow();
  });
  
  test('should handle WebDAV paths with and without trailing slashes', async () => {
    // Настраиваем настройки с путями без завершающего слеша
    mockPlugin.settings.webdavUrl = 'https://webdav.example.com';
    mockPlugin.settings.webdavPath = 'obsidian-sync';
    
    // Создаем новый клиент
    const noSlashClient = new WebDAVClient(mockPlugin);
    
    // Получаем ссылку на мок-методы после создания клиента
    const noSlashMockClient = (createClient as jest.Mock).mock.results[2].value;
    
    // Настраиваем мок для успешной загрузки
    noSlashMockClient.putFileContents.mockResolvedValue(undefined);
    
    // Создаем тестовый буфер
    const buffer = new ArrayBuffer(10);
    
    // Вызываем метод
    await noSlashClient.uploadFile('test-file.md', buffer, 'encrypted-name.enc');
    
    // Проверяем, что путь правильно сформирован
    expect(noSlashMockClient.putFileContents).toHaveBeenCalledWith(
      expect.stringContaining('/obsidian-sync/encrypted-name.enc'),
      buffer,
      expect.any(Object)
    );
  });
  
  test('should handle recursive directory creation for deep paths', async () => {
    // Настраиваем мок для проверки существования директории
    mockWebDAVClientMethods.exists.mockImplementation((path) => {
      // Существует только корневая директория
      if (path === '/obsidian-sync/') {
        return Promise.resolve(true);
      }
      // Подпапки не существуют
      return Promise.resolve(false);
    });
    
    // Проверяем создание вложенной директории
    await webdavClient.ensureDirectoryExists('/obsidian-sync/notes/personal/');
    
    // Проверяем, что были созданы все необходимые директории
    expect(mockWebDAVClientMethods.createDirectory).toHaveBeenCalledWith('/obsidian-sync/notes/');
    expect(mockWebDAVClientMethods.createDirectory).toHaveBeenCalledWith('/obsidian-sync/notes/personal/');
  });
});
import { S3Client, S3FileStat } from '../src/s3-client';
import { requestUrl } from 'obsidian';
import type DementorSyncPlugin from '../src/main';
import * as crypto from 'crypto-js';

// Мокаем requestUrl и crypto-js
jest.mock('obsidian', () => ({
    requestUrl: jest.fn(),
    Notice: jest.fn()
}));

// Явно мокаем crypto-js
jest.mock('crypto-js');

describe('S3Client', () => {
    let s3Client: S3Client;
    let mockPlugin: DementorSyncPlugin;
    
    beforeEach(() => {
        // Сбрасываем моки перед каждым тестом
        jest.clearAllMocks();
        (requestUrl as jest.Mock).mockReset();
        
        // Создаем мок для плагина с настройками для S3
        mockPlugin = {
            settings: {
                s3Url: 'https://s3.example.com/',
                s3Bucket: 'test-bucket',
                s3AccessKey: 'test-access-key',
                s3SecretKey: 'test-secret-key',
                s3Region: 'us-east-1'
            }
        } as unknown as DementorSyncPlugin;
        
        // Инициализируем S3 клиент с мокнутым плагином
        s3Client = new S3Client(mockPlugin);
    });

    describe('testConnection', () => {
        test('успешно проверяет соединение', async () => {
            // Мокаем успешный ответ для HEAD запроса на бакет
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 200,
                text: ''
            });
            
            // Мокаем успешный ответ для проверки наличия маркера директории
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 200,
                arrayBuffer: new ArrayBuffer(0),
                text: ''
            });
            
            const result = await s3Client.testConnection();
            
            // Проверяем результат
            expect(result).toBeTruthy();
            expect(requestUrl).toHaveBeenCalledTimes(2);
        });

        test('возвращает false при ошибке доступа к бакету', async () => {
            // Мокаем ошибку доступа
            (requestUrl as jest.Mock).mockRejectedValueOnce({
                status: 403,
                message: 'Forbidden'
            });
            
            const result = await s3Client.testConnection();
            
            // Проверяем результат
            expect(result).toBeFalsy();
            expect(requestUrl).toHaveBeenCalledTimes(1);
        });
        
        test('создает маркер директории, если он отсутствует', async () => {
            // Мокаем успешный ответ для HEAD запроса на бакет
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 200,
                text: ''
            });
            
            // Мокаем 404 ошибку при проверке маркера
            (requestUrl as jest.Mock).mockRejectedValueOnce({
                status: 404,
                message: 'Not Found'
            });
            
            // Мокаем успешную загрузку маркера
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 200,
                text: ''
            });
            
            const result = await s3Client.testConnection();
            
            // Проверяем результат
            expect(result).toBeTruthy();
            expect(requestUrl).toHaveBeenCalledTimes(3);
        });
    });

    describe('listFiles', () => {
        test('возвращает массив файлов с корректным форматированием', async () => {
            // Мокаем XML ответ от S3 с двумя файлами
            const mockXmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                <ListBucketResult>
                    <Name>test-bucket</Name>
                    <Prefix>obsidian-sync/</Prefix>
                    <Contents>
                        <Key>obsidian-sync/file1.md</Key>
                        <LastModified>2025-04-30T12:00:00.000Z</LastModified>
                        <Size>100</Size>
                    </Contents>
                    <Contents>
                        <Key>obsidian-sync/file2.md</Key>
                        <LastModified>2025-04-30T12:10:00.000Z</LastModified>
                        <Size>200</Size>
                    </Contents>
                    <Contents>
                        <Key>obsidian-sync/.keep</Key>
                        <LastModified>2025-04-30T12:10:00.000Z</LastModified>
                        <Size>0</Size>
                    </Contents>
                    <IsTruncated>false</IsTruncated>
                </ListBucketResult>`;
            
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 200,
                text: mockXmlResponse
            });
            
            const files = await s3Client.listFiles();
            
            // Проверяем результат
            expect(files).toHaveLength(2);  // .keep файл должен быть отфильтрован
            expect(files[0]).toEqual({
                basename: 'file1.md',
                filename: 'obsidian-sync/file1.md',
                lastmod: '2025-04-30T12:00:00.000Z',
                size: 100,
                type: 'file'
            });
            expect(files[1]).toEqual({
                basename: 'file2.md',
                filename: 'obsidian-sync/file2.md',
                lastmod: '2025-04-30T12:10:00.000Z',
                size: 200,
                type: 'file'
            });
        });

        test('обрабатывает пустой результат', async () => {
            // Мокаем пустой XML ответ от S3
            const mockXmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                <ListBucketResult>
                    <Name>test-bucket</Name>
                    <Prefix>obsidian-sync/</Prefix>
                    <IsTruncated>false</IsTruncated>
                </ListBucketResult>`;
            
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 200,
                text: mockXmlResponse
            });
            
            const files = await s3Client.listFiles();
            
            // Проверяем результат
            expect(files).toHaveLength(0);
            expect(files).toEqual([]);
        });

        test('обрабатывает пагинацию', async () => {
            // Первая страница результатов
            const mockXmlPage1 = `<?xml version="1.0" encoding="UTF-8"?>
                <ListBucketResult>
                    <Name>test-bucket</Name>
                    <Prefix>obsidian-sync/</Prefix>
                    <Contents>
                        <Key>obsidian-sync/file1.md</Key>
                        <LastModified>2025-04-30T12:00:00.000Z</LastModified>
                        <Size>100</Size>
                    </Contents>
                    <IsTruncated>true</IsTruncated>
                    <NextContinuationToken>token123</NextContinuationToken>
                </ListBucketResult>`;
            
            // Вторая страница результатов
            const mockXmlPage2 = `<?xml version="1.0" encoding="UTF-8"?>
                <ListBucketResult>
                    <Name>test-bucket</Name>
                    <Prefix>obsidian-sync/</Prefix>
                    <Contents>
                        <Key>obsidian-sync/file2.md</Key>
                        <LastModified>2025-04-30T12:10:00.000Z</LastModified>
                        <Size>200</Size>
                    </Contents>
                    <IsTruncated>false</IsTruncated>
                </ListBucketResult>`;
            
            // Мокаем последовательные ответы
            (requestUrl as jest.Mock)
                .mockResolvedValueOnce({ status: 200, text: mockXmlPage1 })
                .mockResolvedValueOnce({ status: 200, text: mockXmlPage2 });
            
            const files = await s3Client.listFiles(true);
            
            // Проверяем результат
            expect(files).toHaveLength(2);
            expect(requestUrl).toHaveBeenCalledTimes(2);
            expect(files[0].basename).toBe('file1.md');
            expect(files[1].basename).toBe('file2.md');
        });

        test('обрабатывает ошибку при получении списка файлов', async () => {
            // Мокаем XML ответ с ошибкой
            const mockErrorXml = `<?xml version="1.0" encoding="UTF-8"?>
                <Error>
                    <Code>AccessDenied</Code>
                    <Message>Access Denied</Message>
                </Error>`;
            
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 403,
                text: mockErrorXml
            });
            
            await expect(s3Client.listFiles()).rejects.toThrow();
            expect(requestUrl).toHaveBeenCalledTimes(1);
        });
    });

    describe('uploadFile', () => {
        test('успешно загружает файл', async () => {
            // Мокаем успешную загрузку файла
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 200,
                text: ''
            });
            
            // Тестовое содержимое файла
            const testContent = new ArrayBuffer(100);
            
            await s3Client.uploadFile('local/path.md', testContent, 'encrypted-name.md');
            
            // Проверяем аргументы вызова requestUrl
            expect(requestUrl).toHaveBeenCalledTimes(1);
            const callArgs = (requestUrl as jest.Mock).mock.calls[0][0];
            expect(callArgs.url).toContain('test-bucket/obsidian-sync/encrypted-name.md');
            expect(callArgs.method).toBe('PUT');
            expect(callArgs.body).toBe(testContent);
        });
        
        test('обрабатывает ошибку при загрузке файла', async () => {
            // Мокаем ошибку при загрузке
            (requestUrl as jest.Mock).mockRejectedValueOnce({
                status: 500,
                message: 'Internal Server Error'
            });
            
            const testContent = new ArrayBuffer(100);
            
            await expect(s3Client.uploadFile('local/path.md', testContent, 'encrypted-name.md'))
                .rejects.toThrow();
                
            expect(requestUrl).toHaveBeenCalledTimes(1);
        });
        
        test('повторяет попытку загрузки при временной ошибке', async () => {
            // Мокаем первый вызов с временной ошибкой, второй успешный
            (requestUrl as jest.Mock)
                .mockRejectedValueOnce({ status: 500, message: 'Internal Server Error' })
                .mockResolvedValueOnce({ status: 200, text: '' });
            
            const testContent = new ArrayBuffer(100);
            
            await s3Client.uploadFile('local/path.md', testContent, 'encrypted-name.md');
            
            expect(requestUrl).toHaveBeenCalledTimes(2);
        });
    });

    describe('downloadFile', () => {
        test('успешно скачивает файл', async () => {
            // Мокаем успешное скачивание файла
            const mockBuffer = new ArrayBuffer(100);
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 200,
                arrayBuffer: mockBuffer
            });
            
            const result = await s3Client.downloadFile('encrypted-name.md');
            
            // Проверяем результат
            expect(result).toBe(mockBuffer);
            expect(requestUrl).toHaveBeenCalledTimes(1);
            const callArgs = (requestUrl as jest.Mock).mock.calls[0][0];
            expect(callArgs.url).toContain('test-bucket/obsidian-sync/encrypted-name.md');
            expect(callArgs.method).toBe('GET');
            expect(callArgs.contentType).toBe('arraybuffer');
        });
        
        test('обрабатывает ошибку 404', async () => {
            // Мокаем ошибку файл не найден
            (requestUrl as jest.Mock).mockRejectedValueOnce({
                status: 404,
                message: 'Not Found'
            });
            
            await expect(s3Client.downloadFile('encrypted-name.md'))
                .rejects.toThrow('Файл не найден');
                
            expect(requestUrl).toHaveBeenCalledTimes(1);
        });
    });

    describe('deleteFile', () => {
        test('успешно удаляет файл', async () => {
            // Мокаем успешное удаление файла
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 204,
                text: ''
            });
            
            await s3Client.deleteFile('encrypted-name.md');
            
            // Проверяем аргументы вызова requestUrl
            expect(requestUrl).toHaveBeenCalledTimes(1);
            const callArgs = (requestUrl as jest.Mock).mock.calls[0][0];
            expect(callArgs.url).toContain('test-bucket/obsidian-sync/encrypted-name.md');
            expect(callArgs.method).toBe('DELETE');
        });
        
        test('игнорирует ошибку 404 при удалении', async () => {
            // Мокаем ошибку файл не найден
            (requestUrl as jest.Mock).mockRejectedValueOnce({
                status: 404,
                message: 'Not Found'
            });
            
            // Не должен вызвать исключение
            await s3Client.deleteFile('encrypted-name.md');
            
            expect(requestUrl).toHaveBeenCalledTimes(1);
        });
        
        test('обрабатывает другие ошибки при удалении', async () => {
            // Мокаем другую ошибку
            (requestUrl as jest.Mock).mockRejectedValueOnce({
                status: 500,
                message: 'Internal Server Error'
            });
            
            await expect(s3Client.deleteFile('encrypted-name.md'))
                .rejects.toThrow();
                
            expect(requestUrl).toHaveBeenCalledTimes(1);
        });
    });

    describe('uploadFiles', () => {
        test('загружает несколько файлов в пакетном режиме', async () => {
            // Мокаем успешные ответы для всех загрузок
            (requestUrl as jest.Mock)
                .mockResolvedValueOnce({ status: 200, text: '' })
                .mockResolvedValueOnce({ status: 200, text: '' })
                .mockResolvedValueOnce({ status: 200, text: '' });
            
            const testFiles = [
                { localPath: 'local/path1.md', encryptedContent: new ArrayBuffer(100), encryptedName: 'encrypted1.md' },
                { localPath: 'local/path2.md', encryptedContent: new ArrayBuffer(100), encryptedName: 'encrypted2.md' },
                { localPath: 'local/path3.md', encryptedContent: new ArrayBuffer(100), encryptedName: 'encrypted3.md' }
            ];
            
            await s3Client.uploadFiles(testFiles);
            
            // Проверяем, что метод был вызван 3 раза (по одному для каждого файла)
            expect(requestUrl).toHaveBeenCalledTimes(3);
        });
        
        test('обрабатывает пустой массив файлов', async () => {
            await s3Client.uploadFiles([]);
            
            // Не должно быть вызовов requestUrl
            expect(requestUrl).not.toHaveBeenCalled();
        });
    });
});
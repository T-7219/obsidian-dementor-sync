import { Notice } from 'obsidian';
import AWS from 'aws-sdk';
import type DementorSyncPlugin from './main';

// Интерфейс для S3 объектов, совместимый с FileStat из webdav
export interface S3FileStat {
    basename: string;
    filename: string;
    lastmod: string;
    size: number;
    type: string;
}

export class S3Client {
    private s3Client: AWS.S3 | null = null;
    private plugin: DementorSyncPlugin;
    // Путь в бакете для хранения файлов
    private basePath: string = 'obsidian-sync/';
    private bucket: string = '';

    constructor(plugin: DementorSyncPlugin) {
        this.plugin = plugin;
        this.updateConfig();
    }

    public updateConfig() {
        const { s3Url, s3Bucket, s3AccessKey, s3SecretKey } = this.plugin.settings;
        
        if (s3Url && s3Bucket && s3AccessKey && s3SecretKey) {
            // Настройка S3 клиента
            this.bucket = s3Bucket;
            
            // Конфигурация для AWS SDK
            const endpoint = new AWS.Endpoint(s3Url);
            
            this.s3Client = new AWS.S3({
                endpoint: endpoint,
                accessKeyId: s3AccessKey,
                secretAccessKey: s3SecretKey,
                s3ForcePathStyle: true, // Необходимо для совместимости с S3-like серверами (например, Ceph)
                signatureVersion: 'v4',
                region: 'us-east-1' // Регион по умолчанию, может не использоваться для некоторых S3-совместимых серверов
            });
            
            console.log('S3 клиент настроен');
        } else {
            this.s3Client = null;
            console.log('S3 клиент не настроен из-за отсутствия настроек');
        }
    }

    private ensureClient() {
        if (!this.s3Client) {
            throw new Error('S3 клиент не настроен. Проверьте настройки.');
        }
    }

    public async testConnection(): Promise<boolean> {
        try {
            this.ensureClient();
            
            // Проверка существования бакета
            await this.s3Client!.headBucket({
                Bucket: this.bucket
            }).promise();
            
            // Проверка доступа к папке
            await this.s3Client!.listObjectsV2({
                Bucket: this.bucket,
                Prefix: this.basePath,
                MaxKeys: 1
            }).promise();
            
            return true;
        } catch (error) {
            console.error('S3 тест соединения не удался:', error);
            return false;
        }
    }

    // Функция для подробной диагностики проблем соединения
    public async diagnoseBadConnection(): Promise<string> {
        try {
            const { s3Url, s3Bucket, s3AccessKey, s3SecretKey } = this.plugin.settings;
            
            if (!s3Url || !s3Bucket || !s3AccessKey || !s3SecretKey) {
                return "Отсутствует конфигурация S3 (URL, Bucket, Access Key или Secret Key)";
            }
            
            // Тест соединения с S3-сервером
            try {
                const endpoint = new AWS.Endpoint(s3Url);
                
                const testClient = new AWS.S3({
                    endpoint: endpoint,
                    accessKeyId: s3AccessKey,
                    secretAccessKey: s3SecretKey,
                    s3ForcePathStyle: true,
                    signatureVersion: 'v4',
                    region: 'us-east-1'
                });
                
                // Проверка доступа к бакету
                await testClient.headBucket({
                    Bucket: s3Bucket
                }).promise();
                
                console.log('Соединение с S3 бакетом успешно');
            } catch (bucketError) {
                return `Не удалось подключиться к S3 бакету: ${bucketError.message || 'Неизвестная ошибка'}. Проверьте URL, Bucket, Access Key и Secret Key.`;
            }
            
            // Если мы здесь, соединение работает, проверяем доступ к базовому пути
            try {
                this.ensureClient();
                await this.s3Client!.listObjectsV2({
                    Bucket: this.bucket,
                    Prefix: this.basePath,
                    MaxKeys: 1
                }).promise();
            } catch (pathError) {
                return `Подключение к серверу успешно, но не удалось получить доступ к пути ${this.basePath}: ${pathError.message || 'Неизвестная ошибка'}`;
            }
            
            return "Все диагностические тесты пройдены успешно.";
        } catch (error) {
            return `Диагностическая ошибка: ${error.message || 'Неизвестная ошибка'}`;
        }
    }

    public async listFiles(): Promise<S3FileStat[]> {
        try {
            this.ensureClient();
            
            // Получение списка объектов из бакета
            const response = await this.s3Client!.listObjectsV2({
                Bucket: this.bucket,
                Prefix: this.basePath
            }).promise();
            
            if (!response.Contents) {
                return [];
            }
            
            // Преобразование объектов S3 в формат FileStat
            return response.Contents
                .filter(item => item.Key && item.Key !== this.basePath) // Исключение самой директории
                .map(item => {
                    const filename = item.Key!.replace(this.basePath, '');
                    return {
                        basename: filename,
                        filename: filename,
                        lastmod: item.LastModified?.toISOString() || new Date().toISOString(),
                        size: item.Size || 0,
                        type: 'file'
                    };
                });
        } catch (error) {
            console.error('Не удалось получить список файлов из S3:', error);
            throw new Error(`Не удалось получить список файлов: ${error.message}`);
        }
    }

    public async uploadFile(localPath: string, encryptedContent: ArrayBuffer, encryptedName: string): Promise<void> {
        try {
            this.ensureClient();
            
            // Загрузка файла
            const remotePath = this.basePath + encryptedName;
            
            await this.s3Client!.putObject({
                Bucket: this.bucket,
                Key: remotePath,
                Body: Buffer.from(encryptedContent),
                ContentType: 'application/octet-stream'
            }).promise();
            
            console.log(`Загружен файл: ${localPath} -> ${remotePath}`);
        } catch (error) {
            console.error(`Не удалось загрузить файл ${localPath}:`, error);
            throw new Error(`Не удалось загрузить файл ${localPath}: ${error.message}`);
        }
    }

    public async downloadFile(encryptedName: string): Promise<ArrayBuffer> {
        try {
            this.ensureClient();
            
            const remotePath = this.basePath + encryptedName;
            
            // Загрузка файла
            const response = await this.s3Client!.getObject({
                Bucket: this.bucket,
                Key: remotePath
            }).promise();
            
            if (!response.Body) {
                throw new Error(`Файл не найден на сервере: ${remotePath}`);
            }
            
            console.log(`Скачан файл: ${remotePath}`);
            
            // Преобразование Buffer в ArrayBuffer
            const buffer = response.Body as Buffer;
            return buffer.buffer.slice(
                buffer.byteOffset, 
                buffer.byteOffset + buffer.byteLength
            );
        } catch (error) {
            console.error(`Не удалось скачать файл ${encryptedName}:`, error);
            throw new Error(`Не удалось скачать файл: ${error.message}`);
        }
    }

    public async deleteFile(encryptedName: string): Promise<void> {
        try {
            this.ensureClient();
            
            const remotePath = this.basePath + encryptedName;
            
            // Проверяем существование объекта перед удалением
            try {
                await this.s3Client!.headObject({
                    Bucket: this.bucket,
                    Key: remotePath
                }).promise();
            } catch (error) {
                console.log(`Файл ${remotePath} не существует на сервере, пропускаем удаление`);
                return;
            }
            
            // Удаляем объект
            await this.s3Client!.deleteObject({
                Bucket: this.bucket,
                Key: remotePath
            }).promise();
            
            console.log(`Удален файл: ${remotePath}`);
        } catch (error) {
            console.error(`Не удалось удалить файл ${encryptedName}:`, error);
            throw new Error(`Не удалось удалить файл: ${error.message}`);
        }
    }
}
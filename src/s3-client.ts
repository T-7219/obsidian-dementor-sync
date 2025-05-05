import { Notice, requestUrl, RequestUrlResponse, RequestUrlParam } from 'obsidian';
import type DementorSyncPlugin from './main';
import * as crypto from 'crypto-js';

// Интерфейс для S3 объектов, совместимый с FileStat из webdav
export interface S3FileStat {
    basename: string;
    filename: string;
    lastmod: string;
    size: number;
    type: string;
}

interface S3Config {
    endpointUrl: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    region: string;
}

// Интерфейс для кеширования сигнатур
interface SignatureCache {
    date: string;
    dateKey: any;
    dateRegionKey: any;
    dateRegionServiceKey: any;
    signingKey: any;
    expiresAt: number;
}

export class S3Client {
    private config: S3Config | null = null;
    private plugin: DementorSyncPlugin;
    // Путь в бакете для хранения файлов
    private basePath: string = 'obsidian-sync/';
    // Максимальное количество повторных попыток
    private maxRetries: number = 3;
    // Кеш для хранения промежуточных ключей подписи
    private signatureCache: SignatureCache | null = null;
    // Срок жизни кеша подписи в миллисекундах (15 минут)
    private signatureCacheTTL: number = 15 * 60 * 1000;
    // Кеш для списка файлов
    private fileListCache: Map<string, S3FileStat[]> = new Map();
    // Время последнего обновления кеша файлов
    private fileListCacheTime: number = 0;
    // Срок жизни кеша списка файлов (1 минута)
    private fileListCacheTTL: number = 60 * 1000;

    constructor(plugin: DementorSyncPlugin) {
        this.plugin = plugin;
        this.updateConfig();
    }

    public updateConfig() {
        const { s3Url, s3Bucket, s3AccessKey, s3SecretKey, s3Region } = this.plugin.settings;
        
        if (s3Url && s3Bucket && s3AccessKey && s3SecretKey) {
            this.config = {
                endpointUrl: s3Url.endsWith('/') ? s3Url : s3Url + '/',
                bucket: s3Bucket,
                accessKey: s3AccessKey,
                secretKey: s3SecretKey,
                region: s3Region || 'us-east-1'  // Используем регион из настроек или по умолчанию
            };
            
            // Инвалидация кеша при изменении конфигурации
            this.signatureCache = null;
            this.fileListCache.clear();
            this.fileListCacheTime = 0;
            
            console.log('S3 клиент настроен');
        } else {
            this.config = null;
            console.log('S3 клиент не настроен из-за отсутствия настроек');
        }
    }

    private ensureConfig(): boolean {
        if (!this.config) {
            return false;
        }
        return true;
    }

    // Создаем стандартную подпись AWS Signature V4 с кешированием промежуточных ключей
    private getSignatureV4(method: string, contentType: string, resource: string, payload = '', additionalHeaders: Record<string, string> = {}): Record<string, string> {
        if (!this.ensureConfig()) {
            return {};
        }
        
        // Текущая дата в формате ISO8601
        const now = new Date();
        const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
        const dateStamp = amzDate.substring(0, 8);
        
        // Подготовка заголовков для подписи
        const host = this.getHost();
        let headers: Record<string, string> = {
            'Host': host,
            'X-Amz-Date': amzDate,
            'Content-Type': contentType || 'application/octet-stream',
            ...additionalHeaders
        };

        // Канонический запрос
        const canonicalUri = resource;
        const canonicalQueryString = '';
        
        // Сортировка заголовков для канонического запроса
        const headerKeys = Object.keys(headers).sort();
        let canonicalHeaders = '';
        let signedHeaders = '';
        
        headerKeys.forEach(key => {
            canonicalHeaders += `${key.toLowerCase()}:${headers[key]}\n`;
            signedHeaders += `${key.toLowerCase()};`;
        });
        // Удаляем последнюю точку с запятой
        signedHeaders = signedHeaders.slice(0, -1);
        
        // Хеш для содержимого
        const payloadHash = payload ? 
            crypto.SHA256(payload).toString() : 
            crypto.SHA256('').toString();
        
        const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
        
        // Создание строки для подписи
        const algorithm = 'AWS4-HMAC-SHA256';
        const region = this.config!.region;
        const service = 's3';
        const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
        const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto.SHA256(canonicalRequest).toString()}`;
        
        // Получаем ключ подписи, используя кеш при возможности
        const signingKey = this.getSigningKey(dateStamp);
        
        // Вычисление подписи
        const signature = crypto.HmacSHA256(stringToSign, signingKey).toString();
        
        // Создание заголовка авторизации
        headers['Authorization'] = `${algorithm} Credential=${this.config!.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
        
        return headers;
    }
    
    // Функция для получения ключа подписи с кешированием
    private getSigningKey(dateStamp: string): any {
        // Проверяем кеш
        const now = Date.now();
        if (this.signatureCache && 
            this.signatureCache.date === dateStamp && 
            this.signatureCache.expiresAt > now) {
            return this.signatureCache.signingKey;
        }
        
        // Создаем новый ключ подписи
        const kSecret = `AWS4${this.config!.secretKey}`;
        const kDate = crypto.HmacSHA256(dateStamp, kSecret);
        const kRegion = crypto.HmacSHA256(this.config!.region, kDate);
        const kService = crypto.HmacSHA256('s3', kRegion);
        const kSigning = crypto.HmacSHA256('aws4_request', kService);
        
        // Кешируем ключи
        this.signatureCache = {
            date: dateStamp,
            dateKey: kDate,
            dateRegionKey: kRegion,
            dateRegionServiceKey: kService,
            signingKey: kSigning,
            expiresAt: now + this.signatureCacheTTL
        };
        
        return kSigning;
    }
    
    // Получение hostname для заголовка Host
    private getHost(): string {
        try {
            if (!this.config || !this.config.endpointUrl) return '';
            
            const url = new URL(this.config.endpointUrl);
            return url.host;
        } catch (e) {
            console.error('Ошибка при получении хоста из URL:', e);
            return '';
        }
    }
    
    // Выполняем запрос с повторными попытками при ошибках
    private async executeWithRetry<T>(
        operation: () => Promise<T>, 
        retries: boolean = false,
        retryStatusCodes: number[] = [500, 502, 503, 504]
    ): Promise<T> {
        let attempt = 0;
        let lastError: Error | null = null;
        
        while (attempt < (retries ? this.maxRetries : 1)) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                // Проверяем, стоит ли повторять запрос
                const shouldRetry = retries && (
                    // Сетевые ошибки всегда повторяем
                    !error.status ||
                    // HTTP статусы, для которых есть смысл повтора
                    retryStatusCodes.includes(error.status)
                );
                
                if (!shouldRetry || attempt >= this.maxRetries - 1) {
                    throw error;
                }
                
                attempt++;
                
                // Экспоненциальная задержка перед повторной попыткой с небольшим случайным компонентом
                const delay = Math.pow(2, attempt) * 200 + Math.random() * 200;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError || new Error("Неизвестная ошибка");
    }

    public async testConnection(): Promise<boolean> {
        try {
            if (!this.ensureConfig()) {
                return false;
            }
            
            // Формируем URL для проверки прав доступа к бакету
            const headBucketUrl = `${this.config!.endpointUrl}${this.config!.bucket}`;
            
            // Используем HEAD-запрос для проверки доступа к бакету
            const headers = this.getSignatureV4('HEAD', 'application/xml', '/');
            
            await this.executeWithRetry(() => requestUrl({
                url: headBucketUrl,
                method: 'HEAD',
                headers: headers
            }));
            
            // Проверяем наличие базовой директории
            return await this.ensureBaseDirectoryExists();
        } catch (error) {
            console.error('S3 тест соединения не удался:', error);
            
            // Логируем подробную информацию об ошибке
            if (error.status) {
                console.error(`HTTP статус: ${error.status}, Ответ: ${error.message}`);
            }
            
            return false;
        }
    }

    // Проверяет и создаёт базовую директорию, если её нет
    private async ensureBaseDirectoryExists(): Promise<boolean> {
        try {
            if (!this.ensureConfig()) {
                return false;
            }
            
            // В S3 нет настоящих директорий, поэтому создаём пустой файл-маркер директории
            const directoryMarker = `${this.basePath}.keep`;
            
            try {
                // Пробуем проверить существование маркера
                await this.downloadFile('.keep', false);
                // Если маркер существует, директория готова
                return true;
            } catch (error) {
                // Маркер не найден, создаём его
                if (error.message && error.message.includes('404')) {
                    const emptyContent = new ArrayBuffer(0);
                    await this.uploadFile('.keep', emptyContent, '.keep');
                    return true;
                } else {
                    // Другая ошибка - пробрасываем
                    throw error;
                }
            }
        } catch (error) {
            console.error('Ошибка при проверке/создании базовой директории:', error);
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
            
            // Пробуем разные запросы для диагностики проблемы
            try {
                const headBucketUrl = `${this.config!.endpointUrl}${this.config!.bucket}`;
                const headers = this.getSignatureV4('HEAD', 'application/xml', '/');
                
                const response = await requestUrl({
                    url: headBucketUrl,
                    method: 'HEAD',
                    headers: headers,
                    throw: false
                });
                
                if (response.status === 403) {
                    return "Доступ запрещен (403). Проверьте права доступа для указанного ключа.";
                } else if (response.status === 404) {
                    return "Бакет не найден (404). Проверьте правильность имени бакета.";
                } else if (response.status !== 200) {
                    return `Код ошибки: ${response.status}. Описание: ${response.text || 'Нет текста ошибки'}`;
                }
            } catch (err) {
                return `Сетевая ошибка: ${err.message || 'Неизвестная ошибка'}. Проверьте правильность URL и доступность сервера.`;
            }
            
            return "Неизвестная ошибка подключения. Проверьте все параметры подключения.";
        } catch (error) {
            return `Диагностическая ошибка: ${error.message || 'Неизвестная ошибка'}`;
        }
    }

    public async listFiles(handlePagination: boolean = false): Promise<S3FileStat[]> {
        if (!this.ensureConfig()) {
            return [];
        }
        
        // Используем кеш, если он не устарел
        const now = Date.now();
        const cacheKey = `${this.config!.endpointUrl}${this.config!.bucket}${this.basePath}`;
        
        if (this.fileListCache.has(cacheKey) && 
            (now - this.fileListCacheTime) < this.fileListCacheTTL) {
            return this.fileListCache.get(cacheKey)!;
        }
        
        try {
            let fileStats: S3FileStat[] = [];
            let continuationToken: string | null = null;
            let isTruncated = false;
            
            do {
                // Формируем URL для запроса списка, добавляя токен продолжения если необходим
                let listUrl = `${this.config!.endpointUrl}${this.config!.bucket}?list-type=2&prefix=${this.basePath}`;
                if (continuationToken) {
                    listUrl += `&continuation-token=${encodeURIComponent(continuationToken)}`;
                }
                
                // Подписываем запрос
                const headers = this.getSignatureV4('GET', 'application/xml', '/?list-type=2');
                
                // Выполняем запрос с возможными повторами при ошибках
                const response = await this.executeWithRetry(() => requestUrl({
                    url: listUrl,
                    method: 'GET',
                    headers: headers
                }), true);
                
                // Парсинг XML ответа
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(response.text, "text/xml");
                
                // Проверяем наличие ошибок
                const errorNode = xmlDoc.getElementsByTagName('Error')[0];
                if (errorNode) {
                    const code = errorNode.getElementsByTagName('Code')[0]?.textContent;
                    const message = errorNode.getElementsByTagName('Message')[0]?.textContent;
                    throw new Error(`S3 ошибка: ${code} - ${message}`);
                }
                
                // Проверяем, есть ли еще данные
                const isTruncatedNodes = xmlDoc.getElementsByTagName('IsTruncated');
                if (isTruncatedNodes && isTruncatedNodes.length > 0) {
                    isTruncated = isTruncatedNodes[0].textContent === 'true';
                }
                
                // Получаем токен продолжения для следующего запроса
                const tokenNodes = xmlDoc.getElementsByTagName('NextContinuationToken');
                continuationToken = (tokenNodes && tokenNodes.length > 0) ? tokenNodes[0].textContent : null;
                
                // Парсим содержимое текущего ответа
                const contents = xmlDoc.getElementsByTagName('Contents');
                
                for (let i = 0; i < contents.length; i++) {
                    const key = contents[i].getElementsByTagName('Key')[0]?.textContent || '';
                    // Пропускаем директории, служебные файлы и файлы вне нашего пути
                    if (!key || key === this.basePath || key.endsWith('.keep')) continue;
                    
                    const basename = key.replace(this.basePath, '');
                    const lastmod = contents[i].getElementsByTagName('LastModified')[0]?.textContent || '';
                    const size = parseInt(contents[i].getElementsByTagName('Size')[0]?.textContent || '0');
                    
                    fileStats.push({
                        basename,
                        filename: key,
                        lastmod,
                        size,
                        type: 'file'
                    });
                }
                
                // Продолжаем запрашивать данные, если есть еще страницы, и включена пагинация
            } while (isTruncated && continuationToken && handlePagination);
            
            // Обновляем кеш
            this.fileListCache.set(cacheKey, fileStats);
            this.fileListCacheTime = now;
            
            return fileStats;
        } catch (error) {
            console.error('Ошибка при получении списка файлов из S3:', error);
            // В случае ошибки инвалидируем кеш
            this.fileListCache.delete(cacheKey);
            throw new Error(`Не удалось получить список файлов: ${error.message || 'Неизвестная ошибка'}`);
        }
    }

    public async uploadFile(
        localPath: string, 
        encryptedContent: ArrayBuffer, 
        encryptedName: string,
        contentType: string = 'application/octet-stream'
    ): Promise<void> {
        if (!this.ensureConfig()) {
            throw new Error("S3 клиент не настроен. Проверьте настройки.");
        }
        
        try {
            // Обрабатываем специальные символы в имени файла
            const encodedName = encodeURIComponent(encryptedName);
            const uploadUrl = `${this.config!.endpointUrl}${this.config!.bucket}/${this.basePath}${encodedName}`;
            
            // Вычисляем MD5 хеш контента для проверки целостности
            const contentMD5 = this.calculateMD5(encryptedContent);
            
            // Подписываем запрос
            const headers = this.getSignatureV4(
                'PUT', 
                contentType, 
                `/${this.basePath}${encodedName}`,
                '',
                { 'Content-MD5': contentMD5 }
            );
            
            await this.executeWithRetry(() => requestUrl({
                url: uploadUrl,
                method: 'PUT',
                headers: headers,
                body: encryptedContent
            }), true);
            
            // После успешной загрузки инвалидируем кеш списка файлов
            this.invalidateFileListCache();
            
            console.log(`Файл успешно загружен в S3: ${localPath} -> ${this.basePath}${encodedName}`);
        } catch (error) {
            console.error('Ошибка при загрузке файла в S3:', error);
            throw new Error(`Не удалось загрузить файл: ${error.message || 'Неизвестная ошибка'}`);
        }
    }

    public async downloadFile(encryptedName: string, retry: boolean = false): Promise<ArrayBuffer> {
        if (!this.ensureConfig()) {
            throw new Error("S3 клиент не настроен. Проверьте настройки.");
        }
        
        try {
            // Обрабатываем специальные символы в имени файла
            const encodedName = encodeURIComponent(encryptedName);
            const downloadUrl = `${this.config!.endpointUrl}${this.config!.bucket}/${this.basePath}${encodedName}`;
            
            // Подписываем запрос
            const headers = this.getSignatureV4('GET', '', `/${this.basePath}${encodedName}`);
            
            const response = await this.executeWithRetry(() => requestUrl({
                url: downloadUrl,
                method: 'GET',
                headers: headers,
                contentType: 'arraybuffer'
            }), retry);
            
            return response.arrayBuffer;
        } catch (error) {
            console.error(`Ошибка при загрузке файла из S3: ${encryptedName}`, error);
            
            // Улучшенная обработка ошибки 404 (файл не найден)
            if (error.status === 404) {
                throw new Error(`Файл не найден: ${encryptedName}`);
            }
            
            throw new Error(`Не удалось загрузить файл: ${error.message || 'Неизвестная ошибка'}`);
        }
    }

    public async deleteFile(encryptedName: string): Promise<void> {
        if (!this.ensureConfig()) {
            throw new Error("S3 клиент не настроен. Проверьте настройки.");
        }
        
        try {
            // Обрабатываем специальные символы в имени файла
            const encodedName = encodeURIComponent(encryptedName);
            const deleteUrl = `${this.config!.endpointUrl}${this.config!.bucket}/${this.basePath}${encodedName}`;
            
            // Подписываем запрос
            const headers = this.getSignatureV4('DELETE', '', `/${this.basePath}${encodedName}`);
            
            await this.executeWithRetry(() => requestUrl({
                url: deleteUrl,
                method: 'DELETE',
                headers: headers
            }), true);
            
            // После успешного удаления инвалидируем кеш списка файлов
            this.invalidateFileListCache();
            
            console.log(`Файл успешно удален из S3: ${this.basePath}${encryptedName}`);
        } catch (error) {
            // Для 404 просто логируем и не выбрасываем ошибку, т.к. файла и так нет
            if (error.status === 404) {
                console.log(`Файл ${encryptedName} не найден при удалении, игнорируем`);
                return;
            }
            
            console.error(`Ошибка при удалении файла из S3: ${encryptedName}`, error);
            throw new Error(`Не удалось удалить файл: ${error.message || 'Неизвестная ошибка'}`);
        }
    }
    
    // Вычисляем MD5 хеш для содержимого файла
    private calculateMD5(buffer: ArrayBuffer): string {
        // Преобразуем ArrayBuffer в строку Base64
        const base64Content = this.arrayBufferToBase64(buffer);
        return crypto.MD5(crypto.enc.Base64.parse(base64Content)).toString(crypto.enc.Base64);
    }
    
    // Вспомогательный метод для преобразования ArrayBuffer в строку Base64
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        try {
            // Получаем строку из ArrayBuffer
            let binary = '';
            const bytes = new Uint8Array(buffer);
            const len = bytes.byteLength;
            
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            
            // Пробуем использовать window.btoa для браузерного окружения
            if (typeof window !== 'undefined' && window.btoa) {
                return window.btoa(binary);
            }
            
            // В Node.js окружении (для тестов) используем Buffer
            if (typeof Buffer !== 'undefined') {
                return Buffer.from(binary).toString('base64');
            }
            
            // Если ничего не сработало, используем полифилл
            return this.btoaPolyfill(binary);
        } catch (e) {
            console.error('Ошибка при преобразовании ArrayBuffer в Base64:', e);
            throw new Error('Не удалось преобразовать данные в формат Base64');
        }
    }
    
    // Полифилл для btoa на случай, если ни window.btoa, ни Buffer недоступны
    private btoaPolyfill(data: string): string {
        const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let result = '';
        
        // Для каждых трех байтов входных данных
        for (let i = 0; i < data.length; i += 3) {
            // Получаем три 8-битных значения и соединяем их в 24 бита
            const byte1 = data.charCodeAt(i);
            const byte2 = i + 1 < data.length ? data.charCodeAt(i + 1) : 0;
            const byte3 = i + 2 < data.length ? data.charCodeAt(i + 2) : 0;
            
            // Разбиваем 24 бита на четыре 6-битных значения
            const octet1 = (byte1 >> 2) & 0x3F;
            const octet2 = ((byte1 & 0x03) << 4) | ((byte2 >> 4) & 0x0F);
            const octet3 = ((byte2 & 0x0F) << 2) | ((byte3 >> 6) & 0x03);
            const octet4 = byte3 & 0x3F;
            
            // Добавляем символы Base64 в результат
            result += BASE64_CHARS.charAt(octet1);
            result += BASE64_CHARS.charAt(octet2);
            result += i + 1 < data.length ? BASE64_CHARS.charAt(octet3) : '=';
            result += i + 2 < data.length ? BASE64_CHARS.charAt(octet4) : '=';
        }
        
        return result;
    }
    
    // Инвалидирует кеш списка файлов
    private invalidateFileListCache(): void {
        this.fileListCache.clear();
        this.fileListCacheTime = 0;
    }
    
    // Метод для пакетного загрузки файлов (для оптимизации)
    public async uploadFiles(files: { localPath: string, encryptedContent: ArrayBuffer, encryptedName: string }[]): Promise<void> {
        if (!this.ensureConfig()) {
            throw new Error("S3 клиент не настроен. Проверьте настройки.");
        }
        
        if (files.length === 0) {
            return;
        }
        
        // Для небольшого количества файлов оптимальнее загружать последовательно
        if (files.length <= 3) {
            for (const file of files) {
                await this.uploadFile(file.localPath, file.encryptedContent, file.encryptedName);
            }
            return;
        }
        
        // Для большего количества файлов - параллельно, но с ограничением
        const maxConcurrent = 5;
        const chunks = [];
        
        for (let i = 0; i < files.length; i += maxConcurrent) {
            chunks.push(files.slice(i, i + maxConcurrent));
        }
        
        for (const chunk of chunks) {
            await Promise.all(chunk.map(file => 
                this.uploadFile(file.localPath, file.encryptedContent, file.encryptedName)
            ));
        }
        
        // Инвалидируем кеш списка файлов после массовой загрузки
        this.invalidateFileListCache();
    }
}
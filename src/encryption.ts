import { hash, argon2id } from 'argon2-browser';
import { Buffer } from 'buffer';
import { Notice } from 'obsidian';
import type DementorSyncPlugin from './main';

export class EncryptionModule {
    private plugin: DementorSyncPlugin;
    private encryptionKey: CryptoKey | null = null;

    constructor(plugin: DementorSyncPlugin) {
        this.plugin = plugin;
    }

    /**
     * Generates a secure random initialization vector for encryption
     */
    private generateIV(): Uint8Array {
        return crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for GCM mode
    }

    /**
     * Derives an encryption key from the user's password using Argon2id
     */
    public async deriveEncryptionKey(password: string, salt?: Uint8Array): Promise<{ key: CryptoKey, salt: Uint8Array }> {
        // Generate salt if not provided
        if (!salt) {
            salt = crypto.getRandomValues(new Uint8Array(16));
        }

        try {
            // Use Argon2id for key derivation
            const result = await hash({
                pass: password,
                salt: salt,
                type: argon2id,
                time: 3, // Number of iterations
                mem: 65536, // Memory to use in KiB (64 MB)
                hashLen: 32, // Output hash length (32 bytes for AES-256)
            });

            // Import the derived key into the WebCrypto API
            // Fix: Convert Uint8Array to Buffer properly
            const material = new Uint8Array(result.hash);
            const key = await crypto.subtle.importKey(
                'raw',
                material,
                { name: 'AES-GCM' },
                false,
                ['encrypt', 'decrypt']
            );

            return { key, salt };
        } catch (error) {
            console.error('Error deriving encryption key:', error);
            throw new Error(`Failed to derive encryption key: ${error.message}`);
        }
    }

    /**
     * Initializes the encryption module with the user's password
     */
    public async initialize(): Promise<void> {
        const { encryptionPassword } = this.plugin.settings;
        
        if (!encryptionPassword) {
            this.encryptionKey = null;
            console.warn('No encryption password set, encryption module not initialized');
            return;
        }

        try {
            // Get salt from state or generate new one
            let salt: Uint8Array | undefined;
            const storedSalt = await this.plugin.stateManager.getSalt();
            
            if (storedSalt) {
                salt = new Uint8Array(storedSalt);
            }

            // Derive the encryption key
            const { key, salt: newSalt } = await this.deriveEncryptionKey(encryptionPassword, salt);
            this.encryptionKey = key;

            // Store the salt if it's new
            if (!storedSalt) {
                await this.plugin.stateManager.storeSalt(Array.from(newSalt));
            }

            console.log('Encryption module initialized successfully');
        } catch (error) {
            console.error('Failed to initialize encryption module:', error);
            new Notice(`Failed to initialize encryption: ${error.message}`);
            throw error;
        }
    }

    /**
     * Encrypts file data with AES-256-GCM
     */
    public async encryptFile(data: ArrayBuffer, path: string): Promise<{
        encryptedData: ArrayBuffer;
        encryptedName: string;
        iv: number[];
    }> {
        // Initialize if not already done
        if (!this.encryptionKey) {
            await this.initialize();
        }

        if (!this.encryptionKey) {
            throw new Error('Encryption key is not available. Check your encryption password.');
        }

        try {
            // Generate IV for this encryption operation
            const iv = this.generateIV();

            // Encrypt the file content
            // Diagnostic log for empty data issue
            if (data.byteLength === 0) {
                console.log('[EncryptionModule] Encrypting empty data. Input data length:', data.byteLength);
            }
            const encryptedContent = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv
                },
                this.encryptionKey,
                // Ensure data is a plain ArrayBuffer, Node.js Buffer's buffer property is an ArrayBuffer
                data instanceof ArrayBuffer ? data : Buffer.from(data).buffer
            );
            // Diagnostic log for empty data issue
            if (data.byteLength === 0) {
                console.log('[EncryptionModule] Encrypted empty data. Output encryptedContent length:', encryptedContent.byteLength);
            }

            // Hash the file path to create a secure filename that doesn't expose the original name
            const pathData = new TextEncoder().encode(path);
            const pathHash = await crypto.subtle.digest('SHA-256', pathData);
            const encryptedName = Array.from(new Uint8Array(pathHash))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            return {
                encryptedData: encryptedContent,
                encryptedName,
                iv: Array.from(iv)
            };
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error(`Failed to encrypt file ${path}: ${error.message}`);
        }
    }

    /**
     * Decrypts file data with AES-256-GCM
     */
    public async decryptFile(encryptedData: ArrayBuffer, iv: number[]): Promise<ArrayBuffer> {
        // Initialize if not already done
        if (!this.encryptionKey) {
            await this.initialize();
        }

        if (!this.encryptionKey) {
            throw new Error('Encryption key is not available. Check your encryption password.');
        }

        try {
            // Convert the IV array back to Uint8Array
            const ivArray = new Uint8Array(iv);

            // Decrypt the data
            const decryptedContent = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: ivArray
                },
                this.encryptionKey,
                encryptedData
            );

            // Workaround for polyfill potentially returning large buffer for empty plaintext decryption
            // AES-GCM tag is typically 12-16 bytes. If encryptedData was just a tag (or very small)
            // and decryption didn't throw, but result is unexpectedly large, assume original was empty.
            // The check `decryptedContent.byteLength > 16` is a heuristic for "unexpectedly large".
            // The value 8192 was observed in tests.
            if (encryptedData.byteLength <= 16 && decryptedContent.byteLength > 16) {
                // If it didn't throw, and input was tiny, output should be empty.
                return new ArrayBuffer(0);
            }

            return decryptedContent;
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error(`Failed to decrypt file: ${error.message}`);
        }
    }

    /**
     * Get encrypted name for a file path (without encrypting content)
     */
    public async getEncryptedName(path: string): Promise<string> {
        try {
            const pathData = new TextEncoder().encode(path);
            const pathHash = await crypto.subtle.digest('SHA-256', pathData);
            return Array.from(new Uint8Array(pathHash))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        } catch (error) {
            console.error('Error generating encrypted name:', error);
            throw new Error(`Failed to generate encrypted name: ${error.message}`);
        }
    }
}
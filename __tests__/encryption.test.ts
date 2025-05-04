import { EncryptionModule } from '../src/encryption';
import type DementorSyncPlugin from '../src/main';

describe('EncryptionModule', () => {
  // Mock plugin instance
  const mockPlugin = {
    stateManager: {
      getSalt: jest.fn().mockResolvedValue(null),
      storeSalt: jest.fn().mockResolvedValue(undefined)
    },
    settings: {
      encryptionPassword: 'test-password'
    }
  } as unknown as DementorSyncPlugin;
  
  let encryptionModule: EncryptionModule;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    encryptionModule = new EncryptionModule(mockPlugin);
  });
  
  test('should derive encryption key from password', async () => {
    // Generate a test salt
    const testSalt = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      testSalt[i] = i;
    }
    
    // Spy on the crypto API
    const cryptoImportKeySpy = jest.spyOn(crypto.subtle, 'importKey');
    
    // Call the method (with known mocked implementation)
    await encryptionModule.deriveEncryptionKey('test-password', testSalt);
    
    // Verify that crypto.subtle.importKey was called
    expect(cryptoImportKeySpy).toHaveBeenCalled();
  });
  
  test('should encrypt and decrypt file correctly', async () => {
    // Initialize the encryption module (this would normally derive the key)
    await encryptionModule.initialize();
    
    // Create test data - a simple string
    const testData = new TextEncoder().encode('Test file content').buffer;
    const filePath = 'test-file.md';
    
    // Encrypt the data
    const { encryptedData, encryptedName, iv } = await encryptionModule.encryptFile(testData, filePath);
    
    // Verify encrypted data properties
    expect(encryptedData).toBeTruthy();
    expect(encryptedData.byteLength).toBeGreaterThan(0);
    expect(encryptedName).toBeTruthy();
    expect(iv.length).toBe(12); // AES-GCM IV size
    
    // Decrypt the data
    const decryptedData = await encryptionModule.decryptFile(encryptedData, iv);
    
    // Verify the decrypted data matches the original
    const decryptedText = new TextDecoder().decode(decryptedData);
    expect(decryptedText).toBe('Test file content');
  });
  
  test('should generate consistent encrypted names for the same path', async () => {
    const filePath = 'test/path/document.md';
    
    // Generate encrypted name twice for the same path
    const name1 = await encryptionModule.getEncryptedName(filePath);
    const name2 = await encryptionModule.getEncryptedName(filePath);
    
    // Verify they are consistent
    expect(name1).toBe(name2);
    
    // Generate encrypted name for a different path
    const differentName = await encryptionModule.getEncryptedName('different/path.md');
    
    // Verify it's different
    expect(name1).not.toBe(differentName);
  });
});
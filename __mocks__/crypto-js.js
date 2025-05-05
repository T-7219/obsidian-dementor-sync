// Мок для crypto-js библиотеки
const mockCrypto = {
  SHA256: (data) => ({
    toString: () => 'mocked-sha256-hash'
  }),
  HmacSHA256: (data, key) => ({
    toString: () => 'mocked-hmac-sha256-hash'
  }),
  MD5: (data) => ({
    toString: (format) => 'mocked-md5-hash'
  }),
  enc: {
    Base64: {
      parse: (data) => ({ /* mock parsed data */ }),
      stringify: (data) => 'mocked-base64-string'
    }
  }
};

module.exports = mockCrypto;
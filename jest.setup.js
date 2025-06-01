// Polyfill for TextEncoder and TextDecoder
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill for fetch
require('whatwg-fetch');

// Polyfill for crypto.subtle if not fully provided by jsdom
// and crypto.getRandomValues
const crypto = require('crypto');

if (!global.crypto) {
  global.crypto = {};
}

if (!global.crypto.subtle) {
  global.crypto.subtle = crypto.webcrypto.subtle;
}

if (!global.crypto.getRandomValues) {
  global.crypto.getRandomValues = function(arr) {
    return crypto.randomFillSync(arr);
  };
}

// Mock for DOMParser if jest-environment-jsdom doesn't fully cover it for specific cases
// It seems DOMParser is mostly fine with jest-environment-jsdom, so keeping this commented for now.
// if (typeof DOMParser === 'undefined') {
//   global.DOMParser = require('xmldom').DOMParser;
// }

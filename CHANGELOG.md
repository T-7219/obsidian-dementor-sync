# Changelog

All notable changes to Dementor Sync will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### 🛠️ Planned
- Version history and rollback capabilities
- Enhanced conflict resolution with visual diffs
- Selective sync for specific folders
- Performance optimizations for large vaults

## [1.0.0] - 2025-05-04

### ✨ Added
- Complete end-to-end encryption system using AES-256-GCM
- Robust password-based key derivation with Argon2id
- WebDAV synchronization with comprehensive server compatibility
- Bidirectional sync with intelligent change detection
- Automatic synchronization with configurable intervals
- Manual sync trigger via ribbon icon
- Real-time file change monitoring
- Smart conflict detection and resolution
- Status bar indicators showing sync status
- Detailed activity logging
- File and folder exclusion patterns
- Settings panel with comprehensive configuration options
- Mobile device compatibility
- Encrypted filenames for enhanced privacy
- Setup wizard for first-time configuration

### 🔒 Security
- Implementation of zero-knowledge architecture
- Secure local storage of salt values
- Memory-safe handling of encryption keys
- Strict validation of server certificates
- Protection against timing attacks

### 📚 Documentation
- Comprehensive README with feature descriptions
- Security best practices for users
- Detailed installation instructions
- FAQ section addressing common questions
- Contributing guidelines for developers

### 🧪 Testing
- Unit tests for encryption functionality
- Integration tests for WebDAV communication
- End-to-end sync testing across platforms
- Key derivation verification tests
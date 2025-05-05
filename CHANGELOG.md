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

## [2.0.8] - 2025-05-05

### 🐛 Fixed
- Исправлены проблемы с функциональностью S3-клиента
- Улучшена обработка ошибок при работе с S3-совместимыми сервисами
- Оптимизирована работа с различными реализациями S3 API

### ✅ Улучшения
- Расширено покрытие кода тестами для S3-клиента
- Добавлены автотесты для проверки сетевого взаимодействия с S3
- Улучшены диагностические сообщения при проблемах с подключением

### 🔄 Изменения
- Усовершенствована кэширующая подсистема S3-клиента
- Оптимизированы сетевые запросы для уменьшения нагрузки

## [2.0.0] - 2025-05-04

### ✨ Added
- S3 storage support for Amazon S3 and compatible services (MinIO, Ceph)
- Support for selecting between WebDAV or S3 synchronization methods
- User interface for configuring S3 storage (URL, bucket, access keys)
- Automatic detection of storage provider type in settings UI
- Enhanced diagnostic tools for S3 connection troubleshooting
- Improved authentication handling for various S3-compatible services
- Compatible with Ceph Object Storage and other S3 API implementations

### 🔄 Changed
- Completely refactored storage client architecture to support multiple providers
- Updated synchronization orchestrator to work with different storage backends
- Enhanced settings UI with storage method selection dropdown
- Improved error handling for different storage provider types

### 🔒 Security
- Extended secure credential handling to support S3 authentication
- Added secure storage for S3 credentials

## [1.0.1] - 2025-05-04

### 🐛 Fixed
- Fixed connection issues with Yandex.WebDAV servers
- Added special path handling for Yandex.WebDAV using the `disk:/` prefix
- Enhanced connection diagnostics with more detailed error reporting
- Improved error notification display time for better readability
- Added direct HTTP connection testing for authentication problem detection

### ✨ Improved
- Automatic detection of Yandex.WebDAV services from the URL
- Optimized path structure for Yandex.WebDAV using `disk:/ObsidianSync/`
- Increased timeout thresholds for more stable operation on slow connections
- Better error handling for root directory creation operations
- Added extended diagnostics for WebDAV connection troubleshooting
- Updated documentation with Yandex.WebDAV specific configuration details

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
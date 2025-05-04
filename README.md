# Dementor Sync for Obsidian 🔐

<div align="center">

![Dementor Sync Banner](https://raw.githubusercontent.com/T-7219/obsidian-dementor-sync/main/assets/banner.png)

[![GitHub release](https://img.shields.io/badge/version-v2.0.0-4684b1?style=flat-square)](https://github.com/T-7219/obsidian-dementor-sync/releases/latest)
[![GitHub license](https://img.shields.io/github/license/T-7219/obsidian-dementor-sync?style=flat-square&color=4684b1)](LICENSE)
[![Downloads](https://img.shields.io/github/downloads/T-7219/obsidian-dementor-sync/total?color=4684b1&style=flat-square)](https://github.com/T-7219/obsidian-dementor-sync/releases)
[![CodeFactor](https://img.shields.io/codefactor/grade/github/T-7219/obsidian-dementor-sync?style=flat-square)](https://www.codefactor.io/repository/github/T-7219/obsidian-dementor-sync)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.7-blue?style=flat-square&color=3178c6)](https://www.typescriptlang.org/)

</div>

Secure your knowledge with the most private and secure synchronization solution for Obsidian. **Dementor Sync** provides end-to-end encrypted synchronization via WebDAV or S3 storage to keep your notes private and securely accessible across all your devices.

> [!TIP]
> Unlike the official Obsidian Sync, Dementor Sync gives you **full control** over your data with true end-to-end encryption and your choice of storage provider!

## ✨ Key Features

<table>
  <tr>
    <td width="50%">
      <h3>🔒 Military-Grade Encryption</h3>
      <p>AES-256-GCM encryption with Argon2id key derivation ensures your data is secure even if your storage server is compromised.</p>
    </td>
    <td width="50%">
      <h3>🔄 Bidirectional Sync</h3>
      <p>Changes are seamlessly synchronized across all your devices, with intelligent conflict resolution to prevent data loss.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🌐 Multiple Storage Options</h3>
      <p>Choose between WebDAV and S3-compatible storage, including Nextcloud, ownCloud, Amazon S3, MinIO, and Ceph.</p>
    </td>
    <td width="50%">
      <h3>⚡ Real-time Change Detection</h3>
      <p>Instantly detects file changes and optimizes synchronization to minimize data transfer.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>📱 Desktop & Mobile Support</h3>
      <p>Works seamlessly on all platforms Obsidian supports, including iOS and Android.</p>
    </td>
    <td width="50%">
      <h3>🛠️ Customizable Settings</h3>
      <p>Fine-tune sync behavior with exclude patterns, automatic sync intervals, and more.</p>
    </td>
  </tr>
</table>

## 📖 Table of Contents
- [Installation](#-installation)
- [Usage](#-usage)
- [Configuration](#-configuration)
- [Security Features](#-security-features)
- [Supported Storage Services](#-supported-storage-services)
- [FAQ](#-frequently-asked-questions)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Changelog](#-changelog)

## 🔧 Installation

### From Community Plugins

1. Open Obsidian and navigate to **Settings** → **Community plugins** → **Browse**
2. Search for "Dementor Sync" and click **Install**
3. Enable the plugin under **Installed plugins**

### Manual Installation

<details>
<summary>Click to expand manual installation steps</summary>

1. Download the `main.js`, `styles.css`, and `manifest.json` files from the [latest release](https://github.com/T-7219/obsidian-dementor-sync/releases/latest)
2. Create a folder called `dementor-sync` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into the `dementor-sync` folder
4. Restart Obsidian and enable the plugin in **Settings** → **Community plugins**

</details>

## 🚀 Usage

1. After installation, a lock icon 🔒 will appear in your left sidebar
2. Click the icon to open the Dementor Sync panel
3. Configure your connection by clicking the ⚙️ icon or going to **Settings** → **Dementor Sync**:
   - Choose your preferred storage method (WebDAV or S3)
   - Enter your connection details based on the selected storage method
   - Create a strong encryption password (critical for data security!)
   - Configure sync settings and exclusions
   - Test your connection to ensure everything is working correctly

<div align="center">
  <img src="https://raw.githubusercontent.com/T-7219/obsidian-dementor-sync/main/assets/screenshots/setup.png" alt="Setup Screen" width="70%"/>
</div>

> [!IMPORTANT]
> Your encryption password is used to protect your data and is **never** transmitted to the server. If you lose this password, your synchronized data cannot be recovered! Please store it securely.

## ⚙️ Configuration

| Setting | Description |
|---------|-------------|
| **Sync Method** | Choose between WebDAV or S3 storage |
| **WebDAV URL** | The URL of your WebDAV server (when WebDAV is selected) |
| **WebDAV Username** | Your WebDAV server username |
| **WebDAV Password** | Your WebDAV server password |
| **S3 Endpoint URL** | URL of your S3-compatible storage (when S3 is selected) |
| **S3 Bucket Name** | Name of the S3 bucket to use |
| **S3 Access Key** | Access key for S3 authentication |
| **S3 Secret Key** | Secret key for S3 authentication |
| **Encryption Password** | Password for encrypting/decrypting your data |
| **Auto-sync** | Toggle automatic synchronization |
| **Sync Interval** | How often automatic sync occurs (in minutes) |
| **Excluded Patterns** | Glob patterns for files to exclude from sync |
| **Sync on Startup** | Whether to sync when Obsidian launches |
| **Sync Attachments** | Whether to sync attachment files |

### Connection Diagnostics

If you're having trouble connecting to your storage service, the plugin offers enhanced diagnostics:

1. Go to **Settings** → **Dementor Sync**
2. Select your storage method (WebDAV or S3)
3. Fill in your connection details
4. Click the **Test Connection** button to run a comprehensive diagnostics check
5. The plugin will display detailed information about any connection issues
6. Use the diagnostic information to troubleshoot and resolve connection problems

## 🛡️ Security Features

- **End-to-End Encryption**: Your data is encrypted locally before transmission
- **Zero-Knowledge Design**: Your encryption keys never leave your device
- **Modern Cryptography**: AES-256-GCM for encryption, Argon2id for key derivation
- **Encrypted Filenames**: Even filenames are encrypted to protect your privacy
- **No Telemetry**: Your data and usage patterns are never tracked or reported
- **Secure Credential Management**: All provider credentials are securely stored

## 🔄 Supported Storage Services

Dementor Sync works with a variety of storage services:

### WebDAV Services

#### Yandex.Disk
- Automatically detects Yandex.WebDAV servers
- Uses the appropriate path structure (`disk:/ObsidianSync/`)
- Implements extended error handling for Yandex-specific responses
- **URL**: `https://webdav.yandex.ru`

#### Nextcloud/ownCloud
- Standard WebDAV compatibility
- **URL format**: `https://your-nextcloud-instance.com/remote.php/webdav/`

#### Box
- Standard WebDAV compatibility
- **URL format**: `https://dav.box.com/dav`

#### Generic WebDAV Servers
- Compatible with any server following the WebDAV standard
- Adjustable timeouts for slower connections
- Detailed connection diagnostics

### S3 Compatible Services (New in v2.0.0)

#### Amazon S3
- Native S3 protocol support
- **URL format**: `https://s3.region.amazonaws.com`

#### MinIO
- Compatible with S3 API
- Self-hosted or cloud-based options
- **URL format**: `https://your-minio-server.com`

#### Ceph Object Storage
- S3-compatible API for object storage
- Works with both public and private Ceph deployments
- **URL example**: `https://s3.ru1.storage.beget.cloud`

#### Other S3-Compatible Services
- Compatible with any service implementing the S3 API
- Includes Wasabi, DigitalOcean Spaces, Backblaze B2, etc.

## ❓ Frequently Asked Questions

<details>
<summary><b>Can I use multiple devices with the same vault?</b></summary>
Yes! Just install Dementor Sync on each device and use the exact same encryption password.
</details>

<details>
<summary><b>What happens if I change my encryption password?</b></summary>
Changing your encryption password requires re-encrypting all your data. Use the "Change Encryption Password" option in settings, which will handle this process automatically.
</details>

<details>
<summary><b>Is Dementor Sync compatible with the official Obsidian Sync?</b></summary>
No, you should use either Dementor Sync or Obsidian Sync, but not both simultaneously for the same vault.
</details>

<details>
<summary><b>Which storage provider should I choose?</b></summary>
It depends on your needs. WebDAV is widely supported and often simpler to configure, while S3 offers better scalability and may be more cost-effective for larger vaults. We recommend Nextcloud for WebDAV and MinIO or Ceph for S3.
</details>

<details>
<summary><b>Can I switch between WebDAV and S3 storage?</b></summary>
Yes, but it requires re-syncing your vault. Export your vault first, change providers, then sync again.
</details>

<details>
<summary><b>I'm having connection issues with S3, what should I do?</b></summary>
The plugin features enhanced diagnostics for S3 connections. Test your connection in settings and check the detailed error messages. Make sure you're using the correct endpoint URL, bucket name, and valid access/secret keys.
</details>

<details>
<summary><b>Do I need to use AWS S3 specifically?</b></summary>
No, any S3-compatible storage provider will work, including self-hosted options like MinIO or Ceph.
</details>

## 🗺️ Roadmap

- [ ] Version history and rollback functionality
- [ ] Selective sync for specific folders
- [ ] Improved conflict resolution with visual diffs
- [ ] Additional encryption options
- [ ] Sync statistics and monitoring dashboard
- [ ] Self-contained versioning system
- [ ] Support for additional cloud storage providers

## 🤝 Contributing

Contributions are welcome and appreciated! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the [Creative Commons Attribution 4.0 International License (CC BY 4.0)](LICENSE).

## 📋 Changelog

For a detailed list of changes in each version, please see the [CHANGELOG.md](CHANGELOG.md) file.

---

<div align="center">
  <p>
    <a href="https://github.com/T-7219/obsidian-dementor-sync/issues">Report Bug</a> •
    <a href="https://github.com/T-7219/obsidian-dementor-sync/issues">Request Feature</a> •
    <a href="https://ko-fi.com/t7219">Buy Me a Coffee</a>
  </p>
  <p>Made with ❤️ for the Obsidian community</p>
</div>


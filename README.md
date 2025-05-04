# Dementor Sync for Obsidian

[![GitHub license](https://img.shields.io/badge/license-CC%20BY%204.0-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/T-7219/obsidian-dementor-sync.svg)](https://github.com/T-7219/obsidian-dementor-sync/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/T-7219/obsidian-dementor-sync/total.svg)](https://github.com/T-7219/obsidian-dementor-sync/releases)

Dementor Sync is an Obsidian plugin that provides secure vault synchronization through WebDAV with end-to-end encryption.

## Features

- **Secure End-to-End Encryption** - All your data is encrypted locally before being sent to the server, using AES-256-GCM encryption.
- **WebDAV Synchronization** - Seamlessly sync your vault with any WebDAV-compatible server.
- **Bi-directional Sync** - Changes made locally or remotely are automatically detected and synchronized.
- **Real-time Change Tracking** - Efficiently monitors and tracks file changes to minimize data transfer.
- **User-Friendly Interface** - Simple setup and operation with clear status indications.

## Installation

1. In Obsidian, navigate to **Settings** → **Community plugins** → **Browse**
2. Search for "Dementor Sync" and install it
3. Enable the plugin in the **Community plugins** section

### Manual Installation

1. Download the `main.js`, `styles.css`, and `manifest.json` files from the latest release
2. Create a folder called `dementor-sync` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into the `dementor-sync` folder
4. Enable the plugin in the **Community plugins** section of Obsidian settings

## Usage

1. After installation, click on the Dementor Sync icon in the left ribbon
2. Go to plugin settings to configure your WebDAV server connection:
   - Enter your WebDAV server URL
   - Provide your WebDAV username and password
   - Set an encryption password (critical for accessing your data!)
   - Configure automatic sync interval if desired
3. Use the ribbon button to manually trigger synchronization at any time

### Important Security Note

Your encryption password is used to protect your data and is never transmitted to the server. If you lose this password, **your synchronized data cannot be recovered**. Please store this password securely!

## Configuration

In the settings tab, you can configure:

- **WebDAV Server URL** - The address of your WebDAV server
- **WebDAV Credentials** - Your username and password for the server
- **Encryption Password** - The password used to encrypt your data
- **Automatic Sync Interval** - How frequently the plugin should sync automatically
- **Excluded Paths** - Specific files or folders to exclude from synchronization

## Privacy & Security

Dementor Sync is designed with security as a top priority:

- All data is encrypted locally before transmission using AES-256-GCM
- Your encryption key is derived from your password using Argon2id KDF
- No data is ever transmitted in plain text
- Your encryption password never leaves your device

## Development

This plugin is built using TypeScript and the Obsidian Plugin API.

### Building

```bash
# Clone this repository
git clone https://github.com/T-7219/obsidian-dementor-sync.git

# Navigate into the project directory
cd obsidian-dementor-sync

# Install dependencies
npm install

# Build the plugin
npm run build
```

### Contribution

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [Creative Commons Attribution 4.0 International License (CC BY 4.0)](LICENSE).

## Support

If you encounter any issues or have questions, please file them in the [GitHub issue tracker](https://github.com/T-7219/obsidian-dementor-sync/issues).

---

Made with ❤️ for the Obsidian community


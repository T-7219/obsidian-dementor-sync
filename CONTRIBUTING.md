# Contributing to Dementor Sync

Thank you for your interest in contributing to Dementor Sync! We welcome contributions from everyone, regardless of experience level.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally: `git clone https://github.com/your-username/obsidian-dementor-sync.git`
3. Install dependencies: `npm install`
4. Create a branch for your changes: `git checkout -b feature/your-feature-name`

## Development Workflow

1. Make your changes in your feature branch
2. Run `npm run build` to build the plugin
3. Test your changes in Obsidian by setting up a development vault:
   - Create a test vault in Obsidian
   - Enable developer mode in Obsidian settings
   - Create a folder in `.obsidian/plugins/dementor-sync/` 
   - Copy the built `main.js`, `styles.css`, and `manifest.json` to that folder
4. Reload the plugin in Obsidian to test your changes

## Code Style

- Use TypeScript for all code
- Follow the ESLint configurations provided in the project
- Write clear, concise, and well-commented code
- Use meaningful variable and function names

## Pull Requests

1. Ensure your code follows the style guidelines
2. Update the documentation if necessary
3. Add tests for new functionality
4. Submit a pull request from your feature branch to the main repository's `main` branch
5. Include a descriptive title and detailed description

## Bug Reports

When reporting a bug, please include:

1. Steps to reproduce the issue
2. Expected behavior
3. Actual behavior
4. Screenshots if applicable
5. Your Obsidian version
6. Your plugin version
7. Your operating system

## Feature Requests

Feature requests are welcome! Please provide:

1. A clear description of the feature
2. Why you think it would be valuable
3. Any ideas about implementation

## Security Issues

If you discover a security vulnerability, please email the project maintainers directly rather than opening a public issue.

## License

By contributing to this project, you agree that your contributions will be licensed under the project's [CC BY 4.0 license](LICENSE).
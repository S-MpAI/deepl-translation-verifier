# DeepL Translation Verifier

A GitHub Action that verifies translations in specified files against the DeepL API. This tool checks the accuracy of translations added in a commit by comparing them with DeepL's translations, ensuring consistency and quality.

## Features

- Triggers on push events for files matching specified patterns (e.g., `*Translations.txt`, `*.i18n`).
- Extracts translation pairs from diffs in the format `(source)=(target)`.
- Validates translations using the DeepL API.
- Supports customizable file patterns, source, and target languages.
- Provides detailed error messages for mismatched translations.

## Prerequisites

- A DeepL API key (free or pro account). Sign up at https://www.deepl.com/pro-api.
- A GitHub repository with translation files.

## Installation

1. **Clone or Fork the Repository**
   Clone this repository or fork it to your GitHub account:
   git clone https://github.com/S-MpAI/deepl-translation-verifier.git

2. **Set Up Secrets**
   - Go to your repository on GitHub: `Settings > Secrets and variables > Actions > Secrets`.
   - Add a new secret:
     - Name: `DEEPL_API_KEY`
     - Value: Your DeepL API key

## Usage

### As a Workflow

Add the following workflow file to your repository at `.github/workflows/translation-check.yml`:

name: Check Translations

on:
  push:
    paths:
      - '*Translations.txt'
      - '*.i18n'

jobs:
  check-translations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check translations with DeepL
        uses: S-MpAI/deepl-translation-verifier@v0.0.4
        env:
          DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
        with:
          translation-file-patterns: 'Translations.txt,.i18n'
          source-lang: 'EN'
          target-lang: 'RU'

Replace `v0.0.4` with the latest release tag if needed.

### Translation File Format

The action expects translation pairs in the following format within your files:

(... Lige wasn't there. She's been recovered this time.)=(... Лидж там не было. На этот раз ее нашли.)

or with keywords:

...I am a tier-2 field agent from the <keyword=8>Antarctic Union</keyword>.=(...Я являюсь полевым агентом TIER-2 от <keyword=8>Антарктического Союза</keyword>.)

### Configuration

You can customize the action via inputs in the workflow:

- `translation-file-patterns`: Comma-separated list of file patterns (default: `Translations.txt,.i18n`).
- `source-lang`: Source language code (default: `EN`).
- `target-lang`: Target language code (default: `RU`).

Example with custom settings:

- name: Check translations with DeepL
  uses: S-MpAI/deepl-translation-verifier@v0.0.4
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  with:
    translation-file-patterns: 'Translations.txt,locale.json'
    source-lang: 'FR'
    target-lang: 'ES'

## Development

### Prerequisites

- Node.js 16.x
- npm

### Setup

1. Install dependencies:
   npm install @actions/core @actions/github axios

2. Run locally (for testing, requires `GITHUB_TOKEN` and `DEEPL_API_KEY` in your environment):
   node check_translations.js

### File Structure

deepl-translation-verifier/
├── .github/
│   └── workflows/
│       └── translation-check.yml
├── action.yml
├── check_translations.js
├── package.json
└── README.md

## Troubleshooting

- **"Cannot find module" error**: Ensure `check_translations.js` is in the correct location (either root or `.github/scripts/`, depending on your workflow).
- **"DeepL API key not found"**: Verify that `DEEPL_API_KEY` is set in your repository secrets.
- **No translations checked**: Confirm that your push includes changes to files matching the specified patterns.

## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/new-feature`).
3. Commit your changes (`git commit -m 'Add new feature'`).
4. Push to the branch (`git push origin feature/new-feature`).
5. Open a pull request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with DeepL API (https://www.deepl.com/).
- Powered by GitHub Actions.

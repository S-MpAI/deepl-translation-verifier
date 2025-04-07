const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');
const fs = require('fs');

// Получаем шаблоны файлов из переменных окружения или используем значения по умолчанию
const FILE_PATTERNS = (process.env.TRANSLATION_FILE_PATTERNS || 'Translations.txt,.i18n')
    .split(',')
    .map(pattern => pattern.trim());

async function getDiffForTranslationFiles() {
    const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
    const { context } = github;
    
    const commit = await octokit.rest.repos.getCommit({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: context.sha
    });
    
    // Фильтруем файлы по заданным шаблонам из process.env
    const translationFiles = commit.data.files.filter(file => 
        FILE_PATTERNS.some(pattern => 
            file.filename.endsWith(pattern) || 
            file.filename.includes(pattern)
        )
    );
    
    return translationFiles.map(file => ({
        filename: file.filename,
        diff: file.patch || ''
    }));
}

function extractTranslations(diff) {
    const translations = [];
    const pattern = /\((.*?)\)=\((.*?)\)/g;
    
    diff.split('\n').forEach(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) {
            let match;
            while ((match = pattern.exec(line.slice(1))) !== null) {
                translations.push({
                    source: match[1].trim(),
                    target: match[2].trim()
                });
            }
        }
    });
    
    return translations;
}

async function checkTranslationWithDeepL(source, target) {
    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) {
        throw new Error('DeepL API key not found');
    }

    try {
        const response = await axios.post(
            'https://api-free.deepl.com/v2/translate',
            {
                auth_key: apiKey,
                text: source,
                source_lang: 'EN',
                target_lang: 'RU'
            }
        );

        const deeplTranslation = response.data.translations[0].text;
        const deeplClean = deeplTranslation.replace(/\.$/, '').toLowerCase();
        const targetClean = target.replace(/\.$/, '').toLowerCase();

        return {
            isCorrect: deeplClean === targetClean,
            deeplTranslation
        };
    } catch (error) {
        throw new Error(`DeepL API error: ${error.message}`);
    }
}

async function main() {
    try {
        const translationFiles = await getDiffForTranslationFiles();

        if (translationFiles.length === 0) {
            console.log('No translation files found in the diff');
            return;
        }

        let hasErrors = false;

        for (const { filename, diff } of translationFiles) {
            console.log(`Checking file: ${filename}`);
            const translations = extractTranslations(diff);

            if (translations.length === 0) {
                console.log(`No new translations found in ${filename}`);
                continue;
            }

            const errors = [];
            for (const { source, target } of translations) {
                try {
                    const { isCorrect, deeplTranslation } = await checkTranslationWithDeepL(source, target);
                    if (!isCorrect) {
                        errors.push(
                            `Translation mismatch in ${filename}:\n` +
                            `Source: ${source}\n` +
                            `Provided: ${target}\n` +
                            `DeepL: ${deeplTranslation}`
                        );
                    }
                } catch (error) {
                    errors.push(`Error checking translation '${source}' in ${filename}: ${error.message}`);
                }
            }

            if (errors.length > 0) {
                hasErrors = true;
                console.log('Errors found:\n' + errors.join('\n\n'));
            } else {
                console.log(`All translations in ${filename} verified successfully!`);
            }
        }

        if (hasErrors) {
            core.setFailed('Translation check failed');
        } else {
            console.log('All translation files verified successfully!');
        }
    } catch (error) {
        core.setFailed(`Action failed: ${error.message}`);
    }
}

main();

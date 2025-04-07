const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');
const fs = require('fs');

// Получаем параметры из inputs или process.env
const FILE_PATTERNS = (core.getInput('translation-file-patterns') || process.env.TRANSLATION_FILE_PATTERNS || 'Translations.txt,.i18n')
    .split(',')
    .map(pattern => pattern.trim());
const SOURCE_LANG = core.getInput('source-lang') || process.env.SOURCE_LANG || 'EN';
const TARGET_LANG = core.getInput('target-lang') || process.env.TARGET_LANG || 'RU';

async function getDiffForTranslationFiles() {
    const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
    const { context } = github;
    
    const commit = await octokit.rest.repos.getCommit({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: context.sha
    });
    
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
                    target: match[2].trim(),
                    originalLine: line.slice(1) // Сохраняем оригинальную строку
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
                source_lang: SOURCE_LANG,
                target_lang: TARGET_LANG
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

async function updateFileWithComments(octokit, context, filename, translationsWithErrors) {
    // Получаем содержимое файла
    const { data: fileData } = await octokit.rest.repos.getContent({
        owner: context.repo.owner,
        repo: context.repo.repo,
        path: filename,
        ref: context.sha
    });

    let content = Buffer.from(fileData.content, 'base64').toString('utf8');
    let updatedContent = content;

    // Добавляем комментарий после каждой ошибочной строки
    for (const { originalLine, source, target, deeplTranslation } of translationsWithErrors) {
        const comment = `# Translation error: "${source}" -> Provided: "${target}", Expected: "${deeplTranslation}"`;
        // Проверяем, есть ли уже комментарий, чтобы не дублировать
        if (!updatedContent.includes(comment)) {
            updatedContent = updatedContent.replace(
                originalLine,
                `${originalLine}\n${comment}`
            );
        }
    }

    // Если содержимое изменилось, обновляем файл
    if (updatedContent !== content) {
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: context.repo.owner,
            repo: context.repo.repo,
            path: filename,
            message: `Add translation error comments for ${filename}`,
            content: Buffer.from(updatedContent).toString('base64'),
            sha: fileData.sha,
            branch: context.ref.replace('refs/heads/', '')
        });
        console.log(`Updated ${filename} with error comments`);
    } else {
        console.log(`No changes needed for ${filename}`);
    }
}

async function main() {
    try {
        const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
        const { context } = github;
        const translationFiles = await getDiffForTranslationFiles();

        if (translationFiles.length === 0) {
            console.log('No translation files found in the diff');
            return;
        }

        let hasErrors = false;

        for (const { filename, diff } of translationFiles) {
            console.log(`Checking file: ${filename}`);
            const translations = extractTranslations(diff);
            const translationsWithErrors = [];

            if (translations.length === 0) {
                console.log(`No new translations found in ${filename}`);
                continue;
            }

            const errors = [];
            for (const translation of translations) {
                const { source, target, originalLine } = translation;
                try {
                    const { isCorrect, deeplTranslation } = await checkTranslationWithDeepL(source, target);
                    if (!isCorrect) {
                        errors.push(
                            `Translation mismatch in ${filename}:\n` +
                            `Source: ${source}\n` +
                            `Provided: ${target}\n` +
                            `DeepL: ${deeplTranslation}`
                        );
                        translationsWithErrors.push({ originalLine, source, target, deeplTranslation });
                    }
                } catch (error) {
                    errors.push(`Error checking translation '${source}' in ${filename}: ${error.message}`);
                }
            }

            if (errors.length > 0) {
                hasErrors = true;
                console.log('Errors found:\n' + errors.join('\n\n'));
                await updateFileWithComments(octokit, context, filename, translationsWithErrors);
            } else {
                console.log(`All translations in ${filename} verified successfully!`);
            }
        }

        if (hasErrors) {
            core.setFailed('Translation check failed');
        } else {
            console.log('All translation files verified successfully!');
            core.setOutput('status', 'success');
        }
    } catch (error) {
        core.setFailed(`Action failed: ${error.message}`);
    }
}

main();

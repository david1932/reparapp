const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = __dirname;
const IGNORE_DIRS = ['node_modules', '.git', 'dist', '.github'];

const REPORT = {
    syntaxErrors: [],
    consoleLogs: [],
    nativeDialogs: [],
    todos: [],
    sensitiveKeywords: []
};

// Palabras clave sensibles
const SENSITIVE = ['api_key', 'apikey', 'secret', 'password', 'token', 'supabase_key'];

function walkDir(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        if (IGNORE_DIRS.includes(file)) return;

        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.html')) {
            analyzeFile(fullPath);
        }
    });
}

function analyzeFile(filePath) {
    const relativePath = path.relative(PROJECT_ROOT, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Check syntax (only JS)
    if (filePath.endsWith('.js')) {
        try {
            execSync(`node -c "${filePath}"`, { stdio: 'ignore' });
        } catch (e) {
            REPORT.syntaxErrors.push(relativePath);
        }
    }

    lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimLine = line.trim();

        // Skip comments
        if (trimLine.startsWith('//') || trimLine.startsWith('*')) return;

        // Console Logs
        if (trimLine.includes('console.log(')) {
            REPORT.consoleLogs.push(`${relativePath}:${lineNum}`);
        }

        // Native Dialogs (only specific file exclusions if any)
        if (!relativePath.includes('app.js') && !relativePath.includes('manager.js')) {
            if (trimLine.match(/\balert\(/)) REPORT.nativeDialogs.push(`ALERT in ${relativePath}:${lineNum}`);
            if (trimLine.match(/\bconfirm\(/)) REPORT.nativeDialogs.push(`CONFIRM in ${relativePath}:${lineNum}`);
            if (trimLine.match(/\bprompt\(/)) REPORT.nativeDialogs.push(`PROMPT in ${relativePath}:${lineNum}`);
        }

        // TODOs
        if (trimLine.includes('TODO') || trimLine.includes('FIXME')) {
            REPORT.todos.push(`${relativePath}:${lineNum} - ${trimLine}`);
        }

        // Sensitive
        SENSITIVE.forEach(keyword => {
            if (trimLine.toLowerCase().includes(keyword) && trimLine.includes('=')) {
                // Ignore if it's just a variable definition without value or environment var
                if (!trimLine.includes('process.env') && trimLine.length < 200) {
                    REPORT.sensitiveKeywords.push(`${relativePath}:${lineNum} (Potential secret)`);
                }
            }
        });
    });
}

walkDir(PROJECT_ROOT);

REPORT.syntaxErrors.forEach(e => console.log(`  - ${e}`));

// Show first 10
REPORT.consoleLogs.slice(0, 10).forEach(e => console.log(`  - ${e}`));
if (REPORT.consoleLogs.length > 10) console.log(`  ... y ${REPORT.consoleLogs.length - 10} más`);

REPORT.nativeDialogs.forEach(e => console.log(`  - ${e}`));

REPORT.todos.forEach(e => console.log(`  - ${e}`));

REPORT.sensitiveKeywords.forEach(e => console.log(`  - ${e}`));

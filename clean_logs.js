const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['node_modules', '.git', 'dist', '.github'];
const TARGET_DIR = __dirname;

function cleanFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalLength = content.length;

    // Remove console.log but keep console.error and console.warn
    // Regex matches console.log(...) and handles basic parenthesis nesting roughly
    // For safer replacement, we'll replace whole lines containing console.log

    const lines = content.split('\n');
    const newLines = lines.filter(line => {
        const trimmed = line.trim();
        // Remove lines that are purely console.log calls
        if (trimmed.startsWith('console.log(') && trimmed.endsWith(');')) return false;
        if (trimmed.startsWith('console.log(') && !trimmed.includes(');')) return false; // Multi-line start? Risky.

        // Remove lines with database debug dumps

        return true;
    });

    const newContent = newLines.join('\n');

    if (newContent.length !== originalLength) {
        fs.writeFileSync(filePath, newContent, 'utf-8');
    }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        if (IGNORE_DIRS.includes(file)) return;
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (file.endsWith('.js')) {
            cleanFile(fullPath);
        }
    });
}

walk(TARGET_DIR);

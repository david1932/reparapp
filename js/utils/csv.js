/**
 * CSV Utility Service
 * Handles conversion between JSON and CSV formats
 */
class CSVService {
    /**
     * Convert Array of Objects to CSV String
     * @param {Array} data - Array of objects
     * @returns {string} CSV string
     */
    static toCSV(data) {
        if (!data || !data.length) return '';

        // Get headers from first object
        const headers = Object.keys(data[0]);

        // Create CSV header row
        const headerRow = headers.join(',');

        // Create rows
        const rows = data.map(row => {
            return headers.map(fieldName => {
                let val = row[fieldName] === null || row[fieldName] === undefined ? '' : row[fieldName];

                // Handle strings with commas, quotes or newlines
                if (typeof val === 'string') {
                    // Escape quotes by doubling them
                    val = val.replace(/"/g, '""');
                    // Wrap in quotes if contains comma, quote or newline
                    if (val.search(/("|,|\n)/g) >= 0) {
                        val = `"${val}"`;
                    }
                }
                // Handle objects/arrays (stringify)
                if (typeof val === 'object') {
                    val = `"${JSON.stringify(val).replace(/"/g, '""')}"`;
                }

                return val;
            }).join(',');
        });

        return [headerRow, ...rows].join('\r\n');
    }

    /**
     * Parse CSV String to Array of Objects
     * @param {string} csvText - Raw CSV text
     * @returns {Array} Array of objects
     */
    static parse(csvText) {
        if (!csvText || typeof csvText !== 'string') return [];

        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => (h || '').trim());
        const result = [];

        for (let i = 1; i < lines.length; i++) {
            const currentLine = this.splitCSVLine(lines[i]);

            // Skip empty or malformed lines
            if (currentLine.length !== headers.length) continue;

            const obj = {};
            for (let j = 0; j < headers.length; j++) {
                // Asegurar que val sea siempre un string
                let val = currentLine[j];
                if (val === null || val === undefined) val = '';
                val = String(val).trim();

                // Remove wrapping quotes if present
                if (typeof val === 'string' && val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
                    val = val.substring(1, val.length - 1);
                    // Unescape double quotes
                    val = val.replace(/""/g, '"');
                }

                // Try to parse basic types
                if (val === 'true') val = true;
                else if (val === 'false') val = false;
                else if (val !== '' && !isNaN(Number(val))) val = Number(val);

                // Try to parse JSON objects (simple check) - only for strings
                if (typeof val === 'string' && val.length > 0) {
                    const firstChar = val.charAt(0);
                    if (firstChar === '{' || firstChar === '[') {
                        try {
                            val = JSON.parse(val);
                        } catch (e) {
                            // Keep as string if not valid JSON
                        }
                    }
                }

                obj[headers[j]] = val;
            }
            result.push(obj);
        }

        return result;
    }

    /**
     * Helper to correctly split CSV line handling quotes
     */
    static splitCSVLine(text) {
        if (!text || typeof text !== 'string') return [];

        const result = [];
        let cur = '';
        let inQuote = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if (char === '"') {
                inQuote = !inQuote;
            }

            if (char === ',' && !inQuote) {
                result.push(cur);
                cur = '';
            } else {
                cur += char;
            }
        }
        result.push(cur);
        return result;
    }
}

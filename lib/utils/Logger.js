const moment = require('moment');

const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    underline: '\x1b[4m',
    fgWhite: '\x1b[37m',
    fgBlue: '\x1b[34m',
    fgRed: '\x1b[31m',
    fgGreen: '\x1b[32m',
    fgYellow: '\x1b[33m',
    bgBlue: '\x1b[44m'
};

function canUseColor() {
    return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function paint(text, ...styles) {
    if (!canUseColor()) {
        return text;
    }

    const prefix = styles.map((style) => ANSI[style] || '').join('');
    return `${prefix}${text}${ANSI.reset}`;
}

function formatContent(content) {
    if (content instanceof Error) {
        return content.message;
    }

    if (typeof content === 'object' && content !== null) {
        try {
            return JSON.stringify(content);
        } catch (error) {
            return '[Unserializable object]';
        }
    }

    return String(content);
}

function levelStyle(level) {
    switch (level) {
        case 'SUCCESS':
            return ['fgGreen', 'bold'];
        case 'WARN':
            return ['fgYellow', 'bold'];
        case 'ERROR':
            return ['fgRed', 'bold'];
        default:
            return ['fgBlue', 'bold'];
    }
}

module.exports = class Logger {
    static timestamp() {
        return moment().format('DD-MM-YYYY HH:mm:ss');
    }

    static brandTag() {
        return paint(' DISCREMY ', 'bgBlue', 'fgWhite', 'bold', 'underline');
    }

    static print(level, content) {
        const tag = paint(`[${level}]`, ...levelStyle(level));
        const date = paint(this.timestamp(), 'dim');
        const text = formatContent(content);

        console.log(`${this.brandTag()} ${date} ${tag} ${text}`);
    }

    static log(content) {
        this.print('INFO', content);
    }

    static info(content) {
        this.print('INFO', content);
    }

    static success(content) {
        this.print('SUCCESS', content);
    }

    static warn(content) {
        this.print('WARN', content);
    }

    static error(content) {
        this.print('ERROR', content);
    }
};
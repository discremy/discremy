#!/usr/bin/env node

const path = require('path');
const args = process.argv.slice(2);

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
    return Boolean(process.stderr.isTTY) && !process.env.NO_COLOR;
}

function paint(text, ...styles) {
    if (!canUseColor()) {
        return text;
    }

    const prefix = styles.map((style) => ANSI[style] || '').join('');
    return `${prefix}${text}${ANSI.reset}`;
}

function brandTag() {
    const label = ' DISCREMY ';
    return paint(label, 'bgBlue', 'fgWhite', 'bold', 'underline');
}

function terminalWidth() {
    const width = process.stderr.columns || 80;
    return Math.max(50, Math.min(width, 110));
}

function sectionLine() {
    const line = '='.repeat(terminalWidth());
    return paint(line, 'fgBlue', 'bold');
}

function printSectionTitle(title, subtitle) {
    console.error('');
    console.error(`${brandTag()} ${paint(title, 'fgBlue', 'bold')}`);
    console.error(sectionLine());
    if (subtitle) {
        console.error(paint(subtitle, 'dim'));
        console.error(sectionLine());
    }
}

function printCheck(name, ok, detail) {
    const status = ok ? paint('[OK]', 'fgGreen', 'bold') : paint('[FAIL]', 'fgRed', 'bold');
    const label = paint(name, 'bold');
    console.error(`${status} ${label}`);

    if (detail) {
        console.error(`      ${paint(detail, 'dim')}`);
    }
}

function printHint(label, value, style = 'fgYellow') {
    console.error(`${paint(`${label}:`, 'dim')} ${paint(value, style, 'bold')}`);
}

function toUserError(message, installCommand) {
    const error = new Error(message);
    error.code = 'DISCREMY_MISSING_DEPENDENCY';
    error.isUserFacing = true;
    error.installCommand = installCommand;
    return error;
}

function loadProjectConfig() {
    try {
        return require(path.join(process.cwd(), 'config.discremy.js'));
    } catch (error) {
        const cfgError = new Error('config.discremy.js was not found in your project root.');
        cfgError.code = 'DISCREMY_CONFIG_NOT_FOUND';
        cfgError.isUserFacing = true;
        throw cfgError;
    }
}

function validateDependenciesBeforeStart() {
    const config = loadProjectConfig();
    const checks = [];

    checks.push({ name: 'Config file loaded', ok: true, detail: 'config.discremy.js detected.' });

    if (config?.modules?.mongodb?.enabled === true) {
        try {
            require.resolve('@discremy/mongodb', { paths: [process.cwd()] });
            checks.push({
                name: 'MongoDB module dependency',
                ok: true,
                detail: '@discremy/mongodb is installed.'
            });
        } catch (error) {
            checks.push({
                name: 'MongoDB module dependency',
                ok: false,
                detail: '@discremy/mongodb is missing.'
            });

            const missingDependencyError = toUserError(
                'Please install the dependency @discremy/mongodb before enabling modules.mongodb.',
                'npm i @discremy/mongodb'
            );
            missingDependencyError.checks = checks;
            throw missingDependencyError;
        }

        const mongoUri = config?.modules?.mongodb?.uri;
        const mongoName = config?.modules?.mongodb?.name;
        const hasMongoConfig = Boolean(mongoUri) && Boolean(mongoName);

        checks.push({
            name: 'MongoDB module config',
            ok: hasMongoConfig,
            detail: hasMongoConfig
                ? 'modules.mongodb.uri and modules.mongodb.name are configured.'
                : 'Missing modules.mongodb.uri or modules.mongodb.name in config.discremy.js.'
        });

        if (!hasMongoConfig) {
            const configError = toUserError(
                'MongoDB is enabled but its config is incomplete. Add modules.mongodb.uri and modules.mongodb.name in config.discremy.js.',
                'Edit config.discremy.js and set modules.mongodb.uri + modules.mongodb.name'
            );
            configError.code = 'DISCREMY_INVALID_MODULE_CONFIG';
            configError.checks = checks;
            throw configError;
        }
    } else {
        checks.push({
            name: 'MongoDB module dependency',
            ok: true,
            detail: 'MongoDB module disabled in config.'
        });
    }

    if (config?.modules?.mysql?.enabled === true) {
        try {
            require.resolve('@discremy/mysql', { paths: [process.cwd()] });
            checks.push({
                name: 'MySQL module dependency',
                ok: true,
                detail: '@discremy/mysql is installed.'
            });
        } catch (error) {
            checks.push({
                name: 'MySQL module dependency',
                ok: false,
                detail: '@discremy/mysql is missing.'
            });

            const missingDependencyError = toUserError(
                'Please install the dependency @discremy/mysql before enabling modules.mysql.',
                'npm i @discremy/mysql'
            );
            missingDependencyError.checks = checks;
            throw missingDependencyError;
        }

        const mysqlHost = config?.modules?.mysql?.host;
        const mysqlUser = config?.modules?.mysql?.user;
        const mysqlDatabase = config?.modules?.mysql?.database;
        const hasMySQLConfig = Boolean(mysqlHost) && Boolean(mysqlUser) && Boolean(mysqlDatabase);

        checks.push({
            name: 'MySQL module config',
            ok: hasMySQLConfig,
            detail: hasMySQLConfig
                ? 'modules.mysql.host, modules.mysql.user and modules.mysql.database are configured.'
                : 'Missing modules.mysql.host, modules.mysql.user or modules.mysql.database in config.discremy.js.'
        });

        if (!hasMySQLConfig) {
            const configError = toUserError(
                'MySQL is enabled but its config is incomplete. Add modules.mysql.host, modules.mysql.user and modules.mysql.database in config.discremy.js.',
                'Edit config.discremy.js and set modules.mysql.host + modules.mysql.user + modules.mysql.database'
            );
            configError.code = 'DISCREMY_INVALID_MODULE_CONFIG';
            configError.checks = checks;
            throw configError;
        }
    } else {
        checks.push({
            name: 'MySQL module dependency',
            ok: true,
            detail: 'MySQL module disabled in config.'
        });
    }

    return checks;
}

function printStartupError(error) {
    const message = error && error.message ? error.message : 'Unknown startup error.';
    const checks = Array.isArray(error?.checks) ? error.checks : [];

    printSectionTitle('CLI Preflight', 'Checks before startup');

    if (checks.length > 0) {
        checks.forEach((check) => printCheck(check.name, check.ok, check.detail));
        console.error(sectionLine());
    }

    printCheck('Startup validation', false, message);

    if (error?.installCommand) {
        printHint('Install', error.installCommand, 'fgYellow');
    }

    console.error('');
}

process.on('unhandledRejection', (reason) => {
    printStartupError(reason);
    process.exitCode = 1;
});

process.on('uncaughtException', (err) => {
    printStartupError(err);
    process.exit(1);
});

async function start() {
    try {
        const Discremy = require('../lib/Core');
        const checks = validateDependenciesBeforeStart();

        printSectionTitle('CLI Preflight', 'Checks before startup');
        checks.forEach((check) => printCheck(check.name, check.ok, check.detail));
        printCheck('Startup validation', true, 'All checks passed. Booting Discremy...');
        console.error(sectionLine());

        const bot = new Discremy();
        await bot.connect();
    } catch (error) {
        printStartupError(error);
        process.exit(1);
    }
}

if (args[0] === 'start') {
    start();
} else if (args[0] === 'init') {
    const init = require('../lib/cli/init');
    const targetDir = args[1] || null;
    init(targetDir).catch((err) => {
        console.error('Error during project initialization:', err);
        process.exit(1);
    });
} else {
    const isTTY = Boolean(process.stdout.isTTY);
    const blue = isTTY ? '\x1b[34m' : '';
    const cyan = isTTY ? '\x1b[36m' : '';
    const bold = isTTY ? '\x1b[1m' : '';
    const reset = isTTY ? '\x1b[0m' : '';
    const bgBlue = isTTY ? '\x1b[44m' : '';
    const white = isTTY ? '\x1b[37m' : '';
    const underline = isTTY ? '\x1b[4m' : '';

    console.log('');
    console.log(`${bgBlue}${white}${bold}${underline} DISCREMY ${reset} ${blue}${bold}CLI${reset}`);
    console.log('');
    console.log('Available commands:');
    console.log(`  ${cyan}${bold}discremy init [dir]${reset}  - Create a new Discremy project`);
    console.log(`                        Use ${cyan}${bold}.${reset} to initialize in current directory`);
    console.log(`  ${cyan}${bold}discremy start${reset}       - Start your bot`);
    console.log('');
}

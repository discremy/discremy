const fs = require('fs');
const path = require('path');
const readline = require('readline');

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
    fgCyan: '\x1b[36m',
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

function brandTag() {
    const label = ' DISCREMY ';
    return paint(label, 'bgBlue', 'fgWhite', 'bold', 'underline');
}

function terminalWidth() {
    const width = process.stdout.columns || 80;
    return Math.max(50, Math.min(width, 110));
}

function sectionLine() {
    const line = '='.repeat(terminalWidth());
    return paint(line, 'fgBlue', 'bold');
}

function printTitle(title) {
    console.log('');
    console.log(`${brandTag()} ${paint(title, 'fgBlue', 'bold')}`);
    console.log(sectionLine());
}

function printSuccess(message) {
    console.log(`${paint('✓', 'fgGreen', 'bold')} ${message}`);
}

function printInfo(message) {
    console.log(`${paint('i', 'fgBlue', 'bold')} ${message}`);
}

function ask(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${paint('?', 'fgCyan', 'bold')} ${question} `, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function createDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function writeFile(filePath, content) {
    fs.writeFileSync(filePath, content, 'utf8');
}

function generateConfigFile(options) {
    return `const { GatewayIntentBits } = require('discord.js');

module.exports = {
  bot: {
    token: '${options.token || 'YOUR_BOT_TOKEN'}',
    clientId: '${options.clientId || 'YOUR_CLIENT_ID'}',
    avatar: null
  },
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  api: {
    enabled: ${options.includeAPI ? 'true' : 'false'},
    port: 3000
  },
  modules: {
    mongodb: {
      enabled: ${options.includeMongoDB ? 'true' : 'false'},
      uri: 'mongodb://127.0.0.1:27017',
      name: '${options.projectName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_db'
    },
    mysql: {
      enabled: ${options.includeMySQL ? 'true' : 'false'},
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: '${options.projectName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_db'
    }
  }
};
`;
}

function generatePackageJson(projectName, options) {
    const dependencies = {
        "discremy": "^1.2.1"
    };

    if (options.includeMongoDB) {
        dependencies["@discremy/mongodb"] = "^1.0.0";
    }

    if (options.includeMySQL) {
        dependencies["@discremy/mysql"] = "^1.0.0";
    }

    return JSON.stringify({
        name: projectName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        version: "1.0.0",
        description: "My Discremy Discord bot",
        main: "index.js",
        scripts: {
            start: "node node_modules/discremy/bin/discremy.js start",
            dev: "node node_modules/discremy/bin/discremy.js start"
        },
        keywords: ["discremy", "discord", "bot"],
        author: "",
        license: "MIT",
        dependencies
    }, null, 2);
}

function generateIndexJs() {
    return `const Discremy = require('discremy');

const bot = new Discremy();
bot.connect();
`;
}

function generateReadme(projectName) {
    return `# ${projectName}

Discord bot powered by Discremy.

## Setup

1. Configure your bot in \`config.discremy.js\`
2. Install dependencies: \`npm install\`
3. Start the bot: \`npm start\`

## Documentation

Visit [docs.discremy.com](https://docs.discremy.com) for full documentation.
`;
}

function generateExampleCommand() {
    return `module.exports = {
  name: 'ping',
  description: 'Check bot latency',
  run: async (client, interaction) => {
    await interaction.reply(\`Pong! \${client.ws.ping}ms\`);
  }
};
`;
}

function generateExampleEvent() {
    return `module.exports = {
  name: 'ready',
  run: async (client) => {
    client.log(\`Logged in as \${client.user.tag}\`);
  }
};
`;
}

function generateExampleAPIRoute() {
    return `/*
Type: GET
*/
module.exports = (req, res) => {
  return res.status(200).json({ 
    status: 'ok',
    message: 'Discremy API is running'
  });
};
`;
}

function generateGitignore() {
    return `node_modules/
.env
config.discremy.js
.idea/
.vscode/
*.log
`;
}

async function init(targetDir) {
    printTitle('Project Setup');
    console.log('');

    const isCurrentDir = targetDir === '.';
    let projectName;
    let projectPath;

    if (isCurrentDir) {
        projectPath = process.cwd();
        projectName = path.basename(projectPath);

        const entries = fs.readdirSync(projectPath);
        const hasFiles = entries.some(entry => !entry.startsWith('.'));

        if (hasFiles) {
            console.error(paint('Current directory is not empty. Please use an empty directory or specify a project name.', 'fgRed'));
            process.exit(1);
        }

        printInfo(`Initializing project in current directory: ${paint(projectName, 'fgCyan', 'bold')}`);
        console.log('');
    } else {
        projectName = await ask('Project name:');
        if (!projectName) {
            console.error(paint('Project name is required.', 'fgRed'));
            process.exit(1);
        }

        projectPath = path.join(process.cwd(), projectName);

        if (fs.existsSync(projectPath)) {
            console.error(paint(`Folder "${projectName}" already exists.`, 'fgRed'));
            process.exit(1);
        }
    }

    console.log('');
    printInfo('Optional modules (type y/n):');
    const includeMongoDB = (await ask('Include MongoDB module?')).toLowerCase() === 'y';
    const includeMySQL = (await ask('Include MySQL module?')).toLowerCase() === 'y';
    const includeAPI = (await ask('Include REST API?')).toLowerCase() === 'y';

    const token = await ask('Bot token (leave empty to set later):');
    const clientId = await ask('Client ID (leave empty to set later):');

    printTitle('Creating project');

    const options = {
        projectName,
        includeMongoDB,
        includeMySQL,
        includeAPI,
        token,
        clientId
    };

    if (!isCurrentDir) {
        createDirectory(projectPath);
        printSuccess(`Created folder: ${projectName}`);
    }

    writeFile(path.join(projectPath, 'package.json'), generatePackageJson(projectName, options));
    printSuccess('Created package.json');

    writeFile(path.join(projectPath, 'config.discremy.js'), generateConfigFile(options));
    printSuccess('Created config.discremy.js');

    writeFile(path.join(projectPath, 'index.js'), generateIndexJs());
    printSuccess('Created index.js');

    writeFile(path.join(projectPath, 'README.md'), generateReadme(projectName));
    printSuccess('Created README.md');

    writeFile(path.join(projectPath, '.gitignore'), generateGitignore());
    printSuccess('Created .gitignore');

    createDirectory(path.join(projectPath, 'src', 'commands', 'slash'));
    writeFile(path.join(projectPath, 'src', 'commands', 'slash', 'ping.js'), generateExampleCommand());
    printSuccess('Created example command: src/commands/slash/ping.js');

    createDirectory(path.join(projectPath, 'src', 'events'));
    writeFile(path.join(projectPath, 'src', 'events', 'ready.js'), generateExampleEvent());
    printSuccess('Created example event: src/events/ready.js');

    if (includeAPI) {
        createDirectory(path.join(projectPath, 'src', 'api', 'routes'));
        writeFile(path.join(projectPath, 'src', 'api', 'routes', 'index.js'), generateExampleAPIRoute());
        printSuccess('Created example API route: src/api/routes/index.js');
    }

    console.log('');
    console.log(sectionLine());
    console.log('');
    printSuccess(`Project "${projectName}" created successfully!`);
    console.log('');
    printInfo('Next steps:');

    if (!isCurrentDir) {
        console.log(`  ${paint('1.', 'dim')} cd ${projectName}`);
        console.log(`  ${paint('2.', 'dim')} npm install`);
        console.log(`  ${paint('3.', 'dim')} Edit config.discremy.js with your bot credentials`);
        console.log(`  ${paint('4.', 'dim')} npm start`);
    } else {
        console.log(`  ${paint('1.', 'dim')} npm install`);
        console.log(`  ${paint('2.', 'dim')} Edit config.discremy.js with your bot credentials`);
        console.log(`  ${paint('3.', 'dim')} npm start`);
    }

    console.log('');
}

module.exports = init;


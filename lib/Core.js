const path = require('path');
const loadApiRoutes = require('./Api');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const Logger = require('./utils/Logger');
const { createRequire } = require('module');

let configLoaded = loadConfig();

function loadConfig() {
    try {
        return require(path.join(process.cwd(), 'config.discremy.js'));
    } catch (err) {
        console.error('The config.discremy.js file could not be loaded. Make sure you have the file in the root of the project.');
        process.exit(1);
    }
}

function createDisabledDatabaseResponse(log) {
    const notActive = { error: true, message: 'mongodb module is not active.' };
    notActive.save = async () => {
        log('MongoDB is down. An attempt was made to use save(), but it had no effect.');
    };
    notActive.reload = async () => {
        log('MongoDB is down. An attempt was made to use reload(), but it had no effect.');
    };
    notActive.delete = async () => {
        log('MongoDB is down. An attempt was made to use delete(), but it had no effect.');
    };
    return notActive;
}

function createMissingDependencyError(moduleName, packageName) {
    const error = new Error(`Please install the dependency ${packageName} before enabling modules.${moduleName}. Run: npm i ${packageName}`);
    error.code = 'DISCREMY_MISSING_DEPENDENCY';
    error.isUserFacing = true;
    return error;
}

function getProjectRequire() {
    try {
        return createRequire(path.join(process.cwd(), 'package.json'));
    } catch (error) {
        return require;
    }
}

class Core extends Client {
    constructor() {
        super({
            failIfNotExists: true,
            allowedMentions: { parse: ['everyone', 'roles', 'users'] },
            intents: configLoaded.intents || [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.GuildInvites,
                GatewayIntentBits.MessageContent
            ],
            partials: [
                Partials.Channel,
                Partials.Message,
                Partials.User,
                Partials.GuildMember
            ]
        });

        this.config = configLoaded;
        this.avatar = this.config.bot && this.config.bot.avatar;
        this.log = (content) => Logger.log(content);
        this._databaseAdapter = null;

        // Legacy public fields kept for compatibility with older bots.
        this.mongodbSession = null;
        this.mongoClient = null;

        this.slashCommands = new Collection();
        this.userCommands = new Collection();
        this.messageCommands = new Collection();

        this.rest.on('rateLimited', (info) => {
            this.log(`Rate limited: ${JSON.stringify(info)}`);
        });

        // Validate and register optional modules before loading user code.
        this.tryAutoEnableMongoModule();
        this.tryAutoEnableMySQLModule();
        require('./Loader')(this);
    }

    tryAutoEnableMongoModule() {
        if (this.config?.modules?.mongodb?.enabled !== true) {
            return;
        }

        const projectRequire = getProjectRequire();

        try {
            projectRequire.resolve('@discremy/mongodb');
        } catch (resolveError) {
            throw createMissingDependencyError('mongodb', '@discremy/mongodb');
        }

        try {
            const mongoPlugin = projectRequire('@discremy/mongodb');
            this.use(mongoPlugin);
        } catch (err) {
            throw createMissingDependencyError('mongodb', '@discremy/mongodb');
        }
    }

    tryAutoEnableMySQLModule() {
        if (this.config?.modules?.mysql?.enabled !== true) {
            return;
        }

        const projectRequire = getProjectRequire();

        try {
            projectRequire.resolve('@discremy/mysql');
        } catch (resolveError) {
            throw createMissingDependencyError('mysql', '@discremy/mysql');
        }

        try {
            const mysqlPlugin = projectRequire('@discremy/mysql');
            this.use(mysqlPlugin);
        } catch (err) {
            throw createMissingDependencyError('mysql', '@discremy/mysql');
        }
    }

    use(plugin, options = {}) {
        if (typeof plugin === 'function') {
            plugin(this, options);
            return this;
        }

        if (plugin && typeof plugin.register === 'function') {
            plugin.register(this, options);
            return this;
        }

        throw new TypeError('Invalid plugin. Expected a function or an object with register(client, options).');
    }

    registerDatabaseAdapter(adapter) {
        if (!adapter || typeof adapter.database !== 'function') {
            throw new TypeError('Invalid database adapter. A database(query, collection) function is required.');
        }

        this._databaseAdapter = adapter;
        return this;
    }

    async connectMongoDB() {
        if (!this._databaseAdapter || typeof this._databaseAdapter.connect !== 'function') {
            this.log('MongoDB adapter is not registered. Install and use @discremy/mongodb.');
            return null;
        }

        return this._databaseAdapter.connect();
    }

    async reconnectMongoDB() {
        if (!this._databaseAdapter || typeof this._databaseAdapter.reconnect !== 'function') {
            this.log('MongoDB adapter is not registered. Install and use @discremy/mongodb.');
            return null;
        }

        return this._databaseAdapter.reconnect();
    }

    async database(query, collection = 'guilds') {
        if (!this._databaseAdapter) {
            return createDisabledDatabaseResponse(this.log);
        }

        return this._databaseAdapter.database(query, collection);
    }

    async connect() {
        if (this._databaseAdapter && typeof this._databaseAdapter.connect === 'function') {
            this._databaseAdapter.connect().catch((err) => {
                console.error('Error connecting to MongoDB:', err);
            });
        }

        if (this.config?.modules?.mysql?.enabled === true && typeof this.connectMySQL === 'function') {
            this.connectMySQL().catch((err) => {
                console.error('Error connecting to MySQL:', err);
            });
        }

        const loggedIn = await super.login(this.config.bot.token);

        if (this.config.api && this.config.api.enabled) {
            const apiApp = loadApiRoutes();
            const port = this.config.api.port || 3000;
            apiApp.listen(port, () => {
                this.log(`API server is running on port ${port}`);
            });
        }

        return loggedIn;
    }
}

module.exports = Core;

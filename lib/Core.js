const path = require('path');
const loadApiRoutes = require('./Api');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const { MongoClient } = require('mongodb');
const { log } = require('./utils/Logger');

let configLoaded = loadConfig();

// Función para cargar el archivo de configuración del usuario
function loadConfig() {
    try {
        // Se asume que el archivo de configuración se encuentra en el directorio raíz del proyecto del usuario
        return require(path.join(process.cwd(), 'config.discremy.js'));
    } catch (err) {
        console.error('The config.discremy.js file could not be loaded. Make sure you have the file in the root of the project.');
        process.exit(1);
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

        // Carga la configuración del usuario
        this.config = configLoaded;
        this.avatar = this.config.bot && this.config.bot.avatar;
        this.log = log;
        this.mongodbSession = null;
        this.mongoClient = null;
        this.slashCommands = new Collection();
        this.userCommands = new Collection();
        this.messageCommands = new Collection();

        // Listener para manejo de rate limit
        this.rest.on('rateLimited', (info) => {
            this.log('Rate limited:', info);
        });

        // Cargar módulos, comandos y eventos usando el Loader
        require('./Loader')(this);
    }

    async connectMongoDB() {
        // Si ya se está intentando conectar, retornamos la misma promesa.
        if (this.mongoConnectionPromise) return this.mongoConnectionPromise;

        this.mongoConnectionPromise = (async () => {
            let attempts = 0;
            while (attempts < 5) {
                try {
                    this.mongoClient = new MongoClient(configLoaded.modules.mongodb.uri, { maxPoolSize: 10 });
                    await this.mongoClient.connect();
                    this.mongodbSession = this.mongoClient.db(configLoaded.modules.mongodb.name);
                    log("Connected to MongoDB successfully.");

                    // En caso de desconexión, reiniciamos la promesa y la sesión para poder reconectar
                    this.mongoClient.on("close", () => {
                        log("Connection to MongoDB closed. Attempting to reconnect...");
                        this.mongoConnectionPromise = null;
                        this.mongodbSession = null;
                        this.reconnectMongoDB();
                    });
                    break;
                } catch (e) {
                    attempts++;
                    log(`Attempting to reconnect to MongoDB... (${attempts})`, e);
                    if (attempts < 5) {
                        await new Promise(resolve => setTimeout(resolve, 15000));
                    } else {
                        log("Could not connect to MongoDB.");
                        throw e;
                    }
                }
            }
        })();

        return this.mongoConnectionPromise;
    }

    async reconnectMongoDB() {
        let attempts = 0;
        while (attempts < 5) {
            try {
                log("Trying to reconnect to MongoDB...");
                this.mongoClient = new MongoClient(this.config.db.uri, { maxPoolSize: 10 });
                await this.mongoClient.connect();
                this.mongodbSession = this.mongoClient.db(this.config.db.name);
                log("Reconnection to MongoDB successful.");

                this.mongoClient.on("close", () => {
                    log(`Attempting to reconnect to MongoDB... (${attempts})`);
                    this.reconnectMongoDB();
                });
                break;
            } catch (e) {
                attempts++;
                console.error(`Error al reconectar a MongoDB, intento ${attempts} de 5:`, e);
                if (attempts < 5) {
                    await new Promise(resolve => setTimeout(resolve, 30000));
                } else {
                    log("Could not connect to MongoDB.");
                }
            }
        }
    }

    async database(query, collection = "guilds") {
        if (configLoaded.modules.mongodb.enabled !== true) {
            // Retornamos un objeto que simula la respuesta, pero sin interacción real con la BD.
            let notActive = { error: true, message: "mongodb module is not active." };
            notActive.save = async () => {
                log("MongoDB is down. An attempt was made to use save(), but it had no effect.");
            };
            notActive.reload = async () => {
                log("MongoDB is down. An attempt was made to use reload(), but it had no effect.");
            };
            notActive.delete = async () => {
                log("MongoDB is down. An attempt was made to use delete(), but it had no effect.");
            };
            return notActive;
        }

        try {
            if (!this.mongodbSession) {
                await this.connectMongoDB();
            }

            let result = await this.mongodbSession.collection(collection).findOne(query);

            if (!result) {
                await this.mongodbSession.collection(collection).insertOne(query);
                result = await this.mongodbSession.collection(collection).findOne(query);
            }

            result.save = async () => {
                await this.mongodbSession.collection(collection).updateOne(query, { $set: result });
            };

            result.delete = async () => {
                await this.mongodbSession.collection(collection).deleteOne(query);
            };

            result.reload = async () => {
                let updatedResult = await this.mongodbSession.collection(collection).findOne(query);
                if (updatedResult) {
                    Object.assign(result, updatedResult);
                }
                return result;
            };

            return result;

        } catch (e) {
            log("Error in database operation:");
            console.error(e);
        }
    }

    async connect() {
        if(configLoaded.modules.mongodb.enabled == true) {
            this.connectMongoDB().catch(err => console.error("Error connecting to MongoDB:", err));
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

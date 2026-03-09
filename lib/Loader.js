const { PermissionsBitField, Routes, ApplicationCommandType } = require("discord.js");
const { REST } = require("@discordjs/rest");
const { readdirSync } = require("fs");
const { join } = require("path");

module.exports = (client) => {
    let countE = 0;
    const eventsPath = join(process.cwd(), 'src', 'events');

    const logLoaderNotice = (message) => {
        if (client && typeof client.log === 'function') {
            client.log(`[Loader] ${message}`);
            return;
        }

        console.log(`[Loader] ${message}`);
    };

    // Función recursiva para cargar eventos de un directorio y sus subdirectorios
    const loadEventsRecursively = (dir) => {
        const entries = readdirSync(dir, { withFileTypes: true });
        entries.forEach(entry => {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                loadEventsRecursively(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                const event = require(fullPath);
                if (event.name && typeof event.run === "function") {
                    client.on(event.name, (...args) => event.run(client, ...args));
                    countE++;
                } else {
                    console.error(`El archivo ${fullPath} no exporta "name" o "run".`);
                }
            }
        });
    };

    try {
        loadEventsRecursively(eventsPath);
    } catch (err) {
        if (err && err.code === 'ENOENT') {
            logLoaderNotice(`Events folder not found at ${eventsPath}. Skipping event loading.`);
        } else {
            console.error('Could not load events:', err);
        }
    }

    // Registrar comandos (slash, user, message) desde src/commands
    const commandsPath = join(process.cwd(), 'src', 'commands');
    const data = [];
    let countC = 0;

    // Función auxiliar para cargar comandos de un directorio
    const loadCommands = (subPath, type) => {
        const folderPath = join(commandsPath, subPath);
        let commandFiles = [];
        try {
            commandFiles = readdirSync(folderPath).filter(file => file.endsWith('.js'));
        } catch (err) {
            if (err && err.code === 'ENOENT') {
                const isOptionalFolder = subPath === 'user' || subPath === 'message';
                if (isOptionalFolder) {
                    logLoaderNotice(`Optional folder not found: src/commands/${subPath}. Skipping.`);
                } else {
                    logLoaderNotice(`Folder not found: src/commands/${subPath}. Skipping.`);
                }
                return;
            }

            console.error(`Could not read commands folder ${folderPath}:`, err);
            return;
        }
        commandFiles.forEach(file => {
            const command = require(join(folderPath, file));
            if (!command.name) {
                return console.error(`Error in ${subPath}/${file}: A name is required for the command.`);
            }
            // Registrar el comando en la colección correspondiente
            switch (type) {
                case 'slash':
                    client.slashCommands.set(command.name, command);
                    data.push({
                        name: command.name,
                        description: command.description || 'Default text',
                        type: ApplicationCommandType.ChatInput,
                        options: command.options || null,
                        userPerms: command.userPerms ? PermissionsBitField.resolve(command.userPerms).toString() : null
                    });
                    break;
                case 'user':
                    client.userCommands.set(command.name, command);
                    data.push({
                        name: command.name,
                        type: ApplicationCommandType.User,
                        userPerms: command.userPerms ? PermissionsBitField.resolve(command.userPerms).toString() : null
                    });
                    break;
                case 'message':
                    client.messageCommands.set(command.name, command);
                    data.push({
                        name: command.name,
                        type: ApplicationCommandType.Message,
                        userPerms: command.userPerms ? PermissionsBitField.resolve(command.userPerms).toString() : null
                    });
                    break;
            }
            countC++;
        });
    };

    loadCommands('slash', 'slash');
    loadCommands('user', 'user');
    loadCommands('message', 'message');

    client.log(`Loaded events: ${countE}`);
    client.log(`Loaded commands: ${countC}`);

    // Actualizar los comandos de la aplicación en Discord
    const rest = new REST({ version: "10" }).setToken(client.config.bot.token);
    (async () => {
        try {
            client.log("Updating application commands.");
            await rest.put(
                Routes.applicationCommands(client.config.bot.clientId),
                { body: data }
            );
            client.log("Application commands reloaded.");
        } catch (error) {
            console.error("Error updating commands:", error);
        }
    })();
};

#!/usr/bin/env node

const args = process.argv.slice(2);
const Discremy = require('../lib/Core');

process.on('unhandledRejection', (reason, p) => { console.log(reason, p); });
process.on('uncaughtException', (err, origin) => { console.log(err, origin); });
process.on('uncaughtExceptionMonitor', (err, origin) => { console.log(err, origin); });

if (args[0] === 'start') {
    const bot = new Discremy();
    bot.connect().catch(err => {
        console.error('Error starting the bot:', err);
    });
} else {
    console.log('Unrecognized command. Use: discremy start');
}

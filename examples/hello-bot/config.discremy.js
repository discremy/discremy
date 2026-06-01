const { GatewayIntentBits } = require('discord.js');

module.exports = {
  bot: {
    token: process.env.DISCORD_TOKEN || 'PUT_YOUR_TOKEN_HERE',
    clientId: process.env.DISCORD_CLIENT_ID || 'PUT_YOUR_CLIENT_ID_HERE',
    avatar: null
  },
  intents: [GatewayIntentBits.Guilds],
  api: {
    enabled: false,
    port: 3000
  },
  modules: {
    mongodb: { enabled: false },
    mysql: { enabled: false }
  }
};

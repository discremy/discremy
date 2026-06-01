module.exports = {
  name: 'ready',
  run: async (client) => {
    client.log(`Logged in as ${client.user.tag}`);
  }
};

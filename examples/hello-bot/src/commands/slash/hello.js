module.exports = {
  name: 'hello',
  description: 'Say hello',
  run: async (client, interaction) => {
    await interaction.reply('Hello!');
  }
};

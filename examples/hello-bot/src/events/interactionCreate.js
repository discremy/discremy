module.exports = {
  name: 'interactionCreate',
  run: async (client, interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.slashCommands.get(interaction.commandName);
        if (!command) return;
        await command.run(client, interaction);
        return;
      }

      if (interaction.isUserContextMenuCommand()) {
        const command = client.userCommands.get(interaction.commandName);
        if (!command) return;
        await command.run(client, interaction);
        return;
      }

      if (interaction.isMessageContextMenuCommand()) {
        const command = client.messageCommands.get(interaction.commandName);
        if (!command) return;
        await command.run(client, interaction);
      }
    } catch (error) {
      console.error('Error handling interaction:', error);

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: 'There was an error running this command.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error running this command.', ephemeral: true });
      }
    }
  }
};

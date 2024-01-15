const { Routes, SlashCommandBuilder, ChannelType } = require('discord.js')

class CommandBuilder {
    // Setup internal slash commands
    #commandsInternal = {
        'join':
            new SlashCommandBuilder()
            .setName('join')
            .setDescription('Joins a Voice Channel')
            .addChannelOption(option => option
                .setName('channel')
                .setDescription('The channel to join')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice)
            )
            .toJSON(),
        'play':
            new SlashCommandBuilder()
            .setName('play')
            .setDescription('Plays any music')
            .addStringOption(option => option
                .setName('search')
                .setDescription('The audio to play')
                .setRequired(true)
            )
            .toJSON(),
        'queue':
            new SlashCommandBuilder()
            .setName('queue')
            .setDescription('Queues any music to be played next')
            .addStringOption(option => option
                .setName('search')
                .setDescription('The music to queue')
                .setRequired(true)
            )
            .toJSON(),
        'showqueue':
            new SlashCommandBuilder()
            .setName('showqueue')
            .setDescription('Shows the queue')
            .toJSON(),
        'pause':
            new SlashCommandBuilder()
            .setName('pause')
            .setDescription('Pauses the current music')
            .toJSON(),
        'resume':
            new SlashCommandBuilder()
            .setName('resume')
            .setDescription('Resumes the paused music')
            .toJSON(),
        // 'opt': {
        //     options: [
        //       {
        //         choices: [{ name: 'Get pinged when someone joins VC', value: 0 }],
        //         autocomplete: false,
        //         type: 4,
        //         name: 'event',
        //         name_localizations: undefined,
        //         description: 'The program to opt in/out for',
        //         description_localizations: undefined,
        //         required: true,
        //         max_length: undefined,
        //         min_length: undefined
        //       },
        //       {
        //         choices: [{ name: 'in', value: 0 }, { name: 'out', value: 0 }],
        //         autocomplete: false,
        //         type: 4,
        //         name: 'in/out',
        //         name_localizations: undefined,
        //         description: 'The choice',
        //         description_localizations: undefined,
        //         required: true,
        //         max_length: undefined,
        //         min_length: undefined
        //       },
        //     ],
        //     name: 'opt',
        //     name_localizations: undefined,
        //     description: 'Choose to opt in to programs',
        //     description_localizations: undefined,
        //     default_permission: undefined,
        //     default_member_permissions: undefined,
        //     dm_permission: undefined,
        //     nsfw: undefined
        // }
        // new SlashCommandBuilder()
        // .setName('mauw')
        // .setDescription('Unleash the Mauw')
        // .toJSON()

    }
    
    // Expected to use discord.js SlashCommandBuilder
    upsert(name, slashcommand) {
        this.#commandsInternal[name] = slashcommand
    }

    remove(name) {
        delete this.#commandsInternal[name]
    }

    build() {
        let arrayBuffer = []
        for (let command in this.#commandsInternal) arrayBuffer.push(this.#commandsInternal[command])
        return arrayBuffer
    }

    // Very specific function only delegated here because of ugliness.
    updateMusicQueue(musicQueue) {

        this.upsert('remove', {
            options: [
              {
                choices: musicQueue.map( music => ({ name: music.title, value: music.title })).slice(1, Math.min(musicQueue.length, 26)),
                autocomplete: undefined,
                type: 3,
                name: 'song',
                name_localizations: undefined,
                description: 'The song to remove from the queue',
                description_localizations: undefined,
                required: true,
                max_length: undefined,
                min_length: undefined
              }
            ],
            name: 'remove',
            name_localizations: undefined,
            description: 'Removes specific music from the queue',
            description_localizations: undefined,
            default_permission: undefined,
            default_member_permissions: undefined,
            dm_permission: undefined,
            nsfw: undefined
        })
    }

    async put(guildID, botID, rest) {
        await rest.put(
            Routes.applicationGuildCommands(botID, guildID),
            { body: this.build() }
        )
    }
}

module.exports = CommandBuilder
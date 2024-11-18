const { join } = require('node:path')
const { createReadStream, createWriteStream } = require('node:fs')
const { PassThrough } = require('stream')
const ytdl = require('ytdl-core')
const yts = require( 'yt-search' )

const CommandBuilder = require('./commands.js')
const commands = new CommandBuilder

const ffmpegCommand = require('fluent-ffmpeg')
ffmpegCommand.setFfmpegPath('C:\\ffmpeg\\bin\\ffmpeg.exe')
ffmpegCommand.setFfprobePath('C:\\ffmpeg\\bin\\ffprobe.exe')

// setup discord
const { REST, Client, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js')
const config = require('./config.json')
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ] 
})
const rest = new REST({ version: '10'}).setToken(config.token)

// setup discord voice
const { generateDependencyReport, joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType, NoSubscriberBehavior, VoiceConnectionStatus, getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice')
//console.log(generateDependencyReport())
const musicPlayer = createAudioPlayer({
    behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
    },
})
const soundsPlayer = createAudioPlayer({
    behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
    },
})

// setup express
const express = require('express')
const internal = require('node:stream')
const { error } = require('node:console')
const App = express()
App.use(express.json())

// express connections
App.get("/", (req, res) => {
    res.sendFile("./test.html", {'root': __dirname})
})

App.post("/api/message", (req, res) => {
    const channel = client.channels.cache.get('905578341707427870')

    channel.send(req.body.message)
    res.json({'code': 200})
})

let musicQueue = []

client.on(Events.InteractionCreate, async interaction => {
    try {
    if (!interaction.isChatInputCommand()) return
    switch (interaction.commandName) {

        case 'join': try {
            const voiceChannelID = interaction.options.getChannel('channel').id
            const voiceConnection = joinVoiceChannel({
                channelId: voiceChannelID,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
            })
            
            interaction.reply(`Joined <#${voiceChannelID}>`)
            const subscription = voiceConnection.subscribe(musicPlayer)
            

            break
        } catch (error) { console.log(error) }

        case 'play': try {
            const voiceConnection = getVoiceConnection(interaction.guildId)
            
            if (voiceConnection == undefined) {
                const commands = await interaction.guild.commands.fetch()
                const joinID = commands.toJSON().filter(command => command.name == 'join')[0].id
                interaction.reply(`Use </join:${joinID}> first to connect to a voice channel`)
                break
            }

            const search = interaction.options.get('search').value

            if (!search.includes('youtu') || search.split(' ').length > 1) {
                const results = await yts(search)
                musicQueue[0] = { url: results.videos[0].url, title: '' }
                musicQueue[0].title = results.videos[0].title

            } else {
                const youtubeInfo = (await ytdl.getInfo(search)).videoDetails
                musicQueue[0] = { url: youtubeInfo.video_url, title: youtubeInfo.title }
            }

            const stream = youtubeStream(musicQueue[0].url)
            const resource = createAudioResource(stream, { inlineVolume: true })
            
            musicPlayer.play(resource)

            interaction.reply({ embeds: [ new EmbedBuilder()
                .setColor(0x00FF44)
                .setTitle(`${musicQueue[0].title}`)
                .setDescription(`in <#${voiceConnection.joinConfig.channelId}>`)
                .setURL(musicQueue[0].url)
            ]})

            break
        } catch (error) { console.log(error) }

        case 'pause': try {
            const voiceConnection = getVoiceConnection(interaction.guildId)
            
            if (voiceConnection == undefined) {
                const commands = await interaction.guild.commands.fetch()
                const joinID = commands.toJSON().filter(command => command.name == 'join')[0].id
                interaction.reply(`No music was playing. Use </join:${joinID}> first to connect to a voice channel`)
                break
            }

            if (musicQueue[0].url == undefined || musicPlayer.state.status != 'playing') {
                const commands = await interaction.guild.commands.fetch()
                const playID = commands.toJSON().filter(command => command.name == 'play')[0].id
                interaction.reply(`No music was playing. Use </play:${playID}> first to play a song`)
                break
            }
            
            musicPlayer.pause()

            interaction.reply(`Paused [${musicQueue[0].title}](${musicQueue[0].url}) in <#${voiceConnection.joinConfig.channelId}>`)
            break
        } catch (error) { console.log(error) }

        case 'resume': try {
            const voiceConnection = getVoiceConnection(interaction.guildId)
            
            if (voiceConnection == undefined) {
                const commands = await interaction.guild.commands.fetch()
                const joinID = commands.toJSON().filter(command => command.name == 'join')[0].id
                interaction.reply(`No music was playing. Use </join:${joinID}> first to connect to a voice channel`)
                break
            }
            if (youtubeInfo == -1) {
                const commands = await interaction.guild.commands.fetch()
                const playID = commands.toJSON().filter(command => command.name == 'play')[0].id
                interaction.reply(`No music was playing. Use </play:${playID}> first to play a song`)
                break
            }
            if (musicPlayer.state.status == 'playing') {
                interaction.reply('The music wasn\'t paused')
                break
            }

            musicPlayer.unpause()
            interaction.reply(`Resumed [${youtubeInfo.videoDetails.title}](${youtubeInfo.videoDetails.video_url}) in <#${voiceConnection.joinConfig.channelId}>`)
            break
        } catch (error) { console.log(error) }

        case 'queue': try {
            const search = interaction.options.get('search').value
            let url = ''
            let youtubeInfo = {}
            if (!search.includes('youtu') || search.split(' ').length > 1) {
                const results = await yts(search)
                url = results.videos[0].url
                youtubeInfo = results.videos[0]

            } else {
                youtubeInfo = (await ytdl.getInfo(search)).videoDetails
                url = search.split(' ')[0]
            }

            musicQueue.push({url: url, title: youtubeInfo.title})

            commands.updateMusicQueue(musicQueue)
            await commands.put(interaction.guildId, config.botID, rest)

            interaction.reply({ embeds: [ new EmbedBuilder()
                .setColor(0x00FF44)
                .setTitle(`${youtubeInfo.title}`)
                .setDescription('added to queue')
                .setURL(url)
            ]})

            break
        } catch (error) { console.log(error) }

        case 'showqueue': try {
            if (musicQueue == []) {
                interaction.reply({ embeds: [ new EmbedBuilder()
                    .setColor(0x00FF44)
                    .setTitle('No queue')
                ]})
            }

            let tempString = ''
            musicQueue.forEach( music => {
                tempString += `${music.title}\n`
            })
            interaction.reply({ embeds: [ new EmbedBuilder()
                .setColor(0x00FF44)
                .setTitle('Coming up')
                .setDescription(tempString)
            ]})
            break
        } catch (error) { console.log(error) }

        case 'remove': try {
            const voiceConnection = getVoiceConnection(interaction.guildId)

            if (voiceConnection == undefined) {
                const commands = await interaction.guild.commands.fetch()
                const joinID = commands.toJSON().filter(command => command.name == 'join')[0].id
                interaction.reply(`Use </join:${joinID}> first to connect to a voice channel`)
                break
            }

            const index = musicQueue.indexOf(interaction.options.get('song').value);
            const removedMusic = musicQueue.splice(index, 1);

            commands.updateMusicQueue(musicQueue)
            await commands.put(interaction.guildId, config.botID, rest)

            interaction.reply({ embeds: [ new EmbedBuilder()
                .setColor(0x00FF44)
                .setTitle(`${removedMusic[0].title}`)
                .setDescription('removed from queue')
                .setURL(removedMusic[0].url)
            ]})
        } catch (error) { console.log(error) }

        case 'mauw': try {
            const voiceConnection = getVoiceConnection(interaction.guildId)
            const resource = createAudioResource('./mauwvid.mp3')

            if (voiceConnection == undefined) {
                const commands = await interaction.guild.commands.fetch()
                const joinID = commands.toJSON().filter(command => command.name == 'join')[0].id
                interaction.reply(`Use </join:${joinID}> first to connect to a voice channel`)
                break
            }

            if (musicPlayer.state.status == 'playing') {
                musicPlayer.pause()
            }

            voiceConnection.subscribe(soundsPlayer)
            
            voiceConnection.once(VoiceConnectionStatus.Ready, () => {

                soundsPlayer.play(resource)
                
                soundsPlayer.once(AudioPlayerStatus.Idle, () => {
                    voiceConnection.subscribe(musicPlayer)
                    if (musicPlayer.state.status == 'paused') {
                        musicPlayer.unpause()
                    }
                })

            })

            interaction.reply('mauw')
            break
        } catch (error) { console.log(error) }
        case 'meme': try {

            await fetch("http://192.168.50.130:3001/api/changeData", {
                method: "POST",
                mode: "cors",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify((interaction.options.get('image-url') !== null) ? {
                    top: interaction.options.get('top').value,
                    bottom: interaction.options.get('bottom').value,
                    imageURL: interaction.options.get('image-url').value
                } : {
                    top: interaction.options.get('top').value,
                    bottom: interaction.options.get('bottom').value,
                }
                )
            })
            interaction.reply('Somewhere... A meme has been changed.')
            break
        } catch (error) { console.log(error) }
        default:
            return
    }
    }
    catch (error) {
        console.log(error)
    }
})

musicPlayer.on(AudioPlayerStatus.Idle, async () => {

    if (musicQueue.length <= 1) {
        musicQueue = []
        return
    }
    
    const stream = youtubeStream(musicQueue[1].url)
    
    const resource = createAudioResource(stream, { inlineVolume: true })
    
    musicPlayer.play(resource)

    musicQueue.shift()

    if (musicQueue.length == 1) {
        commands.remove('remove')
        await commands.put('848289293226737684', config.botID, rest)
        return
    }

    commands.updateMusicQueue(musicQueue)
    await commands.put('848289293226737684', config.botID, rest)
})

function youtubeStream(uri) {
    try {
        const opt = {
            videoFormat: 'mp4',
            quality: 'highestaudio',
            audioFormat: 'mp3',
            filter (format) {
                return format.container === opt.videoFormat && format.audioBitrate
            }
        }
    
        const video = ytdl(uri, opt)

        const stream = new PassThrough()
        const ffmpeg = ffmpegCommand(video)
    
        process.nextTick( () => {
            const output = ffmpeg.format('mp3').pipe(stream)
        
            ffmpeg.once('error', error => {
                console.log('\nffmpeg error:\n')
                console.error(error.stack)
                console.log("Node NOT Exiting...")
            })
            output.once('error', error => {
                console.log('\noutput error:\n')
                console.error(error.stack)
                console.log("Node NOT Exiting...")
            })
            stream.on('error', error => {
                console.log('\nstream error:\n')
                console.error(error.stack)
                console.log("Node NOT Exiting...")
            })
            stream.on('uncaughtException', error => {
                console.log('\nstream uncaught exception:\n')
                console.error(error.stack)
                console.log("Node NOT Exiting...")
            })
        })
    
        stream.video = video
        stream.ffmpeg = ffmpeg
    
        return stream
    } catch (error) { console.log(error) }
}

// after discord connection is established
client.once(Events.ClientReady, async callBackClient => {
	console.log(`Logged in as ${callBackClient.user.tag}`);

    client.guilds.cache.map( async guild => 
        await commands.put(guild.id, config.botID, rest)
    )
})

client.login(config.token);
App.listen(3000)
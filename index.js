'use strict';

const fsPromises = require('fs/promises');
const chokidar = require('chokidar');
const fs = require('node:fs');
const path = require('node:path');

const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers] });

const MAGIC_CHANNEL_NAME = "Join Me!";
const CHANNEL_PREFIX = "[AC]";
const CHANNEL_NAMES_FILE = "/etc/bananabot/channel_names";

let channelNames = [
    'Eisen 2',
    'ezpz',
    'Holzauge',
    'Inting',
    'Jeeeeenkins!!',
    'Leeeeeroy...!',
    'Need boost!',
    'Olympisch Weitwurf',
    'Sir Feed-a-lot',
    'Sweating',
];



chokidar.watch(CHANNEL_NAMES_FILE, { awaitWritefinish: true }).on('all', (event, path) => {
    setChannelNamesFromFile(path);
});

let managedChannels_ = [];

client.once(Events.ClientReady, async client => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.channels.cache.forEach(channel => {
        if (channel.name.startsWith(CHANNEL_PREFIX)) {
            if (channel.members.size > 0) {
                managedChannels_.push(channel);
            } else {
                channel.delete();
            }
        }
        if (channel.name === MAGIC_CHANNEL_NAME) {
            if (channel.members.size > 0) {
                createChannel(channel).then(new_channel => {
                    channel.members.forEach(member => member.voice.setChannel(new_channel));
                });

            }

        }
    });

});

client.on(Events.VoiceStateUpdate, async (before, after) => {
    if (before.channel != null && managedChannels_.includes(before.channel)) {
        if (before.channel.members.size == 0) {
            managedChannels_ = managedChannels_.filter(channel => channel !== before.channel);
            console.log(`Deleting channel ${before.channel.name}`);
            await before.channel.delete();
        }
    }

    if (after.channel != null && after.channel.name === MAGIC_CHANNEL_NAME) {

        createChannel(after.channel).then(new_channel => {
            new_channel.setRTCRegion("rotterdam");
            after.member.voice.setChannel(new_channel)
        });

    }

});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

async function createChannel(template_channel) {
    let new_name = `${CHANNEL_PREFIX} ${channelNames[Math.floor(channelNames.length * Math.random())]}`;
    console.log(`Creating channel ${new_name}`);
    let new_channel = await template_channel.clone({
        name: new_name,
        reason: 'Auto Voice Channel',
        position: 999
    });
    managedChannels_.push(new_channel);


    return new_channel;
}

function setChannelNamesFromFile(filename) {
    fsPromises.readFile(filename)
        .then(
            function (result) {
                try {

                    let content = result.toString();
                    if (content.length === 0) {
                        throw "No channel names in file.";
                    }
                    channelNames = content.split("\n").filter(name => name.length > 0);
                    console.log(`Got ${channelNames.length} channel names from ${filename}`);
                } catch (e) {
                    console.warn("Could not read channel names from file, using default names.", e);
                }
            }
        )
        .catch(function (e) {
            console.error(e);
        });
}

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	// Set a new item in the Collection with the key as the command name and the value as the exported module
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

client.login(process.env.DISCORD_TOKEN);

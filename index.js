'use strict';

const fsPromises = require('fs/promises');
const chokidar = require('chokidar');
const fs = require('node:fs');
const path = require('node:path');

const { Client, Collection, Events, GatewayIntentBits, VoiceChannel, ChannelType } = require('discord.js');
const { Channel } = require('diagnostics_channel');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers] });

const MAGIC_CATEGORY_NAME = "Auto Voice";
const CHANNEL_NAMES_FILE = "/etc/bananabot/channel_names";

let channelNames = [
    'Chicken Dinner',
    'Eisen 2',
    'ezpz',
    'Holzauge',
    'Inting',
    'Jeeeeenkins!!',
    'Leeeeeroy...!',
    'Monkey Mode',
    'Need boost!',
    'Olympisch Weitwurf',
    'Road to Pochinki',
    'Sir Feed-a-lot',
    'Sweating',
    'Voicy McVoiceface',
];



chokidar.watch(CHANNEL_NAMES_FILE, { awaitWritefinish: true }).on('all', (event, path) => {
    setChannelNamesFromFile(path);
});


let managedCategories_ = [];
client.once(Events.ClientReady, async client => {
    initialize(client);
});

client.on(Events.GuildCreate, async guild => {
    console.log(`ROOT: Joined guild ${guild.name}`);
    initializeGuild(guild);
});

client.on(Events.GuildDelete, async guild => {
    console.log(`ROOT: Left guild ${guild.name}`);
    delete managedCategories_[guild];
});

client.on(Events.VoiceStateUpdate, async (before, after) => {
    let guild;
    if (before.channel != null && managedCategories_[after.guild] == before.channel.parent) {
        guild = before.guild;
        console.log(`Guild ${guild.name}: User ${before.member.user.username} left ${before.channel.name}.`);
    } else if (after.channel != null && managedCategories_[after.guild] == after.channel.parent) {
        guild = after.guild;
        console.log(`Guild ${guild.name}: User ${before.member.user.username} joined ${after.channel.name}!`);
    }

    if (guild != null) {
        reconcileChannels(after.guild, managedCategories_[guild]);
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

async function createVoiceChannel(guild, parent) {
    let new_channel_name = `${channelNames[Math.floor(channelNames.length * Math.random())]}`;
    console.log(`Guild ${guild.name}: Creating new channel ${new_channel_name}..`);
    return await guild.channels.create({
        name: new_channel_name,
        type: ChannelType.GuildVoice,
        parent: parent
    });

}

async function initialize(client) {
    console.log(`ROOT: Logged in as ${client.user.tag}!`);
    console.log(`ROOT: Bot is member of ${client.guilds.cache.size} guilds.`);
    let channelsPerGuild_ = [];
    client.guilds.cache.forEach(guild => {
        initializeGuild(guild);
        channelsPerGuild_[guild] = 0;
    });

    console.log("ROOT: Initialization complete!");
}

async function initializeGuild(guild) {
    console.log(`Guild ${guild.name}: Initializing...`);

    let magic_categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory && c.name === MAGIC_CATEGORY_NAME);
    let magic_category;
    if (magic_categories.size >= 1) {
        magic_category = magic_categories.first();
        console.log(`Guild ${guild.name}: Magic category found!`);
    } else {
        console.log(`Guild ${guild.name}: Creating Magic category...`);
        magic_category = await guild.channels.create({
            name: MAGIC_CATEGORY_NAME,
            type: ChannelType.GuildCategory
        });
    }

    managedCategories_[guild] = magic_category;

    reconcileChannels(guild, magic_category);

    console.log(`Guild ${guild.name}: Initialization complete!`);

}

async function reconcileChannels(guild, magic_category) {
    console.log(`Guild ${guild.name}: Reconciling channels...`);
    let children_channels = magic_category.children.cache.filter(c => c.type === ChannelType.GuildVoice);
    let empty_channels = children_channels.filter(c => c.members.size == 0);
    if (empty_channels.size == 0) {
        createVoiceChannel(guild, magic_category);
    } else if (empty_channels.size > 1) {
        let survivor = empty_channels.random();
        console.log(`Guild ${guild.name}: Too many empty channels! Keeping only ${survivor.name} (ID: ${survivor.id})..`);
        empty_channels.sweep(c => c == survivor);
        empty_channels.forEach(async c => {
            console.log(`Guild ${guild.name}: Deleting channel ${c.name} (ID: ${c.id}...`);
            c.delete();
        });
    }
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

client.login(process.env.DISCORD_TOKEN).then(
    () => {
        console.log("ROOT: Login successful.");
    },
    (err) => {
        console.error(`ROOT: Login failed with error: ${err}`);
    }
);

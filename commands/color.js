const { SlashCommandBuilder } = require('discord.js');
const { colornames } = require("../lib/colornames.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('color')
		.setDescription('Grants a role with a specific color!')
		.addStringOption(
			option =>
				option.setName('color').setDescription('The color as hex code')
		)
		.setDMPermission(false),
	async execute(interaction) {
		let existingRoles = [];
		color = interaction.options.getString('color')?.toLowerCase() ?? '';
		discordUser = `${interaction.member.user.username}#${interaction.member.user.discriminator}`;

		console.debug(`Request: ${color} for ${discordUser}`);

		if (color in colornames) {
			console.debug(`Color ${color} found in color names`);
			color = colornames[color]
		}

		color = color.replace("#", "");

		if (color.length === 0) {
			removeColorRolesFromMember(interaction.member);
			await interaction.reply(`Removed color roles.`);
			return;
		}

		if (!/^[0-9a-f]{6}$/.test(color)) {
			await interaction.reply(`Invalid hex code ${color} :(`);
			return;
		}

		guild = interaction.guild;
		rolemanager = guild.roles;
		removeColorRolesFromMember(interaction.member);
		rolemanager.fetch().then(roles => {
			existingRoles = roles.filter(role => {
				return role.name.startsWith('[BB]') && role.color === parseInt(color, 16);
			});
			if (existingRoles.size === 1) {
				targetRole = existingRoles.first();
				console.log(`Found existing role ${targetRole.name}`);
				interaction.member.roles.add(targetRole);
			} else if (existingRoles.size === 0) {
				interaction.guild.roles.create({
					name: `[BB] - ${color}`,
					color: color
				}).then(
					role => {
						console.log(`Created role ${role.name}.`);
						interaction.member.roles.add(role);
					}
				);
			}


		});

		await interaction.reply(`Set color roles.`);
	},
};

async function removeColorRolesFromMember(member) {
	member.roles.cache.forEach(role => {
		if (role.name.startsWith('[BB]')) {
			member.guild.roles.fetch(role.id).then(role => {
				if (role.members.size === 1) {
					console.log(`Role ${role.name} will be deleted.`);
					role.delete();
				} else {
					member.roles.remove(role);
				}
			});
		}
	});
}

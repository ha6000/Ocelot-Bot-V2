const config = require('../config.json');

const os = require('os');

const hastebin = require('hastebin');

const discord = require('discord.js');
const client = new discord.Client();

const noblox = require('noblox.js');
const Doblox = require('doblox');
const dobloxClient = new Doblox(noblox, client);

const roles = noblox.getRoles(config.groupid);

function getRole(name, roles) {
	return Promise.resolve()
		.then(() => {
			return roles.cache.find(r => r.name == name) || roles.create(name);
		});
}

function checkMember(member) {
	return roles
		.then(roles => {
			dobloxClient.getRankInGroup(member.id, config.groupid)
				.then(rank => {
					const newRoles = member.roles.cache.map(role => {
						return role.name == rank || !roles.includes(role.name);
					});
					if (newRoles.size != member.roles.size) {
						member.roles.set(newRoles)
							.then(() => {
								getRole(rank, member.guild.roles)
									.then(role => {
										member.roles.add(role);
									});
							});
					}
				});
		});
}

function checkMembers(members) {
	const accumalation = [];
	members.each(member => accumalation.push(checkMember(member)));
	return Promise.all(accumalation);
}

client.on('ready', () => {
	console.log('Bot started');
	const logChannel = client.channels.cache.get(config.logchannel);
	const startedEmbed = new discord.MessageEmbed({
		title: `**${client.user.tag}** started`,
		description: `_${os.hostname()} - ${os.platform()}_`
	}).setColor('GREEN');
	logChannel.send(startedEmbed);
	process.on('unhandledRejection', (err) => {
		process.emit('uncaughtExceptionMonitor', err, 'unhandledRejection');
	});
	process.on('uncaughtExceptionMonitor', async (err, origin) => {
		console.error(err);
		if (err.stack.length > 2000) {
			var stack = await hastebin.createPaste(err.stack);
		} else {
			var stack = '```' + err.stack + '```';
		}
		const errorEmbed = new discord.MessageEmbed({
			title: `**${err.name}**`,
			description: stack
		}).setColor('RED');
		logChannel.send(errorEmbed);
	});
	const server = client.guilds.cache.get(config.serverid);
	checkMembers(server.members.cache);
})

client.login(config.token);
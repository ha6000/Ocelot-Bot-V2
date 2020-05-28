const config = require('../config.json');

const os = require('os');

const hastebin = require('hastebin');

const discord = require('discord.js');
const client = new discord.Client();

const noblox = require('noblox.js');
const doblox = require('doblox');
const dobloxClient = new doblox.Client(noblox, client);

const roles = noblox.getRoles(config.groupid).then(r => r.map(role => role.name));

var ready = new Promise((resolve, reject) => {
	client.once('ready', () => {
		resolve();
	});
});

var logChannel;

function log(message) {
	return ready
	.then(() => {
		logChannel.send(message);
	});
}

function getRole(name, roles) {
	return Promise.resolve()
		.then(() => {
			var role = roles.cache.find(r => r.name == name);
			if (role) {
				return role;
			} else {
				log(new discord.MessageEmbed({
					title: 'Creating role',
					description: 'Role created named `' + name + '`'
				}).setColor('PURPLE'));
				return roles.create({data: {name}});
			}
		});
}

function checkMember(member) {
	return roles
		.then(roles => {
			return dobloxClient.getRoleInGroup(member, config.groupid)
				.then(rank => {
					const newRoles = member.roles.cache.filter(role => {
						return role.name == rank || !roles.includes(role.name);
					});
					if (newRoles.size != member.roles.cache.size || !newRoles.some(r => r.name == rank)) {
						log(new discord.MessageEmbed({
							title: 'Updating Roles',
							description: `Updates roles for **${member.user.username}**`
						}).setColor('BLUE'));
						return getRole(rank, member.guild.roles)
							.then(role => {
								newRoles.set(role.id, role);
								return member.roles.set(newRoles);
							})
					}
				})
				.catch(error => {
					if (error.errno == 0) return undefined;
					return Promise.reject(error)
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
	logChannel = client.channels.cache.get(config.logchannel);
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
	setInterval(checkMembers.bind({}, server.members.cache), 5 * 60 * 1000);
});

client.login(config.token);
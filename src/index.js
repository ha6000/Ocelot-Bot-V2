const config = require('../config.json');
const nicknames = require('../nicknames.json');

const os = require('os');

const hastebin = require('hastebin');

const discord = require('discord.js');
const client = new discord.Client();

const noblox = require('noblox.js');
const Doblox = require('doblox');
const doblox = new Doblox.Client(noblox, client, {
	provider: 'bloxlink'
});

var ready = new Promise((resolve, reject) => {
	client.once('ready', () => {
		resolve();
	});
});

var logChannel;
var server;

// sends message in log channel.
function log(message) {
	return ready
	.then(() => {
		logChannel.send(message);
	});
}

// Finds role by name and makes sure it exists.
async function getRole(name, roles) {
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
}

async function updateMember(roles, member) {
	let player;

	try {
		player = await doblox.getRobloxUser(member, false, {
			guild: true
		});
	}
	catch(err) {
		console.error(err);
		return log(new discord.MessageEmbed({
			title: 'User skipped',
			description: `**${member.displayName}** was skipped because **${err.message}** error occured`
		}).setColor('BLUE'));
	}

	if (!player) return log(new discord.MessageEmbed({
		title: 'User skipped',
		description: `User skipped that is not linked **${member.displayName}**`
	}).setColor('BLUE'));

	let rank;

	try {
		rank = await noblox.getRankNameInGroup(config.groupid, player.id)
	}
	catch(err) {
		if (err.errno == 0) return;
	}

	if (typeof rank != 'string') {
		console.error(rank);
		return;
	}

	const acronym = nicknames[rank];

	if (acronym) {
		const nickname = `[${acronym}] ${player.username}`;

		if (member.displayName != nickname) await member.setNickname(nickname).catch(() => {});
	}

	const newRoles = member.roles.cache.filter(role => {
		return role.name == rank || !roles.includes(role.name);
	});
	if (newRoles.size != member.roles.cache.size || !newRoles.some(r => r.name == rank)) {

		log(new discord.MessageEmbed({
			title: 'Updating Roles',
			description: `Updating roles for **${member.displayName}**`
		}).setColor('BLUE'));

		const role = await getRole(rank, member.guild.roles);

		newRoles.set(role.id, role);
		
		return member.roles.set(newRoles);
	}
}

async function updateMembers(members) {
	const roles = await noblox.getRoles(config.groupid).then(r => r.map(role => role.name));

	members = members.filter(m => !m.user.bot).array();

	for (var i = 0; i < members.length; i++) {
		const member = members[i];

		await updateMember(roles, member);
	}
}

function error(err) {
	const errorEmbed = new discord.MessageEmbed({
		title: 'Error occured',
		description: `**${err.message}**`
	}).setColor('RED');

	log(errorEmbed)
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
		error(err);
	});

	server = client.guilds.cache.get(config.serverid);

	updateMembers(server.members.cache);

	setInterval(updateMembers.bind({}, server.members.cache), config.interval || 15 * 60 * 1000);
});

client.on('message', async (message) => {
	if (message.author.bot) return;
	if (message.content == '!refresh') {
		if (!message.member.permissions.has('ADMINISTRATOR')) return message.channel.send('You do not have permissons');
		const alertMessage = await message.channel.send('Checking for changes');
		try {
			await updateMembers(server.members.cache);
		}
		catch(err) {
			console.error(err);
			alertMessage.edit('Failed checking for changes');
		}

		alertMessage.edit('Succesfully updated roles');
	}
});

client.login(config.token);
noblox.setCookie(config.cookie);
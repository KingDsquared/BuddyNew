require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");

const WELCOME_CHANNEL_NAME = "welcome";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.on("ready", () => {
  console.log("BuddyNew is online as " + client.user.tag);
});

client.on("guildMemberAdd", (member) => {
  const channel = member.guild.channels.cache.find(
    ch => ch.name === WELCOME_CHANNEL_NAME
  );

  if (!channel) return;

  channel.send(
    `Welcome ${member} to **${member.guild.name}**! 👋\n\n` +
    `Please read the rules, introduce yourself, and have fun.\n\n` +
    `Start here:\n` +
    `1. Read the rules\n` +
    `2. Pick your roles if the server has role channels\n` +
    `3. Say hello in chat\n` +
    `4. Ask staff if you need help`
  );
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  const msg = message.content.toLowerCase();

  if (msg === "!ping") {
    message.reply("Pong!");
  }

  if (msg === "!help") {
    message.reply("Commands: `!ping`, `!help`, `!welcome-test`");
  }

  if (msg === "!welcome-test") {
    message.channel.send(
      `Welcome ${message.author} to **${message.guild.name}**! 👋\n\n` +
      `Please read the rules, introduce yourself, and have fun.`
    );
  }
});

client.login(process.env.DISCORD_TOKEN);

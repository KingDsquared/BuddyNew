require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");

const WELCOME_CHANNEL_NAME = "welcome";

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("ERROR: DISCORD_TOKEN is missing in Railway Variables.");
  process.exit(1);
}

console.log("Token exists:", true);
console.log("Token length:", token.length);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("ready", () => {
  console.log("BuddyNew is online as " + client.user.tag);
});

client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.find(
    ch => ch.name === WELCOME_CHANNEL_NAME && ch.isTextBased()
  );

  if (!channel) {
    console.log(`No #${WELCOME_CHANNEL_NAME} channel found in ${member.guild.name}`);
    return;
  }

  try {
    await channel.send(
      `Welcome ${member} to **${member.guild.name}**! 👋\n\n` +
      `Please read the rules, introduce yourself, and have fun.\n\n` +
      `Start here:\n` +
      `1. Read the rules\n` +
      `2. Pick your roles if the server has role channels\n` +
      `3. Say hello in chat\n` +
      `4. Ask staff if you need help`
    );
  } catch (error) {
    console.error("Could not send welcome message:", error);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const msg = message.content.toLowerCase();

  if (msg === "!ping") {
    await message.reply("Pong!");
  }

  if (msg === "!help") {
    await message.reply("Commands: `!ping`, `!help`, `!welcome-test`");
  }

  if (msg === "!welcome-test") {
    await message.channel.send(
      `Welcome ${message.author} to **${message.guild.name}**! 👋\n\n` +
      `Please read the rules, introduce yourself, and have fun.`
    );
  }
});

client.login(token);

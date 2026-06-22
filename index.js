require("dotenv").config();

const fs = require("fs");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

const WELCOME_CHANNEL_NAME = "welcome";
const LEVELS_FILE = "./levels.json";

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("ERROR: DISCORD_TOKEN is missing in Railway Variables.");
  process.exit(1);
}

let levels = {};

if (fs.existsSync(LEVELS_FILE)) {
  levels = JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8"));
}

function saveLevels() {
  fs.writeFileSync(LEVELS_FILE, JSON.stringify(levels, null, 2));
}

function getNeededXp(level) {
  return level * 100;
}

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

  if (!channel) return;

  const welcomeEmbed = new EmbedBuilder()
    .setTitle("👋 Welcome to the server!")
    .setDescription(
      `Welcome ${member} to **${member.guild.name}**!\n\n` +
      `We’re happy to have you here. Make sure to read the rules and say hello!`
    )
    .addFields(
      { name: "📌 Start here", value: "Read the rules and check the important channels." },
      { name: "🎭 Roles", value: "Pick your roles if the server has role channels." },
      { name: "💬 Chat", value: "Introduce yourself and have fun!" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setColor(0x5865F2)
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();

  try {
    await channel.send({ content: `${member}`, embeds: [welcomeEmbed] });
  } catch (error) {
    console.error("Could not send welcome message:", error);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const msg = message.content.toLowerCase();

  // XP SYSTEM
  const userId = message.author.id;

  if (!levels[userId]) {
    levels[userId] = {
      xp: 0,
      level: 1
    };
  }

  const xpGain = Math.floor(Math.random() * 10) + 5;
  levels[userId].xp += xpGain;

  const neededXp = getNeededXp(levels[userId].level);

  if (levels[userId].xp >= neededXp) {
    levels[userId].xp -= neededXp;
    levels[userId].level += 1;

    const levelEmbed = new EmbedBuilder()
      .setTitle("🎉 Level Up!")
      .setDescription(`${message.author} reached **Level ${levels[userId].level}**!`)
      .setColor(0x57F287)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    await message.channel.send({ embeds: [levelEmbed] });
  }

  saveLevels();

  // COMMANDS
  if (msg === "!ping") {
    await message.reply("Pong!");
  }

  if (msg === "!help") {
    await message.reply(
      "Commands: `!ping`, `!help`, `!welcome-test`, `!level`, `!rank`, `!leaderboard`"
    );
  }

  if (msg === "!welcome-test") {
    const testEmbed = new EmbedBuilder()
      .setTitle("👋 Welcome to the server!")
      .setDescription(
        `Welcome ${message.author} to **${message.guild.name}**!\n\n` +
        `We’re happy to have you here. Make sure to read the rules and say hello!`
      )
      .addFields(
        { name: "📌 Start here", value: "Read the rules and check the important channels." },
        { name: "🎭 Roles", value: "Pick your roles if the server has role channels." },
        { name: "💬 Chat", value: "Introduce yourself and have fun!" }
      )
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setColor(0x5865F2)
      .setTimestamp();

    await message.channel.send({ embeds: [testEmbed] });
  }

  if (msg === "!level" || msg === "!rank") {
    const userLevel = levels[userId];

    const rankEmbed = new EmbedBuilder()
      .setTitle("⭐ Your Level")
      .setDescription(
        `${message.author}, you are **Level ${userLevel.level}**.\n\n` +
        `XP: **${userLevel.xp}/${getNeededXp(userLevel.level)}**`
      )
      .setColor(0xFEE75C)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

    await message.reply({ embeds: [rankEmbed] });
  }

  if (msg === "!leaderboard") {
    const sorted = Object.entries(levels)
      .sort((a, b) => {
        if (b[1].level === a[1].level) return b[1].xp - a[1].xp;
        return b[1].level - a[1].level;
      })
      .slice(0, 10);

    if (sorted.length === 0) {
      await message.reply("No XP data yet.");
      return;
    }

    const leaderboard = sorted
      .map(([id, data], index) => {
        return `**${index + 1}.** <@${id}> — Level ${data.level}, ${data.xp} XP`;
      })
      .join("\n");

    const leaderboardEmbed = new EmbedBuilder()
      .setTitle("🏆 Server Leaderboard")
      .setDescription(leaderboard)
      .setColor(0xEB459E)
      .setTimestamp();

    await message.channel.send({ embeds: [leaderboardEmbed] });
  }
});

client.login(token);

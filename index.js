require("dotenv").config();

const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require("discord.js");

const WELCOME_CHANNEL_NAME = "welcome";
const REVIEW_CHANNEL_NAME = "build-review";
const OFFICER_ROLE_NAME = "Officer";

const LEVELS_FILE = "./levels.json";
const BUILDS_FILE = "./builds.json";

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("ERROR: DISCORD_TOKEN is missing.");
  process.exit(1);
}

let levels = fs.existsSync(LEVELS_FILE)
  ? JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8"))
  : {};

let builds = fs.existsSync(BUILDS_FILE)
  ? JSON.parse(fs.readFileSync(BUILDS_FILE, "utf8"))
  : {};

function saveLevels() {
  fs.writeFileSync(LEVELS_FILE, JSON.stringify(levels, null, 2));
}

function saveBuilds() {
  fs.writeFileSync(BUILDS_FILE, JSON.stringify(builds, null, 2));
}

function getNeededXp(level) {
  return level * 100;
}

function isValidPoeProfile(url) {
  return (
    url.startsWith("https://www.pathofexile.com/account/view-profile/") ||
    url.startsWith("https://pathofexile.com/account/view-profile/")
  );
}

function isValidPobLink(url) {
  return (
    url.startsWith("https://pobb.in/") ||
    url.startsWith("https://pastebin.com/") ||
    url.startsWith("https://poe.ninja/")
  );
}

function memberIsOfficer(member) {
  return member.roles.cache.some(role => role.name === OFFICER_ROLE_NAME);
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
  console.log("BuddyNew v3 is online as " + client.user.tag);
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
      "Please read the rules, introduce yourself, and have fun."
    )
    .addFields(
      { name: "📌 Start here", value: "Read the rules and check important channels." },
      { name: "🎭 Roles", value: "Pick your roles if the server has role channels." },
      { name: "💬 Chat", value: "Say hello and enjoy the server!" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setColor(0x5865F2)
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();

  await channel.send({ content: `${member}`, embeds: [welcomeEmbed] });
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const msg = message.content.toLowerCase();
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();
  const userId = message.author.id;

  // XP SYSTEM
  if (!levels[userId]) {
    levels[userId] = { xp: 0, level: 1 };
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

  if (msg === "!ping") {
    await message.reply("Pong!");
  }

  if (msg === "!help") {
    await message.reply(
      "Commands: `!ping`, `!help`, `!welcome-test`, `!level`, `!rank`, `!leaderboard`, `!poe`, `!submitbuild <poe-profile-link> <pob-link>`, `!mybuild`, `!builds`"
    );
  }

  if (msg === "!welcome-test") {
    const testEmbed = new EmbedBuilder()
      .setTitle("👋 Welcome to the server!")
      .setDescription(
        `Welcome ${message.author} to **${message.guild.name}**!\n\n` +
        "Please read the rules, introduce yourself, and have fun."
      )
      .setColor(0x5865F2)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    await message.channel.send({ embeds: [testEmbed] });
  }

  if (msg === "!level" || msg === "!rank") {
    const rankEmbed = new EmbedBuilder()
      .setTitle("⭐ Your Level")
      .setDescription(
        `${message.author}, you are **Level ${levels[userId].level}**.\n\n` +
        `XP: **${levels[userId].xp}/${getNeededXp(levels[userId].level)}**`
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

    const leaderboard = sorted
      .map(([id, data], index) => {
        return `**${index + 1}.** <@${id}> — Level ${data.level}, ${data.xp} XP`;
      })
      .join("\n");

    const leaderboardEmbed = new EmbedBuilder()
      .setTitle("🏆 Server Leaderboard")
      .setDescription(leaderboard || "No XP data yet.")
      .setColor(0xEB459E)
      .setTimestamp();

    await message.channel.send({ embeds: [leaderboardEmbed] });
  }

  if (msg === "!poe" || msg === "!poeprofile") {
    const poeEmbed = new EmbedBuilder()
      .setTitle("🔗 Make your Path of Exile profile public")
      .setDescription(
        "To make your PoE profile public:\n\n" +
        "1. Log in to the Path of Exile website\n" +
        "2. Open your privacy settings\n" +
        "3. Turn OFF profile privacy\n" +
        "4. Save changes\n\n" +
        "[Open Path of Exile Privacy Settings](https://www.pathofexile.com/my-account/privacy)"
      )
      .setColor(0xAF6025)
      .setFooter({ text: "Needed for build/profile review" });

    await message.reply({ embeds: [poeEmbed] });
  }

  // SUBMIT BUILD
  if (command === "!submitbuild") {
    const poeProfileLink = args[1];
    const pobLink = args[2];

    if (!poeProfileLink || !pobLink) {
      await message.reply(
        "Use: `!submitbuild <poe-profile-link> <pob-link>`\n\n" +
        "Example:\n" +
        "`!submitbuild https://www.pathofexile.com/account/view-profile/YOURNAME https://pobb.in/YOURBUILD`"
      );
      return;
    }

    if (!isValidPoeProfile(poeProfileLink)) {
      await message.reply(
        "That does not look like a valid Path of Exile profile link.\nUse:\n`https://www.pathofexile.com/account/view-profile/YOURNAME`"
      );
      return;
    }

    if (!isValidPobLink(pobLink)) {
      await message.reply(
        "That does not look like a valid PoB/build link.\nAccepted links:\n`https://pobb.in/...`\n`https://pastebin.com/...`\n`https://poe.ninja/...`"
      );
      return;
    }

    builds[userId] = {
      username: message.author.tag,
      userId: userId,
      poeProfile: poeProfileLink,
      pobLink: pobLink,
      status: "Pending Review",
      submittedAt: new Date().toISOString(),
      reviewedBy: null,
      reviewNote: null
    };

    saveBuilds();

    const reviewChannel = message.guild.channels.cache.find(
      ch => ch.name === REVIEW_CHANNEL_NAME && ch.isTextBased()
    );

    if (!reviewChannel) {
      await message.reply(
        `Build saved, but I could not find a #${REVIEW_CHANNEL_NAME} channel.`
      );
      return;
    }

    const submitEmbed = new EmbedBuilder()
      .setTitle("📥 New PoE Build Submission")
      .setDescription(`${message.author} submitted a build for officer review.`)
      .addFields(
        { name: "User", value: `${message.author}`, inline: true },
        { name: "Status", value: "Pending Review", inline: true },
        { name: "PoE Profile", value: `[Open Profile](${poeProfileLink})` },
        { name: "PoB / Build Link", value: `[Open Build](${pobLink})` }
      )
      .setColor(0xFEE75C)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: "Officers can approve or deny using the buttons below." })
      .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approvebuild_${userId}`)
        .setLabel("Approve Build")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`denybuild_${userId}`)
        .setLabel("Deny Build")
        .setStyle(ButtonStyle.Danger)
    );

    await reviewChannel.send({
      embeds: [submitEmbed],
      components: [buttons]
    });

    await message.reply("Your PoE build has been submitted for officer review.");
  }

  if (msg === "!mybuild") {
    const build = builds[userId];

    if (!build) {
      await message.reply("You have not submitted a build yet. Use `!submitbuild <poe-profile-link> <pob-link>`.");
      return;
    }

    const buildEmbed = new EmbedBuilder()
      .setTitle("📄 Your PoE Build Submission")
      .addFields(
        { name: "Status", value: build.status },
        { name: "PoE Profile", value: `[Open Profile](${build.poeProfile})` },
        { name: "PoB / Build", value: `[Open Build](${build.pobLink})` },
        { name: "Review Note", value: build.reviewNote || "No note yet." }
      )
      .setColor(
        build.status === "Approved" ? 0x57F287 :
        build.status === "Denied" ? 0xED4245 :
        0xFEE75C
      )
      .setTimestamp();

    await message.reply({ embeds: [buildEmbed] });
  }

  if (msg === "!builds") {
    if (!memberIsOfficer(message.member)) {
      await message.reply("Only officers can use this command.");
      return;
    }

    const entries = Object.entries(builds);

    if (entries.length === 0) {
      await message.reply("No build submissions yet.");
      return;
    }

    const list = entries
      .map(([id, data], index) => {
        return `**${index + 1}.** <@${id}> — **${data.status}** — [Profile](${data.poeProfile}) — [Build](${data.pobLink})`;
      })
      .join("\n");

    const buildsEmbed = new EmbedBuilder()
      .setTitle("📋 PoE Build Submissions")
      .setDescription(list)
      .setColor(0x5865F2)
      .setTimestamp();

    await message.channel.send({ embeds: [buildsEmbed] });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, targetUserId] = interaction.customId.split("_");

  if (!["approvebuild", "denybuild"].includes(action)) return;

  if (!memberIsOfficer(interaction.member)) {
    await interaction.reply({
      content: "Only officers can use these buttons.",
      ephemeral: true
    });
    return;
  }

  const build = builds[targetUserId];

  if (!build) {
    await interaction.reply({
      content: "This user has no saved build submission.",
      ephemeral: true
    });
    return;
  }

  if (build.status !== "Pending Review") {
    await interaction.reply({
      content: `This build is already marked as ${build.status}.`,
      ephemeral: true
    });
    return;
  }

  if (action === "approvebuild") {
    build.status = "Approved";
    build.reviewedBy = interaction.user.tag;
    build.reviewNote = "Approved by officer.";
  }

  if (action === "denybuild") {
    build.status = "Denied";
    build.reviewedBy = interaction.user.tag;
    build.reviewNote = "Denied by officer.";
  }

  saveBuilds();

  const statusText = action === "approvebuild" ? "✅ Approved" : "❌ Denied";
  const statusColor = action === "approvebuild" ? 0x57F287 : 0xED4245;

  const updatedEmbed = new EmbedBuilder()
    .setTitle(`${statusText} PoE Build Submission`)
    .setDescription(`Build for <@${targetUserId}> was reviewed by ${interaction.user}.`)
    .addFields(
      { name: "Status", value: build.status, inline: true },
      { name: "Reviewed By", value: interaction.user.tag, inline: true },
      { name: "PoE Profile", value: `[Open Profile](${build.poeProfile})` },
      { name: "PoB / Build", value: `[Open Build](${build.pobLink})` }
    )
    .setColor(statusColor)
    .setTimestamp();

  await interaction.update({
    embeds: [updatedEmbed],
    components: []
  });

  try {
    const user = await client.users.fetch(targetUserId);
    await user.send(
      `Your Path of Exile build was **${build.status}** by ${interaction.user.tag}.\n\n` +
      `PoE Profile: ${build.poeProfile}\n` +
      `PoB / Build: ${build.pobLink}`
    );
  } catch (error) {
    console.log("Could not DM reviewed user.");
  }
});

client.login(token);

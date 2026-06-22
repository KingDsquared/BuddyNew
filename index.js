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
const GUILD_INVITE_CHANNEL_NAME = "guild-invite";

const OFFICER_ROLE_NAME = "Officer";
const APPROVED_ROLE_NAME = "member";

const LEVELS_FILE = "./levels.json";
const PROFILES_FILE = "./profiles.json";

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("ERROR: DISCORD_TOKEN is missing.");
  process.exit(1);
}

let levels = fs.existsSync(LEVELS_FILE)
  ? JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8"))
  : {};

let profiles = fs.existsSync(PROFILES_FILE)
  ? JSON.parse(fs.readFileSync(PROFILES_FILE, "utf8"))
  : {};

function saveLevels() {
  fs.writeFileSync(LEVELS_FILE, JSON.stringify(levels, null, 2));
}

function saveProfiles() {
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
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

function memberIsOfficer(member) {
  return member.roles.cache.some(
    role => role.name.toLowerCase() === OFFICER_ROLE_NAME.toLowerCase()
  );
}

async function sendGuildInviteQuestion(guild, userId) {
  const channel = guild.channels.cache.find(
    ch => ch.name === GUILD_INVITE_CHANNEL_NAME && ch.isTextBased()
  );

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("⚔️ Choose Your Ingame Guild")
    .setDescription(
      `<@${userId}>, your profile has been approved!\n\n` +
      "Which ingame guild do you want to join?"
    )
    .addFields(
      { name: "Path of Exile 1", value: "Click the PoE 1 button.", inline: true },
      { name: "Path of Exile 2", value: "Click the PoE 2 button.", inline: true }
    )
    .setColor(0xAF6025)
    .setTimestamp();

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`guildchoice_poe1_${userId}`)
      .setLabel("Path of Exile 1")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`guildchoice_poe2_${userId}`)
      .setLabel("Path of Exile 2")
      .setStyle(ButtonStyle.Success)
  );

  await channel.send({
    content: `<@${userId}>`,
    embeds: [embed],
    components: [buttons]
  });
}

async function sendOfficerInviteTracking(guild, userId, choiceName) {
  const channel = guild.channels.cache.find(
    ch => ch.name === GUILD_INVITE_CHANNEL_NAME && ch.isTextBased()
  );

  if (!channel) return;

  const profile = profiles[userId];

  const embed = new EmbedBuilder()
    .setTitle("📨 Officer Invite Tracking")
    .setDescription(`<@${userId}> wants to join **${choiceName}**.`)
    .addFields(
      { name: "PoE Profile", value: profile?.link ? `[Open Profile](${profile.link})` : "No profile found." },
      { name: "Invite Status", value: "Waiting for officer invite." }
    )
    .setColor(0xFEE75C)
    .setTimestamp();

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`invitedpoe1_${userId}`)
      .setLabel("Invited to PoE1")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`invitedpoe2_${userId}`)
      .setLabel("Invited to PoE2")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`inviteddone_${userId}`)
      .setLabel("Done")
      .setStyle(ButtonStyle.Secondary)
  );

  await channel.send({
    embeds: [embed],
    components: [buttons]
  });
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

  if (!levels[userId]) levels[userId] = { xp: 0, level: 1 };

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

  if (msg === "!ping") await message.reply("Pong!");

  if (msg === "!help") {
    await message.reply(
      "Commands: `!ping`, `!help`, `!welcome-test`, `!level`, `!rank`, `!leaderboard`, `!poe`, `!submitprofile <poe-profile-link>`, `!myprofile`, `!profiles`"
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
      .setFooter({ text: "Needed for profile review" });

    await message.reply({ embeds: [poeEmbed] });
  }

  if (command === "!submitprofile") {
    const profileLink = args[1];

    if (!profileLink) {
      await message.reply(
        "Use: `!submitprofile https://www.pathofexile.com/account/view-profile/YOURNAME`"
      );
      return;
    }

    if (!isValidPoeProfile(profileLink)) {
      await message.reply(
        "That does not look like a valid Path of Exile profile link.\nUse:\n`https://www.pathofexile.com/account/view-profile/YOURNAME`"
      );
      return;
    }

    profiles[userId] = {
      username: message.author.tag,
      userId,
      link: profileLink,
      status: "Pending Review",
      submittedAt: new Date().toISOString(),
      reviewedBy: null,
      reviewNote: null,
      guildChoice: null,
      inviteStatus: "Not invited yet",
      invitedBy: null,
      inviteCompletedAt: null
    };

    saveProfiles();

    const reviewChannel = message.guild.channels.cache.find(
      ch => ch.name === REVIEW_CHANNEL_NAME && ch.isTextBased()
    );

    if (!reviewChannel) {
      await message.reply(`Profile saved, but I could not find #${REVIEW_CHANNEL_NAME}.`);
      return;
    }

    const submitEmbed = new EmbedBuilder()
      .setTitle("📥 New PoE Profile Submission")
      .setDescription(`${message.author} submitted a Path of Exile profile for review.`)
      .addFields(
        { name: "User", value: `${message.author}`, inline: true },
        { name: "Status", value: "Pending Review", inline: true },
        { name: "PoE Profile", value: `[Open Profile](${profileLink})` }
      )
      .setColor(0xFEE75C)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: "Officers can approve or deny using the buttons below." })
      .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approveprofile_${userId}`)
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`denyprofile_${userId}`)
        .setLabel("Deny")
        .setStyle(ButtonStyle.Danger)
    );

    await reviewChannel.send({ embeds: [submitEmbed], components: [buttons] });
    await message.reply("Your PoE profile has been submitted for officer review.");
  }

  if (msg === "!myprofile") {
    const profile = profiles[userId];

    if (!profile) {
      await message.reply("You have not submitted a PoE profile yet. Use `!submitprofile <link>`.");
      return;
    }

    const profileEmbed = new EmbedBuilder()
      .setTitle("📄 Your PoE Profile Submission")
      .addFields(
        { name: "Status", value: profile.status || "Unknown" },
        { name: "PoE Profile", value: `[Open Profile](${profile.link})` },
        { name: "Guild Choice", value: profile.guildChoice || "Not selected yet." },
        { name: "Invite Status", value: profile.inviteStatus || "Not invited yet." },
        { name: "Review Note", value: profile.reviewNote || "No note yet." }
      )
      .setColor(
        profile.status === "Approved" ? 0x57F287 :
        profile.status === "Denied" ? 0xED4245 :
        0xFEE75C
      )
      .setTimestamp();

    await message.reply({ embeds: [profileEmbed] });
  }

  if (msg === "!profiles") {
    if (!memberIsOfficer(message.member)) {
      await message.reply("Only officers can use this command.");
      return;
    }

    const entries = Object.entries(profiles);

    if (entries.length === 0) {
      await message.reply("No profile submissions yet.");
      return;
    }

    const list = entries
      .map(([id, data], index) => {
        return `**${index + 1}.** <@${id}> — **${data.status}** — ${data.guildChoice || "No guild choice"} — ${data.inviteStatus || "Not invited yet"} — [Profile](${data.link})`;
      })
      .join("\n");

    const profilesEmbed = new EmbedBuilder()
      .setTitle("📋 PoE Profile Submissions")
      .setDescription(list)
      .setColor(0x5865F2)
      .setTimestamp();

    await message.channel.send({ embeds: [profilesEmbed] });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const parts = interaction.customId.split("_");
  const action = parts[0];

  if (action === "approveprofile" || action === "denyprofile") {
    const targetUserId = parts[1];

    if (!memberIsOfficer(interaction.member)) {
      await interaction.reply({ content: "Only officers can use these buttons.", ephemeral: true });
      return;
    }

    const profile = profiles[targetUserId];

    if (!profile) {
      await interaction.reply({ content: "This user has no saved profile submission.", ephemeral: true });
      return;
    }

    if (profile.status !== "Pending Review") {
      await interaction.reply({
        content: `This profile is already marked as ${profile.status}.`,
        ephemeral: true
      });
      return;
    }

    let roleMessage = "";

    if (action === "approveprofile") {
      profile.status = "Approved";
      profile.reviewedBy = interaction.user.tag;
      profile.reviewNote = "Approved by officer.";

      try {
        const guildMember = await interaction.guild.members.fetch(targetUserId);
        const approvedRole = interaction.guild.roles.cache.find(
          role => role.name.toLowerCase() === APPROVED_ROLE_NAME.toLowerCase()
        );

        if (approvedRole) {
          await guildMember.roles.add(approvedRole);
          roleMessage = `\nRole given: **${APPROVED_ROLE_NAME}**`;
          await sendGuildInviteQuestion(interaction.guild, targetUserId);
        } else {
          roleMessage = `\nWarning: I could not find the **${APPROVED_ROLE_NAME}** role.`;
        }
      } catch (error) {
        console.log("Could not add approved role:", error);
        roleMessage = `\nWarning: I could not give the **${APPROVED_ROLE_NAME}** role.`;
      }
    }

    if (action === "denyprofile") {
      profile.status = "Denied";
      profile.reviewedBy = interaction.user.tag;
      profile.reviewNote = "Denied by officer.";
    }

    saveProfiles();

    const statusText = action === "approveprofile" ? "✅ Approved" : "❌ Denied";
    const statusColor = action === "approveprofile" ? 0x57F287 : 0xED4245;

    const updatedEmbed = new EmbedBuilder()
      .setTitle(`${statusText} PoE Profile Submission`)
      .setDescription(`Profile for <@${targetUserId}> was reviewed by ${interaction.user}.${roleMessage}`)
      .addFields(
        { name: "Status", value: profile.status, inline: true },
        { name: "Reviewed By", value: interaction.user.tag, inline: true },
        { name: "PoE Profile", value: `[Open Profile](${profile.link})` }
      )
      .setColor(statusColor)
      .setTimestamp();

    await interaction.update({ embeds: [updatedEmbed], components: [] });

    try {
      const user = await client.users.fetch(targetUserId);
      await user.send(
        `Your Path of Exile profile was **${profile.status}** by ${interaction.user.tag}.\n\n` +
        `PoE Profile: ${profile.link}` +
        (action === "approveprofile"
          ? `\nYou have been given the **${APPROVED_ROLE_NAME}** role. Please check #${GUILD_INVITE_CHANNEL_NAME} to choose your ingame guild.`
          : "")
      );
    } catch {
      console.log("Could not DM reviewed user.");
    }

    return;
  }

  if (action === "guildchoice") {
    const choice = parts[1];
    const targetUserId = parts[2];

    if (interaction.user.id !== targetUserId) {
      await interaction.reply({ content: "Only the approved user can choose this.", ephemeral: true });
      return;
    }

    const profile = profiles[targetUserId];

    if (!profile || profile.status !== "Approved") {
      await interaction.reply({
        content: "You need an approved profile before choosing an ingame guild.",
        ephemeral: true
      });
      return;
    }

    const choiceName = choice === "poe1" ? "Path of Exile 1" : "Path of Exile 2";

    profile.guildChoice = choiceName;
    profile.inviteStatus = "Waiting for officer invite";
    saveProfiles();

    const updatedEmbed = new EmbedBuilder()
      .setTitle("✅ Guild Choice Submitted")
      .setDescription(`<@${targetUserId}> wants to join **${choiceName}** ingame guild.`)
      .addFields(
        { name: "PoE Profile", value: `[Open Profile](${profile.link})` },
        { name: "Status", value: "Waiting for officer invite" }
      )
      .setColor(0x57F287)
      .setTimestamp();

    await interaction.update({
      content: `<@${targetUserId}> selected **${choiceName}**.`,
      embeds: [updatedEmbed],
      components: []
    });

    await sendOfficerInviteTracking(interaction.guild, targetUserId, choiceName);
    return;
  }

  if (["invitedpoe1", "invitedpoe2", "inviteddone"].includes(action)) {
    const targetUserId = parts[1];

    if (!memberIsOfficer(interaction.member)) {
      await interaction.reply({ content: "Only officers can use these buttons.", ephemeral: true });
      return;
    }

    const profile = profiles[targetUserId];

    if (!profile) {
      await interaction.reply({ content: "No profile found for this user.", ephemeral: true });
      return;
    }

    let inviteStatus = "";

    if (action === "invitedpoe1") inviteStatus = "Invited to Path of Exile 1";
    if (action === "invitedpoe2") inviteStatus = "Invited to Path of Exile 2";
    if (action === "inviteddone") inviteStatus = "Done";

    profile.inviteStatus = inviteStatus;
    profile.invitedBy = interaction.user.tag;
    profile.inviteCompletedAt = new Date().toISOString();

    saveProfiles();

    const done = action === "inviteddone";

    const embed = new EmbedBuilder()
      .setTitle(done ? "✅ Invite Process Complete" : "📨 Guild Invite Updated")
      .setDescription(`<@${targetUserId}> invite status was updated by ${interaction.user}.`)
      .addFields(
        { name: "Guild Choice", value: profile.guildChoice || "No choice saved.", inline: true },
        { name: "Invite Status", value: inviteStatus, inline: true },
        { name: "PoE Profile", value: `[Open Profile](${profile.link})` }
      )
      .setColor(done ? 0x57F287 : 0xFEE75C)
      .setTimestamp();

    await interaction.update({
      embeds: [embed],
      components: done ? [] : interaction.message.components
    });

    try {
      const user = await client.users.fetch(targetUserId);
      await user.send(`Your guild invite status is now: **${inviteStatus}**.`);
    } catch {
      console.log("Could not DM user about invite status.");
    }
  }
});

client.login(token);

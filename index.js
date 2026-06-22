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

// =========================
// CONFIG
// =========================
const WELCOME_CHANNEL_NAME = "welcome";
const REVIEW_CHANNEL_NAME = "build-review";
const GUILD_INVITE_CHANNEL_NAME = "guild-invite";

const OFFICER_ROLE_NAME = "Officer";
const LEADER_ROLE_NAME = "Leader";
const APPROVED_ROLE_NAME = "member";

const LEVELS_FILE = "./levels.json";
const PROFILES_FILE = "./profiles.json";

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("ERROR: DISCORD_TOKEN is missing.");
  process.exit(1);
}

// =========================
// LOAD / SAVE DATA
// =========================
let levels = fs.existsSync(LEVELS_FILE)
  ? JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8"))
  : {};

let profiles = fs.existsSync(PROFILES_FILE)
  ? JSON.parse(fs.readFileSync(PROFILES_FILE, "utf8"))
  : {};

const pendingDenials = new Map();

function saveLevels() {
  fs.writeFileSync(LEVELS_FILE, JSON.stringify(levels, null, 2));
}

function saveProfiles() {
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
}

// =========================
// HELPERS
// =========================
function getNeededXp(level) {
  return level * 100;
}

function isValidPoeProfile(url) {
  return (
    url.startsWith("https://www.pathofexile.com/account/view-profile/") ||
    url.startsWith("https://pathofexile.com/account/view-profile/")
  );
}

function memberCanReview(member) {
  return member.roles.cache.some(role =>
    [OFFICER_ROLE_NAME.toLowerCase(), LEADER_ROLE_NAME.toLowerCase()].includes(
      role.name.toLowerCase()
    )
  );
}

function getPendingReason(profile) {
  if (profile.status === "Pending Review") {
    return "Waiting for officer/leader profile review";
  }

  if (profile.status === "Approved" && !profile.guildChoice) {
    return "Approved, waiting for user to choose PoE1 or PoE2";
  }

  if (
    profile.status === "Approved" &&
    profile.guildChoice &&
    (!profile.inviteStatus ||
      profile.inviteStatus === "Not invited yet" ||
      profile.inviteStatus === "Waiting for officer invite")
  ) {
    return `User chose ${profile.guildChoice}, waiting for officer invite`;
  }

  if (
    profile.status === "Approved" &&
    profile.inviteStatus &&
    profile.inviteStatus.startsWith("Invited to")
  ) {
    return `${profile.inviteStatus}, waiting to be marked Done`;
  }

  return null;
}

// =========================
// GUILD INVITE HELPERS
// =========================
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
      {
        name: "PoE Profile",
        value: profile?.link ? `[Open Profile](${profile.link})` : "No profile found."
      },
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

// =========================
// DISCORD CLIENT
// =========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// =========================
// READY
// =========================
client.once("ready", () => {
  console.log("BuddyNew is online as " + client.user.tag);
});

// =========================
// WELCOME MESSAGE WHEN USER JOINS
// =========================
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.find(
    ch => ch.name === WELCOME_CHANNEL_NAME && ch.isTextBased()
  );

  if (!channel) return;

  const welcomeEmbed = new EmbedBuilder()
    .setTitle("👋 Welcome to the server!")
    .setDescription(
      `Welcome ${member} to **${member.guild.name}**!\n\n` +
      "Please follow the steps below so we can approve you."
    )
    .addFields(
      {
        name: "📌 Start here",
        value:
          "1. Read the rules and check important channels.\n" +
          "2. Change your Path of Exile profile to public so we can check it.\n" +
          "3. If you can’t find where that is, use `!poeprofile`.\n" +
          "4. Post your character/profile link with `!profiel https://www.pathofexile.com/account/view-profile/YOURNAME/characters` so we can check it."
      },
      { name: "💬 Chat", value: "Say hello and enjoy the server!" }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setColor(0x5865F2)
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();

  await channel.send({
    content: `${member}`,
    embeds: [welcomeEmbed]
  });
});

// =========================
// MESSAGE CREATE
// =========================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
    const pendingDeny = pendingDenials.get(message.author.id);

  if (pendingDeny && pendingDeny.channelId === message.channel.id) {
    if (!memberCanReview(message.member)) {
      pendingDenials.delete(message.author.id);
      return;
    }

    const targetUserId = pendingDeny.targetUserId;
    const profile = profiles[targetUserId];

    if (!profile) {
      await message.reply("This user has no saved profile submission.");
      pendingDenials.delete(message.author.id);
      return;
    }

    const denyReason = message.content;

    profile.status = "Denied";
    profile.reviewedBy = message.author.tag;
    profile.reviewNote = denyReason;
    profile.deniedAt = new Date().toISOString();

    saveProfiles();
    pendingDenials.delete(message.author.id);

    const denyEmbed = new EmbedBuilder()
      .setTitle("❌ PoE Profile Denied")
      .setDescription(`<@${targetUserId}> was denied by ${message.author}.`)
      .addFields(
        { name: "Denied User", value: `<@${targetUserId}>`, inline: true },
        { name: "Denied By", value: message.author.tag, inline: true },
        { name: "Reason", value: denyReason },
        { name: "PoE Profile", value: `[Open Profile](${profile.link})` }
      )
      .setColor(0xED4245)
      .setTimestamp();

    try {
      const reviewMessage = await message.channel.messages.fetch(pendingDeny.messageId);
      await reviewMessage.edit({
        embeds: [denyEmbed],
        components: []
      });
    } catch {
      await message.channel.send({ embeds: [denyEmbed] });
    }

    await message.reply(`✅ Denial reason saved for <@${targetUserId}>.`);

    try {
      const user = await client.users.fetch(targetUserId);
      await user.send(
        `Your Path of Exile profile was **Denied** by ${message.author.tag}.\n\n` +
        `**Reason:** ${denyReason}\n\n` +
        `PoE Profile: ${profile.link}`
      );
    } catch {
      console.log("Could not DM denied user.");
    }

    return;
  }

  const msg = message.content.toLowerCase();
  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();
  const userId = message.author.id;

  // -------------------------
  // XP / LEVEL SYSTEM
  // -------------------------
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

  // =========================
  // !help
  // =========================
  if (msg === "!help") {
    const canReview = memberCanReview(message.member);

    const helpEmbed = new EmbedBuilder()
      .setTitle("📘 BuddyNew Command Menu")
      .setDescription("Here are the commands you can use.")
      .addFields({
        name: "👤 Member Commands",
        value:
          "`!help` — Show this menu\n" +
          "`!level` / `!rank` — Show your XP and level\n" +
          "`!leaderboard` — Show the server XP leaderboard\n" +
          "`!poeprofile` — Help making your PoE profile public\n" +
          "`!profiel <link>` — Submit your PoE character/profile link for review\n" +
          "`!myprofile` — Check your onboarding status\n" +
          "`!welcome-test` — Test the welcome message"
      })
      .setColor(0x5865F2)
      .setFooter({ text: "BuddyNew • Path of Exile Guild Bot" })
      .setTimestamp();

    if (canReview) {
      helpEmbed.addFields(
        {
          name: "🛡️ Officer / Leader Commands",
          value:
            "`!profiles` — Show all submitted profiles\n" +
            "`!pending` — Show only users needing action\n" +
            "`!profile @user` — Show full onboarding record\n" +
            "`!resetprofile @user` — Reset a user’s submission\n" +
            "`!setguild @user poe1/poe2` — Manually set guild choice\n" +
            "`!setinvite @user poe1/poe2/done` — Manually set invite status"
        },
        {
          name: "🔘 Button Workflows",
          value:
            "**Profile Review:** Approve / Deny\n" +
            "**Guild Choice:** Path of Exile 1 / Path of Exile 2\n" +
            "**Invite Tracking:** Invited to PoE1 / Invited to PoE2 / Done"
        }
      );
    }

    await message.reply({ embeds: [helpEmbed] });
    return;
  }

  // =========================
  // !level / !rank
  // =========================
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
    return;
  }

  // =========================
  // !leaderboard
  // =========================
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
    return;
  }

  // =========================
  // !poeprofile
  // =========================
  if (msg === "!poeprofile") {
    const poeEmbed = new EmbedBuilder()
      .setTitle("🔓 Make your Path of Exile profile public")
      .setDescription(
        "This command is only for helping you make your Path of Exile profile public.\n\n" +
        "Your profile must be public so officers can check your characters before approval.\n\n" +
        "**How to do it:**\n" +
        "1. Log in to the Path of Exile website\n" +
        "2. Open your privacy settings\n" +
        "3. Turn OFF profile privacy\n" +
        "4. Save changes\n\n" +
        "[Open Path of Exile Privacy Settings](https://www.pathofexile.com/my-account/privacy)\n\n" +
        "After that, submit your profile with:\n" +
        "`!profiel https://www.pathofexile.com/account/view-profile/YOURNAME/characters`"
      )
      .setColor(0xAF6025)
      .setFooter({
        text: "This does not submit your profile. It only helps you make it public."
      });

    await message.reply({ embeds: [poeEmbed] });
    return;
  }

  // =========================
  // !welcome-test
  // =========================
  if (msg === "!welcome-test") {
    const welcomeEmbed = new EmbedBuilder()
      .setTitle("👋 Welcome to the server!")
      .setDescription(
        `Welcome ${message.author} to **${message.guild.name}**!\n\n` +
        "Please follow the steps below so we can approve you."
      )
      .addFields(
        {
          name: "📌 Start here",
          value:
            "1. Read the rules and check important channels.\n" +
            "2. Change your Path of Exile profile to public so we can check it.\n" +
            "3. If you can’t find where that is, use `!poeprofile`.\n" +
            "4. Post your character/profile link with `!profiel https://www.pathofexile.com/account/view-profile/YOURNAME/characters` so we can check it."
        },
        { name: "💬 Chat", value: "Say hello and enjoy the server!" }
      )
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setColor(0x5865F2)
      .setFooter({ text: `Member #${message.guild.memberCount}` })
      .setTimestamp();

    await message.channel.send({
      content: `${message.author}`,
      embeds: [welcomeEmbed]
    });
    return;
  }

            // =========================
  // !profiel
  // =========================
  if (command === "!profiel") {
    const profileLink = args[1];

    if (!profileLink) {
      await message.reply(
        "Use: `!profiel https://www.pathofexile.com/account/view-profile/YOURNAME/characters`"
      );
      return;
    }

    if (!isValidPoeProfile(profileLink)) {
      await message.reply(
        "That does not look like a valid Path of Exile profile link.\nUse:\n`https://www.pathofexile.com/account/view-profile/YOURNAME/characters`"
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
      deniedAt: null,
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
      .setFooter({ text: "Officers / Leaders can approve or deny using the buttons below." })
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

    const reviewMessage = await reviewChannel.send({
      embeds: [submitEmbed],
      components: [buttons]
    });

    profiles[userId].reviewMessageId = reviewMessage.id;
    profiles[userId].reviewChannelId = reviewChannel.id;
    saveProfiles();

    await message.reply("Your PoE profile has been submitted for officer / leader review.");
    return;
  }

  // =========================
  // !myprofile
  // =========================
  if (msg === "!myprofile") {
    const profile = profiles[userId];

    if (!profile) {
      await message.reply("You have not submitted a PoE profile yet. Use `!profiel <link>`.");
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
        profile.status === "Approved"
          ? 0x57F287
          : profile.status === "Denied"
          ? 0xED4245
          : 0xFEE75C
      )
      .setTimestamp();

    await message.reply({ embeds: [profileEmbed] });
    return;
  }

  // =========================
  // !profiles
  // =========================
  if (msg === "!profiles") {
    if (!memberCanReview(message.member)) {
      await message.reply("Only officers or leaders can use this command.");
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
    return;
  }

  // =========================
  // !pending
  // =========================
  if (msg === "!pending") {
    if (!memberCanReview(message.member)) {
      await message.reply("Only officers or leaders can use this command.");
      return;
    }

    const pendingEntries = Object.entries(profiles)
      .map(([id, profile]) => ({
        id,
        profile,
        reason: getPendingReason(profile)
      }))
      .filter(item => item.reason !== null);

    if (pendingEntries.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle("✅ Officer Queue")
        .setDescription("No pending onboarding tasks right now.")
        .setColor(0x57F287)
        .setTimestamp();

      await message.channel.send({ embeds: [emptyEmbed] });
      return;
    }

    const pendingList = pendingEntries
      .slice(0, 20)
      .map((item, index) => {
        return (
          `**${index + 1}.** <@${item.id}>\n` +
          `Status: **${item.profile.status || "Unknown"}**\n` +
          `Guild: **${item.profile.guildChoice || "Not selected"}**\n` +
          `Invite: **${item.profile.inviteStatus || "Not invited yet"}**\n` +
          `Task: ${item.reason}\n` +
          `[Open Profile](${item.profile.link})`
        );
      })
      .join("\n\n");

    const pendingEmbed = new EmbedBuilder()
      .setTitle("📌 Officer / Leader Pending Queue")
      .setDescription(pendingList)
      .setColor(0xFEE75C)
      .setFooter({
        text: `Showing ${Math.min(pendingEntries.length, 20)} of ${pendingEntries.length} pending tasks.`
      })
      .setTimestamp();

    await message.channel.send({ embeds: [pendingEmbed] });
    return;
  }

  // =========================
  // !profile @user
  // =========================
  if (command === "!profile") {
    if (!memberCanReview(message.member)) {
      await message.reply("Only officers or leaders can use this command.");
      return;
    }

    const target = message.mentions.users.first();

    if (!target) {
      await message.reply("Use: `!profile @user`");
      return;
    }

    const profile = profiles[target.id];

    if (!profile) {
      await message.reply("That user has no saved onboarding profile.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📄 Onboarding Record: ${target.tag}`)
      .addFields(
        { name: "User", value: `<@${target.id}>`, inline: true },
        { name: "Review Status", value: profile.status || "Unknown", inline: true },
        { name: "Guild Choice", value: profile.guildChoice || "Not selected", inline: true },
        { name: "Invite Status", value: profile.inviteStatus || "Not invited yet", inline: true },
        { name: "Reviewed By", value: profile.reviewedBy || "Not reviewed yet", inline: true },
        { name: "Invited By", value: profile.invitedBy || "Not invited yet", inline: true },
        { name: "Submitted At", value: profile.submittedAt || "Unknown" },
        { name: "Denied At", value: profile.deniedAt || "Not denied" },
        { name: "Invite Completed At", value: profile.inviteCompletedAt || "Not completed yet" },
        { name: "Review Note", value: profile.reviewNote || "No note" },
        { name: "PoE Profile", value: `[Open Profile](${profile.link})` }
      )
      .setColor(0x5865F2)
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
    return;
  }

  // =========================
  // !resetprofile @user
  // =========================
  if (command === "!resetprofile") {
    if (!memberCanReview(message.member)) {
      await message.reply("Only officers or leaders can use this command.");
      return;
    }

    const target = message.mentions.users.first();

    if (!target) {
      await message.reply("Use: `!resetprofile @user`");
      return;
    }

    if (!profiles[target.id]) {
      await message.reply("That user has no profile to reset.");
      return;
    }

    delete profiles[target.id];
    saveProfiles();

    await message.channel.send(
      `🗑️ Reset onboarding profile for ${target}. They can submit again with \`!profiel https://www.pathofexile.com/account/view-profile/YOURNAME/characters\`.`
    );
    return;
  }

  // =========================
  // !setguild @user poe1/poe2
  // =========================
  if (command === "!setguild") {
    if (!memberCanReview(message.member)) {
      await message.reply("Only officers or leaders can use this command.");
      return;
    }

    const target = message.mentions.users.first();
    const choice = args[2]?.toLowerCase();

    if (!target || !["poe1", "poe2"].includes(choice)) {
      await message.reply("Use: `!setguild @user poe1` or `!setguild @user poe2`");
      return;
    }

    const profile = profiles[target.id];

    if (!profile) {
      await message.reply("That user has no saved onboarding profile.");
      return;
    }

    profile.guildChoice = choice === "poe1" ? "Path of Exile 1" : "Path of Exile 2";
    profile.inviteStatus = "Waiting for officer invite";

    saveProfiles();

    await message.channel.send(`✅ Set ${target}'s guild choice to **${profile.guildChoice}**.`);
    return;
  }

  // =========================
  // !setinvite @user poe1/poe2/done
  // =========================
  if (command === "!setinvite") {
    if (!memberCanReview(message.member)) {
      await message.reply("Only officers or leaders can use this command.");
      return;
    }

    const target = message.mentions.users.first();
    const status = args[2]?.toLowerCase();

    if (!target || !["poe1", "poe2", "done"].includes(status)) {
      await message.reply(
        "Use: `!setinvite @user poe1`, `!setinvite @user poe2`, or `!setinvite @user done`"
      );
      return;
    }

    const profile = profiles[target.id];

    if (!profile) {
      await message.reply("That user has no saved onboarding profile.");
      return;
    }

    if (status === "poe1") profile.inviteStatus = "Invited to Path of Exile 1";
    if (status === "poe2") profile.inviteStatus = "Invited to Path of Exile 2";
    if (status === "done") profile.inviteStatus = "Done";

    profile.invitedBy = message.author.tag;
    profile.inviteCompletedAt = new Date().toISOString();

    saveProfiles();

    await message.channel.send(`✅ Set ${target}'s invite status to **${profile.inviteStatus}**.`);
    return;
  }
  client.on("messageCreate", async (message) => {
    });

// =========================
// INTERACTION CREATE
// =========================
client.on(Events.InteractionCreate, async (interaction) => {
  // =========================
  // DENY MODAL SUBMIT
  // =========================
  if (interaction.isModalSubmit()) {
    if (!interaction.customId.startsWith("denyreason_")) return;

    const targetUserId = interaction.customId.split("_")[1];

    if (!memberCanReview(interaction.member)) {
      await interaction.reply({
        content: "Only officers or leaders can submit denial reasons.",
        ephemeral: true
      });
      return;
    }

    const profile = profiles[targetUserId];

    if (!profile) {
      await interaction.reply({
        content: "This user has no saved profile submission.",
        ephemeral: true
      });
      return;
    }

    const denyReason = interaction.fields.getTextInputValue("deny_reason");

    profile.status = "Denied";
    profile.reviewedBy = interaction.user.tag;
    profile.reviewNote = denyReason;
    profile.deniedAt = new Date().toISOString();

    saveProfiles();

    const denyEmbed = new EmbedBuilder()
      .setTitle("❌ PoE Profile Denied")
      .setDescription(`<@${targetUserId}> was denied by ${interaction.user}.`)
      .addFields(
        { name: "Denied User", value: `<@${targetUserId}>`, inline: true },
        { name: "Denied By", value: interaction.user.tag, inline: true },
        { name: "Status", value: "Denied", inline: true },
        { name: "Reason", value: denyReason, inline: false },
        { name: "PoE Profile", value: `[Open Profile](${profile.link})`, inline: false }
      )
      .setColor(0xED4245)
      .setTimestamp();

    await interaction.reply({
      content: "Denial reason saved.",
      ephemeral: true
    });

    try {
      if (profile.reviewChannelId && profile.reviewMessageId) {
        const channel = await interaction.guild.channels.fetch(profile.reviewChannelId);
        const reviewMessage = await channel.messages.fetch(profile.reviewMessageId);

        await reviewMessage.edit({
          embeds: [denyEmbed],
          components: []
        });
      }
    } catch (error) {
      console.log("Could not edit original review message:", error);
    }

    try {
      const user = await client.users.fetch(targetUserId);
      await user.send(
        `Your Path of Exile profile was **Denied** by ${interaction.user.tag}.\n\n` +
        `**Reason:** ${denyReason}\n\n` +
        `PoE Profile: ${profile.link}`
      );
    } catch {
      console.log("Could not DM denied user.");
    }

    return;
  }

  if (!interaction.isButton()) return;

  const parts = interaction.customId.split("_");
  const action = parts[0];

  // =========================
  // APPROVE / DENY PROFILE BUTTONS
  // =========================
  if (action === "approveprofile" || action === "denyprofile") {
    const targetUserId = parts[1];

    if (!memberCanReview(interaction.member)) {
      await interaction.reply({
        content: "Only officers or leaders can use these buttons.",
        ephemeral: true
      });
      return;
    }

    const profile = profiles[targetUserId];

    if (!profile) {
      await interaction.reply({
        content: "This user has no saved profile submission.",
        ephemeral: true
      });
      return;
    }

    if (profile.status !== "Pending Review") {
      await interaction.reply({
        content: `This profile is already marked as ${profile.status}.`,
        ephemeral: true
      });
      return;
    }
    
if (action === "denyprofile") {
  pendingDenials.set(interaction.user.id, {
    targetUserId,
    channelId: interaction.channel.id,
    messageId: interaction.message.id
  });

  await interaction.reply({
    content:
      `${interaction.user}, please type the reason why <@${targetUserId}> is denied.\n\n` +
      `Example: \`Profile is private / wrong link / requirements not met\`\n\n` +
      `You have 2 minutes to reply.`,
    ephemeral: false
  });

  return;
}
    
    if (action === "approveprofile") {
      let roleMessage = "";

      profile.status = "Approved";
      profile.reviewedBy = interaction.user.tag;
      profile.reviewNote = "Approved by officer/leader.";

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

      saveProfiles();

      const approveEmbed = new EmbedBuilder()
        .setTitle("✅ Approved PoE Profile Submission")
        .setDescription(`Profile for <@${targetUserId}> was reviewed by ${interaction.user}.${roleMessage}`)
        .addFields(
          { name: "Status", value: profile.status, inline: true },
          { name: "Reviewed By", value: interaction.user.tag, inline: true },
          { name: "Review Note", value: profile.reviewNote, inline: false },
          { name: "PoE Profile", value: `[Open Profile](${profile.link})` }
        )
        .setColor(0x57F287)
        .setTimestamp();

      await interaction.update({
        embeds: [approveEmbed],
        components: []
      });

      try {
        const user = await client.users.fetch(targetUserId);
        await user.send(
          `Your Path of Exile profile was **Approved** by ${interaction.user.tag}.\n\n` +
          `PoE Profile: ${profile.link}\n` +
          `You have been given the **${APPROVED_ROLE_NAME}** role. Please check #${GUILD_INVITE_CHANNEL_NAME} to choose your ingame guild.`
        );
      } catch {
        console.log("Could not DM reviewed user.");
      }

      return;
    }
  }

  // =========================
  // GUILD CHOICE BUTTONS
  // =========================
  if (action === "guildchoice") {
    const choice = parts[1];
    const targetUserId = parts[2];

    if (interaction.user.id !== targetUserId) {
      await interaction.reply({
        content: "Only the approved user can choose this.",
        ephemeral: true
      });
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

  // =========================
  // INVITE TRACKING BUTTONS
  // =========================
  if (["invitedpoe1", "invitedpoe2", "inviteddone"].includes(action)) {
    const targetUserId = parts[1];

    if (!memberCanReview(interaction.member)) {
      await interaction.reply({
        content: "Only officers or leaders can use these buttons.",
        ephemeral: true
      });
      return;
    }

    const profile = profiles[targetUserId];

    if (!profile) {
      await interaction.reply({
        content: "No profile found for this user.",
        ephemeral: true
      });
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

    return;
  }
});

client.login(token);

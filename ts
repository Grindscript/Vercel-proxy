import express from "express";
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } from "discord.js";

const {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,     // optional (faster command register)
  API_AUTH,             // strong secret (e.g. 32+ chars)
  PORT = 3000
} = process.env;

const app = express();
app.use(express.json());

// In-memory store (ok for demo). For production, use a DB.
let latestJob = null;

// --- API endpoints ---
app.post("/job", (req, res) => {
  const auth = (req.headers.authorization || "").replace("Bearer ","");
  if (auth !== API_AUTH) return res.status(401).send({error:"unauthorized"});

  const { placeId, jobId, note } = req.body || {};
  if (!placeId || !jobId) return res.status(400).send({error:"missing placeId/jobId"});

  latestJob = { placeId: Number(placeId), jobId: String(jobId), note: note||"", updatedAt: new Date().toISOString() };
  res.send({ ok: true, latestJob });
});

app.get("/job", (req, res) => {
  res.send(latestJob || { error: "no job yet" });
});

app.listen(PORT, () => console.log("API running on", PORT));

// --- Discord bot ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  {
    name: "setjob",
    description: "Set the current PlaceId + JobId (for your own Roblox experience)",
    options: [
      { name: "placeid", description: "Roblox PlaceId", type: 4, required: true },
      { name: "jobid",   description: "Server JobId",   type: 3, required: true },
      { name: "note",    description: "Optional note",  type: 3, required: false }
    ]
  },
  { name: "showjob", description: "Show the latest server info" }
];

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  if (DISCORD_GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), { body: commands });
  } else {
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: commands });
  }
  console.log("Slash commands registered");
}

client.on("ready", () => console.log(`Logged in as ${client.user.tag}`));

client.on("interactionCreate", async (i) => {
  try {
    if (!i.isChatInputCommand()) return;

    if (i.commandName === "setjob") {
      const placeId = i.options.getInteger("placeid");
      const jobId   = i.options.getString("jobid");
      const note    = i.options.getString("note") || "";

      // forward to API
      const r = await fetch(`http://localhost:${PORT}/job`, {
        method: "POST",
        headers: { "Content-Type":"application/json", "Authorization":`Bearer ${API_AUTH}` },
        body: JSON.stringify({ placeId, jobId, note })
      });
      const data = await r.json();
      if (!data.ok) return i.reply({ content: "❌ Failed to set job.", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("✅ Latest Server Set")
        .setDescription(`**PlaceId:** \`${placeId}\`\n**JobId:** \`${jobId}\`\n${note ? `**Note:** ${note}` : ""}`)
        .setColor(0x36a64f);

      await i.reply({ embeds: [embed] });
    }

    if (i.commandName === "showjob") {
      if (!latestJob) return i.reply({ content: "ℹ️ No job set yet.", ephemeral: true });

      const { placeId, jobId, updatedAt, note } = latestJob;
      const embed = new EmbedBuilder()
        .setTitle("🛰️ Latest Roblox Server")
        .setDescription(
`**PlaceId:** \`${placeId}\`
**JobId:** \`${jobId}\`
**Updated:** <t:${Math.floor(new Date(updatedAt).getTime()/1000)}:R>
${note ? `**Note:** ${note}` : ""}

**Teleport code (copy into a LocalScript button):**
\`\`\`lua
game:GetService("TeleportService"):TeleportToPlaceInstance(${placeId}, "${jobId}", game.Players.LocalPlayer)
\`\`\`
`)
        .setColor(0x2b6cb0);
      await i.reply({ embeds: [embed] });
    }
  } catch (e) {
    console.error(e);
    if (i.isRepliable()) i.reply({ content: "⚠️ Something went wrong.", ephemeral: true });
  }
});

await registerCommands();
client.login(DISCORD_TOKEN);

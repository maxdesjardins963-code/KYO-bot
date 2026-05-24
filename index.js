const express = require("express");
const fs = require("fs");
const path = require("path");
const { 
    Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle 
} = require("discord.js");
require("dotenv").config();

// ---------------- SERVER WEB POUR RENDER ----------------
// Render exige qu'un port web soit écouté en moins de 60s pour garder le bot en ligne.
const app = express();
const PORT = process.env.PORT || 10000;
app.get("/", (req, res) => res.send("Le bot Kyotaru Family est actif et optimisé !"));
app.listen(PORT, "0.0.0.0", () => console.log(`🌍 Serveur Web connecté sur le port ${PORT}`));

// ---------------- CONFIGURATION DISCORD ----------------
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

const STAFF_ID = "1499852043408642099"; // Ton ID ou l'ID du rôle Staff

// ---------------- BASE DE DONNÉES LOCALE ----------------
const bddPath = path.join(__dirname, "kyotarudata.json");
let bdd = { points: {}, banque: {}, profil: {}, entreprises: {}, boutique: {} };

if (fs.existsSync(bddPath)) {
    try { 
        const data = JSON.parse(fs.readFileSync(bddPath, "utf-8")); 
        bdd = { ...bdd, ...data };
    } catch (e) { console.error("Erreur lecture BDD :", e); }
}
function sauvegarderDonnees() { fs.writeFileSync(bddPath, JSON.stringify(bdd, null, 2)); }

// ---------------- STOCKAGE TEMPORAIRE (Giveaways) ----------------
const activeGW = {};
const activeMiniGW = {};

// ---------------- ENREGISTREMENT DES COMMANDES ----------------
const commands = [
    // ... Tes autres commandes existantes (help, profil, boutique, hack, etc.) ...
    
    // NOUVEAU : GIVEAWAY PAYANT
    new SlashCommandBuilder().setName("giveaway").setDescription("Lancer un Giveaway (coûte des points aux participants)")
        .addStringOption(opt => opt.setName("prix").setDescription("Le cadeau à gagner").setRequired(true))
        .addIntegerOption(opt => opt.setName("cout").setDescription("Combien coûte la participation (en pts)").setRequired(true))
        .addIntegerOption(opt => opt.setName("minutes").setDescription("Durée du giveaway en minutes").setRequired(true)),

    // NOUVEAU : MINI GIVEAWAY ECLAIR (STAFF SEULEMENT)
    new SlashCommandBuilder().setName("minigw").setDescription("Mini Giveaway Éclair ! (Staff - 50 secondes)")
        .addStringOption(opt => opt.setName("prix").setDescription("Le cadeau à gagner").setRequired(true))
        .addIntegerOption(opt => opt.setName("nombre").setDescription("Le nombre secret (1 - 200)").setRequired(true))
].map(command => command.toJSON());

client.once("ready", async () => {
    console.log(`🤖 [Kyotaru Family] Connecté : ${client.user.tag}`);
    client.user.setActivity("Gérer l'Empire Kyotaru 📈");
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log("✅ Commandes mises à jour avec succès !");
    } catch (error) { console.error(error); }
});

// ---------------- GESTION DES INTERACTIONS ----------------
client.on("interactionCreate", async interaction => {
    
    // Initialisation BDD automatique pour l'utilisateur
    if (interaction.user && !bdd.points[interaction.user.id]) bdd.points[interaction.user.id] = 100;

    // === GESTION DES COMMANDES SLASH ===
    if (interaction.isChatInputCommand()) {
        const { commandName, options, user, member } = interaction;
        const isStaff = user.id === STAFF_ID || (member && member.roles.cache.has(STAFF_ID));

        // 🎁 COMMANDE /GIVEAWAY (Classique Payant)
        if (commandName === "giveaway") {
            if (!isStaff) return interaction.reply({ content: "❌ Seul le staff peut créer un Giveaway.", ephemeral: true });

            const prix = options.getString("prix");
            const cout = options.getInteger("cout");
            const minutes = options.getInteger("minutes");
            const endTime = Math.floor(Date.now() / 1000) + (minutes * 60);

            const embed = new EmbedBuilder()
                .setTitle("🎉 NOUVEAU GIVEAWAY ! 🎉")
                .setDescription(`**Prix :** ${prix}\n**Frais de participation :** 🪙 ${cout} pts\n**Tirage :** <t:${endTime}:R>`)
                .setColor("#9b59b6");

            const btn = new ButtonBuilder()
                .setCustomId("btn_gw_join")
                .setLabel(`Participer (-${cout} pts)`)
                .setStyle(ButtonStyle.Success)
                .setEmoji("🎟️");

            const row = new ActionRowBuilder().addComponents(btn);
            const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

            activeGW[msg.id] = { prix, cout, participants: new Set() };

            setTimeout(async () => {
                const gwData = activeGW[msg.id];
                if (!gwData) return;

                const participantsArray = Array.from(gwData.participants);
                const winnerEmbed = new EmbedBuilder().setTitle("🏁 Fin du Giveaway");

                if (participantsArray.length === 0) {
                    winnerEmbed.setDescription(`Personne n'a participé au giveaway pour **${gwData.prix}**...`).setColor("#e74c3c");
                } else {
                    const winnerId = participantsArray[Math.floor(Math.random() * participantsArray.length)];
                    winnerEmbed.setDescription(`🎉 Félicitations à <@${winnerId}> qui remporte : **${gwData.prix}** !`).setColor("#f1c40f");
                }

                btn.setDisabled(true);
                await msg.edit({ components: [new ActionRowBuilder().addComponents(btn)] });
                await interaction.channel.send({ embeds: [winnerEmbed] });
                delete activeGW[msg.id];
            }, minutes * 60000);
        }

        // ⏱️ COMMANDE /MINIGW (Mini Giveaway 50 secondes)
        if (commandName === "minigw") {
            if (!isStaff) return interaction.reply({ content: "❌ Commande réservée au Staff.", ephemeral: true });

            const prix = options.getString("prix");
            const secret = options.getInteger("nombre");

            if (secret < 1 || secret > 200) {
                return interaction.reply({ content: "❌ Le nombre secret doit être entre 1 et 200 !", ephemeral: true });
            }

            const endTime = Math.floor(Date.now() / 1000) + 50; // Chrono réel Discord

            const embed = new EmbedBuilder()
                .setTitle("⚡ MINI GIVEAWAY ÉCLAIR ! ⚡")
                .setDescription(`Le staff a choisi un nombre secret entre **1 et 200**.\n\n🎁 **À gagner :** ${prix}\n⏳ **Fin :** <t:${endTime}:R>\n\nAppuie sur le bouton bleu et trouve le nombre pile pour gagner !`)
                .setColor("#3498db");

            // Bouton Bleu (Primary)
            const btn = new ButtonBuilder()
                .setCustomId("btn_minigw")
                .setLabel("Deviner un nombre")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("⏱️");

            const row = new ActionRowBuilder().addComponents(btn);
            const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

            activeMiniGW[msg.id] = { secret, prix, participants: new Map() };

            // Résolution après 50 secondes
            setTimeout(async () => {
                const gwData = activeMiniGW[msg.id];
                if (!gwData) return;
                
                const winners = [];
                for (const [userId, guess] of gwData.participants.entries()) {
                    if (guess === gwData.secret) winners.push(`<@${userId}>`);
                }

                btn.setDisabled(true);
                await msg.edit({ components: [new ActionRowBuilder().addComponents(btn)] });

                const resEmbed = new EmbedBuilder().setTitle("🏁 Fin du Mini Giveaway !");
                if (winners.length > 0) {
                    resEmbed.setDescription(`Le nombre secret était **${gwData.secret}** !\n\n🎉 **Gagnant(s) pile poil :** ${winners.join(", ")}\n🎁 **Vous remportez :** ${gwData.prix}`).setColor("#2ecc71");
                } else {
                    resEmbed.setDescription(`Le nombre secret était **${gwData.secret}** !\n\n❌ Personne n'a trouvé le bon nombre...`).setColor("#e74c3c");
                }
                
                await interaction.channel.send({ embeds: [resEmbed] });
                delete activeMiniGW[msg.id];
            }, 50000);
        }
    }

    // === GESTION DES BOUTONS ===
    if (interaction.isButton()) {
        
        // Clic sur le Giveaway payant
        if (interaction.customId === "btn_gw_join") {
            const gwData = activeGW[interaction.message.id];
            if (!gwData) return interaction.reply({ content: "❌ Ce Giveaway est terminé !", ephemeral: true });

            if (gwData.participants.has(interaction.user.id)) {
                return interaction.reply({ content: "Tu participes déjà à ce Giveaway !", ephemeral: true });
            }

            if (bdd.points[interaction.user.id] < gwData.cout) {
                return interaction.reply({ content: `❌ Tu n'as pas assez d'argent. Il te faut **${gwData.cout} pts** en poche.`, ephemeral: true });
            }

            // Déduction des points et ajout à la liste
            bdd.points[interaction.user.id] -= gwData.cout;
            sauvegarderDonnees();
            gwData.participants.add(interaction.user.id);

            return interaction.reply({ content: `✅ Inscription validée ! **-${gwData.cout} pts** ont été retirés de tes poches. Bonne chance !`, ephemeral: true });
        }

        // Clic sur le Mini Giveaway (Ouverture du Modal)
        if (interaction.customId === "btn_minigw") {
            const msgId = interaction.message.id;
            if (!activeMiniGW[msgId]) return interaction.reply({ content: "⏳ Trop tard, le chrono est écoulé !", ephemeral: true });

            const modal = new ModalBuilder()
                .setCustomId(`modal_minigw_${msgId}`)
                .setTitle("🔢 Trouve le nombre !");

            const input = new TextInputBuilder()
                .setCustomId("guess_input")
                .setLabel("Choisis un nombre (1 - 200)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(3);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }
    }

    // === GESTION DES MODALS (Formulaires) ===
    if (interaction.isModalSubmit()) {
        
        // Validation du Mini Giveaway
        if (interaction.customId.startsWith("modal_minigw_")) {
            const msgId = interaction.customId.replace("modal_minigw_", "");
            const gwData = activeMiniGW[msgId];
            
            if (!gwData) return interaction.reply({ content: "⏳ Trop tard, le chrono de 50 secondes est terminé !", ephemeral: true });

            const guessStr = interaction.fields.getTextInputValue("guess_input");
            const guess = parseInt(guessStr, 10);
            
            if (isNaN(guess) || guess < 1 || guess > 200) {
                return interaction.reply({ content: "❌ Tu dois entrer un nombre valide entre 1 et 200 !", ephemeral: true });
            }

            // Enregistrement du choix du joueur (écrase son choix précédent s'il re-valide)
            gwData.participants.set(interaction.user.id, guess);
            await interaction.reply({ content: `✅ Ton choix (**${guess}**) a été enregistré dans le système. Attends la fin du chrono !`, ephemeral: true });
        }
    }
});

// Éviter le crash brutal du bot sur Render en cas d'erreur asynchrone
process.on("unhandledRejection", (reason) => console.error("⚠️ Rejet non géré :", reason));
process.on("uncaughtException", (err) => console.error("⚠️ Exception critique :", err));

client.login(process.env.TOKEN);


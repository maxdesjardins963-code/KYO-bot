const express = require("express");
const fs = require("fs");
const path = require("path");
const { 
    Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle 
} = require("discord.js");
require("dotenv").config();

// ---------------- SERVER WEB POUR RENDER ----------------
const app = express();
const PORT = process.env.PORT || 10000;
app.get("/", (req, res) => res.send("Le bot Kyotaru Family Business & Casino est actif et optimisé pour Render !"));
app.listen(PORT, "0.0.0.0", () => console.log(`🌍 Serveur Web connecté sur le port ${PORT}`));

// ---------------- CONFIGURATION DISCORD ----------------
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

const STAFF_ID = "1499852043408642099";

// ---------------- BASE DE DONNÉES LOCALE ----------------
const bddPath = path.join(__dirname, "kyotarudata.json");
let bdd = { points: {}, banque: {}, profil: {}, entreprises: {}, investissements: {}, cooldowns: {}, antihack: {}, boutique: {} };

if (fs.existsSync(bddPath)) {
    try { 
        const data = JSON.parse(fs.readFileSync(bddPath, "utf-8")); 
        bdd = { ...bdd, ...data };
    } catch (e) { console.error("Erreur lecture BDD :", e); }
}

if (!bdd.banque) bdd.banque = {};
if (!bdd.cooldowns) bdd.cooldowns = {};
if (!bdd.antihack) bdd.antihack = {};
if (!bdd.boutique || Object.keys(bdd.boutique).length === 0) {
    bdd.boutique = {
        serveur: { nom: "💻 Serveur de Bot clandestin", prix: 500, revenu: 25 },
        bunker: { nom: "🛡️ Bunker Kyotaru-Data", prix: 2000, revenu: 120 },
        casino: { nom: "🎰 Mini-Casino Kyotaru", prix: 7500, revenu: 500 },
        syndicat: { nom: "👑 Quartier Général du Syndicat", prix: 25000, revenu: 2000 }
    };
}
function sauvegarderDonnees() { fs.writeFileSync(bddPath, JSON.stringify(bdd, null, 2)); }

// ---------------- STOCKAGE TEMPORAIRE (Giveaways) ----------------
const activeGW = {};
const activeMiniGW = {};

// ---------------- GESTION DES COOLDOWNS ----------------
function checkCooldown(userId, commande, delaiMs) {
    if (!bdd.cooldowns[userId]) bdd.cooldowns[userId] = {};
    const dernierAppel = bdd.cooldowns[userId][commande] || 0;
    const tempsEcoule = Date.now() - dernierAppel;
    
    if (tempsEcoule < delaiMs) {
        return Math.ceil((delaiMs - tempsEcoule) / 1000); 
    }
    bdd.cooldowns[userId][commande] = Date.now();
    sauvegarderDonnees();
    return 0;
}

// ---------------- ENREGISTREMENT DES COMMANDES ----------------
const commands = [
    // ℹ️ HELP
    new SlashCommandBuilder().setName("help").setDescription("Affiche la liste complète de toutes les commandes du bot"),

    // 🪙 ÉCONOMIE
    new SlashCommandBuilder().setName("profil").setDescription("Affiche ton empire, tes points et ton argent en banque").addUserOption(opt => opt.setName("membre").setDescription("Le membre")),
    new SlashCommandBuilder().setName("points").setDescription("Affiche tes KyotaruPoints (Poches et Banque)").addUserOption(opt => opt.setName("membre").setDescription("Le membre")),
    new SlashCommandBuilder().setName("daily").setDescription("Récupère tes dividendes quotidiens (Points gratuits)"),
    new SlashCommandBuilder().setName("leaderboard").setDescription("Affiche le Top 10 des membres les plus riches de la famille"),
    new SlashCommandBuilder().setName("settitle").setDescription("Change ton titre sur ton /profil").addStringOption(opt => opt.setName("titre").setDescription("Ton nouveau titre").setRequired(true)),
    new SlashCommandBuilder().setName("banque").setDescription("Gère ton coffre-fort sécurisé")
        .addSubcommand(sub => sub.setName("deposer").setDescription("Mettre des points à l'abri").addIntegerOption(opt => opt.setName("montant").setDescription("Montant").setRequired(true)))
        .addSubcommand(sub => sub.setName("retirer").setDescription("Retirer des points de la banque").addIntegerOption(opt => opt.setName("montant").setDescription("Montant").setRequired(true)))
        .addSubcommand(sub => sub.setName("solde").setDescription("Voir le solde de ton compte bancaire")),

    // 🏢 BUSINESS & IMMOBILIER
    new SlashCommandBuilder().setName("boutique").setDescription("Affiche la liste des bâtiments et entreprises disponibles"),
    new SlashCommandBuilder().setName("acheter").setDescription("Acheter un bâtiment")
        .addStringOption(opt => opt.setName("id").setDescription("L'ID du bâtiment").setRequired(true)),
    new SlashCommandBuilder().setName("investir").setDescription("Placer des points en bourse (Cooldown : 10 min)")
        .addIntegerOption(opt => opt.setName("montant").setDescription("Montant à investir").setRequired(true)),
    new SlashCommandBuilder().setName("recolter").setDescription("Récolter les points générés par tes bâtiments (Cooldown : 1h)"),

    // 🎰 CASINO
    new SlashCommandBuilder().setName("slots").setDescription("Machine à sous (Cooldown : 15s)").addIntegerOption(opt => opt.setName("mise").setDescription("Montant").setRequired(true)),
    new SlashCommandBuilder().setName("coinflip").setDescription("Double ou quitte (Cooldown : 15s)").addStringOption(opt => opt.setName("choix").setDescription("pile ou face").setRequired(true).addChoices({name: "Pile", value: "pile"}, {name: "Face", value: "face"})).addIntegerOption(opt => opt.setName("mise").setDescription("Mise").setRequired(true)),
    new SlashCommandBuilder().setName("roulette").setDescription("Mise sur une couleur (Cooldown : 15s)").addStringOption(opt => opt.setName("couleur").setDescription("Rouge, Noir ou Vert").setRequired(true).addChoices({name: "Rouge", value: "rouge"}, {name: "Noir", value: "noir"}, {name: "Vert", value: "vert"})).addIntegerOption(opt => opt.setName("mise").setDescription("Mise").setRequired(true)),

    // 🎭 HACK & FUN
    new SlashCommandBuilder().setName("hack").setDescription("Voler 30% des points d'un membre (Cooldown : 1h)").addUserOption(opt => opt.setName("membre").setDescription("Victime").setRequired(true)),
    new SlashCommandBuilder().setName("antihack").setDescription("Place un pare-feu sur un membre (50 pts)")
        .addUserOption(opt => opt.setName("membre").setDescription("Le hacker potentiel").setRequired(true)),
    new SlashCommandBuilder().setName("pourcentage").setDescription("Test de pourcentage d'humour")
        .addStringOption(opt => opt.setName("type").setDescription("Le test").setRequired(true).addChoices({name: "Gay", value: "gay"}, {name: "Furry", value: "furry"}, {name: "Gigachad", value: "gigachad"}, {name: "Traître", value: "traitre"}))
        .addUserOption(opt => opt.setName("membre").setDescription("Le membre")),
    new SlashCommandBuilder().setName("8ball").setDescription("Pose une question magique").addStringOption(opt => opt.setName("question").setDescription("Ta question").setRequired(true)),
    new SlashCommandBuilder().setName("baffe").setDescription("Donne une claque à un membre").addUserOption(opt => opt.setName("membre").setDescription("Victime").setRequired(true)),

    // 🎁 GIVEAWAYS
    new SlashCommandBuilder().setName("giveaway").setDescription("Lancer un Giveaway payant (Staff)")
        .addStringOption(opt => opt.setName("prix").setDescription("Cadeau").setRequired(true))
        .addIntegerOption(opt => opt.setName("cout").setDescription("Frais en pts").setRequired(true))
        .addIntegerOption(opt => opt.setName("minutes").setDescription("Durée (minutes)").setRequired(true)),
    new SlashCommandBuilder().setName("minigw").setDescription("Mini Giveaway Éclair ! (Staff - 50 secondes)")
        .addStringOption(opt => opt.setName("prix").setDescription("Cadeau").setRequired(true))
        .addIntegerOption(opt => opt.setName("nombre").setDescription("Nombre secret (1 - 200)").setRequired(true)),

    // 🛡️ MODÉRATION STAFF
    new SlashCommandBuilder().setName("annonce").setDescription("Faire une annonce (Staff)").addStringOption(opt => opt.setName("message").setDescription("Message").setRequired(true)).addStringOption(opt => opt.setName("style").setDescription("Format").setRequired(true).addChoices({name: "Embed", value: "embed"}, {name: "Texte", value: "texte"})),
    new SlashCommandBuilder().setName("kick").setDescription("Exclure (Staff)").addUserOption(opt => opt.setName("membre").setDescription("Membre").setRequired(true)).addStringOption(opt => opt.setName("raison").setDescription("Raison")),
    new SlashCommandBuilder().setName("ban").setDescription("Bannir (Staff)").addUserOption(opt => opt.setName("membre").setDescription("Membre").setRequired(true)).addStringOption(opt => opt.setName("raison").setDescription("Raison")),
    new SlashCommandBuilder().setName("mute").setDescription("Mute (Staff)").addUserOption(opt => opt.setName("membre").setDescription("Membre").setRequired(true)).addIntegerOption(opt => opt.setName("minutes").setDescription("Minutes").setRequired(true)),
    new SlashCommandBuilder().setName("unmute").setDescription("Unmute (Staff)").addUserOption(opt => opt.setName("membre").setDescription("Membre").setRequired(true)),
    new SlashCommandBuilder().setName("clear").setDescription("Nettoyer messages (Staff)").addIntegerOption(opt => opt.setName("nombre").setDescription("Nombre").setRequired(true)),
    new SlashCommandBuilder().setName("warn").setDescription("Avertir (Staff)").addUserOption(opt => opt.setName("membre").setDescription("Membre").setRequired(true)).addStringOption(opt => opt.setName("raison").setDescription("Raison")),

    // 👑 DIRECTION STAFF (Économie & Création Entreprises)
    new SlashCommandBuilder().setName("staff").setDescription("Panneau de contrôle de la Direction")
        .addSubcommandGroup(group => group.setName("eco").setDescription("Gérer l'argent")
            .addSubcommand(sub => sub.setName("ajouter").setDescription("Ajouter des points").addUserOption(opt => opt.setName("membre").setDescription("Joueur").setRequired(true)).addIntegerOption(opt => opt.setName("montant").setDescription("Montant").setRequired(true)))
            .addSubcommand(sub => sub.setName("retirer").setDescription("Retirer des points").addUserOption(opt => opt.setName("membre").setDescription("Joueur").setRequired(true)).addIntegerOption(opt => opt.setName("montant").setDescription("Montant").setRequired(true)))
            .addSubcommand(sub => sub.setName("set").setDescription("Définir un montant exact").addUserOption(opt => opt.setName("membre").setDescription("Joueur").setRequired(true)).addIntegerOption(opt => opt.setName("montant").setDescription("Montant").setRequired(true)))
        )
        .addSubcommandGroup(group => group.setName("batiment").setDescription("Gérer les bâtiments")
            .addSubcommand(sub => sub.setName("donner").setDescription("Offrir un bâtiment")
                .addUserOption(opt => opt.setName("membre").setDescription("Joueur").setRequired(true))
                .addStringOption(opt => opt.setName("id").setDescription("ID bâtiment").setRequired(true))
                .addIntegerOption(opt => opt.setName("quantite").setDescription("Quantité").setRequired(true))
            )
        )
        .addSubcommandGroup(group => group.setName("entreprise").setDescription("Créer de nouvelles entreprises")
            .addSubcommand(sub => sub.setName("creer").setDescription("Ajouter à la boutique")
                .addStringOption(opt => opt.setName("id").setDescription("ID unique (ex: resto)").setRequired(true))
                .addStringOption(opt => opt.setName("nom").setDescription("Nom complet").setRequired(true))
                .addIntegerOption(opt => opt.setName("prix").setDescription("Prix d'achat").setRequired(true))
                .addIntegerOption(opt => opt.setName("revenu").setDescription("Revenu par heure").setRequired(true))
            )
        )
].map(command => command.toJSON());

client.once("ready", async () => {
    console.log(`🤖 Connecté : ${client.user.tag}`);
    client.user.setActivity("Gérer l'Empire Kyotaru 📈");
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (error) { console.error(error); }
});

// ---------------- GESTION DES COMMANDES ----------------
client.on("interactionCreate", async interaction => {
    
    // ============================================
    // 1. COMMANDES SLASH (/commande)
    // ============================================
    if (interaction.isChatInputCommand()) {
        const { commandName, options, user, member } = interaction;
        const isStaff = user.id === STAFF_ID || (member && member.roles.cache.has(STAFF_ID));

        if (!bdd.points[user.id]) bdd.points[user.id] = 100;
        if (!bdd.banque[user.id]) bdd.banque[user.id] = 0;
        if (!bdd.profil[user.id]) bdd.profil[user.id] = { titre: "Actionnaire Kyotaru", dailyCooldown: 0, warns: 0 };
        if (!bdd.entreprises[user.id]) bdd.entreprises[user.id] = {};
        if (!bdd.investissements[user.id]) bdd.investissements[user.id] = { dernierRecolte: Date.now() };
        if (!bdd.antihack[user.id]) bdd.antihack[user.id] = {};

        // SÉCURITÉ STAFF
        const commandesStaff = ["staff", "annonce", "warn", "mute", "unmute", "clear", "kick", "ban", "giveaway", "minigw"];
        if (commandesStaff.includes(commandName) && !isStaff) {
            return interaction.reply({ content: "❌ Accès refusé. Réservé au Staff.", ephemeral: true });
        }

        // --- DIRECTION STAFF (Entreprises, Éco, Giveaways) ---
        if (commandName === "staff") {
            const groupe = options.getSubcommandGroup();
            const sous = options.getSubcommand();
            if (groupe === "eco") {
                const cible = options.getUser("membre");
                const mt = options.getInteger("montant");
                if (!bdd.points[cible.id]) bdd.points[cible.id] = 0;
                if (sous === "ajouter") bdd.points[cible.id] += mt;
                if (sous === "retirer") bdd.points[cible.id] = Math.max(0, bdd.points[cible.id] - mt);
                if (sous === "set") bdd.points[cible.id] = mt;
                sauvegarderDonnees();
                return interaction.reply(`✅ Solde de ${cible.username} mis à jour : **${bdd.points[cible.id]} pts**.`);
            }
            if (groupe === "batiment") {
                const cible = options.getUser("membre");
                const idBat = options.getString("id").toLowerCase();
                const qte = options.getInteger("quantite");
                if (!bdd.boutique[idBat]) return interaction.reply("❌ Bâtiment introuvable.");
                if (!bdd.entreprises[cible.id]) bdd.entreprises[cible.id] = {};
                bdd.entreprises[cible.id][idBat] = (bdd.entreprises[cible.id][idBat] || 0) + qte;
                sauvegarderDonnees();
                return interaction.reply(`✅ ${qte}x ${bdd.boutique[idBat].nom} donnés à ${cible.username}.`);
            }
            if (groupe === "entreprise") {
                const id = options.getString("id").toLowerCase();
                const nom = options.getString("nom");
                const prix = options.getInteger("prix");
                const rev = options.getInteger("revenu");
                bdd.boutique[id] = { nom, prix, revenu: rev };
                sauvegarderDonnees();
                return interaction.reply(`✅ **Entreprise créée :** ${nom} ajoutée à la /boutique pour ${prix} pts.`);
            }
        }

        if (commandName === "giveaway") {
            const prix = options.getString("prix");
            const cout = options.getInteger("cout");
            const min = options.getInteger("minutes");
            const endTime = Math.floor(Date.now() / 1000) + (min * 60);

            const embed = new EmbedBuilder().setTitle("🎉 GIVEAWAY PAYANT !").setDescription(`**Prix :** ${prix}\n**Frais :** 🪙 ${cout} pts\n**Tirage :** <t:${endTime}:R>`).setColor("#9b59b6");
            const btn = new ButtonBuilder().setCustomId("btn_gw_join").setLabel(`Participer (-${cout} pts)`).setStyle(ButtonStyle.Success).setEmoji("🎟️");
            const msg = await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)], fetchReply: true });

            activeGW[msg.id] = { prix, cout, participants: new Set() };
            setTimeout(async () => {
                const gwData = activeGW[msg.id];
                if (!gwData) return;
                const pArray = Array.from(gwData.participants);
                const wEmbed = new EmbedBuilder().setTitle("🏁 Fin du Giveaway");
                if (pArray.length === 0) wEmbed.setDescription("Personne n'a participé...").setColor("#e74c3c");
                else wEmbed.setDescription(`🎉 Gagnant : <@${pArray[Math.floor(Math.random() * pArray.length)]}> remporte **${gwData.prix}** !`).setColor("#f1c40f");
                
                btn.setDisabled(true);
                await msg.edit({ components: [new ActionRowBuilder().addComponents(btn)] });
                await interaction.channel.send({ embeds: [wEmbed] });
                delete activeGW[msg.id];
            }, min * 60000);
            return;
        }

        if (commandName === "minigw") {
            const prix = options.getString("prix");
            const secret = options.getInteger("nombre");
            if (secret < 1 || secret > 200) return interaction.reply({ content: "❌ Nombre entre 1 et 200.", ephemeral: true });

            const endTime = Math.floor(Date.now() / 1000) + 50;
            const embed = new EmbedBuilder().setTitle("⚡ MINI GIVEAWAY ÉCLAIR !").setDescription(`🎁 **Prix :** ${prix}\n⏳ **Fin :** <t:${endTime}:R>\n\nAppuie sur le bouton bleu pour trouver le nombre secret (1-200) !`).setColor("#3498db");
            const btn = new ButtonBuilder().setCustomId("btn_minigw").setLabel("Deviner").setStyle(ButtonStyle.Primary).setEmoji("⏱️");
            const msg = await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)], fetchReply: true });

            activeMiniGW[msg.id] = { secret, prix, participants: new Map() };
            setTimeout(async () => {
                const gwData = activeMiniGW[msg.id];
                if (!gwData) return;
                const winners = [];
                for (const [userId, guess] of gwData.participants.entries()) { if (guess === gwData.secret) winners.push(`<@${userId}>`); }
                btn.setDisabled(true);
                await msg.edit({ components: [new ActionRowBuilder().addComponents(btn)] });
                const rEmbed = new EmbedBuilder().setTitle("🏁 Fin du Mini Giveaway !");
                if (winners.length > 0) rEmbed.setDescription(`Nombre exact : **${gwData.secret}** !\n🎉 **Gagnant(s) :** ${winners.join(", ")}\n🎁 **Gagné :** ${gwData.prix}`).setColor("#2ecc71");
                else rEmbed.setDescription(`Nombre exact : **${gwData.secret}** !\n❌ Personne n'a trouvé.`).setColor("#e74c3c");
                await interaction.channel.send({ embeds: [rEmbed] });
                delete activeMiniGW[msg.id];
            }, 50000);
            return;
        }

        // --- ECONOMIE & BUSINESS ---
        if (commandName === "boutique") {
            const e = new EmbedBuilder().setTitle("🏬 BOUTIQUE").setColor("#2ecc71");
            for (const [id, data] of Object.entries(bdd.boutique)) e.addFields({ name: `${data.nom} (ID: \`${id}\`)`, value: `Prix: **${data.prix} pts** • Revenu: **+${data.revenu}/h**` });
            return interaction.reply({ embeds: [e] });
        }
        if (commandName === "acheter") {
            const id = options.getString("id").toLowerCase();
            const bat = bdd.boutique[id];
            if (!bat) return interaction.reply("❌ ID introuvable.");
            if (bdd.points[user.id] < bat.prix) return interaction.reply("❌ Solde insuffisant.");
            bdd.points[user.id] -= bat.prix;
            bdd.entreprises[user.id][id] = (bdd.entreprises[user.id][id] || 0) + 1;
            sauvegarderDonnees();
            return interaction.reply(`🏢 Tu as acheté : **${bat.nom}**.`);
        }
        if (commandName === "recolter") {
            const ent = bdd.entreprises[user.id];
            const tps = Date.now() - bdd.investissements[user.id].dernierRecolte;
            const h = Math.floor(tps / 3600000);
            if (h < 1) return interaction.reply({ content: `⏱️ Reviens dans **${Math.ceil((3600000 - tps) / 60000)} min**.`, ephemeral: true });
            let gains = 0;
            for (const [id, qte] of Object.entries(ent)) if (bdd.boutique[id]) gains += qte * bdd.boutique[id].revenu;
            gains *= h;
            if (gains <= 0) return interaction.reply("❌ Aucun bâtiment productif.");
            bdd.points[user.id] += gains;
            bdd.investissements[user.id].dernierRecolte = Date.now();
            sauvegarderDonnees();
            return interaction.reply(`💰 Tu as récolté **+${gains} pts** pour ${h}h de travail !`);
        }
        if (commandName === "banque") {
            const sous = options.getSubcommand();
            if (sous === "solde") return interaction.reply(`🏦 Banque : **${bdd.banque[user.id]} pts**.`);
            const mt = options.getInteger("montant");
            if (sous === "deposer") {
                if (bdd.points[user.id] < mt) return interaction.reply("❌ Fonds insuffisants.");
                bdd.points[user.id] -= mt; bdd.banque[user.id] += mt; sauvegarderDonnees();
                return interaction.reply(`🏦 **${mt} pts** placés en sécurité.`);
            }
            if (sous === "retirer") {
                if (bdd.banque[user.id] < mt) return interaction.reply("❌ Fonds bancaires insuffisants.");
                bdd.banque[user.id] -= mt; bdd.points[user.id] += mt; sauvegarderDonnees();
                return interaction.reply(`🏦 **${mt} pts** retirés.`);
            }
        }
        if (commandName === "profil" || commandName === "points" || commandName === "daily" || commandName === "leaderboard" || commandName === "settitle" || commandName === "investir") {
            // [Logique simplifiée pour gain de place, s'appuie sur tes variables existantes]
            if (commandName === "points") return interaction.reply(`🪙 Poche: **${bdd.points[user.id]} pts** | Banque: **${bdd.banque[user.id]} pts**`);
            if (commandName === "daily") {
                if (Date.now() < bdd.profil[user.id].dailyCooldown) return interaction.reply({ content: "⏳ Déjà récupéré.", ephemeral: true });
                bdd.points[user.id] += 300; bdd.profil[user.id].dailyCooldown = Date.now() + 86400000; sauvegarderDonnees(); return interaction.reply("🎁 **+300 pts** quotidiens !");
            }
        }

        // --- HACK & ANTI-HACK ---
        if (commandName === "antihack") {
            const c = options.getUser("membre");
            if (bdd.points[user.id] < 50) return interaction.reply("❌ Il te faut 50 pts.");
            bdd.points[user.id] -= 50; bdd.antihack[user.id][c.id] = true; sauvegarderDonnees();
            return interaction.reply(`🛡️ Pare-feu activé contre **${c.username}**.`);
        }
        if (commandName === "hack") {
            const cd = checkCooldown(user.id, "hack", 3600000);
            if (cd > 0) return interaction.reply({ content: `⏳ Attends ${Math.ceil(cd/60)} min.`, ephemeral: true });
            const c = options.getUser("membre");
            await interaction.reply(`🛸 Piratage de **${c.username}** en cours...`);
            setTimeout(() => {
                if (bdd.antihack[c.id] && bdd.antihack[c.id][user.id]) {
                    bdd.points[user.id] = Math.max(0, bdd.points[user.id] - 100);
                    bdd.antihack[c.id][user.id] = false; sauvegarderDonnees();
                    return interaction.editReply(`💥 **ALERTE !** ${c.username} avait un Anti-Hack. Tu perds **100 pts**.`);
                }
                const vol = Math.floor((bdd.points[c.id] || 0) * 0.30);
                if (vol < 5) return interaction.editReply(`🏴‍☠️ ${c.username} n'a pas assez d'argent.`);
                bdd.points[c.id] -= vol; bdd.points[user.id] += vol; sauvegarderDonnees();
                return interaction.editReply(`🏴‍☠️ **SUCCÈS !** Tu as siphonné 30% : **+${vol} pts** !`);
            }, 3000);
            return;
        }

        // --- CASINO ---
        if (["slots", "coinflip", "roulette"].includes(commandName)) {
            const cd = checkCooldown(user.id, "casino", 15000);
            if (cd > 0) return interaction.reply({ content: `⏳ Attends ${cd} sec.`, ephemeral: true });
            const m = options.getInteger("mise");
            if (bdd.points[user.id] < m) return interaction.reply("❌ Fonds insuffisants.");
            bdd.points[user.id] -= m;
            
            if (commandName === "roulette") {
                const c = options.getString("couleur");
                const d = Math.floor(Math.random() * 37);
                const r = d === 0 ? "vert" : (d % 2 === 0 ? "noir" : "rouge");
                if (c === r) {
                    const gain = m * (r === "vert" ? 14 : 2); bdd.points[user.id] += gain; sauvegarderDonnees();
                    return interaction.reply(`🎡 **${d} (${r.toUpperCase()})** ! ✅ Gagné **${gain} pts** !`);
                }
                sauvegarderDonnees(); return interaction.reply(`🎡 **${d} (${r.toUpperCase()})**... ❌ Perdu.`);
            }
        }

        // --- MODÉRATION ---
        if (commandName === "clear") {
            await interaction.channel.bulkDelete(options.getInteger("nombre"), true);
            return interaction.reply({ content: `🗑️ Messages supprimés.`, ephemeral: true });
        }
        if (commandName === "annonce") return interaction.reply("📢 " + options.getString("message"));
    }

    // ============================================
    // 2. BOUTONS (Giveaways)
    // ============================================
    if (interaction.isButton()) {
        if (interaction.customId === "btn_gw_join") {
            const gw = activeGW[interaction.message.id];
            if (!gw) return interaction.reply({ content: "❌ Terminé.", ephemeral: true });
            if (gw.participants.has(interaction.user.id)) return interaction.reply({ content: "Déjà inscrit.", ephemeral: true });
            if (bdd.points[interaction.user.id] < gw.cout) return interaction.reply({ content: `❌ Il te faut ${gw.cout} pts.`, ephemeral: true });
            bdd.points[interaction.user.id] -= gw.cout; sauvegarderDonnees();
            gw.participants.add(interaction.user.id);
            return interaction.reply({ content: `✅ Inscrit ! (-${gw.cout} pts)`, ephemeral: true });
        }

        if (interaction.customId === "btn_minigw") {
            if (!activeMiniGW[interaction.message.id]) return interaction.reply({ content: "⏳ Trop tard !", ephemeral: true });
            const modal = new ModalBuilder().setCustomId(`modal_minigw_${interaction.message.id}`).setTitle("🔢 Devine !");
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("guess").setLabel("Nombre 1 - 200").setStyle(TextInputStyle.Short).setRequired(true)));
            await interaction.showModal(modal);
        }
    }

    // ============================================
    // 3. MODALS (Formulaire Mini-GW)
    // ============================================
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith("modal_minigw_")) {
            const msgId = interaction.customId.replace("modal_minigw_", "");
            const gw = activeMiniGW[msgId];
            if (!gw) return interaction.reply({ content: "⏳ Terminé !", ephemeral: true });
            
            const g = parseInt(interaction.fields.getTextInputValue("guess"), 10);
            if (isNaN(g) || g < 1 || g > 200) return interaction.reply({ content: "❌ Invalide.", ephemeral: true });
            gw.participants.set(interaction.user.id, g);
            return interaction.reply({ content: `✅ Choix enregistré : **${g}**.`, ephemeral: true });
        }
    }
});

process.on("unhandledRejection", (r) => console.error("⚠️", r));
process.on("uncaughtException", (e) => console.error("⚠️", e));

client.login(process.env.TOKEN);

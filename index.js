const express = require("express");
const fs = require("fs");
const path = require("path");
const { 
    Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField
} = require("discord.js");
require("dotenv").config();

// ---------------- SERVER WEB POUR RENDER ----------------
const app = express();
const PORT = process.env.PORT || 10000;
app.get("/", (req, res) => res.send("Le bot Kyotaru Family est 100% opérationnel !"));
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
        serveur: { nom: "💻 Serveur clandestin", prix: 500, revenu: 25 },
        bunker: { nom: "🛡️ Bunker de données", prix: 2000, revenu: 120 },
        casino: { nom: "🎰 Mini-Casino", prix: 7500, revenu: 500 },
        syndicat: { nom: "👑 QG du Syndicat", prix: 25000, revenu: 2000 }
    };
}
function sauvegarderDonnees() { fs.writeFileSync(bddPath, JSON.stringify(bdd, null, 2)); }

const activeGW = {};
const activeMiniGW = {};

function checkCooldown(userId, commande, delaiMs) {
    if (!bdd.cooldowns[userId]) bdd.cooldowns[userId] = {};
    const dernierAppel = bdd.cooldowns[userId][commande] || 0;
    const tempsEcoule = Date.now() - dernierAppel;
    if (tempsEcoule < delaiMs) return Math.ceil((delaiMs - tempsEcoule) / 1000); 
    bdd.cooldowns[userId][commande] = Date.now();
    sauvegarderDonnees();
    return 0;
}

// ---------------- ENREGISTREMENT DES COMMANDES ----------------
const commands = [
    new SlashCommandBuilder().setName("help").setDescription("Affiche la liste complète de toutes les commandes du bot"),
    
    // ÉCONOMIE
    new SlashCommandBuilder().setName("profil").setDescription("Affiche ton empire").addUserOption(opt => opt.setName("membre").setDescription("Le membre")),
    new SlashCommandBuilder().setName("points").setDescription("Affiche tes KyotaruPoints").addUserOption(opt => opt.setName("membre").setDescription("Le membre")),
    new SlashCommandBuilder().setName("daily").setDescription("Récupère tes dividendes quotidiens"),
    new SlashCommandBuilder().setName("leaderboard").setDescription("Affiche le Top 10"),
    new SlashCommandBuilder().setName("settitle").setDescription("Change ton titre").addStringOption(opt => opt.setName("titre").setDescription("Ton nouveau titre").setRequired(true)),
    new SlashCommandBuilder().setName("banque").setDescription("Gère ton coffre-fort")
        .addSubcommand(sub => sub.setName("deposer").setDescription("Mettre des points à l'abri").addIntegerOption(opt => opt.setName("montant").setDescription("Montant").setRequired(true)))
        .addSubcommand(sub => sub.setName("retirer").setDescription("Retirer des points").addIntegerOption(opt => opt.setName("montant").setDescription("Montant").setRequired(true)))
        .addSubcommand(sub => sub.setName("solde").setDescription("Voir le solde bancaire")),

    // BUSINESS
    new SlashCommandBuilder().setName("boutique").setDescription("Affiche la liste des bâtiments"),
    new SlashCommandBuilder().setName("acheter").setDescription("Acheter un bâtiment").addStringOption(opt => opt.setName("id").setDescription("L'ID du bâtiment").setRequired(true)),
    new SlashCommandBuilder().setName("investir").setDescription("Placer des points en bourse").addIntegerOption(opt => opt.setName("montant").setDescription("Montant à investir").setRequired(true)),
    new SlashCommandBuilder().setName("recolter").setDescription("Récolter les points générés"),

    // CASINO & FUN
    new SlashCommandBuilder().setName("slots").setDescription("Machine à sous").addIntegerOption(opt => opt.setName("mise").setDescription("Montant").setRequired(true)),
    new SlashCommandBuilder().setName("coinflip").setDescription("Double ou quitte").addStringOption(opt => opt.setName("choix").setDescription("pile ou face").setRequired(true).addChoices({name: "Pile", value: "pile"}, {name: "Face", value: "face"})).addIntegerOption(opt => opt.setName("mise").setDescription("Mise").setRequired(true)),
    new SlashCommandBuilder().setName("roulette").setDescription("Mise sur une couleur").addStringOption(opt => opt.setName("couleur").setDescription("Rouge, Noir ou Vert").setRequired(true).addChoices({name: "Rouge", value: "rouge"}, {name: "Noir", value: "noir"}, {name: "Vert", value: "vert"})).addIntegerOption(opt => opt.setName("mise").setDescription("Mise").setRequired(true)),
    new SlashCommandBuilder().setName("hack").setDescription("Voler 30% des points").addUserOption(opt => opt.setName("membre").setDescription("Victime").setRequired(true)),
    new SlashCommandBuilder().setName("antihack").setDescription("Place un pare-feu (50 pts)").addUserOption(opt => opt.setName("membre").setDescription("Le hacker").setRequired(true)),
    new SlashCommandBuilder().setName("pourcentage").setDescription("Test de pourcentage").addStringOption(opt => opt.setName("type").setDescription("Test").setRequired(true).addChoices({name: "Gay", value: "gay"}, {name: "Furry", value: "furry"}, {name: "Gigachad", value: "gigachad"}, {name: "Traître", value: "traitre"})).addUserOption(opt => opt.setName("membre").setDescription("Le membre")),
    new SlashCommandBuilder().setName("8ball").setDescription("Pose une question magique").addStringOption(opt => opt.setName("question").setDescription("Ta question").setRequired(true)),
    new SlashCommandBuilder().setName("baffe").setDescription("Donne une claque").addUserOption(opt => opt.setName("membre").setDescription("Victime").setRequired(true)),

    // GIVEAWAYS & STAFF
    new SlashCommandBuilder().setName("giveaway").setDescription("Giveaway payant").addStringOption(opt => opt.setName("prix").setDescription("Cadeau").setRequired(true)).addIntegerOption(opt => opt.setName("cout").setDescription("Frais").setRequired(true)).addIntegerOption(opt => opt.setName("minutes").setDescription("Durée").setRequired(true)),
    new SlashCommandBuilder().setName("minigw").setDescription("Mini Giveaway (50s)").addStringOption(opt => opt.setName("prix").setDescription("Cadeau").setRequired(true)).addIntegerOption(opt => opt.setName("nombre").setDescription("Nombre (1-200)").setRequired(true)),
    new SlashCommandBuilder().setName("annonce").setDescription("Faire une annonce").addStringOption(opt => opt.setName("message").setDescription("Message").setRequired(true)).addStringOption(opt => opt.setName("style").setDescription("Format").setRequired(true).addChoices({name: "Embed", value: "embed"}, {name: "Texte", value: "texte"})),
    new SlashCommandBuilder().setName("kick").setDescription("Exclure").addUserOption(opt => opt.setName("membre").setDescription("Membre").setRequired(true)).addStringOption(opt => opt.setName("raison").setDescription("Raison")),
    new SlashCommandBuilder().setName("ban").setDescription("Bannir").addUserOption(opt => opt.setName("membre").setDescription("Membre").setRequired(true)).addStringOption(opt => opt.setName("raison").setDescription("Raison")),
    new SlashCommandBuilder().setName("mute").setDescription("Mute").addUserOption(opt => opt.setName("membre").setDescription("Membre").setRequired(true)).addIntegerOption(opt => opt.setName("minutes").setDescription("Minutes").setRequired(true)),
    new SlashCommandBuilder().setName("unmute").setDescription("Unmute").addUserOption(opt => opt.setName("membre").setDescription("Membre").setRequired(true)),
    new SlashCommandBuilder().setName("clear").setDescription("Nettoyer messages").addIntegerOption(opt => opt.setName("nombre").setDescription("Nombre").setRequired(true)),
    new SlashCommandBuilder().setName("warn").setDescription("Avertir").addUserOption(opt => opt.setName("membre").setDescription("Membre").setRequired(true)).addStringOption(opt => opt.setName("raison").setDescription("Raison")),
    
    new SlashCommandBuilder().setName("staff").setDescription("Panneau de Direction")
        .addSubcommandGroup(group => group.setName("eco").setDescription("Gérer l'argent")
            .addSubcommand(sub => sub.setName("ajouter").setDescription("Ajouter points").addUserOption(opt => opt.setName("membre").setDescription("Joueur").setRequired(true)).addIntegerOption(opt => opt.setName("montant").setDescription("Montant").setRequired(true)))
            .addSubcommand(sub => sub.setName("retirer").setDescription("Retirer points").addUserOption(opt => opt.setName("membre").setDescription("Joueur").setRequired(true)).addIntegerOption(opt => opt.setName("montant").setDescription("Montant").setRequired(true)))
            .addSubcommand(sub => sub.setName("set").setDescription("Définir montant").addUserOption(opt => opt.setName("membre").setDescription("Joueur").setRequired(true)).addIntegerOption(opt => opt.setName("montant").setDescription("Montant").setRequired(true)))
        )
        .addSubcommandGroup(group => group.setName("batiment").setDescription("Gérer les bâtiments")
            .addSubcommand(sub => sub.setName("donner").setDescription("Offrir").addUserOption(opt => opt.setName("membre").setDescription("Joueur").setRequired(true)).addStringOption(opt => opt.setName("id").setDescription("ID").setRequired(true)).addIntegerOption(opt => opt.setName("quantite").setDescription("Quantité").setRequired(true)))
        )
        .addSubcommandGroup(group => group.setName("entreprise").setDescription("Nouvelles entreprises")
            .addSubcommand(sub => sub.setName("creer").setDescription("Ajouter boutique").addStringOption(opt => opt.setName("id").setDescription("ID").setRequired(true)).addStringOption(opt => opt.setName("nom").setDescription("Nom").setRequired(true)).addIntegerOption(opt => opt.setName("prix").setDescription("Prix").setRequired(true)).addIntegerOption(opt => opt.setName("revenu").setDescription("Revenu").setRequired(true)))
        )
].map(command => command.toJSON());

// FIX DU READY: utilisation de clientReady au lieu de ready
client.once("clientReady", async () => {
    console.log(`🤖 Connecté : ${client.user.tag}`);
    client.user.setActivity("Gérer l'Empire Kyotaru 📈");
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (error) { console.error(error); }
});

// ---------------- GESTION DES COMMANDES ----------------
client.on("interactionCreate", async interaction => {
    
    if (interaction.isChatInputCommand()) {
        const { commandName, options, user, member } = interaction;
        const isStaff = user.id === STAFF_ID || (member && member.roles.cache.has(STAFF_ID));

        if (!bdd.points[user.id]) bdd.points[user.id] = 100;
        if (!bdd.banque[user.id]) bdd.banque[user.id] = 0;
        if (!bdd.profil[user.id]) bdd.profil[user.id] = { titre: "Recrue Kyotaru", dailyCooldown: 0, warns: 0 };
        if (!bdd.entreprises[user.id]) bdd.entreprises[user.id] = {};
        if (!bdd.investissements[user.id]) bdd.investissements[user.id] = { dernierRecolte: Date.now() };
        if (!bdd.antihack[user.id]) bdd.antihack[user.id] = {};

        // SECURITE STAFF
        const commandesStaff = ["staff", "annonce", "warn", "mute", "unmute", "clear", "kick", "ban", "giveaway", "minigw"];
        if (commandesStaff.includes(commandName) && !isStaff) {
            return interaction.reply({ content: "❌ Accès refusé. Réservé au Staff.", ephemeral: true });
        }

        // --- COMMANDES GENERALES ---
        if (commandName === "help") {
            const embed = new EmbedBuilder().setTitle("📚 Commandes de l'Empire Kyotaru").setColor("#3498db")
                .addFields(
                    { name: "💰 Économie", value: "`/daily`, `/profil`, `/points`, `/settitle`, `/banque`, `/leaderboard`" },
                    { name: "🏢 Business", value: "`/boutique`, `/acheter`, `/recolter`, `/investir`" },
                    { name: "🎰 Casino & Fun", value: "`/slots`, `/roulette`, `/coinflip`, `/hack`, `/antihack`, `/8ball`, `/baffe`, `/pourcentage`" },
                    { name: "🎁 Événements", value: "`/giveaway`, `/minigw`" }
                ).setFooter({ text: "Utilise les commandes Slash pour jouer !" });
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === "profil") {
            const cible = options.getUser("membre") || user;
            if (!bdd.profil[cible.id]) return interaction.reply("❌ Joueur introuvable.");
            const p = bdd.profil[cible.id];
            let entTxt = "";
            if (bdd.entreprises[cible.id]) {
                for (const [id, qte] of Object.entries(bdd.entreprises[cible.id])) {
                    if (bdd.boutique[id]) entTxt += `- ${bdd.boutique[id].nom} (x${qte})\n`;
                }
            }
            if (entTxt === "") entTxt = "Aucun bâtiment.";
            const embed = new EmbedBuilder().setTitle(`Profil de ${cible.username}`).setColor("#f1c40f")
                .addFields(
                    { name: "🏷️ Titre", value: p.titre, inline: true },
                    { name: "⚠️ Avertissements", value: `${p.warns || 0}`, inline: true },
                    { name: "🪙 Poches", value: `${bdd.points[cible.id] || 0} pts`, inline: true },
                    { name: "🏦 Banque", value: `${bdd.banque[cible.id] || 0} pts`, inline: true },
                    { name: "🏢 Entreprises", value: entTxt, inline: false }
                );
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === "leaderboard") {
            const top = Object.entries(bdd.points).sort((a, b) => b[1] - a[1]).slice(0, 10);
            let desc = "";
            top.forEach(([id, pts], index) => { desc += `**${index + 1}.** <@${id}> - 🪙 ${pts} pts\n`; });
            const embed = new EmbedBuilder().setTitle("🏆 Classement des plus riches").setColor("#e67e22").setDescription(desc || "Aucun joueur.");
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === "points") {
            const cible = options.getUser("membre") || user;
            return interaction.reply(`🪙 Poche: **${bdd.points[cible.id] || 0} pts** | 🏦 Banque: **${bdd.banque[cible.id] || 0} pts**`);
        }

        if (commandName === "settitle") {
            const titre = options.getString("titre");
            bdd.profil[user.id].titre = titre; sauvegarderDonnees();
            return interaction.reply(`✅ Ton titre est maintenant : **${titre}**`);
        }

        if (commandName === "daily") {
            if (Date.now() < bdd.profil[user.id].dailyCooldown) return interaction.reply({ content: "⏳ Tu as déjà récupéré tes points aujourd'hui.", ephemeral: true });
            bdd.points[user.id] += 300; bdd.profil[user.id].dailyCooldown = Date.now() + 86400000; sauvegarderDonnees();
            return interaction.reply("🎁 **+300 pts** quotidiens ! Reviens demain.");
        }

        if (commandName === "banque") {
            const sous = options.getSubcommand();
            if (sous === "solde") return interaction.reply(`🏦 Solde bancaire : **${bdd.banque[user.id]} pts**.`);
            const mt = options.getInteger("montant");
            if (sous === "deposer") {
                if (bdd.points[user.id] < mt) return interaction.reply("❌ Fonds insuffisants dans tes poches.");
                bdd.points[user.id] -= mt; bdd.banque[user.id] += mt; sauvegarderDonnees();
                return interaction.reply(`🏦 **${mt} pts** placés en sécurité.`);
            }
            if (sous === "retirer") {
                if (bdd.banque[user.id] < mt) return interaction.reply("❌ Fonds bancaires insuffisants.");
                bdd.banque[user.id] -= mt; bdd.points[user.id] += mt; sauvegarderDonnees();
                return interaction.reply(`🏦 **${mt} pts** retirés de la banque.`);
            }
        }

        // --- BUSINESS ---
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
            if (gains <= 0) return interaction.reply("❌ Tu n'as aucun bâtiment productif.");
            bdd.points[user.id] += gains;
            bdd.investissements[user.id].dernierRecolte = Date.now();
            sauvegarderDonnees();
            return interaction.reply(`💰 Tu as récolté **+${gains} pts** pour ${h}h de travail !`);
        }

        if (commandName === "investir") {
            const cd = checkCooldown(user.id, "investir", 600000); // 10 min
            if (cd > 0) return interaction.reply({ content: `⏳ La bourse est fermée. Attends ${Math.ceil(cd/60)} min.`, ephemeral: true });
            const mt = options.getInteger("montant");
            if (bdd.points[user.id] < mt) return interaction.reply("❌ Fonds insuffisants.");
            const chance = Math.random();
            if (chance > 0.5) {
                const gain = Math.floor(mt * 1.5);
                bdd.points[user.id] += (gain - mt); sauvegarderDonnees();
                return interaction.reply(`📈 Bon placement ! Tu récupères **${gain} pts** !`);
            } else {
                bdd.points[user.id] -= mt; sauvegarderDonnees();
                return interaction.reply(`📉 Krach boursier... Tu as tout perdu (**-${mt} pts**).`);
            }
        }

        // --- HACK, CASINO & FUN ---
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
            if(c.id === user.id) return interaction.reply("Tu ne peux pas te pirater toi-même !");
            await interaction.reply(`🛸 Piratage de **${c.username}** en cours...`);
            setTimeout(() => {
                if (bdd.antihack[c.id] && bdd.antihack[c.id][user.id]) {
                    bdd.points[user.id] = Math.max(0, bdd.points[user.id] - 100);
                    bdd.antihack[c.id][user.id] = false; sauvegarderDonnees();
                    return interaction.editReply(`💥 **ALERTE !** ${c.username} avait un Anti-Hack. Tu perds **100 pts**.`);
                }
                const vol = Math.floor((bdd.points[c.id] || 0) * 0.30);
                if (vol < 5) return interaction.editReply(`🏴‍☠️ ${c.username} est trop pauvre pour être piraté.`);
                bdd.points[c.id] -= vol; bdd.points[user.id] += vol; sauvegarderDonnees();
                return interaction.editReply(`🏴‍☠️ **SUCCÈS !** Tu as siphonné 30% : **+${vol} pts** !`);
            }, 3000);
            return;
        }

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
            if (commandName === "coinflip") {
                const c = options.getString("choix");
                const r = Math.random() > 0.5 ? "pile" : "face";
                if (c === r) { bdd.points[user.id] += m * 2; sauvegarderDonnees(); return interaction.reply(`🪙 La pièce tombe sur **${r}** ! Tu gagnes **${m*2} pts** !`); }
                sauvegarderDonnees(); return interaction.reply(`🪙 La pièce tombe sur **${r}**... Tu perds tout.`);
            }
            if (commandName === "slots") {
                const emojis = ["🍎", "🍇", "🍒", "💎"];
                const res = [emojis[Math.floor(Math.random()*4)], emojis[Math.floor(Math.random()*4)], emojis[Math.floor(Math.random()*4)]];
                if (res[0] === res[1] && res[1] === res[2]) { bdd.points[user.id] += m * 5; sauvegarderDonnees(); return interaction.reply(`🎰 [ ${res.join(" | ")} ] JACKPOT ! Tu gagnes **${m*5} pts** !`); }
                sauvegarderDonnees(); return interaction.reply(`🎰 [ ${res.join(" | ")} ] Perdu...`);
            }
        }

        if (commandName === "pourcentage") {
            const cible = options.getUser("membre") || user;
            const type = options.getString("type");
            const score = Math.floor(Math.random() * 101);
            return interaction.reply(`📊 ${cible.username} est à **${score}%** ${type} !`);
        }
        
        if (commandName === "8ball") {
            const rep = ["Oui absolument.", "C'est certain.", "Pas du tout.", "Je ne pense pas...", "Demande-moi plus tard.", "Peut-être bien..."];
            return interaction.reply(`🎱 **Question:** ${options.getString("question")}\n💬 **Réponse:** ${rep[Math.floor(Math.random()*rep.length)]}`);
        }

        if (commandName === "baffe") {
            return interaction.reply(`👋 <@${user.id}> a mis une baffe magistrale à <@${options.getUser("membre").id}> ! *CLAC !*`);
        }

        // --- GIVEAWAYS ---
        if (commandName === "giveaway") {
            const prix = options.getString("prix"), cout = options.getInteger("cout"), min = options.getInteger("minutes");
            const endTime = Math.floor(Date.now() / 1000) + (min * 60);
            const embed = new EmbedBuilder().setTitle("🎉 GIVEAWAY PAYANT !").setDescription(`**Prix :** ${prix}\n**Frais :** 🪙 ${cout} pts\n**Tirage :** <t:${endTime}:R>`).setColor("#9b59b6");
            const btn = new ButtonBuilder().setCustomId("btn_gw_join").setLabel(`Participer (-${cout} pts)`).setStyle(ButtonStyle.Success).setEmoji("🎟️");
            const msg = await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)], fetchReply: true });

            activeGW[msg.id] = { prix, cout, participants: new Set() };
            setTimeout(async () => {
                const gwData = activeGW[msg.id]; if (!gwData) return;
                const pArray = Array.from(gwData.participants);
                const wEmbed = new EmbedBuilder().setTitle("🏁 Fin du Giveaway");
                if (pArray.length === 0) wEmbed.setDescription("Personne n'a participé...").setColor("#e74c3c");
                else wEmbed.setDescription(`🎉 Gagnant : <@${pArray[Math.floor(Math.random() * pArray.length)]}> remporte **${gwData.prix}** !`).setColor("#f1c40f");
                btn.setDisabled(true); await msg.edit({ components: [new ActionRowBuilder().addComponents(btn)] });
                await interaction.channel.send({ embeds: [wEmbed] }); delete activeGW[msg.id];
            }, min * 60000);
            return;
        }

        if (commandName === "minigw") {
            const prix = options.getString("prix"), secret = options.getInteger("nombre");
            if (secret < 1 || secret > 200) return interaction.reply({ content: "❌ Nombre entre 1 et 200.", ephemeral: true });
            const endTime = Math.floor(Date.now() / 1000) + 50;
            const embed = new EmbedBuilder().setTitle("⚡ MINI GIVEAWAY ÉCLAIR !").setDescription(`🎁 **Prix :** ${prix}\n⏳ **Fin :** <t:${endTime}:R>\n\nAppuie sur le bouton bleu pour trouver le nombre secret (1-200) !`).setColor("#3498db");
            const btn = new ButtonBuilder().setCustomId("btn_minigw").setLabel("Deviner").setStyle(ButtonStyle.Primary).setEmoji("⏱️");
            const msg = await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)], fetchReply: true });

            activeMiniGW[msg.id] = { secret, prix, participants: new Map() };
            setTimeout(async () => {
                const gwData = activeMiniGW[msg.id]; if (!gwData) return;
                const winners = [];
                for (const [userId, guess] of gwData.participants.entries()) { if (guess === gwData.secret) winners.push(`<@${userId}>`); }
                btn.setDisabled(true); await msg.edit({ components: [new ActionRowBuilder().addComponents(btn)] });
                const rEmbed = new EmbedBuilder().setTitle("🏁 Fin du Mini Giveaway !");
                if (winners.length > 0) rEmbed.setDescription(`Nombre exact : **${gwData.secret}** !\n🎉 **Gagnant(s) :** ${winners.join(", ")}\n🎁 **Gagné :** ${gwData.prix}`).setColor("#2ecc71");
                else rEmbed.setDescription(`Nombre exact : **${gwData.secret}** !\n❌ Personne n'a trouvé.`).setColor("#e74c3c");
                await interaction.channel.send({ embeds: [rEmbed] }); delete activeMiniGW[msg.id];
            }, 50000);
            return;
        }

        // --- STAFF & MODERATION ---
        if (commandName === "annonce") {
            const msg = options.getString("message");
            if (options.getString("style") === "embed") {
                return interaction.reply({ embeds: [new EmbedBuilder().setDescription(msg).setColor("Red")] });
            }
            return interaction.reply("📢 " + msg);
        }

        if (commandName === "warn") {
            const c = options.getUser("membre");
            if(!bdd.profil[c.id]) bdd.profil[c.id] = { warns: 0 };
            bdd.profil[c.id].warns = (bdd.profil[c.id].warns || 0) + 1; sauvegarderDonnees();
            return interaction.reply(`⚠️ ${c.username} a reçu un avertissement. (Total: ${bdd.profil[c.id].warns})`);
        }

        if (commandName === "clear") {
            try { await interaction.channel.bulkDelete(options.getInteger("nombre"), true); return interaction.reply({ content: `🗑️ Messages supprimés.`, ephemeral: true }); }
            catch(e) { return interaction.reply({ content: "Erreur, messages trop anciens.", ephemeral: true}); }
        }

        if (commandName === "kick" || commandName === "ban" || commandName === "mute" || commandName === "unmute") {
            try {
                const targetMember = await interaction.guild.members.fetch(options.getUser("membre").id);
                if (commandName === "kick") { await targetMember.kick(options.getString("raison")); return interaction.reply(`🚪 ${targetMember.user.username} a été expulsé.`); }
                if (commandName === "ban") { await targetMember.ban({ reason: options.getString("raison") }); return interaction.reply(`🔨 ${targetMember.user.username} a été banni.`); }
                if (commandName === "mute") { await targetMember.timeout(options.getInteger("minutes") * 60000); return interaction.reply(`🔇 ${targetMember.user.username} est muté pour ${options.getInteger("minutes")} min.`); }
                if (commandName === "unmute") { await targetMember.timeout(null); return interaction.reply(`🔊 ${targetMember.user.username} peut de nouveau parler.`); }
            } catch(e) { return interaction.reply({ content: "❌ Impossible d'agir sur ce membre (Permissions insuffisantes).", ephemeral: true}); }
        }

        if (commandName === "staff") {
            const groupe = options.getSubcommandGroup(), sous = options.getSubcommand();
            if (groupe === "eco") {
                const cible = options.getUser("membre"), mt = options.getInteger("montant");
                if (!bdd.points[cible.id]) bdd.points[cible.id] = 0;
                if (sous === "ajouter") bdd.points[cible.id] += mt;
                if (sous === "retirer") bdd.points[cible.id] = Math.max(0, bdd.points[cible.id] - mt);
                if (sous === "set") bdd.points[cible.id] = mt;
                sauvegarderDonnees(); return interaction.reply(`✅ Solde de ${cible.username} : **${bdd.points[cible.id]} pts**.`);
            }
            if (groupe === "batiment") {
                const cible = options.getUser("membre"), idBat = options.getString("id").toLowerCase(), qte = options.getInteger("quantite");
                if (!bdd.boutique[idBat]) return interaction.reply("❌ Bâtiment introuvable.");
                if (!bdd.entreprises[cible.id]) bdd.entreprises[cible.id] = {};
                bdd.entreprises[cible.id][idBat] = (bdd.entreprises[cible.id][idBat] || 0) + qte; sauvegarderDonnees();
                return interaction.reply(`✅ ${qte}x ${bdd.boutique[idBat].nom} donnés à ${cible.username}.`);
            }
            if (groupe === "entreprise") {
                const id = options.getString("id").toLowerCase(), nom = options.getString("nom"), prix = options.getInteger("prix"), rev = options.getInteger("revenu");
                bdd.boutique[id] = { nom, prix, revenu: rev }; sauvegarderDonnees();
                return interaction.reply(`✅ **Entreprise créée :** ${nom} ajoutée à la boutique !`);
            }
        }

        // ============================================
        // BOUCLIER ANTI-CRASH DISCORD (TRES IMPORTANT)
        // ============================================
        if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({ content: "🛠️ Commande introuvable ou en construction.", ephemeral: true });
        }
    }

    // ============================================
    // BOUTONS (Giveaways)
    // ============================================
    if (interaction.isButton()) {
        if (interaction.customId === "btn_gw_join") {
            const gw = activeGW[interaction.message.id];
            if (!gw) return interaction.reply({ content: "❌ Terminé.", ephemeral: true });
            if (gw.participants.has(interaction.user.id)) return interaction.reply({ content: "Déjà inscrit.", ephemeral: true });
            if (bdd.points[interaction.user.id] < gw.cout) return interaction.reply({ content: `❌ Il te faut ${gw.cout} pts.`, ephemeral: true });
            bdd.points[interaction.user.id] -= gw.cout; sauvegarderDonnees(); gw.participants.add(interaction.user.id);
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
    // MODALS (Formulaire Mini-GW)
    // ============================================
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith("modal_minigw_")) {
            const msgId = interaction.customId.replace("modal_minigw_", "");
            const gw = activeMiniGW[msgId];
            if (!gw) return interaction.reply({ content: "⏳ Terminé !", ephemeral: true });
            const g = parseInt(interaction.fields.getTextInputValue("guess"), 10);
            if (isNaN(g) || g < 1 || g > 200) return interaction.reply({ content: "❌ Invalide (1-200).", ephemeral: true });
            gw.participants.set(interaction.user.id, g);
            return interaction.reply({ content: `✅ Choix enregistré : **${g}**.`, ephemeral: true });
        }
    }
});

process.on("unhandledRejection", (r) => console.error("⚠️", r));
process.on("uncaughtException", (e) => console.error("⚠️", e));

client.login(process.env.TOKEN);


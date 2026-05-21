const express = require('express');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

// ---------------- SERVER WEB POUR RENDER ----------------
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send("Le bot Kyotaru Family est en ligne et protégé contre la mise en veille !");
});

app.listen(PORT, () => {
    console.log(`Serveur Web Kyotaru activé sur le port ${PORT} (Anti-crash Render).`);
});

// ---------------- CONFIGURATION DISCORD ----------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

const STAFF_ID = "1499852043408642099"; // Rôle ou ID staff autorisé
const LOG_CHANNEL_ID = "1506792520133251253"; // Salon de logs

// Base de données locale
const bddPath = path.join(__dirname, 'kyotarudata.json');
let bdd = { points: {}, giveaways: {} };

if (fs.existsSync(bddPath)) {
    try { 
        bdd = JSON.parse(fs.readFileSync(bddPath, 'utf-8')); 
    } catch (e) {
        console.error("Erreur lecture BDD:", e);
    }
}
function sauvegarderDonnees() { 
    fs.writeFileSync(bddPath, JSON.stringify(bdd, null, 2)); 
}

// ---------------- ENREGISTREMENT DES SLASH COMMANDS ----------------
const commands = [
    new SlashCommandBuilder().setName('points').setDescription('Affiche tes KyotaruPoints ou ceux d\'un membre').addUserOption(opt => opt.setName('membre').setDescription('Le membre à vérifier')),
    new SlashCommandBuilder().setName('setpoints').setDescription('Définir les points d\'un membre (Staff)').addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true)).addIntegerOption(opt => opt.setName('montant').setDescription('Le montant').setRequired(true)),
    new SlashCommandBuilder().setName('giveaway').setDescription('Lancer un grand giveaway (Staff)').addIntegerOption(opt => opt.setName('temps').setDescription('Temps en minutes').setRequired(true)).addStringOption(opt => opt.setName('lot').setDescription('Le lot à gagner').setRequired(true)),
    new SlashCommandBuilder().setName('minigiveaway').setDescription('Lancer un mini giveaway (Staff)').addIntegerOption(opt => opt.setName('temps').setDescription('Temps en minutes').setRequired(true)).addStringOption(opt => opt.setName('lot').setDescription('Le lot à gagner').setRequired(true)),
    new SlashCommandBuilder().setName('kick').setDescription('Exclure un membre (Staff)').addUserOption(opt => opt.setName('membre').setDescription('Le membre à exclure').setRequired(true)).addStringOption(opt => opt.setName('raison').setDescription('La raison')),
    new SlashCommandBuilder().setName('ban').setDescription('Bannir un membre (Staff)').addUserOption(opt => opt.setName('membre').setDescription('Le membre à bannir').setRequired(true)).addStringOption(opt => opt.setName('raison').setDescription('La raison')),
    new SlashCommandBuilder().setName('slots').setDescription('Jeu de la machine à sous de la famille'),
    new SlashCommandBuilder().setName('hack').setDescription('Simuler un piratage style Cyber-Attaque Kyotaru').addUserOption(opt => opt.setName('membre').setDescription('La victime').setRequired(true)),
    new SlashCommandBuilder().setName('fruit').setDescription('Reçois un fruit de l\'intendant Kyotaru'),
    new SlashCommandBuilder().setName('respect').setDescription('Calcule ton taux de respect dans la famille').addUserOption(opt => opt.setName('membre').setDescription('Le membre')),
    new SlashCommandBuilder().setName('bounty').setDescription('Découvre ta prime de recherche (Bounty Crew)'),
    new SlashCommandBuilder().setName('duel').setDescription('Lancer un duel de sabre au hasard'),
    new SlashCommandBuilder().setName('boss').setDescription('Lâche une punchline de haut gradé'),
    new SlashCommandBuilder().setName('slap').setDescription('Donne une balayette réglementaire').addUserOption(opt => opt.setName('membre').setDescription('Le membre à corriger').setRequired(true)),
    new SlashCommandBuilder().setName('alliance').setDescription('Teste ton alliance fraternelle avec un membre').addUserOption(opt => opt.setName('membre').setDescription('L\'allié').setRequired(true)),
    new SlashCommandBuilder().setName('secret').setDescription('Fuite de l\'historique secret d\'un membre'),
    new SlashCommandBuilder().setName('avatar').setDescription('Afficher la fiche d\'identité visuelle d\'un membre').addUserOption(opt => opt.setName('membre').setDescription('Le membre'))
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`[Kyotaru Family] Bot connecté en tant que : ${client.user.tag}`);
    client.user.setActivity('Protéger la Kyotaru Family ⚔️');
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('🔄 Enregistrement des commandes / en cours...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Toutes les commandes / ont été enregistrées avec succès !');
    } catch (error) {
        console.error("Erreur enregistrement commandes :", error);
    }
});

// ---------------- GESTION DES COMMANDES INTERACTION ----------------
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, guild, member } = interaction;
    const logChannel = guild ? guild.channels.cache.get(LOG_CHANNEL_ID) : null;

    // 🪙 POINTS
    if (commandName === 'points') {
        const cible = options.getUser('membre') || user;
        const pts = bdd.points[cible.id] || 0;
        return interaction.reply(`🪙 **${cible.username}** possède actuellement **${pts} KyotaruPoints** !`);
    }

    if (commandName === 'setpoints') {
        if (user.id !== STAFF_ID && (!member || !member.roles.cache.has(STAFF_ID))) {
            return interaction.reply({ content: "❌ Tu ne possèdes pas les permissions requises pour modifier les points.", ephemeral: true });
        }
        const cible = options.getUser('membre');
        const montant = options.getInteger('montant');
        bdd.points[cible.id] = montant;
        sauvegarderDonnees();
        return interaction.reply(`✅ Les **KyotaruPoints** de ${cible.username} ont été définis à **${montant}** !`);
    }

    // 🎉 GIVEAWAYS
    if (commandName === 'giveaway' || commandName === 'minigiveaway') {
        if (user.id !== STAFF_ID && (!member || !member.roles.cache.has(STAFF_ID))) {
            return interaction.reply({ content: "❌ Réservé aux hauts gradés de la famille.", ephemeral: true });
        }
        const temps = options.getInteger('temps');
        const lot = options.getString('lot');
        
        const embed = new EmbedBuilder()
            .setTitle(commandName === 'minigiveaway' ? "🎁 MINI GIVEAWAY !" : "🎉 GRAND GIVEAWAY !")
            .setDescription(`Réagissez avec 🎉 pour participer !\n\n**Lot :** ${lot}\n**Temps :** ${temps} minute(s)`)
            .setColor(commandName === 'minigiveaway' ? 0x3498db : 0xe74c3c)
            .setTimestamp();
            
        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
        await msg.react("🎉");
        return;
    }

    // 🛡️ MODERATION
    if (commandName === 'kick' || commandName === 'ban') {
        if (user.id !== STAFF_ID && (!member || !member.roles.cache.has(STAFF_ID))) {
            return interaction.reply({ content: "❌ Tu ne possèdes pas le rôle requis pour exécuter la modération de la Kyotaru Family.", ephemeral: true });
        }
        const cible = options.getMember('membre');
        const raison = options.getString('raison') || "Exclu par un haut gradé de la famille.";

        if (!cible) return interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });

        if (commandName === 'kick') {
            if (!cible.kickable) return interaction.reply("❌ Impossible d'expulser ce membre. Permissions trop basses.");
            await cible.kick(raison);
            interaction.reply(`🥾 **${cible.user.tag}** a été éjecté du serveur.`);
            
            if (logChannel) {
                const embedLog = new EmbedBuilder()
                    .setTitle('🥾 [KICK] Expulsion Kyotaru')
                    .setColor('#d2691e')
                    .addFields(
                        { name: 'Membre Expulsé', value: `${cible.user.tag} (${cible.id})` },
                        { name: 'Exécuté par', value: `${user.tag}` },
                        { name: 'Raison officielle', value: raison }
                    ).setTimestamp();
                logChannel.send({ embeds: [embedLog] });
            }
        }

        if (commandName === 'ban') {
            if (!cible.bannable) return interaction.reply("❌ Impossible de bannir ce membre. Mes permissions sont trop basses.");
            await cible.ban({ reason: raison });
            interaction.reply(`🚨 **${cible.user.tag}** a été banni définitivement de la Kyotaru Family.`);
            
            if (logChannel) {
                const embedLog = new EmbedBuilder()
                    .setTitle('🚷 [BAN] Bannissement Kyotaru')
                    .setColor('#8b0000')
                    .addFields(
                        { name: 'Membre Banni', value: `${cible.user.tag} (${cible.id})` },
                        { name: 'Exécuté par', value: `${user.tag}` },
                        { name: 'Raison officielle', value: raison }
                    ).setTimestamp();
                logChannel.send({ embeds: [embedLog] });
            }
        }
        return;
    }

    // 🕹️ 10 COMMANDES FUN
    if (commandName === 'slots') {
        const emojis = ["🍎", "🍋", "🍇", "💎", "👑"];
        const r1 = emojis[Math.floor(Math.random() * emojis.length)];
        const r2 = emojis[Math.floor(Math.random() * emojis.length)];
        const r3 = emojis[Math.floor(Math.random() * emojis.length)];
        return interaction.reply(`🎰 **[ ${r1} | ${r2} | ${r3} ]**\n${(r1 === r2 && r2 === r3) ? "🎉 INCROYABLE ! Tu as gagné le gros lot de la famille !" : "❌ Oh non, tu as perdu !"}`);
    }

    if (commandName === 'hack') {
        const cible = options.getUser('membre');
        await interaction.reply(`🛰️ Initialisation du protocole \`Kyotaru_NetCrack.sh\`...`);
        
        setTimeout(() => interaction.editReply(`🕵️‍♂️ Infiltration des bases de données de **${cible.username}** en cours...`), 1500);
        setTimeout(() => interaction.editReply(`🌐 Adresse IP locale interceptée : \`172.16.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}\``), 3000);
        setTimeout(() => interaction.editReply(`⚠️ Dossier secret découvert : *"Comment battre la Kyotaru Family en 1v1 (Tuto raté)"*`), 4500);
        setTimeout(() => interaction.editReply(`🏴 **${cible.username}** a été piraté avec succès par la Kyotaru Family ! Vol de robux terminé. 🔥`), 6000);
    }

    if (commandName === 'fruit') {
        const fruits = ['🍌 Kilo', '🍏 Spin', '🕵️‍♂️ Chop', '🔥 Flame', '❄️ Ice', '💡 Light', '🌋 Magma', '✨ Buddha', '🍩 Dough', '🐆 Leopard', '🐉 Dragon'];
        const randomFruit = fruits[Math.floor(Math.random() * fruits.length)];
        return interaction.reply(`🎁 L'intendant de la Kyotaru Family t'offre le fruit suivant : **${randomFruit}** !`);
    }

    if (commandName === 'respect') {
        const cible = options.getUser('membre') || user;
        const respectPercent = Math.floor(Math.random() * 101);
        let grade = "Nouvelle Recrue 🪙";
        if (respectPercent > 40) grade = "Membre Respectable ⚔️";
        if (respectPercent > 75) grade = "Bras Droit de confiance 🎖️";
        if (respectPercent === 100) grade = "Parrain de la Famille 👑";
        return interaction.reply(`📊 Le taux de respect de **${cible.username}** au sein de la Kyotaru Family est de **${respectPercent}%**.\n**Statut :** \`${grade}\``);
    }

    if (commandName === 'bounty') {
        const fakeBounty = (Math.random() * 30).toFixed(1);
        return interaction.reply(`🏴 Si la Marine mettait ta tête à prix, tu vaudrais environ **${fakeBounty} Millions** de Berrys !`);
    }

    if (commandName === 'duel') {
        const issues = ['⚔️ Tu as sorti ton sabre en premier, tu gagnes le duel !', '🌊 Tu as glissé dans l\'eau avant même le combat. Défaite humiliante.'];
        return interaction.reply(issues[Math.floor(Math.random() * issues.length)]);
    }

    if (commandName === 'boss') {
        const punchlines = ["On ne choisit pas la Kyotaru Family, c'est elle qui nous choisit.", "Ta puissance fait trembler les boss de la troisième mer.", "Ne parle pas de skill à un haut gradé."];
        return interaction.reply(`🕶️ ${punchlines[Math.floor(Math.random() * punchlines.length)]}`);
    }

    if (commandName === 'slap') {
        const cible = options.getUser('membre');
        if (cible.id === user.id) return interaction.reply({ content: "Tu ne peux pas te donner une balayette toi-même !", ephemeral: true });
        return interaction.reply(`💥 **${user.username}** remet les idées en place de **${cible.username}** avec une énorme balayette réglementaire !`);
    }

    if (commandName === 'alliance') {
        const cible = options.getUser('membre');
        return interaction.reply(`🤛 **Taux de fraternité** entre **${user.username}** et **${cible.username}** : **${Math.floor(Math.random() * 101)}%** d'affinité !`);
    }

    if (commandName === 'secret') {
        const secrets = ["Comment faire croire qu'on a du skill ?", "Acheter un faux badge d'admin Roblox", "Pourquoi mon clavier a volé après un ragequit ?"];
        return interaction.reply(`🔍 Historique secret de **${user.username}** :\n*"${secrets[Math.floor(Math.random() * secrets.length)]}"*`);
    }

    if (commandName === 'avatar') {
        const cible = options.getUser('membre') || user;
        const embedAvatar = new EmbedBuilder()
            .setTitle(`📸 Fiche d'identité visuelle de : ${cible.username}`)
            .setImage(cible.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setColor('#1a1a1a');
        return interaction.reply({ embeds: [embedAvatar] });
    }
});

// Anti-crash global
process.on('unhandledRejection', (reason) => console.error('⚠️ [ANTI-CRASH] Rejet non géré :', reason));
process.on('uncaughtException', (err) => console.error('⚠️ [ANTI-CRASH] Exception non capturée :', err));

client.login(process.env.TOKEN);

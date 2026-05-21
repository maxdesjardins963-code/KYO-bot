const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Kyotaru Bot Slash en ligne !'));
app.listen(process.env.PORT || 10000);

const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// CONFIGURATION 
const STAFF_ID = "1499852043408642099"; // Garde ton ID ici
const LOGS_CHANNEL_ID = "1506792520133251253";

// Base de données locale
const bddPath = path.join(__dirname, 'kyotarudata.json');
let bdd = { points: {}, giveaways: {} };

if (fs.existsSync(bddPath)) {
    try { bdd = JSON.parse(fs.readFileSync(bddPath, 'utf-8')); } catch (e) {}
}
function sauvegarderDonnees() { fs.writeFileSync(bddPath, JSON.stringify(bdd, null, 2)); }

// Liste des commandes à enregistrer chez Discord
const commands = [
    new SlashCommandBuilder().setName('points').setDescription('Affiche tes KyotaruPoints ou ceux d\'un membre').addUserOption(opt => opt.setName('membre').setDescription('Le membre à checker')),
    new SlashCommandBuilder().setName('setpoints').setDescription('Définir les points d\'un membre (Staff)').addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true)).addIntegerOption(opt => opt.setName('montant').setDescription('Le montant').setRequired(true)),
    new SlashCommandBuilder().setName('giveaway').setDescription('Lancer un grand giveaway (Staff)').addIntegerOption(opt => opt.setName('temps').setDescription('Temps en minutes').setRequired(true)).addStringOption(opt => opt.setName('lot').setDescription('Le lot à gagner').setRequired(true)),
    new SlashCommandBuilder().setName('minigiveaway').setDescription('Lancer un mini giveaway (Staff)').addIntegerOption(opt => opt.setName('temps').setDescription('Temps en minutes').setRequired(true)).addStringOption(opt => opt.setName('lot').setDescription('Le lot à gagner').setRequired(true)),
    new SlashCommandBuilder().setName('kick').setDescription('Exclure un membre (Staff)').addUserOption(opt => opt.setName('membre').setDescription('Le membre à exclure').setRequired(true)).addStringOption(opt => opt.setName('raison').setDescription('La raison')),
    new SlashCommandBuilder().setName('ban').setDescription('Bannir un membre (Staff)').addUserOption(opt => opt.setName('membre').setDescription('Le membre à bannir').setRequired(true)).addStringOption(opt => opt.setName('raison').setDescription('La raison')),
    new SlashCommandBuilder().setName('slots').setDescription('Jeu de la machine à sous'),
    new SlashCommandBuilder().setName('hack').setDescription('Simuler un piratage fun sur un membre').addUserOption(opt => opt.setName('membre').setDescription('La victime').setRequired(true)),
    new SlashCommandBuilder().setName('iq').setDescription('Affiche ton QI ou celui d\'un membre').addUserOption(opt => opt.setName('membre').setDescription('Le membre')),
    new SlashCommandBuilder().setName('fight').setDescription('Affronter un membre au hasard').addUserOption(opt => opt.setName('adversaire').setDescription('Ton adversaire').setRequired(true)),
    new SlashCommandBuilder().setName('joke').setDescription('Raconte une blague de papa'),
    new SlashCommandBuilder().setName('bg').setDescription('Calcule le taux de BG').addUserOption(opt => opt.setName('membre').setDescription('Le membre')),
    new SlashCommandBuilder().setName('sus').setDescription('Calcule le taux de suspicion').addUserOption(opt => opt.setName('membre').setDescription('Le membre')),
    new SlashCommandBuilder().setName('dice').setDescription('Lancer un dé à 6 faces'),
    new SlashCommandBuilder().setName('8ball').setDescription('Poser une question à la boule magique').addStringOption(opt => opt.setName('question').setDescription('Ta question').setRequired(true)),
    new SlashCommandBuilder().setName('avatar').setDescription('Afficher l\'avatar d\'un membre').addUserOption(opt => opt.setName('membre').setDescription('Le membre'))
].map(command => command.toJSON());

// Enregistrement des commandes quand le bot s'allume
client.once('ready', async () => {
    console.log(`🤖 Bot connecté sur ${client.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('🔄 Enregistrement des commandes / en cours...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Toutes les commandes / ont été enregistrées avec succès !');
    } catch (error) {
        console.error(error);
    }
});

// Gestionnaire des interactions (Slash Commands)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, guild } = interaction;

    // 🪙 POINTS
    if (commandName === 'points') {
        const cible = options.getUser('membre') || user;
        const pts = bdd.points[cible.id] || 0;
        return interaction.reply(`🪙 **${cible.username}** possède **${pts} KyotaruPoints** !`);
    }

    if (commandName === 'setpoints') {
        if (user.id !== STAFF_ID) return interaction.reply({ content: "❌ Réservé au staff.", ephemeral: true });
        const cible = options.getUser('membre');
        const montant = options.getInteger('montant');
        bdd.points[cible.id] = montant;
        sauvegarderDonnees();
        return interaction.reply(`✅ Les **KyotaruPoints** de ${cible.username} ont été définis à **${montant}** !`);
    }

    // 🎉 GIVEAWAYS
    if (commandName === 'giveaway' || commandName === 'minigiveaway') {
        if (user.id !== STAFF_ID) return interaction.reply({ content: "❌ Réservé au staff.", ephemeral: true });
        const temps = options.getInteger('temps');
        const lot = options.getString('lot');
        
        const embed = new EmbedBuilder()
            .setTitle(commandName === 'minigiveaway' ? "🎁 MINI GIVEAWAY !" : "🎉 GRAND GIVEAWAY !")
            .setDescription(`Réagissez avec 🎉 !\n\n**Lot :** ${lot}\n**Temps :** ${temps} min`)
            .setColor(commandName === 'minigiveaway' ? 0x3498db : 0xe74c3c);
            
        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
        await msg.react("🎉");
    }

    // 🛡️ MODERATION
    if (commandName === 'kick') {
        if (user.id !== STAFF_ID) return interaction.reply({ content: "❌ Réservé au staff.", ephemeral: true });
        const cible = options.getMember('membre');
        const raison = options.getString('raison') || "Aucune raison";
        await cible.kick(raison);
        return interaction.reply(`✅ ${cible.user.tag} a été expulsé.`);
    }

    if (commandName === 'ban') {
        if (user.id !== STAFF_ID) return interaction.reply({ content: "❌ Réservé au staff.", ephemeral: true });
        const cible = options.getMember('membre');
        const raison = options.getString('raison') || "Aucune raison";
        await cible.ban({ reason: raison });
        return interaction.reply(`✅ ${cible.user.tag} a été banni.`);
    }

    // 🕹️ COMMANDES FUN
    if (commandName === 'slots') {
        const emojis = ["🍎", "🍋", "🍇", "💎", "👑"];
        const r1 = emojis[Math.floor(Math.random() * emojis.length)];
        const r2 = emojis[Math.floor(Math.random() * emojis.length)];
        const r3 = emojis[Math.floor(Math.random() * emojis.length)];
        return interaction.reply(`🎰 **[ ${r1} | ${r2} | ${r3} ]**\n${(r1===r2 && r2===r3) ? "🎉 Gagné !" : "❌ Perdu !"}`);
    }

    if (commandName === 'hack') {
        const cible = options.getUser('membre');
        await interaction.reply(`💻 Initialisation du piratage sur **${cible.username}**...`);
        setTimeout(() => interaction.editReply(`🕵️‍♂️ IP : \`192.168.${Math.floor(Math.random()*254)}.${Math.floor(Math.random()*254)}\`...`), 2000);
        setTimeout(() => interaction.editReply(`💸 Piratage complet réussi ! Vol de robux terminé ! 🔥`), 4000);
    }

    if (commandName === 'joke') {
        const blagues = ["Que dit une imprimante en colère ? J'ai des feuilles blanches !", "Quel est le comble pour un électricien ? De ne pas être au courant."];
        return interaction.reply(`💬 ${blagues[Math.floor(Math.random() * blagues.length)]}`);
    }

    if (commandName === 'iq') {
        const cible = options.getUser('membre') || user;
        return interaction.reply(`🧠 QI de **${cible.username}** : **${Math.floor(Math.random() * 200)}**`);
    }

    if (commandName === 'bg') {
        const cible = options.getUser('membre') || user;
        return interaction.reply(`✨ Taux de BG de **${cible.username}** : **${Math.floor(Math.random() * 101)}%** 😎`);
    }
    
    if (commandName === 'sus') {
        const cible = options.getUser('membre') || user;
        return interaction.reply(`🕵️‍♂️ **${cible.username}** est suspect à **${Math.floor(Math.random() * 101)}%**`);
    }

    if (commandName === 'dice') {
        return interaction.reply(`🎲 Résultat du dé : **${Math.floor(Math.random() * 6) + 1}**`);
    }

    if (commandName === '8ball') {
        const reponses = ["Oui !", "Non.", "Peut-être...", "C'est certain."];
        return interaction.reply(`🔮 *${options.getString('question')}*\n🎱 **Réponse :** ${reponses[Math.floor(Math.random() * reponses.length)]}`);
    }

    if (commandName === 'avatar') {
        const cible = options.getUser('membre') || user;
        return interaction.reply(`🖼️ Avatar de ${cible.username} :\n${cible.displayAvatarURL({ dynamic: true, size: 1024 })}`);
    }
});

client.login(process.env.TOKEN);

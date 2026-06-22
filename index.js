require('dotenv').config();
const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes, 
    ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder
} = require('discord.js');
const fs = require('fs');
const express = require('express');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent] 
});

// 🔴 TON ID DE ROLE STAFF ICI 🔴
const STAFF_ROLE_ID = '1502765782960967861'; 

// --- BASE DE DONNÉES ---
const dbPath = './kyo_db.json';
let db = { users: {} };
if (fs.existsSync(dbPath)) { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); }

function saveDB() { fs.writeFileSync(dbPath, JSON.stringify(db, null, 4)); }

function addPoints(userId, amount) {
    if (!db.users[userId]) db.users[userId] = { kyop: 0 };
    db.users[userId].kyop += amount;
    saveDB();
}

// --- SYSTÈME ANTI-SPAM & VARIABLES GLOBALES ---
const usedInteractions = new Set(); // Stocke les actions déjà utilisées pour bloquer les doubles clics

let activeGames = {
    boss: { hp: 0, actif: false, msgId: null },
    drapeau: { reponse: null, points: 0, actif: false },
    math: { reponse: null, points: 0, actif: false },
    mot: { reponse: null, points: 0, actif: false },
    guerre: { red: new Set(), blue: new Set(), actif: false }, // Les Set() empêchent les joueurs d'être comptés 2 fois
    heist: { players: new Set(), actif: false },
    survie: { votes: {}, bonneRep: null, points: 0, actif: false }
};

// --- ENREGISTREMENT DES COMMANDES ---
const commands = [
    new SlashCommandBuilder().setName('panel').setDescription('[STAFF] Afficher le grand guide explicatif des jeux'),
    new SlashCommandBuilder().setName('giveaway').setDescription('[STAFF] Lance un grand giveaway de Kyo Points').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Le lot')).addIntegerOption(o=>o.setName('minutes').setRequired(true).setDescription('Durée')),
    new SlashCommandBuilder().setName('remove').setDescription('[STAFF] Retirer des Kyo Points à un joueur').addUserOption(o=>o.setName('user').setRequired(true).setDescription('Joueur')).addIntegerOption(o=>o.setName('montant').setRequired(true).setDescription('Montant')),
    new SlashCommandBuilder().setName('reset').setDescription('[STAFF] Réinitialiser à 0 les points d\'un joueur').addUserOption(o=>o.setName('user').setRequired(true).setDescription('Joueur')),
    new SlashCommandBuilder().setName('drop').setDescription('[STAFF] Lâche un coffre').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Lot')),
    new SlashCommandBuilder().setName('boss').setDescription('[STAFF] Invoque un Boss').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Lot')).addIntegerOption(o=>o.setName('pv').setRequired(true).setDescription('PV')),
    new SlashCommandBuilder().setName('loto').setDescription('[STAFF] Lance un Loto express').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Lot')).addIntegerOption(o=>o.setName('gagnant').setRequired(true).setDescription('Gagnant')).addIntegerOption(o=>o.setName('max').setRequired(true).setDescription('Max')),
    new SlashCommandBuilder().setName('drapeau').setDescription('[STAFF] Quiz Drapeau').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Lot')).addStringOption(o=>o.setName('emoji').setRequired(true).setDescription('Emoji')).addStringOption(o=>o.setName('pays').setRequired(true).setDescription('Pays')),
    new SlashCommandBuilder().setName('math').setDescription('[STAFF] Calcul mental').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Lot')).addStringOption(o=>o.setName('calcul').setRequired(true).setDescription('Calcul')).addIntegerOption(o=>o.setName('reponse').setRequired(true).setDescription('Réponse')),
    new SlashCommandBuilder().setName('roulette').setDescription('[STAFF] Roulette Russe').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Lot')),
    new SlashCommandBuilder().setName('guerre').setDescription('[STAFF] Guerre Rouge vs Bleu (30s)').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Lot')),
    new SlashCommandBuilder().setName('sniper').setDescription('[STAFF] Test de réflexe').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Lot')),
    new SlashCommandBuilder().setName('bombe').setDescription('[STAFF] Démineur').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Lot')),
    new SlashCommandBuilder().setName('mot').setDescription('[STAFF] Dactylo inversé').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Lot')).addStringOption(o=>o.setName('mot_inverse').setRequired(true).setDescription('Mot à l\'envers')).addStringOption(o=>o.setName('reponse').setRequired(true).setDescription('Réponse')),
    new SlashCommandBuilder().setName('braquage').setDescription('[STAFF] Braquage collectif').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Lot')),
    new SlashCommandBuilder().setName('survie').setDescription('[STAFF] Jeu de survie').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Lot')).addStringOption(o=>o.setName('question').setRequired(true).setDescription('Question')).addStringOption(o=>o.setName('bonne_rep').setRequired(true).setDescription('A ou B')),
    new SlashCommandBuilder().setName('flash').setDescription('[STAFF] Tirage Éclair 15s').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Lot')),
    new SlashCommandBuilder().setName('chifoumi').setDescription('[STAFF] Chifoumi Bot').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Lot')),
    new SlashCommandBuilder().setName('jackpot').setDescription('[STAFF] Machine à sous').addIntegerOption(o=>o.setName('kyop').setRequired(true).setDescription('Lot')),
    
    new SlashCommandBuilder().setName('balance').setDescription('Voir ses Kyo Points (Public)').addUserOption(o=>o.setName('user').setDescription('Joueur').setRequired(false))
];

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} est en ligne !`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
});

// ==========================================
// ⚙️ GESTION DES COMMANDES (AVEC SÉCURITÉ)
// ==========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'balance') {
        const user = interaction.options.getUser('user') || interaction.user;
        const pts = db.users[user.id]?.kyop || 0;
        return interaction.reply(`💳 **${user.username}** possède **${pts} Kyo Points** 💠`);
    }

    // 🔒 SÉCURITÉ STAFF ABSOLUE : Stoppe toute personne sans le rôle
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
        return interaction.reply({ content: "⛔ **Accès refusé.** Tu n'es pas autorisé à utiliser les commandes Staff.", ephemeral: true });
    }

    const { commandName, options } = interaction;
    const prize = options.getInteger('kyop') || 0;
    const UID = Date.now().toString(); // Identifiant unique pour ce jeu

    // MODÉRATION
    if (commandName === 'remove') {
        const targetUser = options.getUser('user');
        const amount = options.getInteger('montant');
        if (!db.users[targetUser.id]) db.users[targetUser.id] = { kyop: 0 };
        db.users[targetUser.id].kyop = Math.max(0, db.users[targetUser.id].kyop - amount);
        saveDB();
        return interaction.reply(`📉 **Sanction :** **${amount} Kyo Points** retirés à **${targetUser.username}**.`);
    }

    if (commandName === 'reset') {
        const targetUser = options.getUser('user');
        if (db.users[targetUser.id]) {
            db.users[targetUser.id].kyop = 0;
            saveDB();
        }
        return interaction.reply(`🗑️ **Reset effectué :** Les points de **${targetUser.username}** sont à 0.`);
    }

    if (commandName === 'panel') {
        const embed = new EmbedBuilder().setTitle("📜 GUIDE KYO").setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('panel_guide_kyo').setPlaceholder('Voir les explications...').addOptions([
                { label: 'Kyo Points', value: 'guide_kyop', emoji: '💠' },
                { label: 'Raids & Boss', value: 'guide_boss', emoji: '👹' },
                { label: 'Jeux', value: 'guide_games', emoji: '🎰' }
            ])
        );
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    // JEUX À BOUTON UNIQUE (Le premier clic détruit le bouton)
    if (commandName === 'drop') {
        const embed = new EmbedBuilder().setTitle("📦 COFFRE DROPPÉ !").setDescription(`Contient **${prize} Kyo Points** !\nPremier arrivé, premier servi !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`action_drop_${prize}_${UID}`).setLabel('PILLER').setStyle(ButtonStyle.Success).setEmoji('💰'));
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (commandName === 'roulette') {
        const embed = new EmbedBuilder().setTitle("🔫 ROULETTE RUSSE").setDescription(`Survie : +${prize} Points\nÉchec : -50% de tes points.`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`action_roulette_${prize}_${UID}`).setLabel('TIRER').setStyle(ButtonStyle.Danger));
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (commandName === 'bombe') {
        const embed = new EmbedBuilder().setTitle("💣 BOMBE ACTIVE").setDescription(`Coupe le fil. Réussite : +${prize} Points | Échec : -100 Points.`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`action_bombe_${prize}_${UID}`).setLabel('Couper ✂️').setStyle(ButtonStyle.Primary));
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (commandName === 'chifoumi') {
        const embed = new EmbedBuilder().setTitle("✊✋✌️ CHIFOUMI").setDescription(`Battez le bot pour **${prize} Points** !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`action_rps_p_${prize}_${UID}`).setLabel('PIERRE ✊').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`action_rps_f_${prize}_${UID}`).setLabel('PAPIER ✋').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`action_rps_c_${prize}_${UID}`).setLabel('CISEAUX ✌️').setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (commandName === 'jackpot') {
        const embed = new EmbedBuilder().setTitle("🎰 JACKPOT").setDescription(`3 symboles identiques = **${prize} Points** !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`action_jackpot_${prize}_${UID}`).setLabel('LEVIER 🎰').setStyle(ButtonStyle.Primary));
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (commandName === 'loto') {
        const max = options.getInteger('max');
        const win = options.getInteger('gagnant');
        const embed = new EmbedBuilder().setTitle("🎰 LOTO EXPRESS").setDescription(`Chiffre mystère entre **1 et ${max}** pour **${prize} Points** !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`action_loto_${win}_${max}_${prize}_${UID}`).setLabel('Tenter 🎫').setStyle(ButtonStyle.Primary));
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    // JEUX À DÉLAI ET SPAM 
    if (commandName === 'sniper') {
        await interaction.reply({ content: "🎯 *Préparez-vous...*", fetchReply: true });
        setTimeout(async () => {
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`action_sniper_${prize}_${UID}`).setLabel('🔥 TIREZ !').setStyle(ButtonStyle.Danger));
            await interaction.channel.send({ content: "💥", components: [row] });
        }, Math.floor(Math.random() * 6000) + 3000);
        return;
    }

    if (commandName === 'boss') {
        activeGames.boss = { hp: options.getInteger('pv'), actif: true, msgId: UID };
        const embed = new EmbedBuilder().setTitle("👹 BOSS DE RAID !").setDescription(`**PV :** ${activeGames.boss.hp}\nLe coup fatal remporte **${prize} Points** !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`action_boss_${prize}_${UID}`).setLabel('FRAPPER ⚔️').setStyle(ButtonStyle.Danger));
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    // JEUX COLLECTIFS
    if (commandName === 'guerre') {
        activeGames.guerre = { red: new Set(), blue: new Set(), actif: true };
        const embed = new EmbedBuilder().setTitle("⚔️ GUERRE (30s)").setDescription(`Chaque gagnant prend **${prize} Points** !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`action_war_red_${prize}`).setLabel('ROUGE 🔴').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`action_war_blue_${prize}`).setLabel('BLEU 🔵').setStyle(ButtonStyle.Primary)
        );
        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
        
        setTimeout(async () => {
            activeGames.guerre.actif = false;
            const rCount = activeGames.guerre.red.size;
            const bCount = activeGames.guerre.blue.size;
            let winners = [];
            let txt = "Égalité !";
            if (rCount > bCount) { winners = Array.from(activeGames.guerre.red); txt = `🔴 Victoire ROUGE (${rCount} vs ${bCount}) !`; }
            else if (bCount > rCount) { winners = Array.from(activeGames.guerre.blue); txt = `🔵 Victoire BLEU (${bCount} vs ${rCount}) !`; }
            
            winners.forEach(id => addPoints(id, prize));
            await msg.edit({ content: `🏁 **FIN !** ${txt}`, embeds: [], components: [] });
        }, 30000);
        return;
    }

    if (commandName === 'braquage') {
        activeGames.heist = { players: new Set(), actif: true };
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('action_heist_join').setLabel('Rejoindre le Van 🚔').setStyle(ButtonStyle.Secondary));
        const msg = await interaction.reply({ content: `💰 **BRAQUAGE (20s)**\nSi on réussit, chaque joueur prend **${prize} Points** !`, components: [row], fetchReply: true });
        
        setTimeout(async () => {
            activeGames.heist.actif = false;
            if (activeGames.heist.players.size === 0) return msg.edit({ content: "❌ Annulé, personne n'est venu.", components: [] });
            
            if (Math.random() < 0.55) {
                Array.from(activeGames.heist.players).forEach(id => addPoints(id, prize));
                await msg.edit({ content: `✅ **RÉUSSITE !** Tous les braqueurs s'enfuient avec **${prize} Points** !`, components: [] });
            } else {
                await msg.edit({ content: `🚨 **ÉCHEC !** Arrêtés par la police, 0 point.`, components: [] });
            }
        }, 20000);
        return;
    }

    if (commandName === 'survie') {
        activeGames.survie = { votes: {}, bonneRep: options.getString('bonne_rep').toUpperCase(), points: prize, actif: true };
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('action_survie_A').setLabel('Option A').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('action_survie_B').setLabel('Option B').setStyle(ButtonStyle.Danger)
        );
        const msg = await interaction.reply({ content: `💀 **SURVIE (25s)**\n${options.getString('question')}`, components: [row], fetchReply: true });
        
        setTimeout(async () => {
            activeGames.survie.actif = false;
            let gagnants = [];
            for (const [uid, vote] of Object.entries(activeGames.survie.votes)) {
                if (vote === activeGames.survie.bonneRep) gagnants.push(uid);
            }
            gagnants.forEach(id => addPoints(id, prize));
            await msg.edit({ content: `🏁 **FIN !** La bonne réponse était **${activeGames.survie.bonneRep}**.\nFélicitations aux survivants !`, components: [] });
        }, 25000);
        return;
    }

    if (commandName === 'flash') {
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('action_flash_join').setLabel('PARTICIPER').setStyle(ButtonStyle.Success));
        const msg = await interaction.reply({ content: `⚡ **TIRAGE FLASH 15s !** (Lot : ${prize} Points)`, components: [row], fetchReply: true });
        
        let inscrits = new Set();
        const collector = msg.createMessageComponentCollector({ time: 15000 });
        collector.on('collect', async i => { inscrits.add(i.user.id); await i.reply({ content: "✅ Inscrit !", ephemeral: true }); });
        collector.on('end', async () => {
            const arr = Array.from(inscrits);
            if (arr.length === 0) return msg.edit({ content: "⏳ Aucun participant.", components: [] });
            const winner = arr[Math.floor(Math.random() * arr.length)];
            addPoints(winner, prize);
            await msg.edit({ content: `🎉 Flash terminé ! <@${winner}> gagne **${prize} Points** !`, components: [] });
        });
        return;
    }

    if (commandName === 'giveaway') {
        const minutes = options.getInteger('minutes');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('action_gw_join').setLabel('Participer 🎉').setStyle(ButtonStyle.Success));
        const msg = await interaction.reply({ content: `🎉 **GIVEAWAY DE ${prize} POINTS !**\n⏳ Fin dans ${minutes} minute(s).`, components: [row], fetchReply: true });

        let participants = new Set();
        const collector = msg.createMessageComponentCollector({ time: minutes * 60 * 1000 });
        collector.on('collect', async i => {
            if (participants.has(i.user.id)) return i.reply({ content: "⚠️ Tu es déjà inscrit !", ephemeral: true });
            participants.add(i.user.id);
            await i.reply({ content: "✅ Inscription validée !", ephemeral: true });
        });
        collector.on('end', async () => {
            const arr = Array.from(participants);
            if (arr.length === 0) return msg.edit({ content: "❌ Giveaway annulé (0 participant).", components: [] });
            const winnerId = arr[Math.floor(Math.random() * arr.length)];
            addPoints(winnerId, prize);
            await msg.edit({ content: `🎉 **GIVEAWAY TERMINÉ !**\nBravo à <@${winnerId}> qui remporte **${prize} Kyo Points** !`, components: [] });
        });
        return;
    }

    // JEUX DE CHAT PUR
    if (commandName === 'drapeau') {
        activeGames.drapeau = { reponse: options.getString('pays').toLowerCase(), points: prize, actif: true };
        return interaction.reply(`🌍 Trouvez le pays : ${options.getString('emoji')} (Lot: ${prize} pts)`);
    }
    if (commandName === 'math') {
        activeGames.math = { reponse: options.getInteger('reponse').toString(), points: prize, actif: true };
        return interaction.reply(`🧠 Calculez : **${options.getString('calcul')}** (Lot: ${prize} pts)`);
    }
    if (commandName === 'mot') {
        activeGames.mot = { reponse: options.getString('reponse').toLowerCase(), points: prize, actif: true };
        return interaction.reply(`🔤 Remettez ce mot à l'endroit : **${options.getString('mot_inverse')}** (Lot: ${prize} pts)`);
    }
});

// ==========================================
// 🛡️ SYSTÈME DE RÉPONSES AUX BOUTONS AVEC VERROUILLAGE ANTI-SPAM
// ==========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    const id = interaction.customId;
    const args = id.split('_');
    const UID = args[args.length - 1]; // Récupère le code unique à la fin de l'ID

    // VÉRIFICATION ANTI DOUBLE-CLIC (Le composant est "brûlé" après 1 usage)
    const singleUseGames = ['drop', 'sniper', 'bombe', 'roulette', 'rps', 'jackpot'];
    if (singleUseGames.some(game => id.includes(game))) {
        if (usedInteractions.has(UID)) {
            return interaction.reply({ content: "⏱️ Trop tard, cette action a déjà été effectuée par quelqu'un d'autre !", ephemeral: true });
        }
        usedInteractions.add(UID); // Verrouille le bouton instantanément
    }

    if (id.startsWith('action_drop_')) {
        const pts = parseInt(args[2]);
        addPoints(interaction.user.id, pts);
        return interaction.update({ content: `🎉 **Looté !** <@${interaction.user.id}> a ouvert le coffre et gagne **${pts} Points** !`, embeds: [], components: [] });
    }

    if (id.startsWith('action_sniper_')) {
        const pts = parseInt(args[2]);
        addPoints(interaction.user.id, pts);
        return interaction.update({ content: `🎯 **HEADSHOT !** <@${interaction.user.id}> a tiré le premier et prend **${pts} Points** !`, components: [] });
    }

    if (id.startsWith('action_bombe_')) {
        const pts = parseInt(args[2]);
        if (Math.random() < 0.25) {
            if (db.users[interaction.user.id]) db.users[interaction.user.id].kyop = Math.max(0, db.users[interaction.user.id].kyop - 100);
            saveDB();
            return interaction.update({ content: `💥 **BOOM !** <@${interaction.user.id}> s'est fait sauter avec la bombe (-100 pts).`, embeds: [], components: [] });
        } else {
            addPoints(interaction.user.id, pts);
            return interaction.update({ content: `🟢 **DÉMORCÉ !** <@${interaction.user.id}> a coupé le bon fil : **+${pts} Points** !`, embeds: [], components: [] });
        }
    }

    if (id.startsWith('action_roulette_')) {
        const pts = parseInt(args[2]);
        if (Math.random() < 0.166) { 
            if (db.users[interaction.user.id]) db.users[interaction.user.id].kyop = Math.floor(db.users[interaction.user.id].kyop / 2);
            saveDB();
            return interaction.update({ content: `💥 **PAN !** <@${interaction.user.id}> a perdu la moitié de ses points.`, embeds: [], components: [] });
        } else {
            addPoints(interaction.user.id, pts);
            return interaction.update({ content: `🍀 *Clic...* <@${interaction.user.id}> survit et encaisse **${pts} Points**.`, embeds: [], components: [] });
        }
    }

    if (id.startsWith('action_rps_')) {
        const choice = args[2];
        const pts = parseInt(args[3]);
        const rps = ['p', 'f', 'c'];
        const botPlay = rps[Math.floor(Math.random() * 3)];
        let res = "Égalité ! L'action a été annulée.";
        
        if ((choice === 'p' && botPlay === 'c') || (choice === 'f' && botPlay === 'p') || (choice === 'c' && botPlay === 'f')) {
            addPoints(interaction.user.id, pts);
            res = `🎉 <@${interaction.user.id}> a gagné contre le bot et remporte **${pts} Points** !`;
        } else if (choice !== botPlay) {
            res = `❌ <@${interaction.user.id}> a perdu contre le bot.`;
        }
        return interaction.update({ content: res, embeds: [], components: [] });
    }

    if (id.startsWith('action_jackpot_')) {
        const pts = parseInt(args[2]);
        const items = ['🍎', '💎', '🍋', '🔔', '🍀'];
        const [r1, r2, r3] = [items[Math.floor(Math.random()*5)], items[Math.floor(Math.random()*5)], items[Math.floor(Math.random()*5)]];
        if (r1 === r2 && r2 === r3) {
            addPoints(interaction.user.id, pts);
            return interaction.update({ content: `🎰 **[ ${r1} | ${r2} | ${r3} ]**\n🏆 **JACKPOT !** <@${interaction.user.id}> gagne **${pts} Points** !`, embeds: [], components: [] });
        } else {
            return interaction.update({ content: `🎰 **[ ${r1} | ${r2} | ${r3} ]**\n❌ <@${interaction.user.id}> a perdu au casino.`, embeds: [], components: [] });
        }
    }

    // SPAM BOUTONS MULTIPLES (Mais sécurisés)
    if (id.startsWith('action_boss_')) {
        if (!activeGames.boss.actif || activeGames.boss.msgId !== UID) return interaction.reply({ content: "❌ Le combat est terminé !", ephemeral: true });
        
        activeGames.boss.hp -= Math.floor(Math.random() * 12) + 4;
        
        if (activeGames.boss.hp <= 0 && activeGames.boss.actif) {
            activeGames.boss.actif = false; // Verrouille instantanément pour éviter le double loot
            const pts = parseInt(args[2]);
            addPoints(interaction.user.id, pts);
            return interaction.update({ content: `💀 **MONSTRE TERRASSÉ !** <@${interaction.user.id}> donne le coup de grâce et prend **${pts} Points** !`, embeds: [], components: [] });
        } else {
            return interaction.reply({ content: `⚔️ PV restants du Boss : **${activeGames.boss.hp}**.`, ephemeral: true });
        }
    }

    if (id.startsWith('action_war_')) {
        const team = args[2];
        if (!activeGames.guerre.actif) return interaction.reply({ content: "La guerre est finie !", ephemeral: true });
        if (team === 'red') activeGames.guerre.red.add(interaction.user.id);
        if (team === 'blue') activeGames.guerre.blue.add(interaction.user.id);
        return interaction.reply({ content: "⚔️ Position validée !", ephemeral: true });
    }

    if (id === 'action_heist_join') {
        if (!activeGames.heist.actif) return interaction.reply({ content: "Le van est déjà parti !", ephemeral: true });
        activeGames.heist.players.add(interaction.user.id);
        return interaction.reply({ content: "💼 Tu es prêt pour le casse.", ephemeral: true });
    }

    if (id.startsWith('action_survie_')) {
        const vote = args[2];
        if (!activeGames.survie.actif) return interaction.reply({ content: "Le temps est écoulé !", ephemeral: true });
        activeGames.survie.votes[interaction.user.id] = vote;
        return interaction.reply({ content: `Choix **${vote}** validé.`, ephemeral: true });
    }

    // GESTION LOTO
    if (id.startsWith('action_loto_')) {
        if (usedInteractions.has(UID)) return interaction.reply({ content: "⏱️ Le loto a déjà été trouvé !", ephemeral: true });
        const win = args[2], max = args[3], pts = args[4];
        const modal = new ModalBuilder().setCustomId(`modal_loto_${win}_${pts}_${UID}`).setTitle('Loto');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('choice').setLabel(`Entre 1 et ${max}`).setStyle(TextInputStyle.Short).setRequired(true)));
        await interaction.showModal(modal);
    }
});

// GESTION MODAL LOTO
client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit() || !interaction.customId.startsWith('modal_loto_')) return;
    
    const args = interaction.customId.split('_');
    const winNum = args[2], pts = parseInt(args[3]), UID = args[4];
    const ans = interaction.fields.getTextInputValue('choice').trim();
    
    if (usedInteractions.has(UID)) return interaction.reply({ content: "❌ Quelqu'un d'autre a déjà trouvé la réponse !", ephemeral: true });

    if (ans === winNum) {
        usedInteractions.add(UID); // Verrouille le loto
        addPoints(interaction.user.id, pts);
        return interaction.reply(`🎰 **NUMÉRO EXACT !** <@${interaction.user.id}> a démasqué le **${winNum}** et gagne **${pts} Points** !`);
    } else {
        return interaction.reply({ content: `❌ Faux !`, ephemeral: true });
    }
});

// MENU GUIDE EXPLICATIF
client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'panel_guide_kyo') return;
    const choice = interaction.values[0];
    let embed = new EmbedBuilder().setColor('#2b2d31');

    if (choice === 'guide_kyop') embed.setTitle("💠 SYSTÈME DE KYO POINTS").setDescription("Les points récompensent ta présence. Seul le staff les distribue.");
    else if (choice === 'guide_boss') embed.setTitle("👹 RAIDS BOSS").setDescription("Spammez le bouton ! Celui qui donne le dernier coup remporte le lot complet.");
    else if (choice === 'guide_games') embed.setTitle("🎰 MINI-JEUX").setDescription("Soyez le plus rapide sur les boutons et dans le chat pour rafler la mise.");

    return interaction.reply({ embeds: [embed], ephemeral: true });
});

// GESTION JEUX DANS LE CHAT (Drapeau, Math, Mot)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (activeGames.drapeau.actif && message.content.toLowerCase() === activeGames.drapeau.reponse) {
        activeGames.drapeau.actif = false;
        addPoints(message.author.id, activeGames.drapeau.points);
        return message.reply(`🌍 **RÉPONSE COMPLÈTE !** Bravo <@${message.author.id}>, c'était **${message.content}**. Gain : **${activeGames.drapeau.points} pts** !`);
    }
    if (activeGames.math.actif && message.content.trim() === activeGames.math.reponse) {
        activeGames.math.actif = false;
        addPoints(message.author.id, activeGames.math.points);
        return message.reply(`🧠 **GÉNIE !** <@${message.author.id}> valide en premier. Gain : **${activeGames.math.points} pts** !`);
    }
    if (activeGames.mot.actif && message.content.toLowerCase() === activeGames.mot.reponse) {
        activeGames.mot.actif = false;
        addPoints(message.author.id, activeGames.mot.points);
        return message.reply(`🔤 **Dactylo !** <@${message.author.id}> trouve en premier. Gain : **${activeGames.mot.points} pts** !`);
    }
});

const app = express();
app.listen(process.env.PORT || 3000);
client.login(process.env.TOKEN);

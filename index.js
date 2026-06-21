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
const STAFF_ROLE_ID = 'REMPLACE_PAR_ID_STAFF'; 

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

// --- VARIABLES DES JEUX EN COURS ---
let activeGames = {
    boss: { hp: 0, actif: false },
    drapeau: { reponse: null, points: 0, actif: false },
    math: { reponse: null, points: 0, actif: false },
    mot: { reponse: null, points: 0, actif: false },
    guerre: { red: [], blue: [], actif: false },
    heist: { players: [], actif: false },
    survie: { votes: {}, bonneRep: null, points: 0, actif: false }
};

// --- ENREGISTREMENT DES COMMANDES (15 JEUX + PANEL + BALANCE) ---
const commands = [
    new SlashCommandBuilder().setName('panel').setDescription('[STAFF] Afficher le grand guide explicatif des jeux'),
    
    new SlashCommandBuilder().setName('drop').setDescription('[STAFF] Lâche un coffre de Kyo Points')
        .addIntegerOption(o=>o.setName('kyop').setDescription('Le lot de Kyo Points à gagner').setRequired(true)),
        
    new SlashCommandBuilder().setName('boss').setDescription('[STAFF] Invoque un Boss de Raid')
        .addIntegerOption(o=>o.setName('kyop').setDescription('Le lot pour celui qui achève le boss').setRequired(true))
        .addIntegerOption(o=>o.setName('pv').setDescription('Points de vie du boss (ex: 200)').setRequired(true)),
        
    new SlashCommandBuilder().setName('loto').setDescription('[STAFF] Lance un Loto express')
        .addIntegerOption(o=>o.setName('kyop').setDescription('Le lot pour celui qui trouve le chiffre pile').setRequired(true))
        .addIntegerOption(o=>o.setName('gagnant').setDescription('Le numéro gagnant secret').setRequired(true))
        .addIntegerOption(o=>o.setName('max').setDescription('Chiffre maximum (ex: 50 pour chercher entre 1 et 50)').setRequired(true)),
        
    new SlashCommandBuilder().setName('drapeau').setDescription('[STAFF] Quiz Drapeau dans le chat')
        .addIntegerOption(o=>o.setName('kyop').setDescription('Le lot pour le premier qui trouve').setRequired(true))
        .addStringOption(o=>o.setName('emoji').setDescription('L\'emoji du drapeau (ex: 🇧🇷)').setRequired(true))
        .addStringOption(o=>o.setName('pays').setDescription('Le nom du pays exact en réponse').setRequired(true)),
        
    new SlashCommandBuilder().setName('math').setDescription('[STAFF] Lancer un calcul mental rapide')
        .addIntegerOption(o=>o.setName('kyop').setDescription('Le lot pour le premier qui donne le bon résultat').setRequired(true))
        .addStringOption(o=>o.setName('calcul').setDescription('Le calcul à afficher (ex: 12x4)').setRequired(true))
        .addIntegerOption(o=>o.setName('reponse').setDescription('La réponse au calcul').setRequired(true)),
        
    new SlashCommandBuilder().setName('roulette').setDescription('[STAFF] Ouvre la Roulette Russe des points')
        .addIntegerOption(o=>o.setName('kyop').setDescription('Le lot de points gagnés en cas de survie').setRequired(true)),
        
    new SlashCommandBuilder().setName('guerre').setDescription('[STAFF] Lance une guerre des clics Rouge vs Bleu (30s)')
        .addIntegerOption(o=>o.setName('kyop').setDescription('Le lot reçu par CHAQUE membre de l\'équipe gagnante').setRequired(true)),
        
    new SlashCommandBuilder().setName('sniper').setDescription('[STAFF] Test de réflexe pur (Sniper)')
        .addIntegerOption(o=>o.setName('kyop').setDescription('Le lot pour le tireur le plus rapide').setRequired(true)),
        
    new SlashCommandBuilder().setName('bombe').setDescription('[STAFF] Lance le démineur de bombe')
        .addIntegerOption(o=>o.setName('kyop').setDescription('Le lot gagné si le fil est bien coupé').setRequired(true)),
        
    new SlashCommandBuilder().setName('mot').setDescription('[STAFF] Dactylo à l\'envers')
        .addIntegerOption(o=>o.setName('kyop').setDescription('Le lot de points').setRequired(true))
        .addStringOption(o=>o.setName('mot_inverse').setDescription('Le mot écrit à l\'envers (ex: ORXEN)').setRequired(true))
        .addStringOption(o=>o.setName('reponse').setDescription('Le mot correct à l\'endroit (ex: NEXRO)').setRequired(true)),
        
    new SlashCommandBuilder().setName('braquage').setDescription('[STAFF] Organise un braquage de banque collectif')
        .addIntegerOption(o=>o.setName('kyop').setDescription('Le lot remporté par chaque braqueur si ça réussit').setRequired(true)),
        
    new SlashCommandBuilder().setName('survie').setDescription('[STAFF] Mini-jeu de survie (Vote A ou B)')
        .addIntegerOption(o=>o.setName('kyop').setDescription('Le lot pour les survivants qui ont bien voté').setRequired(true))
        .addStringOption(o=>o.setName('question').setDescription('La question éliminatoire').setRequired(true))
        .addStringOption(o=>o.setName('bonne_rep').setDescription('La bonne réponse (Mettre A ou B)').setRequired(true)),
        
    new SlashCommandBuilder().setName('flash').setDescription('[STAFF] Giveaway Éclair de 15 secondes')
        .addIntegerOption(o=>o.setName('kyop').setDescription('Le lot de points tiré au sort').setRequired(true)),
        
    new SlashCommandBuilder().setName('chifoumi').setDescription('[STAFF] Lance un Chifoumi contre le Bot')
        .addIntegerOption(o=>o.setName('kyop').setDescription('Le lot de points en cas de victoire contre le bot').setRequired(true)),
        
    new SlashCommandBuilder().setName('jackpot').setDescription('[STAFF] Active la Machine à sous (Jackpot)')
        .addIntegerOption(o=>o.setName('kyop').setDescription('Le lot si un joueur aligne 3 emojis identiques').setRequired(true)),

    new SlashCommandBuilder().setName('balance').setDescription('Voir ses Kyo Points (Public)').addUserOption(o=>o.setName('user').setDescription('Joueur').setRequired(false))
];

// ==========================================
// 📡 ENREGISTREMENT ET DEPLOIEMENT DE TOUTES LES COMMANDES COMME NEXRO BOT
// ==========================================
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} est connecté et prêt !`);
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        // Le fameux .put qui met à jour l'application de façon instantanée
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log("➡️ Toutes les commandes Kyo Bot ont été injectées avec succès !");
    } catch (error) {
        console.error("Erreur lors du .put :", error);
    }
});

// ==========================================
// ⚙️ EXÉCUTION DES INTERACTIONS SLASH (STAFF ONLY)
// ==========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'balance') {
        const user = interaction.options.getUser('user') || interaction.user;
        const pts = db.users[user.id]?.kyop || 0;
        return interaction.reply(`💳 **${user.username}** possède **${pts} Kyo Points** 💠`);
    }

    // Protection Staff absolue
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
        return interaction.reply({ content: "⛔ **Accès refusé.** Seul le Staff Kyo peut instancier ces modules de jeu.", ephemeral: true });
    }

    const { commandName, options } = interaction;
    const prize = options.getInteger('kyop') || 0;

    // --- LE PANEL GUIDE ---
    if (commandName === 'panel') {
        const embed = new EmbedBuilder()
            .setTitle("📜 GUIDE DES ÉVÉNEMENTS & JEUX KYO")
            .setDescription("Bienvenue sur le centre d'information du serveur. Le Staff lance régulièrement des mini-jeux interactifs ! Sélectionnez une catégorie ci-dessous pour comprendre les règles en moins de 40 secondes.")
            .setColor('#2b2d31');
        
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('panel_guide_kyo').setPlaceholder('Choisir un sujet explicatif...').addOptions([
                { label: 'Les Kyo Points (C\'est quoi ?)', value: 'guide_kyop', emoji: '💠' },
                { label: 'Les Raids & Boss', value: 'guide_boss', emoji: '👹' },
                { label: 'Les Jeux de Réflexes & Hasard', value: 'guide_games', emoji: '🎰' }
            ])
        );
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    // 1. DROP
    if (commandName === 'drop') {
        const embed = new EmbedBuilder().setTitle("📦 COFFRE SUR LE DISCORD !").setDescription(`Un coffre contenant **${prize} Kyo Points** vient de tomber !\nPressez le bouton pour tout piller !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`action_drop_${prize}`).setLabel('PILLER').setStyle(ButtonStyle.Success).setEmoji('💰'));
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    // 2. BOSS
    if (commandName === 'boss') {
        activeGames.boss.hp = options.getInteger('pv');
        activeGames.boss.actif = true;
        const embed = new EmbedBuilder().setTitle("👹 UN BOSS DE RAID APPARAÎT !").setDescription(`**PV restants :** ${activeGames.boss.hp}\nSpammez l'épée ! Le dernier coup valide remporte **${prize} Kyo Points** !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`action_boss_${prize}`).setLabel('FRAPPER ⚔️').setStyle(ButtonStyle.Danger));
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    // 3. LOTO
    if (commandName === 'loto') {
        const max = options.getInteger('max');
        const win = options.getInteger('gagnant');
        const embed = new EmbedBuilder().setTitle("🎰 LOTO INSTANTANÉ").setDescription(`Le Staff a verrouillé un numéro secret entre **1 et ${max}**.\nTrouvez-le pour empocher **${prize} Kyo Points** !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`action_loto_${win}_${max}_${prize}`).setLabel('Parier 🎫').setStyle(ButtonStyle.Primary));
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    // 4. DRAPEAU
    if (commandName === 'drapeau') {
        activeGames.drapeau = { reponse: options.getString('pays').toLowerCase(), points: prize, actif: true };
        return interaction.reply(`🌍 **BLIND TEST GÉOGRAPHIQUE**\nTrouvez le pays de ce drapeau : ${options.getString('emoji')}\n*Répondez directement dans le chat pour choper **${prize} Kyo Points** !*`);
    }

    // 5. MATH
    if (commandName === 'math') {
        activeGames.math = { reponse: options.getInteger('reponse').toString(), points: prize, actif: true };
        return interaction.reply(`🧠 **DÉFI MATHÉMATIQUE**\nCalculez rapidement : **${options.getString('calcul')}**\n*Premier à écrire le résultat exact = **${prize} Kyo Points** !*`);
    }

    // 6. ROULETTE RUSSE
    if (commandName === 'roulette') {
        const embed = new EmbedBuilder().setTitle("🔫 ROULETTE RUSSE").setDescription(`Tente ta chance face au barillet.\n**Survie :** +${prize} Kyo Points\n**Échec :** Tu perds la moitié de ton compte !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`action_roulette_${prize}`).setLabel('PRESSER LA DETENTE').setStyle(ButtonStyle.Danger));
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    // 7. GUERRE DES CLICS
    if (commandName === 'guerre') {
        activeGames.guerre = { red: [], blue: [], actif: true };
        const embed = new EmbedBuilder().setTitle("⚔️ GUERRE DES CLICS (30s)").setDescription(`Rejoignez une faction et cliquez à l'infini !\nChaque membre du groupe gagnant remporte **${prize} Kyo Points** !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`action_war_red_${prize}`).setLabel('ROUGE 🔴').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`action_war_blue_${prize}`).setLabel('BLEU 🔵').setStyle(ButtonStyle.Primary)
        );
        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
        
        setTimeout(async () => {
            activeGames.guerre.actif = false;
            const rCount = activeGames.guerre.red.length;
            const bCount = activeGames.guerre.blue.length;
            let winners = [];
            let texteWin = "Égalité ! Personne ne gagne.";
            
            if (rCount > bCount) {
                winners = activeGames.guerre.red;
                texteWin = `🔴 **L'Équipe ROUGE écrase le combat (${rCount} vs ${bCount}) !**`;
            } else if (bCount > rCount) {
                winners = activeGames.guerre.blue;
                texteWin = `🔵 **L'Équipe BLEUE écrase le combat (${bCount} vs ${rCount}) !**`;
            }
            
            winners.forEach(id => addPoints(id, prize));
            await msg.edit({ content: `🏁 **FIN DE LA GUERRE !**\n${texteWin}\nTous les gagnants reçoivent **${prize} Kyo Points** !`, embeds: [], components: [] });
        }, 30000);
        return;
    }

    // 8. SNIPER
    if (commandName === 'sniper') {
        await interaction.reply({ content: "🎯 *Le Sniper se met en joue... Concentrez-vous, le bouton va surgir !*", fetchReply: true });
        const delay = Math.floor(Math.random() * 6000) + 3000;
        
        setTimeout(async () => {
            const embed = new EmbedBuilder().setTitle("💥 FEU ! TIREZ !").setDescription("CLIQUEZ SUR LE BOUTON AVANT TOUT LE MONDE !").setColor('#2b2d31');
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`action_sniper_${prize}`).setLabel('🔥 SHOOT !').setStyle(ButtonStyle.Danger));
            await interaction.channel.send({ embeds: [embed], components: [row] });
        }, delay);
        return;
    }

    // 9. BOMBE
    if (commandName === 'bombe') {
        const embed = new EmbedBuilder().setTitle("💣 ALERTE À LA BOMBE").setDescription(`Un colis piégé est actif ! Tente de couper le bon fil.\n**Réussite :** +${prize} Kyo Points\n**Explosion :** -100 points.`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`action_bombe_${prize}`).setLabel('Couper le fil bleu ✂️').setStyle(ButtonStyle.Primary));
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    // 10. MOT INVERSÉ
    if (commandName === 'mot') {
        activeGames.mot = { reponse: options.getString('reponse').toLowerCase(), points: prize, actif: true };
        return interaction.reply(`🔤 **VITESSE DACTYLO**\nRemettez ce mot dans le bon sens : **${options.getString('mot_inverse')}**\n*Le premier qui écrit le mot correct s'empare de **${prize} Kyo Points** !*`);
    }

    // 11. BRAQUAGE COLLECTIF
    if (commandName === 'braquage') {
        activeGames.heist = { players: [], actif: true };
        const embed = new EmbedBuilder().setTitle("💰 BRAQUAGE DE LA BANQUE").setDescription(`Le Staff lance un braquage ! Cliquez pour monter dans la voiture.\nSi le casse réussit, CHAQUE complice gagne **${prize} Kyo Points** !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('action_heist_join').setLabel('Monter dans le van 🚔').setStyle(ButtonStyle.Secondary));
        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
        
        setTimeout(async () => {
            activeGames.heist.actif = false;
            if (activeGames.heist.players.length === 0) return msg.edit({ content: "❌ Le braquage a échoué faute de complices !", embeds: [], components: [] });
            
            const reussite = Math.random() < 0.55;
            if (reussite) {
                activeGames.heist.players.forEach(id => addPoints(id, prize));
                await msg.edit({ content: `💰 **BRAQUAGE RÉUSSI !** La team s'échappe ! Tous les participants empochent **${prize} Kyo Points** !`, embeds: [], components: [] });
            } else {
                await msg.edit({ content: `🚨 **INTERCEPTION DE LA POLICE !** Le casse a échoué lamentablement ! (0 points gagnés)`, embeds: [], components: [] });
            }
        }, 20000);
        return;
    }

    // 12. SURVIE DÉCISIONNELLE
    if (commandName === 'survie') {
        activeGames.survie = { votes: {}, bonneRep: options.getString('bonne_rep').toUpperCase(), points: prize, actif: true };
        const embed = new EmbedBuilder().setTitle("💀 JEU DE SURVIE ELIMINATOIRE").setDescription(`**Question :** ${options.getString('question')}\n\nVotez A ou B. Les bons choix gagnent **${prize} Kyo Points**, les autres sautent !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('action_survie_A').setLabel('Option A').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('action_survie_B').setLabel('Option B').setStyle(ButtonStyle.Danger)
        );
        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
        
        setTimeout(async () => {
            activeGames.survie.actif = false;
            let gagnants = [];
            for (const [uid, vote] of Object.entries(activeGames.survie.votes)) {
                if (vote === activeGames.survie.bonneRep) gagnants.push(uid);
            }
            gagnants.forEach(id => addPoints(id, prize));
            await msg.edit({ content: `🏁 **FIN DE LA SURVIE !** La bonne réponse était l'option **${activeGames.survie.bonneRep}**.\nFélicitations aux survivants qui prennent **${prize} Kyo Points** !`, embeds: [], components: [] });
        }, 25000);
        return;
    }

    // 13. FLASH
    if (commandName === 'flash') {
        const embed = new EmbedBuilder().setTitle("⚡ TIRAGE ÉCLAIR (15s)").setDescription(`Cliquez instantanément ! Un gagnant aléatoire prendra **${prize} Kyo Points** !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('action_flash_join').setLabel('S\'INSCRIRE').setStyle(ButtonStyle.Success));
        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
        
        let inscrits = [];
        const collector = msg.createMessageComponentCollector({ time: 15000 });
        collector.on('collect', async i => {
            if (i.customId === 'action_flash_join') {
                if (!inscrits.includes(i.user.id)) inscrits.push(i.user.id);
                await i.reply({ content: "✅ Pris en compte !", ephemeral: true });
            }
        });
        collector.on('end', async () => {
            if (inscrits.length === 0) return msg.edit({ content: "⏳ Temps écoulé, aucun joueur n'a cliqué.", embeds: [], components: [] });
            const winner = inscrits[Math.floor(Math.random() * inscrits.length)];
            addPoints(winner, prize);
            await msg.edit({ content: `🎉 **Tirage Flash fini !** Bravo à <@${winner}> qui rafle le lot de **${prize} Kyo Points** !`, embeds: [], components: [] });
        });
        return;
    }

    // 14. CHIFOUMI GLOBAL
    if (commandName === 'chifoumi') {
        const embed = new EmbedBuilder().setTitle("✊✋✌️ CHIFOUMI CONTRE LE BOT").setDescription(`Défiez l'I.A du bot ! Si vous gagnez votre duel, vous remportez **${prize} Kyo Points** !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`action_rps_p_${prize}`).setLabel('PIERRE ✊').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`action_rps_f_${prize}`).setLabel('PAPIER ✋').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`action_rps_c_${prize}`).setLabel('CISEAUX ✌️').setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({ embeds: [embed], components: [row] });
    }

    // 15. JACKPOT MACHINE
    if (commandName === 'jackpot') {
        const embed = new EmbedBuilder().setTitle("🎰 MACHINE À SOUS").setDescription(`Le casino Kyo ouvre ses portes ! Pressez le levier.\nSi vous alignez 3 symboles identiques, vous touchez le lot de **${prize} Kyo Points** !`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`action_jackpot_${prize}`).setLabel('ACTIVER LE LEVIER 🎰').setStyle(ButtonStyle.Primary));
        return interaction.reply({ embeds: [embed], components: [row] });
    }
});

// ==========================================
// 📥 INTERACTION DES MENUS DÉROULANTS (LE PANEL EXPLICATIF)
// ==========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'panel_guide_kyo') return;

    const choice = interaction.values[0];
    let embed = new EmbedBuilder().setColor('#2b2d31');

    if (choice === 'guide_kyop') {
        embed.setTitle("💠 SYSTÈME DE KYO POINTS")
             .setDescription("L'économie est au cœur de notre activité.\n\n> **C'est quoi ?**\nLes Kyo Points représentent ton influence et ton activité sur le serveur. Ce n'est pas une monnaie automatique : elle est distribuée par le Staff lors de grands événements.\n\n> **À quoi ça sert ?**\nAucune boutique ennuyeuse ici ! Les points servent de jauge de puissance. Plus tu en as, plus tu es respecté, et plus tu as du poids lors des gros mini-jeux et événements flash organisés par le staff. Suis bien le chat !");
    } 
    else if (choice === 'guide_boss') {
        embed.setTitle("👹 EXPLICATION : LES RAIDS BOSS")
             .setDescription("Une mécanique de combat instantanée et ultra-compétitive.\n\n> **Le Principe**\nQuand un modérateur fait apparaître un Boss, une jauge de points de vie (PV) s'affiche. Tous les membres doivent cliquer le plus vite possible sur le bouton de combat pour blesser le monstre.\n\n> **Comment gagner ?**\nChaque clic inflige des dégâts aléatoires. Le bot calcule en temps réel la vie du monstre. Le joueur qui donne le **coup de grâce** (le tout dernier coup qui fait tomber les PV à 0) intercepte le lot de points fixé par l'admin ! Soyez synchros.");
    } 
    else if (choice === 'guide_games') {
        embed.setTitle("🎰 EXPLICATION : JEUX ET REFLEXES")
             .setDescription("Ici, tout se joue à la seconde ou à la chance pure.\n\n> **Jeux de Rapidité**\nPour le *Sniper*, le *Drapeau*, le *Mot* ou les *Maths*, la règle est simple : soit le plus rapide du chat ou clique sur le bouton dès qu'il apparaît pour valider le lot.\n\n> **Jeux de Risque**\nLa *Roulette Russe* ou le *Démineur de Bombe* te permettent de doubler tes gains ou de tout perdre sur un coup de tête. À toi de voir si tu as l'âme d'un joueur ou si tu préfères rester en sécurité !");
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
});

// ==========================================
// 🕹️ MODULE DE RÉPONSE AUX BOUTONS ET MODALS
// ==========================================
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const id = interaction.customId;

        if (id.startsWith('action_drop_')) {
            const pts = parseInt(id.split('_')[2]);
            addPoints(interaction.user.id, pts);
            return interaction.update({ content: `🎉 **Loot instantané !** <@${interaction.user.id}> a ouvert le coffre en premier et gagne **${pts} Kyo Points** !`, embeds: [], components: [] });
        }

        if (id.startsWith('action_boss_')) {
            if (!activeGames.boss.actif) return interaction.reply({ content: "❌ Le boss n'est plus de ce monde.", ephemeral: true });
            const pts = parseInt(id.split('_')[2]);
            activeGames.boss.hp -= Math.floor(Math.random() * 12) + 4;
            
            if (activeGames.boss.hp <= 0) {
                activeGames.boss.actif = false;
                addPoints(interaction.user.id, pts);
                return interaction.update({ content: `💀 **MONSTRE TERRASSÉ !** <@${interaction.user.id}> assène l'ultime coup fatal et empoche le lot de **${pts} Kyo Points** !`, embeds: [], components: [] });
            } else {
                return interaction.reply({ content: `⚔️ Impact ! Vitalité restante du Boss : **${activeGames.boss.hp} PV**.`, ephemeral: true });
            }
        }

        if (id.startsWith('action_roulette_')) {
            const pts = parseInt(id.split('_')[2]);
            if (Math.random() < 0.166) { 
                if (db.users[interaction.user.id]) db.users[interaction.user.id].kyop = Math.floor(db.users[interaction.user.id].kyop / 2);
                saveDB();
                return interaction.reply({ content: "💥 **PAN !** Le coup est parti ! Vos Kyo Points sont coupés en deux !", ephemeral: true });
            } else {
                addPoints(interaction.user.id, pts);
                return interaction.reply({ content: `🍀 *Clic...* Chambre vide ! Tu survis et ramasses **${pts} Kyo Points**.`, ephemeral: true });
            }
        }

        if (id.startsWith('action_war_')) {
            const [, , team, pts] = id.split('_');
            if (team === 'red' && !activeGames.guerre.red.includes(interaction.user.id)) activeGames.guerre.red.push(interaction.user.id);
            if (team === 'blue' && !activeGames.guerre.blue.includes(interaction.user.id)) activeGames.guerre.blue.push(interaction.user.id);
            return interaction.reply({ content: "⚔️ Spam enregistré pour ton équipe !", ephemeral: true });
        }

        if (id.startsWith('action_sniper_')) {
            const pts = parseInt(id.split('_')[2]);
            addPoints(interaction.user.id, pts);
            return interaction.update({ content: `🎯 **HEADSHOT !** <@${interaction.user.id}> a dégainé à la vitesse de l'éclair et sécurise **${pts} Kyo Points** !`, embeds: [], components: [] });
        }

        if (id.startsWith('action_bombe_')) {
            const pts = parseInt(id.split('_')[2]);
            if (Math.random() < 0.25) {
                if (db.users[interaction.user.id]) db.users[interaction.user.id].kyop = Math.max(0, db.users[interaction.user.id].kyop - 100);
                saveDB();
                return interaction.update({ content: `💥 **BOOM !** <@${interaction.user.id}> a sectionné le mauvais câble ! Explosion fatale (-100 points).`, embeds: [], components: [] });
            } else {
                addPoints(interaction.user.id, pts);
                return interaction.update({ content: `🟢 **DÉMORCÉ !** <@${interaction.user.id}> a coupé le bon fil avec sang-froid et gagne **${pts} Kyo Points** !`, embeds: [], components: [] });
            }
        }

        if (id === 'action_heist_join') {
            if (!activeGames.heist.players.includes(interaction.user.id)) activeGames.heist.players.push(interaction.user.id);
            return interaction.reply({ content: "💼 Tu as équipé ton masque, tu es prêt pour le casse.", ephemeral: true });
        }

        if (id.startsWith('action_survie_')) {
            const vote = id.split('_')[2];
            activeGames.survie.votes[interaction.user.id] = vote;
            return interaction.reply({ content: `Sélection de l'option **${vote}** validée. Wait and see.`, ephemeral: true });
        }

        if (id.startsWith('action_rps_')) {
            const [, , choice, ptsStr] = id.split('_');
            const pts = parseInt(ptsStr);
            const rps = ['p', 'f', 'c'];
            const botPlay = rps[Math.floor(Math.random() * 3)];
            
            let label = {p: "✊ PIERRE", f: "✋ PAPIER", c: "✌️ CISEAUX"};
            let res = "Égalité ! Recommence.";
            
            if ((choice === 'p' && botPlay === 'c') || (choice === 'f' && botPlay === 'p') || (choice === 'c' && botPlay === 'f')) {
                addPoints(interaction.user.id, pts);
                res = `🎉 **VICTOIRE !** Tu as mis ${label[choice]} contre ${label[botPlay]} du bot ! Tu prends **${pts} Kyop** !`;
            } else if (choice !== botPlay) {
                res = `❌ **PERDU !** Ton choix : ${label[choice]} | Bot : ${label[botPlay]}. Retente ta chance !`;
            }
            return interaction.reply({ content: res, ephemeral: true });
        }

        if (id.startsWith('action_jackpot_')) {
            const pts = parseInt(id.split('_')[2]);
            const items = ['🍎', '💎', '🍋', '🔔', '🍀'];
            const r1 = items[Math.floor(Math.random() * items.length)];
            const r2 = items[Math.floor(Math.random() * items.length)];
            const r3 = items[Math.floor(Math.random() * items.length)];
            
            if (r1 === r2 && r2 === r3) {
                addPoints(interaction.user.id, pts);
                return interaction.reply({ content: `🎰 **[ ${r1} | ${r2} | ${r3} ]**\n🏆 **JACKPOT INCROYABLE !** Tu as aligné 3 symboles ! Tu gagnes **${pts} Kyo Points** !` });
            } else {
                return interaction.reply({ content: `🎰 **[ ${r1} | ${r2} | ${r3} ]**\n❌ Pas de correspondance. Retente ta chance au prochain tour !`, ephemeral: true });
            }
        }

        if (id.startsWith('action_loto_')) {
            const [, , win, max, pts] = id.split('_');
            const modal = new ModalBuilder().setCustomId(`modal_loto_${win}_${pts}`).setTitle('Pari Loto');
            const txt = new TextInputBuilder().setCustomId('choice').setLabel(`Propose un nombre entre 1 et ${max}`).setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(txt));
            await interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_loto_')) {
        const [, , winNum, pts] = interaction.customId.split('_');
        const ans = interaction.fields.getTextInputValue('choice').trim();
        
        if (ans === winNum) {
            addPoints(interaction.user.id, parseInt(pts));
            return interaction.reply(`🎰 **NUMÉRO EXACT !** <@${interaction.user.id}> a démasqué le chiffre secret (**${winNum}**) et s'empare du lot de **${pts} Kyo Points** !`);
        } else {
            return interaction.reply({ content: `❌ Raté ! Le chiffre secret n'était pas ${ans}.`, ephemeral: true });
        }
    }
});

// ==========================================
// 💬 CHAT VERIFICATIONS (DRAPEAU, MATH, MOT)
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (activeGames.drapeau.actif && message.content.toLowerCase() === activeGames.drapeau.reponse) {
        activeGames.drapeau.actif = false;
        addPoints(message.author.id, activeGames.drapeau.points);
        return message.reply(`🌍 **RÉPONSE COMPLÈTE !** Bravo <@${message.author.id}>, c'était bien **${message.content}**. Tu gagnes le lot de **${activeGames.drapeau.points} Kyo Points** !`);
    }

    if (activeGames.math.actif && message.content.trim() === activeGames.math.reponse) {
        activeGames.math.actif = false;
        addPoints(message.author.id, activeGames.math.points);
        return message.reply(`🧠 **GÉNIE !** <@${message.author.id}> valide le calcul en premier. Gain : **${activeGames.math.points} Kyo Points** !`);
    }

    if (activeGames.mot.actif && message.content.toLowerCase() === activeGames.mot.reponse) {
        activeGames.mot.actif = false;
        addPoints(message.author.id, activeGames.mot.points);
        return message.reply(`🔤 **Dactylo Maître !** <@${message.author.id}> remet le mot dans l'axe. Gain : **${activeGames.mot.points} Kyo Points** !`);
    }
});

const app = express();
app.listen(process.env.PORT || 3000);
client.login(process.env.TOKEN);

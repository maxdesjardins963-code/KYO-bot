require('dotenv').config();
const http = require('http'); // Module natif pour le serveur web gratuit de Render
const { 
    Client, GatewayIntentBits, EmbedBuilder, REST, Routes, 
    SlashCommandBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ActivityType 
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- MINI SERVEUR POUR LEURRER RENDER (100% GRATUIT) ---
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Kyo Family en ligne et actif ! 🚀');
}).listen(PORT, () => {
    console.log(`📡 Leurre Render activé sur le port ${PORT}`);
});

// --- INITIALISATION DU CLIENT DISCORD ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Configuration Visuelle Directe
const CONFIG = {
    color: "#FF2A7A", 
    adminColor: "#2A7AFF",
    abuseColor: "#6A0DAD",
    currency: "🪙",
    footer: "✨ Kyotaru Family • L'élite du Divertissement"
};

// --- BASE DE DONNÉES LOCALE INTÉGRÉE (JSON AUTOMATIQUE) ---
const dbPath = path.join(__dirname, 'database.json');
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, '{}');

function readDB() { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); }
function writeDB(data) { fs.writeFileSync(dbPath, JSON.stringify(data, null, 2)); }

function getUserData(userId) {
    const db = readDB();
    if (!db[userId]) {
        db[userId] = { 
            xp: 0, level: 1, coins: 100, bank: 0, 
            lastDaily: 0, lastWork: 0, lastCrime: 0, lastRob: 0,
            inventory: [], business: null, crypto: 0 
        };
        writeDB(db);
    }
    return db[userId];
}
function updateUserData(userId, key, value) {
    const db = readDB();
    if (!db[userId]) getUserData(userId);
    db[userId][key] = value;
    writeDB(db);
}

// --- CONFIGURATION DES COMMANDES ---
const funCommands = [
    new SlashCommandBuilder().setName('meme').setDescription('Affiche un mème légendaire du web'),
    new SlashCommandBuilder().setName('joke').setDescription('Raconte une blague hilarante'),
    new SlashCommandBuilder().setName('8ball').setDescription('Pose une question existentielle à l\'oracle').addStringOption(o=>o.setName('question').setDescription('Ta question').setRequired(true)),
    new SlashCommandBuilder().setName('ship').setDescription('Calcule le taux d\'amour entre deux membres').addUserOption(o=>o.setName('u1').setDescription('Premier utilisateur').setRequired(true)).addUserOption(o=>o.setName('u2').setDescription('Deuxième utilisateur').setRequired(true)),
    new SlashCommandBuilder().setName('gayrate').setDescription('Calcule le pourcentage de cutitude/gayrate d\'un membre').addUserOption(o=>o.setName('cible').setDescription('Le membre')),
    new SlashCommandBuilder().setName('iq').setDescription('Mesure le QI secret de quelqu\'un').addUserOption(o=>o.setName('cible').setDescription('Le membre')),
    new SlashCommandBuilder().setName('hack').setDescription('Simule un piratage ultra immersif').addUserOption(o=>o.setName('cible').setDescription('La victime').setRequired(true)),
    new SlashCommandBuilder().setName('fight').setDescription('Déclenche un duel à mort dans l\'arène').addUserOption(o=>o.setName('cible').setDescription('L\'adversaire').setRequired(true)),
    new SlashCommandBuilder().setName('roast').setDescription('Envoie un clash destructeur').addUserOption(o=>o.setName('cible').setDescription('La cible').setRequired(true)),
    new SlashCommandBuilder().setName('ppsize').setDescription('Mesure la taille de l\'appareil de quelqu\'un').addUserOption(o=>o.setName('cible').setDescription('Le membre'))
];

const adminFunCommands = [
    new SlashCommandBuilder().setName('gstart').setDescription('Lance un giveaway de manière stylée').addStringOption(o=>o.setName('lot').setDescription('Le lot').setRequired(true)).addIntegerOption(o=>o.setName('duree').setDescription('Durée en minutes').setRequired(true)),
    new SlashCommandBuilder().setName('greroll').setDescription('Tire un nouveau gagnant pour un giveaway').addStringOption(o=>o.setName('message_id').setDescription('ID du message du giveaway').setRequired(true)),
    new SlashCommandBuilder().setName('sayembed').setDescription('Envoie un embed personnalisé pro').addStringOption(o=>o.setName('titre').setDescription('Titre').setRequired(true)).addStringOption(o=>o.setName('texte').setDescription('Contenu').setRequired(true)),
    new SlashCommandBuilder().setName('poll').setDescription('Crée un sondage interactif rapide').addStringOption(o=>o.setName('question').setDescription('La question').setRequired(true)),
    new SlashCommandBuilder().setName('ticketsetup').setDescription('Déploie le système de ticket à bouton'),
    new SlashCommandBuilder().setName('annonce').setDescription('Fait une annonce flash avec mention @everyone').addStringOption(o=>o.setName('message').setDescription('L\'annonce').setRequired(true)),
    new SlashCommandBuilder().setName('slowmode').setDescription('Modifie la vitesse du salon de manière stylée').addIntegerOption(o=>o.setName('secondes').setDescription('Temps en secondes').setRequired(true)),
    new SlashCommandBuilder().setName('lock').setDescription('Verrouille le salon actuel instantanément'),
    new SlashCommandBuilder().setName('unlock').setDescription('Déverrouille le salon actuel instantanément'),
    new SlashCommandBuilder().setName('nuke').setDescription('Explose et recrée proprement le salon actuel pour effacer les fantômes')
];

const adminAbuseCommands = [
    new SlashCommandBuilder().setName('fakeban').setDescription('[ABUSE] Simule un faux bannissement hyper réaliste').addUserOption(o=>o.setName('cible').setDescription('La victime').setRequired(true)),
    new SlashCommandBuilder().setName('stealcoins').setDescription('[ABUSE] Récupère secrètement tout l\'argent d\'un joueur').addUserOption(o=>o.setName('cible').setDescription('La cible').setRequired(true)),
    new SlashCommandBuilder().setName('spamdm').setDescription('[ABUSE] Bombarde les messages privés d\'un membre').addUserOption(o=>o.setName('cible').setDescription('La cible').setRequired(true)).addStringOption(o=>o.setName('texte').setDescription('Message à spammer').setRequired(true)),
    new SlashCommandBuilder().setName('forceprofile').setDescription('[ABUSE] Modifie arbitrairement le niveau XP d\'un membre').addUserOption(o=>o.setName('cible').setDescription('Le membre').setRequired(true)).addIntegerOption(o=>o.setName('level').setDescription('Nouveau niveau').setRequired(true)),
    new SlashCommandBuilder().setName('ghostping').setDescription('[ABUSE] Mentionne discrètement quelqu\'un et supprime la preuve').addUserOption(o=>o.setName('cible').setDescription('La cible').setRequired(true))
];

const ecoCommands = [
    new SlashCommandBuilder().setName('eco').setDescription('Système bancaire et financier Kyotaru')
        .addSubcommand(s=>s.setName('balance').setDescription('Affiche ton compte bancaire visuel').addUserOption(o=>o.setName('cible').setDescription('Le membre')))
        .addSubcommand(s=>s.setName('daily').setDescription('Récupère tes dividendes quotidiens'))
        .addSubcommand(s=>s.setName('work').setDescription('Travaille pour une grande corporation'))
        .addSubcommand(s=>s.setName('crime').setDescription('Tente une action illégale à haut rendement'))
        .addSubcommand(s=>s.setName('rob').setDescription('Essaie de détrousser un membre riche').addUserOption(o=>o.setName('cible').setDescription('La victime').setRequired(true)))
        .addSubcommand(s=>s.setName('deposit').setDescription('Sécurise tes pièces à la banque').addIntegerOption(o=>o.setName('montant').setDescription('Montant à déposer').setRequired(true)))
        .addSubcommand(s=>s.setName('withdraw').setDescription('Retire tes fonds de la banque').addIntegerOption(o=>o.setName('montant').setDescription('Montant à retirer').setRequired(true)))
        .addSubcommand(s=>s.setName('shop').setDescription('Magasin des industries et des cryptos'))
        .addSubcommand(s=>s.setName('buy').setDescription('Investis dans une entreprise ou un item').addIntegerOption(o=>o.setName('id').setDescription('ID de l\'achat').setRequired(true)))
        .addSubcommand(s=>s.setName('crypto').setDescription('Visualise le cours fluctuant de la KyotoCoin'))
];

const utilCommands = [
    new SlashCommandBuilder().setName('profile').setDescription('Affiche ta carte d\'identité complète (XP/Éco)').addUserOption(o=>o.setName('cible').setDescription('Le membre')),
    new SlashCommandBuilder().setName('avatar').setDescription('Affiche la photo de profil d\'un utilisateur').addUserOption(o=>o.setName('cible').setDescription('Le membre')),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Donne l\'état et la puissance du serveur')
];

const allCommands = [...funCommands, ...adminFunCommands, ...adminAbuseCommands, ...ecoCommands, ...utilCommands];

// --- ENREGISTREMENT SÉCURISÉ DES COMMANDES ---
client.once('ready', async () => {
    console.log(`🎁 ${client.user.tag} est connecté avec succès !`);
    client.user.setActivity('Ambiancer la Kyotaru Family', { type: ActivityType.Competing });

    if (!process.env.CLIENT_ID || !process.env.TOKEN) {
        console.error("❌ ERREUR SÉCURITÉ : CLIENT_ID ou TOKEN manquant dans le tableau de bord Render !");
        return;
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('⚡ Envoi monolithique de toutes les commandes sur Discord...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: allCommands.map(c => c.toJSON()) }
        );
        console.log('✅ Toutes les commandes sont synchronisées et utilisables !');
    } catch (err) {
        console.error("❌ Erreur lors de la synchronisation des commandes :", err);
    }
});

// --- GESTIONNAIRE COMPLET DES INTERACTIONS ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, guild, channel } = interaction;
    const dbData = getUserData(user.id);
    const cur = CONFIG.currency;

    // --- FUN ---
    if (commandName === 'meme') {
        const memes = [
            "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3BwZzVleWptZzFmYWp2dnE3M3h4dmptbWlzbXN5dzF5cm94bzhidCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/NEvPzZ8bd1V4Y/giphy.gif",
            "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbmswM2R2Z3F4b3N2cWk4cXdrNnVscXN0bW8yZHk1aHJwMWhiZXBsYiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Nx053yyqRx74k/giphy.gif"
        ];
        const emb = new EmbedBuilder().setColor(CONFIG.color).setTitle('😂 Mème Aléatoire').setImage(memes[Math.floor(Math.random() * memes.length)]).setFooter({text: CONFIG.footer});
        return interaction.reply({ embeds: [emb] });
    }

    if (commandName === 'joke') {
        const jokes = [
            "Pourquoi les développeurs détestent la lumière du soleil ? \n*Parce que ça fait fondre les bugs.*",
            "Qu'est-ce qu'un geek qui a rompu ? \n*Un mec qui s'est déconnecté.*",
            "Pourquoi le bot est-il si intelligent ? \n*Parce qu'il ne dort jamais !*"
        ];
        const emb = new EmbedBuilder().setColor(CONFIG.color).setTitle('🤣 Blague Flash').setDescription(jokes[Math.floor(Math.random()*jokes.length)]).setFooter({text: CONFIG.footer});
        return interaction.reply({ embeds: [emb] });
    }

    if (commandName === '8ball') {
        const reps = ["Absolument !", "C'est une évidence.", "Il y a de fortes chances.", "Pas du tout.", "Ne compte pas là-dessus.", "Le destin reste flou..."];
        const emb = new EmbedBuilder().setColor(CONFIG.color).setTitle(`🔮 Question : ${options.getString('question')}`).setDescription(`> **Réponse :** ${reps[Math.floor(Math.random()*reps.length)]}`);
        return interaction.reply({ embeds: [emb] });
    }

    if (commandName === 'ship') {
        const u1 = options.getUser('u1'); const u2 = options.getUser('u2');
        const rate = Math.floor(Math.random()*101);
        const emb = new EmbedBuilder().setColor(CONFIG.color).setTitle('❤️ Test de Compatibilité').setDescription(`💘 **${u1.username}** + **${u2.username}** = **${rate}%** d'amour pur !`);
        return interaction.reply({ embeds: [emb] });
    }

    if (commandName === 'gayrate') {
        const target = options.getUser('cible') || user;
        const emb = new EmbedBuilder().setColor(CONFIG.color).setDescription(`🏳️‍🌈 Le taux de cutitude/gayrate de **${target.username}** est estimé à \`${Math.floor(Math.random()*101)}%\``);
        return interaction.reply({ embeds: [emb] });
    }

    if (commandName === 'iq') {
        const target = options.getUser('cible') || user;
        const emb = new EmbedBuilder().setColor(CONFIG.color).setDescription(`🧠 Scanner cérébral : **${target.username}** possède un QI de \`${Math.floor(Math.random()*110)+60}\``);
        return interaction.reply({ embeds: [emb] });
    }

    if (commandName === 'hack') {
        const target = options.getUser('cible');
        await interaction.reply(`💻 Initialisation de l'exploit sur **${target.username}**...`);
        const logs = [`📡 Récupération de l'adresse IP locale...`, `📂 Extraction du dossier Roblox & Discord tokens...`, `👾 Injection du malware Kyotaru...`, `🏴‍☠️ Piratage terminé ! Compte revendu.`];
        for (const log of logs) {
            await new Promise(r => setTimeout(r, 1200));
            await interaction.editReply(log);
        }
        return;
    }

    if (commandName === 'fight') {
        const target = options.getUser('cible');
        const winner = Math.random() > 0.5 ? user : target;
        const emb = new EmbedBuilder().setColor(CONFIG.color).setTitle('⚔️ Duel Sanglant').setDescription(`💥 **${user.username}** provoque **${target.username}** !\n\n🏆 Après un combat épique, **${winner.username}** terrasse son adversaire !`);
        return interaction.reply({ embeds: [emb] });
    }

    if (commandName === 'roast') {
        const target = options.getUser('cible');
        const roasts = ["Ton secret de beauté ? Le filtre flou.", "Tu es la raison pour laquelle les notices d'utilisation existent.", "Je parierais bien que ton QI ne dépasse pas ton niveau Roblox."];
        const emb = new EmbedBuilder().setColor(CONFIG.color).setDescription(`🔥 **${target.username}**, encaisse ça : ${roasts[Math.floor(Math.random()*roasts.length)]}`);
        return interaction.reply({ embeds: [emb] });
    }

    if (commandName === 'ppsize') {
        const target = options.getUser('cible') || user; const size = Math.floor(Math.random()*25);
        const emb = new EmbedBuilder().setColor(CONFIG.color).setDescription(`📏 Appareil de **${target.username}** :\n\`E${"=".repeat(size)}D\` (${size} cm)`);
        return interaction.reply({ embeds: [emb] });
    }

    // --- SECU ADMIN ---
    const geopoliticalAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (['gstart', 'greroll', 'sayembed', 'poll', 'ticketsetup', 'annonce', 'slowmode', 'lock', 'unlock', 'nuke', 'fakeban', 'stealcoins', 'spamdm', 'forceprofile', 'ghostping'].includes(commandName) && !geopoliticalAdmin) {
        return interaction.reply({ content: "❌ Tu n'as pas la permission d'Administrateur pour exécuter cette commande !", ephemeral: true });
    }

    // --- ADMIN FUN ---
    if (commandName === 'gstart') {
        const prize = options.getString('lot'); const time = options.getInteger('duree');
        const emb = new EmbedBuilder().setColor(CONFIG.adminColor).setTitle('🎉 GIVEAWAY KYOTARU 🎉').setDescription(`🎁 Lot : **${prize}**\n⏳ Durée : **${time} minute(s)**\n\n*Réagissez avec 🎉 pour tenter votre chance !*`);
        const msg = await interaction.reply({ embeds: [emb], fetchReply: true });
        await msg.react('🎉');
        setTimeout(async () => {
            const remsg = await channel.messages.fetch(msg.id);
            const users = await remsg.reactions.cache.get('🎉').users.fetch();
            const pool = users.filter(u => !u.bot);
            if(pool.size === 0) return channel.send("😭 Personne n'a participé au giveaway.");
            channel.send(`🏆 **Félicitations** à ${pool.random()} qui gagne **${prize}** !`);
        }, time * 60000);
        return;
    }

    if (commandName === 'greroll') {
        try {
            const mid = options.getString('message_id'); const remsg = await channel.messages.fetch(mid);
            const users = await remsg.reactions.cache.get('🎉').users.fetch();
            const pool = users.filter(u => !u.bot);
            if(pool.size === 0) return interaction.reply({ content: "Aucun participant trouvé.", ephemeral: true });
            return interaction.reply(`🎲 **Reroll :** Le nouveau gagnant est ${pool.random()} ! ✨`);
        } catch(e) { return interaction.reply({content: "ID de message invalide.", ephemeral: true}); }
    }

    if (commandName === 'sayembed') {
        const emb = new EmbedBuilder().setColor(CONFIG.adminColor).setTitle(options.getString('titre')).setDescription(options.getString('texte')).setFooter({text: CONFIG.footer});
        await interaction.reply({ content: "Envoyé !", ephemeral: true });
        return channel.send({ embeds: [emb] });
    }

    if (commandName === 'poll') {
        const emb = new EmbedBuilder().setColor(CONFIG.adminColor).setTitle('📊 SONDAGE INTERACTIF').setDescription(options.getString('question'));
        await interaction.reply({ content: "Sondage créé !", ephemeral: true });
        const m = await channel.send({ embeds: [emb] }); await m.react('✅'); await m.react('❌'); return;
    }

    if (commandName === 'ticketsetup') {
        const emb = new EmbedBuilder().setColor(CONFIG.adminColor).setTitle('✉️ Support & Demandes').setDescription('Cliquez sur le bouton ci-dessous pour générer un ticket privé sécurisé.');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tk_create').setLabel('Ouvrir un ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫'));
        await interaction.reply({ content: "Système déployé !", ephemeral: true });
        return channel.send({ embeds: [emb], components: [row] });
    }

    if (commandName === 'annonce') {
        await interaction.reply({content: "Annonce faite !", ephemeral: true});
        await channel.send({ content: "@everyone" });
        const emb = new EmbedBuilder().setColor(CONFIG.adminColor).setTitle('📢 ANNONCE OFFICIELLE').setDescription(options.getString('message')).setFooter({text: CONFIG.footer});
        return channel.send({ embeds: [emb] });
    }

    if (commandName === 'slowmode') {
        const sec = options.getInteger('secondes'); await channel.setRateLimitPerUser(sec);
        return interaction.reply(`⏳ Le mode lent de ce salon est ajusté à **${sec}s** !`);
    }

    if (commandName === 'lock') {
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        return interaction.reply('🔒 Le salon a été verrouillé !');
    }

    if (commandName === 'unlock') {
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true });
        return interaction.reply('🔓 Le salon est à nouveau accessible à tous !');
    }

    if (commandName === 'nuke') {
        const pos = channel.position;
        const newChan = await channel.clone();
        await channel.delete();
        await newChan.setPosition(pos);
        const emb = new EmbedBuilder().setColor(CONFIG.adminColor).setDescription("💥 Salon purifié par explosion numérique ! Nettoyage réussi.");
        return newChan.send({ embeds: [emb] });
    }

    // --- ADMIN ABUSE ---
    if (commandName === 'fakeban') {
        const target = options.getUser('cible');
        const emb = new EmbedBuilder().setColor("#FF0000").setTitle('🛑 BAN DEFINITIF').setDescription(`🚨 **${target.username}** a été exclu définitivement de la Kyotaru Family.`);
        await interaction.reply({ embeds: [emb] });
        await new Promise(r => setTimeout(r, 4000));
        return interaction.followUp({ content: `😜 C'était un faux ban pour rigoler !` });
    }

    if (commandName === 'stealcoins') {
        const target = options.getUser('cible'); const tData = getUserData(target.id);
        const loot = tData.coins;
        updateUserData(target.id, 'coins', 0); updateUserData(user.id, 'coins', dbData.coins + loot);
        return interaction.reply({ content: `😈 [ABUSE] Tu as siphonné la totalité des économies de **${target.username}** (${loot} ${cur}) !`, ephemeral: true });
    }

    if (commandName === 'spamdm') {
        const target = options.getUser('cible'); const txt = options.getString('texte');
        await interaction.reply({ content: "Spam lancé en DM !", ephemeral: true });
        for(let i=0; i<5; i++) { await target.send(`⚠️ **ALERTE ADMIN :** ${txt}`).catch(()=>{}); }
        return;
    }

    if (commandName === 'forceprofile') {
        const target = options.getUser('cible'); const lvl = options.getInteger('level');
        updateUserData(target.id, 'level', lvl); updateUserData(target.id, 'xp', 0);
        return interaction.reply({ content: `✨ **${target.username}** est maintenant propulsé au **Niveau ${lvl}**.` });
    }

    if (commandName === 'ghostping') {
        const target = options.getUser('cible');
        await interaction.reply({ content: "Ghostping exécuté !", ephemeral: true });
        const m = await channel.send(`<@${target.id}>`);
        return m.delete();
    }

    // --- ECONOMIE ---
    if (commandName === 'eco') {
        const sub = options.getSubcommand();

        if (sub === 'balance') {
            const target = options.getUser('cible') || user; const tData = getUserData(target.id);
            const emb = new EmbedBuilder().setColor(CONFIG.color).setTitle(`🏦 COMPTE FINANCIER • ${target.username}`)
                .setDescription(`\`🖥️ ETAT DES COMPTES INFORMATISÉS\`\n\n💵 **Portefeuille :** \`${tData.coins} ${cur}\`\n💳 **Banque Sécurisée :** \`${tData.bank} ${cur}\`\n💎 **Crypto Assets :** \`${tData.crypto} K-Coin\``)
                .setFooter({text: CONFIG.footer});
            return interaction.reply({ embeds: [emb] });
        }

        if (sub === 'daily') {
            if (Date.now() - dbData.lastDaily < 86400000) return interaction.reply({content: "⏱️ Revenez demain pour réclamer vos récompenses !", ephemeral: true});
            updateUserData(user.id, 'coins', dbData.coins + 500); updateUserData(user.id, 'lastDaily', Date.now());
            return interaction.reply(`🎁 Vous avez encaissé vos dividendes quotidiens de **500 ${cur}** !`);
        }

        if (sub === 'work') {
            if (Date.now() - dbData.lastWork < 3600000) return interaction.reply({content: "⏱️ Laisse tes muscles se reposer. Attends 1 heure !", ephemeral: true});
            const pay = Math.floor(Math.random()*151)+100;
            updateUserData(user.id, 'coins', dbData.coins + pay); updateUserData(user.id, 'lastWork', Date.now());
            return interaction.reply(`💼 Contrat rempli ! Ton job te rapporte **${pay} ${cur}**.`);
        }

        if (sub === 'crime') {
            if (Date.now() - dbData.lastCrime < 7200000) return interaction.reply({content: "🚨 La police tourne encore, attends 2 heures !", ephemeral: true});
            const success = Math.random() > 0.45;
            updateUserData(user.id, 'lastCrime', Date.now());
            if (success) {
                const loot = Math.floor(Math.random()*400)+200; updateUserData(user.id, 'coins', dbData.coins + loot);
                return interaction.reply(`🥷 **Grand Succès !** Tu as braqué une base de données et récupéré **${loot} ${cur}** !`);
            } else {
                const lose = Math.floor(Math.random()*200)+50; updateUserData(user.id, 'coins', Math.max(0, dbData.coins - lose));
                return interaction.reply(`👮 **Échec !** Les pare-feux t'ont bloqué. Amende de **${lose} ${cur}**.`);
            }
        }

        if (sub === 'rob') {
            const target = options.getUser('cible'); const tData = getUserData(target.id);
            if (tData.coins < 100) return interaction.reply({content: "La cible est trop pauvre !", ephemeral: true});
            if (Date.now() - dbData.lastRob < 14400000) return interaction.reply({content: "Tu as fait trop de bruit, attends 4h !", ephemeral: true});
            
            updateUserData(user.id, 'lastRob', Date.now());
            if(Math.random() > 0.6) {
                const loot = Math.floor(tData.coins * 0.25);
                updateUserData(target.id, 'coins', tData.coins - loot); updateUserData(user.id, 'coins', dbData.coins + loot);
                return interaction.reply(`🦹 Tu as détroussé **${target.username}** de **${loot} ${cur}** !`);
            } else { return interaction.reply(`👟 **${target.username}** t'a vu arriver. Fuite immédiate !`); }
        }

        if (sub === 'deposit') {
            const amt = options.getInteger('montant');
            if(dbData.coins < amt) return interaction.reply({content: "Pas assez d'argent sur toi.", ephemeral: true});
            updateUserData(user.id, 'coins', dbData.coins - amt); updateUserData(user.id, 'bank', dbData.bank + amt);
            return interaction.reply(`🏦 Coffre alimenté de **${amt} ${cur}** !`);
        }

        if (sub === 'withdraw') {
            const amt = options.getInteger('montant');
            if(dbData.bank < amt) return interaction.reply({content: "Fonds bancaires insuffisants.", ephemeral: true});
            updateUserData(user.id, 'bank', dbData.bank - amt); updateUserData(user.id, 'coins', dbData.coins + amt);
            return interaction.reply(`💵 Retrait validé : **${amt} ${cur}** récupéré.`);
        }

        if (sub === 'shop') {
            const emb = new EmbedBuilder().setColor(CONFIG.color).setTitle('🛒 INDUSTRIES & STOCKS KYOTARU')
                .setDescription(`Investis pour augmenter ton statut :\n\n👉 **[1] 🏢 Serveur Cloud Pro** — \`Prix: 2000 ${cur}\` (Génère du prestige)\n👉 **[2] 🚀 Fusée Privée** — \`Prix: 10000 ${cur}\` (Affiche sur ton profil)`)
                .setFooter({text: CONFIG.footer});
            return interaction.reply({ embeds: [emb] });
        }

        if (sub === 'buy') {
            const id = options.getInteger('id');
            if (id === 1 && dbData.coins >= 2000) {
                updateUserData(user.id, 'coins', dbData.coins - 2000); updateUserData(user.id, 'inventory', [...dbData.inventory, "🏢 Serveur Cloud Pro"]);
                return interaction.reply("🎉 Achat validé : Infrastructure Cloud Pro obtenue !");
            } else if (id === 2 && dbData.coins >= 10000) {
                updateUserData(user.id, 'coins', dbData.coins - 10000); updateUserData(user.id, 'inventory', [...dbData.inventory, "🚀 Fusée Privée"]);
                return interaction.reply("🎉 Incroyable ! Tu as acheté ta propre fusée privée !");
            }
            return interaction.reply({content: "ID incorrect ou fonds insuffisants.", ephemeral: true});
        }

        if (sub === 'crypto') {
            const price = Math.floor(Math.abs(Math.sin(new Date().getMinutes()) * 1500)) + 200;
            const emb = new EmbedBuilder().setColor("#00FF66").setTitle('📈 MARCHÉ CRYPTO (KyotoCoin)')
                .setDescription(`📊 Cours actuel : **${price} ${cur} / K-Coin**\n\n*Évolution chaotique toutes les minutes !*`);
            return interaction.reply({ embeds: [emb] });
        }
    }

    // --- UTILITAIRES ---
    if (commandName === 'profile') {
        const target = options.getUser('cible') || user; const tData = getUserData(target.id);
        const xpNeeded = tData.level * tData.level * 100;
        const emb = new EmbedBuilder().setColor(CONFIG.color).setTitle('👤 DOSSIER CITOYEN')
            .setThumbnail(target.displayAvatarURL({dynamic:true}))
            .addFields(
                { name: '✨ Niveau', value: `\`Niveau ${tData.level}\` (${tData.xp}/${xpNeeded} XP)`, inline: true },
                { name: '💰 Fortune totale', value: `\`${tData.coins + tData.bank} ${cur}\``, inline: true },
                { name: '🎒 Inventaire', value: tData.inventory.length > 0 ? tData.inventory.map(i=>`• ${i}`).join('\n') : '*Aucun item*' }
            );
        return interaction.reply({ embeds: [emb] });
    }

    if (commandName === 'avatar') {
        const target = options.getUser('cible') || user;
        const emb = new EmbedBuilder().setColor(CONFIG.color).setTitle(`🖼️ Avatar de ${target.username}`).setImage(target.displayAvatarURL({size:1024, dynamic:true}));
        return interaction.reply({ embeds: [emb] });
    }

    if (commandName === 'serverinfo') {
        const emb = new EmbedBuilder().setColor(CONFIG.color).setTitle(`🏰 ${guild.name}`)
            .setThumbnail(guild.iconURL())
            .addFields(
                { name: '👑 Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
                { name: '👥 Membres', value: `${guild.memberCount}`, inline: true },
                { name: '🌟 Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true }
            );
        return interaction.reply({ embeds: [emb] });
    }
});

// --- SYSTÈME D'XP AU MESSAGE INTERNE ---
const xpCooldowns = new Set();
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    if (xpCooldowns.has(message.author.id)) return;

    const uData = getUserData(message.author.id);
    const xpGained = Math.floor(Math.random() * 10) + 15;
    let newXp = uData.xp + xpGained; let newLvl = uData.level;
    const req = newLvl * newLvl * 100;

    if(newXp >= req) {
        newXp -= req; newLvl++;
        const lvlEmb = new EmbedBuilder().setColor(CONFIG.color).setDescription(`🎉 **LEVEL UP !** ${message.author} passe **Niveau ${newLvl}** ! ✨`);
        message.channel.send({ embeds: [lvlEmb] }).then(m => setTimeout(() => m.delete().catch(()=>{}), 5000));
    }
    updateUserData(message.author.id, 'xp', newXp); updateUserData(message.author.id, 'level', newLvl);
    xpCooldowns.add(message.author.id); setTimeout(() => xpCooldowns.delete(message.author.id), 60000);
});

// --- COMPOSANT DES TICKETS AUTOMATIQUES ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || interaction.customId !== 'tk_create') return;
    const chan = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
    });
    const emb = new EmbedBuilder().setColor(CONFIG.adminColor).setTitle('🎫 ASSISTANCE PRIVÉE').setDescription(`Bonjour ${interaction.user}, pose tes questions ici. Un admin va te répondre.`);
    await chan.send({ embeds: [emb] });
    return interaction.reply({ content: `✅ Ton ticket a été créé ici : ${chan}`, ephemeral: true });
});

// --- FILETS DE SÉCURITÉ ULTRA-IMPORTANT (ANTI-CRASH) ---
process.on('unhandledRejection', (reason, p) => console.error('🛡️ Anti-Crash détecté et bloqué :', reason));
process.on('uncaughtException', (err, origin) => console.error('🛡️ Exception fatale bloquée :', err));

client.login(process.env.TOKEN);

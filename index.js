require('dotenv').config();
const http = require('http');
const { 
    Client, GatewayIntentBits, EmbedBuilder, REST, Routes, 
    SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ActivityType, ModalBuilder, 
    TextInputBuilder, TextInputStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- MINI SERVEUR RENDER ---
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Kyo Bot Update 2.5 en ligne ! 🚀');
}).listen(PORT);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const CONFIG = { color: "#FF2A7A", currency: "💠 Kyo Points" };
// Remplace par tes IDs si besoin
const ADMIN_ROLES = ['1502765782960967861', '1512921382101454878'];

// --- BASE DE DONNÉES JSON ---
const dbPath = path.join(__dirname, 'database.json');
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, '{}');

function readDB() { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); }
function writeDB(data) { fs.writeFileSync(dbPath, JSON.stringify(data, null, 2)); }

function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function getUserData(userId) {
    const db = readDB();
    if (!db[userId]) {
        db[userId] = { 
            coins: 0, streak: 0, lastMissionDate: null,
            todayDate: getTodayString(), messagesToday: 0, imageToday: false, lastMessageTime: 0
        };
        writeDB(db);
    }
    // Reset quotidien paresseux
    if (db[userId].todayDate !== getTodayString()) {
        db[userId].todayDate = getTodayString();
        db[userId].messagesToday = 0;
        db[userId].imageToday = false;
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

function isAdmin(member) {
    return member.roles.cache.some(r => ADMIN_ROLES.includes(r.id)) || ADMIN_ROLES.includes(member.id) || member.permissions.has(PermissionFlagsBits.Administrator);
}

// Variables globales pour les jeux en cours
const activeLotos = new Map();

// --- DÉFINITION DES COMMANDES SLASH ---
const commands = [
    new SlashCommandBuilder().setName('put').setDescription('[ADMIN] Déploie un panel statique')
        .addStringOption(o => o.setName('type').setDescription('Choisis le panel').setRequired(true).addChoices({ name: 'Panel Hub', value: 'panel' }, { name: 'Panel Guide', value: 'guide' })),
    new SlashCommandBuilder().setName('giveaway').setDescription('[ADMIN] Lance un giveaway payant')
        .addStringOption(o=>o.setName('lot').setDescription('Le cadeau').setRequired(true)).addIntegerOption(o=>o.setName('duree').setDescription('Durée (min)').setRequired(true)).addIntegerOption(o=>o.setName('prix').setDescription('Prix d\'entrée').setRequired(true)),
    new SlashCommandBuilder().setName('admin').setDescription('[ADMIN] Gestion de l\'économie')
        .addSubcommand(s => s.setName('add_points').setDescription('Donne des Kyo Points à un joueur').addUserOption(o=>o.setName('cible').setDescription('Le joueur').setRequired(true)).addIntegerOption(o=>o.setName('montant').setDescription('Combien ?').setRequired(true))),
    new SlashCommandBuilder().setName('fakeban').setDescription('Simule un faux bannissement').addUserOption(o=>o.setName('cible').setDescription('La victime').setRequired(true)),
    new SlashCommandBuilder().setName('fakeappeal').setDescription('Dénonce quelqu\'un à la police (Faux)').addUserOption(o=>o.setName('cible').setDescription('Le criminel').setRequired(true)).addStringOption(o=>o.setName('motif').setDescription('Le crime').setRequired(true)),
    new SlashCommandBuilder().setName('trahison').setDescription('[ADMIN] Lance le jeu de la trahison !'),
    
    new SlashCommandBuilder().setName('pari').setDescription('Mise tes Kyo Points et tente de devenir riche !')
        .addSubcommand(s => s.setName('slots').setDescription('🎰 Joue à la machine à sous').addIntegerOption(o=>o.setName('mise').setDescription('Combien tu mises ?').setRequired(true)))
        .addSubcommand(s => s.setName('coffre').setDescription('📦 Choisis le bon coffre (Quitte ou Double)').addIntegerOption(o=>o.setName('mise').setDescription('Combien tu mises ?').setRequired(true)))
        .addSubcommand(s => s.setName('duel').setDescription('⚔️ Défie un joueur à pile ou face').addUserOption(o=>o.setName('adversaire').setDescription('Qui défier ?').setRequired(true)).addIntegerOption(o=>o.setName('mise').setDescription('Mise par joueur').setRequired(true))),
        
    new SlashCommandBuilder().setName('jeu').setDescription('[ADMIN] Lance un grand jeu serveur')
        .addSubcommand(s => s.setName('loto').setDescription('🎯 Lance le Loto secret (via Modal)').addIntegerOption(o=>o.setName('nombre').setDescription('Le nombre secret').setRequired(true)).addIntegerOption(o=>o.setName('recompense').setDescription('La prime').setRequired(true)))
        .addSubcommand(s => s.setName('braquage').setDescription('🏦 Lance un event de braquage en coop'))
        .addSubcommand(s => s.setName('drapeau').setDescription('🌍 Jeu de rapidité : devine le pays'))
        .addSubcommand(s => s.setName('codesecret').setDescription('🔢 Jeu de déduction : craque le coffre'))
];

client.once('ready', async () => {
    console.log(`🎁 ${client.user.tag} est connecté avec l'Update 2.5 !`);
    client.user.setActivity('Update 2.5 | 💠 Kyo Points', { type: ActivityType.Playing });
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
});

// --- TRACKING MISSIONS QUOTIDIENNES ---
client.on('messageCreate', message => {
    if (message.author.bot || !message.guild) return;
    const uData = getUserData(message.author.id);
    const now = Date.now();
    let updated = false;

    if (uData.lastMissionDate === getTodayString()) return; // Mission déjà faite aujourd'hui

    if (message.attachments.size > 0 && !uData.imageToday) { uData.imageToday = true; updated = true; }
    // Anti-spam : 15 secondes d'intervalle et 15 caractères min
    if (message.content.length > 15 && (now - uData.lastMessageTime > 15000)) {
        uData.messagesToday += 1;
        uData.lastMessageTime = now;
        updated = true;
    }

    if (uData.messagesToday >= 10 && uData.imageToday) {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth()+1}-${yesterday.getDate()}`;
        
        if (uData.lastMissionDate === yesterdayStr) uData.streak += 1;
        else uData.streak = 1;

        uData.lastMissionDate = getTodayString();
        const reward = 100 + (uData.streak * 50);
        uData.coins += reward;
        
        message.channel.send(`🎉 **INCROYABLE ${message.author} !** Tu as validé ta mission du jour ! \n🔥 Ton Streak actuel : **${uData.streak} jours**\n💰 Récompense : **+${reward} Kyo Points** !`).then(m => setTimeout(() => m.delete().catch(()=>{}), 15000));
        updated = true;
    }

    if (updated) {
        updateUserData(message.author.id, 'messagesToday', uData.messagesToday);
        updateUserData(message.author.id, 'imageToday', uData.imageToday);
        updateUserData(message.author.id, 'lastMessageTime', uData.lastMessageTime);
        updateUserData(message.author.id, 'streak', uData.streak);
        updateUserData(message.author.id, 'lastMissionDate', uData.lastMissionDate);
        updateUserData(message.author.id, 'coins', uData.coins);
    }
});

// --- ROUTEUR DES INTERACTIONS ---
client.on('interactionCreate', async interaction => {

    // 1. SOUMISSION MODAL LOTO
    if (interaction.isModalSubmit() && interaction.customId.startsWith('loto_modal_')) {
        const msgId = interaction.customId.split('_')[2];
        if (!activeLotos.has(msgId)) return interaction.reply({content: "⏳ Ce loto est déjà terminé !", ephemeral: true});
        
        const guess = parseInt(interaction.fields.getTextInputValue('guess_input'));
        if (isNaN(guess)) return interaction.reply({content: "❌ Ce n'est pas un nombre valide !", ephemeral: true});
        
        const loto = activeLotos.get(msgId);
        loto.guesses.push({ userId: interaction.user.id, guess: guess });
        
        return interaction.reply({content: `✅ Ta réponse (**${guess}**) a été enregistrée secrètement. Attends la fin du chrono !`, ephemeral: true});
    }

    // 2. GESTION DES BOUTONS
    if (interaction.isButton()) {
        const cId = interaction.customId;

        if (cId === 'btn_profile') {
            const uData = getUserData(interaction.user.id);
            const emb = new EmbedBuilder().setColor(CONFIG.color).setTitle(`💳 Compte de ${interaction.user.username}`).addFields(
                { name: '💠 Solde', value: `**${uData.coins} Kyo Points**`, inline: true },
                { name: '🔥 Streak', value: `**${uData.streak} jours**`, inline: true },
                { name: '🎯 Objectif du jour', value: `- Messages utiles : ${uData.messagesToday}/10\n- Image postée : ${uData.imageToday ? '✅' : '❌'}` }
            );
            return interaction.reply({ embeds: [emb], ephemeral: true });
        }

        if (cId === 'btn_guide') {
            return interaction.reply({ content: `✨ **Rappel :** Envoie 10 messages et 1 image aujourd'hui pour ta mission.\nTente ta chance avec \`/pari slots\` !`, ephemeral: true });
        }

        if (cId === 'btn_loto_join') {
            const msgId = interaction.message.id;
            if (!activeLotos.has(msgId)) return interaction.reply({content: "⏳ Ce loto est terminé !", ephemeral: true});
            
            const loto = activeLotos.get(msgId);
            if (loto.guesses.find(g => g.userId === interaction.user.id)) return interaction.reply({content: "❌ Tu as déjà tenté ta chance !", ephemeral: true});
            
            const modal = new ModalBuilder().setCustomId(`loto_modal_${msgId}`).setTitle("🎯 Tente ta chance !");
            const input = new TextInputBuilder().setCustomId('guess_input').setLabel("Quel est le nombre caché ?").setPlaceholder("Écris un nombre ici...").setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        if (cId.startsWith('coffre_')) {
            const [, miseStr, choix] = cId.split('_');
            const mise = parseInt(miseStr);
            if (interaction.message.interaction && interaction.message.interaction.user.id !== interaction.user.id) return interaction.reply({ content: "C'est pas ton coffre !", ephemeral: true });

            const uData = getUserData(interaction.user.id);
            const gainsMultipliers = [0, 1, 2];
            const multiplier = gainsMultipliers[Math.floor(Math.random() * gainsMultipliers.length)];
            const gainFinal = mise * multiplier;
            updateUserData(interaction.user.id, 'coins', uData.coins + gainFinal);
            
            let msg = multiplier === 0 ? "💀 Piégé ! Tu perds ta mise." : multiplier === 1 ? "🤝 Remboursement !" : "🎉 **BINGO !** Doublé !";
            return interaction.update({ content: `${interaction.user} a ouvert le **Coffre ${choix}**.\n\n${msg}\nGain: **${gainFinal} Kyo Points**.`, embeds: [], components: [] });
        }

        if (cId.startsWith('duel_accept_')) {
            const [, , miseStr, defieurId] = cId.split('_');
            const mise = parseInt(miseStr);
            if (interaction.user.id === defieurId) return interaction.reply({ content: "Tu ne peux pas accepter ton duel !", ephemeral: true });

            const uData1 = getUserData(defieurId);
            const uData2 = getUserData(interaction.user.id);
            if (uData2.coins < mise) return interaction.reply({ content: "Pas assez d'argent !", ephemeral: true });

            updateUserData(defieurId, 'coins', uData1.coins - mise);
            updateUserData(interaction.user.id, 'coins', uData2.coins - mise);

            await interaction.update({ content: `⚔️ **DUEL !** <@${interaction.user.id}> affronte <@${defieurId}> pour **${mise} Kyo Points** !\n*La pièce tourne...* 🪙`, components: [] });

            setTimeout(() => {
                const gagnantId = Math.random() > 0.5 ? defieurId : interaction.user.id;
                const gainTotal = mise * 2;
                const finalData = getUserData(gagnantId);
                updateUserData(gagnantId, 'coins', finalData.coins + gainTotal);
                interaction.channel.send(`👑 <@${gagnantId}> gagne le duel et remporte **${gainTotal} Kyo Points** !`);
            }, 3000);
            return;
        }

        if (cId === 'duel_refuse') return interaction.update({ content: `🐔 Duel refusé par peur !`, components: [] });
        if (cId === 'trahison_kick') return interaction.reply({ content: "Haha faux bouton ! Tu n'es pas un bon ami 😜", ephemeral: true });
    }

    // 3. COMMANDES SLASH
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, user, member, channel, guild } = interaction;

    if (commandName === 'admin') {
        if (!isAdmin(member)) return interaction.reply({ content: "❌ Réservé au Staff.", ephemeral: true });
        const cible = options.getUser('cible');
        const montant = options.getInteger('montant');
        const d = getUserData(cible.id);
        updateUserData(cible.id, 'coins', d.coins + montant);
        return interaction.reply(`✅ Transaction réussie ! **${montant} Kyo Points** donnés à ${cible}.`);
    }

    if (commandName === 'giveaway') {
        if (!isAdmin(member)) return interaction.reply({ content: "❌ Réservé au Staff.", ephemeral: true });
        const lot = options.getString('lot');
        const duree = options.getInteger('duree');
        const prix = options.getInteger('prix');
        
        const emb = new EmbedBuilder().setColor("#FFD700").setTitle('🎁 GIVEAWAY EXCLUSIF 🎁').setDescription(`**Lot :** ${lot}\n**Prix d'entrée :** ${prix} 💠\n**Temps :** ${duree} min\n\n*Clique pour acheter ton ticket !*`);
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_gw_join').setLabel(`Participer (-${prix} Kyo Points)`).setStyle(ButtonStyle.Primary));
        const msg = await interaction.reply({ embeds: [emb], components: [row], fetchReply: true });
        const participants = new Set();
        
        const collector = msg.createMessageComponentCollector({ filter: i => i.customId === 'btn_gw_join', time: duree * 60000 });
        collector.on('collect', async i => {
            if (participants.has(i.user.id)) return i.reply({ content: "❌ Ticket déjà acheté !", ephemeral: true });
            const d = getUserData(i.user.id);
            if (d.coins < prix) return i.reply({ content: `❌ Fonds insuffisants !`, ephemeral: true });
            updateUserData(i.user.id, 'coins', d.coins - prix);
            participants.add(i.user.id);
            await i.reply({ content: `✅ Ticket validé ! **-${prix} Kyo Points**.`, ephemeral: true });
        });
        collector.on('end', async () => {
            await msg.edit({ components: [] });
            const pArray = Array.from(participants);
            if (pArray.length === 0) return channel.send(`😭 Personne n'a participé. Giveaway annulé.`);
            const winnerId = pArray[Math.floor(Math.random() * pArray.length)];
            channel.send(`🎉 **GIVEAWAY TERMINÉ !** 🎉\nFélicitations à <@${winnerId}> qui remporte : **${lot}** !`);
        });
        return;
    }

    if (commandName === 'put') {
        if (!isAdmin(member)) return interaction.reply({ content: "❌ Réservé au Staff.", ephemeral: true });
        const type = options.getString('type');
        if (type === 'panel') {
            const emb = new EmbedBuilder().setColor(CONFIG.color).setTitle('🏦 LA BANQUE DES KYO POINTS 🏦').setDescription(`Clique ci-dessous pour voir tes fonds.`);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_profile').setLabel('Mon Compte').setStyle(ButtonStyle.Primary));
            await channel.send({ embeds: [emb], components: [row] });
            return interaction.reply({ content: '✅ Panel déployé.', ephemeral: true });
        } else {
            const emb = new EmbedBuilder().setColor(CONFIG.color).setTitle('📖 GUIDE KYO').setDescription(`Joue, parie, et gagne des points !`);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_guide').setLabel('Résumé').setStyle(ButtonStyle.Success));
            await channel.send({ embeds: [emb], components: [row] });
            return interaction.reply({ content: '✅ Guide déployé.', ephemeral: true });
        }
    }

    if (commandName === 'pari') {
        const sub = options.getSubcommand();
        const mise = options.getInteger('mise');
        const uData = getUserData(user.id);

        if (uData.coins < mise || mise <= 0) return interaction.reply({ content: `❌ Pas assez d'argent. (Solde: ${uData.coins})`, ephemeral: true });

        if (sub === 'slots') {
            updateUserData(user.id, 'coins', uData.coins - mise);
            const items = ['🍒', '🍋', '🔔', '💠', '💰'];
            const r1 = items[Math.floor(Math.random() * items.length)], r2 = items[Math.floor(Math.random() * items.length)], r3 = items[Math.floor(Math.random() * items.length)];
            let gain = 0; let msgTxt = "Perdu...";
            if (r1 === r2 && r2 === r3) { gain = r1 === '💠' ? mise * 10 : mise * 5; msgTxt = "JACKPOT !!! 💎"; } 
            else if (r1 === r2 || r2 === r3 || r1 === r3) { gain = mise * 2; msgTxt = "Doublé ! ✨"; }
            updateUserData(user.id, 'coins', uData.coins - mise + gain);

            await interaction.reply({ content: `🎰 **Machine de ${user.username}**\n**[ 🟩 | 🟩 | 🟩 ]**\n*Tourne...*` });
            setTimeout(() => interaction.editReply({ content: `🎰 **Résultat de ${user.username}**\n**[ ${r1} | ${r2} | ${r3} ]**\n\n${msgTxt} (Gain: ${gain})` }), 2000);
            return;
        }

        if (sub === 'coffre') {
            updateUserData(user.id, 'coins', uData.coins - mise);
            const emb = new EmbedBuilder().setColor("#FFA500").setTitle('📦 Quitte ou Double !').setDescription(`Mise : ${mise}. Trouve le x2 !`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`coffre_${mise}_A`).setLabel('Coffre A').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`coffre_${mise}_B`).setLabel('Coffre B').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`coffre_${mise}_C`).setLabel('Coffre C').setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [emb], components: [row] });
        }

        if (sub === 'duel') {
            const adv = options.getUser('adversaire');
            if (adv.bot || adv.id === user.id) return interaction.reply({ content: "❌ Impossible !", ephemeral: true });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`duel_accept_${mise}_${user.id}`).setLabel('Accepter').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('duel_refuse').setLabel('Refuser').setStyle(ButtonStyle.Danger)
            );
            return interaction.reply({ content: `⚔️ **${adv}**, ${user} te défie ! Mise: **${mise}**. Accepte-tu ?`, components: [row] });
        }
    }

    if (commandName === 'jeu') {
        if (!isAdmin(member)) return interaction.reply({ content: "❌ Staff uniquement.", ephemeral: true });
        const sub = options.getSubcommand();

        if (sub === 'loto') {
            const nombre = options.getInteger('nombre'), recompense = options.getInteger('recompense');
            const emb = new EmbedBuilder().setColor(CONFIG.color).setTitle('🎯 LOTO SECRET').setDescription(`💰 **Récompense : ${recompense} Kyo Points**\n⏳ **60 secondes** pour deviner !`);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_loto_join').setLabel('Tenter ma chance 🎟️').setStyle(ButtonStyle.Success));
            const msg = await interaction.reply({ embeds: [emb], components: [row], fetchReply: true });
            
            activeLotos.set(msg.id, { secret: nombre, recompense: recompense, guesses: [] });
            
            setTimeout(async () => {
                const loto = activeLotos.get(msg.id);
                activeLotos.delete(msg.id);
                await msg.edit({ components: [] });
                if (loto.guesses.length === 0) return channel.send("😭 Personne n'a participé.");
                
                let text = "📜 **RÉSULTATS :**\n";
                let gagnants = [];
                loto.guesses.forEach(g => {
                    text += `- <@${g.userId}> a dit : **${g.guess}**\n`;
                    if (g.guess === loto.secret) gagnants.push(g.userId);
                });
                text += `\n🎯 Le nombre était **${loto.secret}** !`;
                
                if (gagnants.length > 0) {
                    gagnants.forEach(id => updateUserData(id, 'coins', getUserData(id).coins + loto.recompense));
                    text += `\n🎉 **Gagnants :** ${gagnants.map(id=>`<@${id}>`).join(', ')} (+${loto.recompense} pts) !`;
                } else text += `\n😭 Personne n'a trouvé !`;
                channel.send(text);
            }, 60000);
            return;
        }

        if (sub === 'braquage') {
            const emb = new EmbedBuilder().setColor("#000000").setTitle('🏦 BRAQUAGE').setDescription("💰 **Butin : 10000 pts**\n⏳ 30s pour rejoindre !");
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('join_braquage').setLabel('Rejoindre l\'assaut !').setStyle(ButtonStyle.Danger));
            const msg = await interaction.reply({ embeds: [emb], components: [row], fetchReply: true });
            let braqueurs = [];
            const collector = msg.createMessageComponentCollector({ filter: i => i.customId === 'join_braquage', time: 30000 });
            collector.on('collect', i => {
                if(!braqueurs.includes(i.user.id)) { braqueurs.push(i.user.id); i.reply({ content: "Tu es dedans !", ephemeral: true }); }
                else i.reply({ content: "Déjà dedans !", ephemeral: true });
            });
            collector.on('end', async () => {
                await msg.edit({ components: [] });
                if (braqueurs.length === 0) return channel.send("😭 Event annulé.");
                if (Math.random() > 0.4) {
                    const gain = Math.floor(10000 / braqueurs.length);
                    braqueurs.forEach(id => updateUserData(id, 'coins', getUserData(id).coins + gain));
                    channel.send(`🎉 **RÉUSSI !** Chacun gagne **${gain} pts** !`);
                } else channel.send(`🚨 **ÉCHEC !** La police vous a eus.`);
            });
            return;
        }

        if (sub === 'drapeau') {
            await interaction.deferReply();
            const pays = [{nom:'japon', flag:'🇯🇵'}, {nom:'canada', flag:'🇨🇦'}, {nom:'bresil', flag:'🇧🇷'}];
            const p = pays[Math.floor(Math.random() * pays.length)];
            await interaction.editReply(`🌍 Quel est ce pays : ${p.flag} ? (Gain: 500)`);
            const collector = channel.createMessageCollector({ filter: m => m.content.toLowerCase() === p.nom, max: 1, time: 20000 });
            collector.on('collect', m => {
                updateUserData(m.author.id, 'coins', getUserData(m.author.id).coins + 500);
                channel.send(`🏆 Gagné ${m.author} ! C'était le **${p.nom.toUpperCase()}** ! (+500)`);
            });
            collector.on('end', coll => { if(coll.size === 0) channel.send(`⏳ C'était : **${p.nom.toUpperCase()}**.`); });
            return;
        }

        if (sub === 'codesecret') {
            await interaction.deferReply();
            const secret = Math.floor(Math.random() * 8999) + 1000;
            await interaction.editReply(`🔢 **CRACKAGE** (1000-9999)\nProposez vos nombres !`);
            const collector = channel.createMessageCollector({ filter: m => !isNaN(m.content) && !m.author.bot, time: 60000 });
            collector.on('collect', m => {
                const guess = parseInt(m.content);
                if (guess === secret) {
                    updateUserData(m.author.id, 'coins', getUserData(m.author.id).coins + 1000);
                    channel.send(`🔓 **BINGO !** ${m.author} a trouvé **${secret}** (+1000 pts) !`);
                    collector.stop();
                } else m.react(guess < secret ? '⬆️' : '⬇️');
            });
            collector.on('end', (c, r) => { if (r !== 'user') channel.send(`⏳ Verrouillé. Le code était **${secret}**.`); });
            return;
        }
    }

    if (commandName === 'fakeban' || commandName === 'fakeappeal') {
        const target = options.getUser('cible');
        if (commandName === 'fakeban') {
            await interaction.reply(`🚨 Adieu ${target}, justice est rendue !`);
            return setTimeout(() => interaction.channel.send(`*Haha je rigole !*`), 3000);
        } else {
            return interaction.reply(`🚓 **POLICE !** ${user} dénonce ${target} pour : "${options.getString('motif')}".`);
        }
    }

    if (commandName === 'trahison') {
        if (!isAdmin(member)) return interaction.reply({ content: "❌ Admin uniquement.", ephemeral: true });
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        const msg = await interaction.reply({ content: "🔪 **JEU DE LA TRAHISON**\nLe salon est verrouillé. 20s pour s'inscrire.", components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trahison_join').setLabel('Rejoindre').setStyle(ButtonStyle.Danger))], fetchReply: true });
        let parts = [];
        const collector = msg.createMessageComponentCollector({ filter: i => i.customId === 'trahison_join', time: 20000 });
        collector.on('collect', async i => { if (!parts.includes(i.user.id)) { parts.push(i.user.id); await i.reply({ content: 'Inscrit', ephemeral: true }); } });
        collector.on('end', async () => {
            await msg.delete().catch(()=>{});
            if (parts.length < 2) { await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true }); return channel.send("❌ Pas assez de joueurs."); }
            const p1 = guild.members.cache.get(parts[0]), p2 = guild.members.cache.get(parts[1]);
            const tMsg = await channel.send({ content: `😈 Finalistes : ${p1} et ${p2}.\nVoulez-vous kick l'autre ?`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trahison_kick').setLabel('Trahir').setStyle(ButtonStyle.Danger))] });
            setTimeout(async () => {
                await tMsg.delete().catch(()=>{});
                await channel.permissionOverwrites.edit(p1.id, { SendMessages: true }); await channel.permissionOverwrites.edit(p2.id, { SendMessages: true });
                const ans = 15 + 12; // Modifiable
                await channel.send(`🔥 **DUEL FINAL !** Vous deux seuls pouvez parler.\n🔢 **Combien font : 15 + 12 ?**`);
                const mathColl = channel.createMessageCollector({ filter: m => (m.author.id===p1.id || m.author.id===p2.id) && m.content.trim()==='27', max: 1, time: 30000 });
                mathColl.on('collect', m => channel.send(`🏆 **Gagné ${m.author} !**`));
                mathColl.on('end', async () => {
                    await channel.permissionOverwrites.edit(p1.id, { SendMessages: null }); await channel.permissionOverwrites.edit(p2.id, { SendMessages: null });
                    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true });
                    channel.send("🔓 Salon ouvert.");
                });
            }, 7000);
        });
    }
});

client.login(process.env.TOKEN);

require('dotenv').config();
const http = require('http');
const { 
    Client, GatewayIntentBits, EmbedBuilder, REST, Routes, 
    SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ActivityType, ComponentType
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- MINI SERVEUR RENDER ---
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Kyo Bot Update 2.0 en ligne ! 🚀');
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
    return member.roles.cache.some(r => ADMIN_ROLES.includes(r.id)) || member.permissions.has(PermissionFlagsBits.Administrator);
}

// --- COMMANDES ---
const commands = [
    new SlashCommandBuilder().setName('put').setDescription('[ADMIN] Déploie un panel statique')
        .addStringOption(o => o.setName('type').setDescription('Choisis le panel à afficher').setRequired(true).addChoices(
            { name: 'Panel Hub (Profil Kyo Points)', value: 'panel' },
            { name: 'Panel Guide (Explications)', value: 'guide' }
        )),
    new SlashCommandBuilder().setName('giveaway').setDescription('[ADMIN] Lance un giveaway').addStringOption(o=>o.setName('lot').setDescription('Le cadeau').setRequired(true)).addIntegerOption(o=>o.setName('duree').setDescription('Durée (min)').setRequired(true)).addIntegerOption(o=>o.setName('prix').setDescription('Prix d\'entrée').setRequired(true)),
    new SlashCommandBuilder().setName('fakeban').setDescription('Simule un faux bannissement').addUserOption(o=>o.setName('cible').setDescription('La victime').setRequired(true)),
    new SlashCommandBuilder().setName('fakeappeal').setDescription('Dénonce quelqu\'un à la police (Faux)').addUserOption(o=>o.setName('cible').setDescription('Le criminel').setRequired(true)).addStringOption(o=>o.setName('motif').setDescription('Le crime').setRequired(true)),
    new SlashCommandBuilder().setName('trahison').setDescription('[ADMIN] Lance le jeu de la trahison !'),
    
    // NOUVELLES COMMANDES DE PARIS
    new SlashCommandBuilder().setName('pari').setDescription('Mise tes Kyo Points et tente de devenir riche !')
        .addSubcommand(s => s.setName('slots').setDescription('🎰 Joue à la machine à sous').addIntegerOption(o=>o.setName('mise').setDescription('Combien tu mises ?').setRequired(true)))
        .addSubcommand(s => s.setName('coffre').setDescription('📦 Choisis le bon coffre (Quitte ou Double)').addIntegerOption(o=>o.setName('mise').setDescription('Combien tu mises ?').setRequired(true)))
        .addSubcommand(s => s.setName('duel').setDescription('⚔️ Défie un joueur à pile ou face').addUserOption(o=>o.setName('adversaire').setDescription('Qui défier ?').setRequired(true)).addIntegerOption(o=>o.setName('mise').setDescription('Mise par joueur').setRequired(true))),
        
    // NOUVELLES COMMANDES D'EVENTS
    new SlashCommandBuilder().setName('jeu').setDescription('[ADMIN] Lance un grand jeu serveur')
        .addSubcommand(s => s.setName('braquage').setDescription('🏦 Lance un event de braquage en coop'))
        .addSubcommand(s => s.setName('drapeau').setDescription('🌍 Jeu de rapidité : devine le pays'))
        .addSubcommand(s => s.setName('codesecret').setDescription('🔢 Jeu de déduction : craque le coffre'))
];

client.once('ready', async () => {
    console.log(`🎁 ${client.user.tag} est connecté avec l'Update 2.0 !`);
    client.user.setActivity('Faire gagner des Kyo Points 💠', { type: ActivityType.Playing });
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
});

// --- TRACKING MISSIONS QUOTIDIENNES ---
client.on('messageCreate', message => {
    if (message.author.bot || !message.guild) return;
    const uData = getUserData(message.author.id);
    const now = Date.now();
    let updated = false;

    if (uData.lastMissionDate === getTodayString()) return;

    if (message.attachments.size > 0 && !uData.imageToday) { uData.imageToday = true; updated = true; }
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

// --- ROUTEUR DE COMMANDES ---
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) return handleButtons(interaction);
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, guild, channel, member } = interaction;

    // --- COMMANDES ADMINS ---
    if (commandName === 'put') {
        if (!isAdmin(member)) return interaction.reply({ content: "❌ Accès refusé.", ephemeral: true });
        const type = options.getString('type');

        if (type === 'panel') {
            const emb = new EmbedBuilder().setColor(CONFIG.color)
                .setTitle('🏦 LA BANQUE DES KYO POINTS 🏦')
                .setDescription(`Bienvenue dans ton espace personnel ! L'activité est la clé de la richesse ici.\n\n` +
                                `🎯 **Ta mission quotidienne :**\n` +
                                `💬 • Envoie 10 vrais messages (anti-spam activé !)\n` +
                                `📸 • Partage 1 image dans le salon médias\n\n` +
                                `🔥 **Le Streak :** Reviens chaque jour ! Plus ta série est longue, plus tu gagnes de points. Si tu rates un jour, tu retombes à zéro !\n\n` +
                                `👇 *Clique ci-dessous pour voir tes fonds secrets.*`);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_profile').setLabel('Consulter mon Compte').setStyle(ButtonStyle.Primary).setEmoji('💳'));
            await channel.send({ embeds: [emb], components: [row] });
            return interaction.reply({ content: '✅ Panel Banque déployé !', ephemeral: true });
        }

        if (type === 'guide') {
            const emb = new EmbedBuilder().setColor(CONFIG.color)
                .setTitle('📖 LE MANUEL DE SURVIE DU SERVEUR 📖')
                .setDescription(`Tu es nouveau et tu veux tout rafler ? Lis attentivement :\n\n` +
                                `💠 **À quoi servent les Kyo Points ?**\n` +
                                `Ils te permettent de participer à des **Giveaways Exclusifs** avec de vrais gros lots. Plus tu es riche, plus tu peux t'acheter de tickets d'entrée !\n\n` +
                                `🎰 **Comment devenir riche vite ?**\n` +
                                `En plus de la mission quotidienne, tu peux utiliser les commandes de paris comme \`/pari slots\` ou affronter tes amis avec \`/pari duel\` ! Mais attention à ne pas tout perdre...\n\n` +
                                `👇 *Clique pour un rappel de ton objectif du jour.*`);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_guide').setLabel('Résumé Rapide').setStyle(ButtonStyle.Success).setEmoji('📜'));
            await channel.send({ embeds: [emb], components: [row] });
            return interaction.reply({ content: '✅ Panel Guide déployé !', ephemeral: true });
        }
    }

    // --- JEUX ADMINS ---
    if (commandName === 'jeu') {
        if (!isAdmin(member)) return interaction.reply({ content: "❌ Les events sont gérés par le staff.", ephemeral: true });
        const sub = options.getSubcommand();

        if (sub === 'braquage') {
            const emb = new EmbedBuilder().setColor("#000000").setTitle('🏦 BRAQUAGE EN COURS !')
                .setDescription("La banque de Kyo City est vulnérable ! On recrute une équipe.\n\n💰 **Butin estimé : 10 000 Kyo Points** (à partager entre les survivants).\n⏳ Vous avez **30 secondes** pour rejoindre l'équipe d'assaut !");
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('join_braquage').setLabel('Rejoindre l\'assaut !').setStyle(ButtonStyle.Danger).setEmoji('🔫'));
            
            const msg = await interaction.reply({ embeds: [emb], components: [row], fetchReply: true });
            let braqueurs = [];
            
            const collector = msg.createMessageComponentCollector({ filter: i => i.customId === 'join_braquage', time: 30000 });
            collector.on('collect', i => {
                if(!braqueurs.includes(i.user.id)) { braqueurs.push(i.user.id); i.reply({ content: "Tu es dans l'équipe, prépare ton masque !", ephemeral: true }); }
                else i.reply({ content: "Tu es déjà dans le van !", ephemeral: true });
            });

            collector.on('end', async () => {
                await msg.edit({ components: [] });
                if (braqueurs.length === 0) return channel.send("😭 Personne n'a eu le courage de braquer la banque. L'event est annulé.");
                
                // 60% de chances de réussite
                const success = Math.random() > 0.4;
                if (success) {
                    const gainPerPlayer = Math.floor(10000 / braqueurs.length);
                    braqueurs.forEach(id => {
                        const d = getUserData(id);
                        updateUserData(id, 'coins', d.coins + gainPerPlayer);
                    });
                    channel.send(`🎉 **BRAQUAGE RÉUSSI !** L'équipe a fui la police. Les ${braqueurs.length} participants gagnent chacun **${gainPerPlayer} Kyo Points** !`);
                } else {
                    channel.send(`🚨 **ÉCHEC CRITIQUE !** La police a intercepté l'équipe. Tout le monde a paniqué et vous n'avez rien gagné. Mieux vaut courir !`);
                }
            });
            return;
        }

        if (sub === 'drapeau') {
            await interaction.deferReply();
            const pays = [
                { nom: 'japon', drapeau: '🇯🇵' }, { nom: 'bresil', drapeau: '🇧🇷' }, 
                { nom: 'canada', drapeau: '🇨🇦' }, { nom: 'espagne', drapeau: '🇪🇸' },
                { nom: 'coree du sud', drapeau: '🇰🇷' }
            ];
            const p = pays[Math.floor(Math.random() * pays.length)];
            
            await interaction.editReply(`🌍 **JEU DE GÉOGRAPHIE** 🌍\nLe premier qui écrit le nom de ce pays remporte **500 Kyo Points** !\n\nQuel est ce pays : ${p.drapeau}`);
            
            const filter = m => m.content.toLowerCase() === p.nom;
            const collector = channel.createMessageCollector({ filter, max: 1, time: 20000 });
            
            collector.on('collect', m => {
                const d = getUserData(m.author.id);
                updateUserData(m.author.id, 'coins', d.coins + 500);
                channel.send(`🏆 **Gagné !** Bien joué ${m.author}, c'était bien le **${p.nom.toUpperCase()}** ! (+500 Kyo Points)`);
            });
            collector.on('end', collected => {
                if (collected.size === 0) channel.send(`⏳ Temps écoulé ! Personne n'a trouvé. C'était : **${p.nom.toUpperCase()}**.`);
            });
            return;
        }

        if (sub === 'codesecret') {
            await interaction.deferReply();
            const secret = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;
            await interaction.editReply(`🔢 **CRACKAGE DE COFFRE** 🔢\nUn coffre vient d'apparaître ! Il contient **1000 Kyo Points**.\nLe code est compris entre **1000 et 9999**.\nProposez vos nombres dans le chat !`);
            
            const filter = m => !isNaN(m.content) && !m.author.bot;
            const collector = channel.createMessageCollector({ filter, time: 60000 });
            
            collector.on('collect', m => {
                const guess = parseInt(m.content);
                if (guess === secret) {
                    const d = getUserData(m.author.id);
                    updateUserData(m.author.id, 'coins', d.coins + 1000);
                    channel.send(`🔓 **BINGO !** Le coffre est ouvert ! ${m.author} a trouvé le code secret (**${secret}**) et remporte 1000 Kyo Points !`);
                    collector.stop();
                } else if (guess < secret) {
                    m.react('⬆️');
                } else {
                    m.react('⬇️');
                }
            });
            collector.on('end', (c, reason) => {
                if (reason !== 'user') channel.send(`⏳ La sécurité a bloqué le coffre. Le code était **${secret}**.`);
            });
            return;
        }
    }

    // --- PARIS & JEUX D'ARGENT ---
    if (commandName === 'pari') {
        const sub = options.getSubcommand();
        const mise = options.getInteger('mise');
        const uData = getUserData(user.id);

        if (uData.coins < mise || mise <= 0) {
            return interaction.reply({ content: `❌ Tu n'as pas assez d'argent ou ta mise est invalide. Tu as **${uData.coins}** Kyo Points.`, ephemeral: true });
        }

        if (sub === 'slots') {
            updateUserData(user.id, 'coins', uData.coins - mise);
            const items = ['🍒', '🍋', '🔔', '💠', '💰'];
            const r1 = items[Math.floor(Math.random() * items.length)];
            const r2 = items[Math.floor(Math.random() * items.length)];
            const r3 = items[Math.floor(Math.random() * items.length)];
            
            let gain = 0;
            let msgTxt = "Perdu... La maison gagne toujours.";
            
            if (r1 === r2 && r2 === r3) {
                if (r1 === '💠') { gain = mise * 10; msgTxt = "JACKPOT MYTHIQUE !!! 💎"; }
                else { gain = mise * 5; msgTxt = "SUPER JACKPOT ! 🔥"; }
            } else if (r1 === r2 || r2 === r3 || r1 === r3) {
                gain = mise * 2; msgTxt = "Petite victoire, c'est doublé ! ✨";
            }

            const finalCoins = uData.coins - mise + gain;
            updateUserData(user.id, 'coins', finalCoins);

            const emb = new EmbedBuilder().setColor(gain > 0 ? "#00FF00" : "#FF0000")
                .setTitle(`🎰 Machine à sous de ${user.username}`)
                .setDescription(`**[ 🟩 | 🟩 | 🟩 ]**\n*La machine tourne...*`);
            
            await interaction.reply({ embeds: [emb] });
            
            setTimeout(() => {
                const finalEmb = new EmbedBuilder().setColor(gain > 0 ? "#00FF00" : "#FF0000")
                    .setTitle(`🎰 Résultat de ${user.username}`)
                    .setDescription(`**[ ${r1} | ${r2} | ${r3} ]**\n\n${msgTxt}\nTu gagnes **${gain} Kyo Points** !`);
                interaction.editReply({ embeds: [finalEmb] });
            }, 2000);
            return;
        }

        if (sub === 'coffre') {
            updateUserData(user.id, 'coins', uData.coins - mise);
            const emb = new EmbedBuilder().setColor("#FFA500")
                .setTitle('📦 Le Quitte ou Double !')
                .setDescription(`Tu as misé ${mise} Kyo Points.\nChoisis un coffre ! Un seul contient le trésor (x2), un rembourse (x1), et un est vide (x0).`);
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`coffre_${mise}_A`).setLabel('Coffre A').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`coffre_${mise}_B`).setLabel('Coffre B').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`coffre_${mise}_C`).setLabel('Coffre C').setStyle(ButtonStyle.Primary)
            );

            return interaction.reply({ embeds: [emb], components: [row] });
        }

        if (sub === 'duel') {
            const adv = options.getUser('adversaire');
            if (adv.bot || adv.id === user.id) return interaction.reply({ content: "❌ Tu ne peux pas défier un bot ou toi-même !", ephemeral: true });
            
            const advData = getUserData(adv.id);
            if (advData.coins < mise) return interaction.reply({ content: `❌ ${adv.username} n'a pas assez d'argent pour parier ${mise} Kyo Points.`, ephemeral: true });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`duel_accept_${mise}_${user.id}`).setLabel('Accepter le Duel').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('duel_refuse').setLabel('Refuser').setStyle(ButtonStyle.Danger)
            );

            return interaction.reply({ content: `⚔️ **${adv}**, tu es défié par ${user} pour un combat à Pile ou Face ! Mise : **${mise} Kyo Points** chacun. Le vainqueur rafle tout. Accepteras-tu ?`, components: [row] });
        }
    }

    // --- ANCIENNES COMMANDES (Trahison, Fake, Giveaway) ---
    if (commandName === 'trahison') {
        if (!isAdmin(member)) return interaction.reply({ content: "❌ Admin uniquement.", ephemeral: true });
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        
        const emb = new EmbedBuilder().setColor("#000000").setTitle('🔪 JEU DE LA TRAHISON').setDescription('Le salon est verrouillé.\nCliquez sur le bouton pour participer au jeu. 2 finalistes seront choisis pour le duel à mort.');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trahison_join').setLabel('Rejoindre le jeu').setStyle(ButtonStyle.Danger));
        
        const msg = await interaction.reply({ embeds: [emb], components: [row], fetchReply: true });
        let participants = [];
        const collector = msg.createMessageComponentCollector({ filter: i => i.customId === 'trahison_join', time: 20000 });

        collector.on('collect', async i => {
            if (!participants.includes(i.user.id)) { participants.push(i.user.id); await i.reply({ content: 'Inscrit.', ephemeral: true }); }
            else await i.reply({ content: 'Déjà inscrit.', ephemeral: true });
        });

        collector.on('end', async () => {
            await msg.delete().catch(()=>{});
            if (participants.length < 2) {
                await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true });
                return channel.send("❌ Pas assez de joueurs. Annulé.");
            }

            const shuffled = participants.sort(() => 0.5 - Math.random());
            const p1 = guild.members.cache.get(shuffled[0]);
            const p2 = guild.members.cache.get(shuffled[1]);

            await channel.send(`😈 **Finalistes :** ${p1} et ${p2}.\n*Préparez-vous.*`);

            const tRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trahison_kick').setLabel('Trahir et Kick l\'autre').setStyle(ButtonStyle.Danger));
            const tMsg = await channel.send({ content: `${p1} ${p2} : Voulez-vous un avantage ? Cliquez pour KICK votre adversaire !`, components: [tRow] });

            setTimeout(async () => {
                await tMsg.delete().catch(()=>{});
                await channel.permissionOverwrites.edit(p1.id, { SendMessages: true });
                await channel.permissionOverwrites.edit(p2.id, { SendMessages: true });

                const isAddition = Math.random() > 0.5;
                const num1 = Math.floor(Math.random() * 20) + 5;
                const num2 = Math.floor(Math.random() * 20) + 5;
                const answer = isAddition ? (num1 + num2) : (num1 * num2);
                const symbol = isAddition ? '+' : 'x';

                await channel.send(`🔥 **DUEL FINAL !** Seuls vous deux pouvez parler. Le premier qui écrit la bonne réponse gagne !\n🔢 **Combien font : ${num1} ${symbol} ${num2} ?**`);

                const mathFilter = m => (m.author.id === p1.id || m.author.id === p2.id) && m.content.trim() === answer.toString();
                const mathCollector = channel.createMessageCollector({ filter: mathFilter, max: 1, time: 30000 });

                mathCollector.on('collect', async m => {
                    await channel.send(`🏆 **FÉLICITATIONS ${m.author} !** Tu as remporté le jeu de la trahison !`);
                });
                mathCollector.on('end', async collected => {
                    if (collected.size === 0) await channel.send(`⏳ Temps écoulé ! Personne n'a trouvé.`);
                    await channel.permissionOverwrites.edit(p1.id, { SendMessages: null });
                    await channel.permissionOverwrites.edit(p2.id, { SendMessages: null });
                    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true });
                    channel.send("🔓 Le salon est à nouveau ouvert.");
                });
            }, 7000);
        });
    }

    if (commandName === 'fakeban' || commandName === 'fakeappeal') {
        const target = options.getUser('cible');
        if (commandName === 'fakeban') {
            await interaction.reply(`🚨 **BANNISSEMENT EN COURS** 🚨\nAdieu ${target}, tu as été frappé par le marteau de la justice !`);
            return setTimeout(() => interaction.channel.send(`*...Haha je rigole, c'était un faux ban !* 😜`), 3000);
        } else {
            return interaction.reply(`🚓 **ALLO LA POLICE ?**\n${user} dénonce ${target} pour : **"${options.getString('motif')}"**.\n*Les autorités sont en route.*`);
        }
    }
});

// --- GESTION DES BOUTONS COMPLEXES ---
async function handleButtons(interaction) {
    if (interaction.customId === 'btn_profile') {
        const uData = getUserData(interaction.user.id);
        const emb = new EmbedBuilder().setColor(CONFIG.color).setTitle(`💳 Compte de ${interaction.user.username}`).addFields(
            { name: '💠 Solde', value: `**${uData.coins} Kyo Points**`, inline: true },
            { name: '🔥 Streak', value: `**${uData.streak} jours**`, inline: true },
            { name: '🎯 Objectif du jour', value: `- Messages utiles : ${uData.messagesToday}/10\n- Image postée : ${uData.imageToday ? '✅' : '❌'}` }
        );
        return interaction.reply({ embeds: [emb], ephemeral: true });
    }

    if (interaction.customId === 'btn_guide') {
        return interaction.reply({ content: `✨ **Rappel Rapide :** Envoie 10 messages et 1 image aujourd'hui pour valider ta mission. Utilise les commandes \`/pari\` pour tenter de doubler ton solde !`, ephemeral: true });
    }

    if (interaction.customId.startsWith('coffre_')) {
        const [, miseStr, choix] = interaction.customId.split('_');
        const mise = parseInt(miseStr);
        
        // Anti-triche : seul l'auteur du pari peut cliquer
        if (interaction.message.interaction && interaction.message.interaction.user.id !== interaction.user.id) {
            return interaction.reply({ content: "C'est pas ton coffre, tricheur ! 😡", ephemeral: true });
        }

        const uData = getUserData(interaction.user.id);
        const gainsMultipliers = [0, 1, 2];
        const multiplier = gainsMultipliers[Math.floor(Math.random() * gainsMultipliers.length)];
        const gainFinal = mise * multiplier;
        
        updateUserData(interaction.user.id, 'coins', uData.coins + gainFinal);
        
        let msg = "";
        if (multiplier === 0) msg = "💀 Le coffre était vide ou piégé ! Tu perds ta mise.";
        else if (multiplier === 1) msg = "🤝 Ouf, remboursement ! Tu récupères ta mise.";
        else msg = "🎉 **BINGO !** Trésor doublé !";

        await interaction.update({ content: `${interaction.user} a ouvert le **Coffre ${choix}**.\n\n${msg}\nGain: **${gainFinal} Kyo Points**.`, embeds: [], components: [] });
    }

    if (interaction.customId.startsWith('duel_accept_')) {
        const [, , miseStr, defieurId] = interaction.customId.split('_');
        const mise = parseInt(miseStr);
        
        // Seul le joueur défié (qui n'est pas le defieur) doit cliquer, en théorie le message mentionnait la personne
        if (interaction.user.id === defieurId) return interaction.reply({ content: "Tu ne peux pas accepter ton propre duel !", ephemeral: true });

        const uData1 = getUserData(defieurId);
        const uData2 = getUserData(interaction.user.id);
        
        if (uData2.coins < mise) return interaction.reply({ content: "Tu n'as pas l'argent pour accepter ce duel !", ephemeral: true });

        // Soustraction des mises
        updateUserData(defieurId, 'coins', uData1.coins - mise);
        updateUserData(interaction.user.id, 'coins', uData2.coins - mise);

        await interaction.update({ content: `⚔️ **LE DUEL COMMENCE !**\n${interaction.message.mentions.users.first() || 'Le joueur défié'} a accepté le pari contre <@${defieurId}> pour **${mise} Kyo Points** !\n\n*La pièce tourne en l'air...* 🪙`, components: [] });

        setTimeout(() => {
            const gagnantId = Math.random() > 0.5 ? defieurId : interaction.user.id;
            const perdantId = gagnantId === defieurId ? interaction.user.id : defieurId;
            const gainTotal = mise * 2;
            
            const finalData = getUserData(gagnantId);
            updateUserData(gagnantId, 'coins', finalData.coins + gainTotal);

            interaction.channel.send(`👑 **RÉSULTAT DU DUEL :** La pièce est tombée !\nFélicitations à <@${gagnantId}> qui écrase <@${perdantId}> et remporte **${gainTotal} Kyo Points** !`);
        }, 3000);
    }

    if (interaction.customId === 'duel_refuse') {
        await interaction.update({ content: `🐔 Quelqu'un a refusé le duel par peur de perdre ses Kyo Points !`, components: [] });
    }

    if (interaction.customId === 'trahison_kick') {
        return interaction.reply({ content: "Haha désolé, je crois que tu n'es pas un bon ami de base c'est juste un troll... Cette option était fausse ! 😜", ephemeral: true });
    }
}

client.login(process.env.TOKEN);

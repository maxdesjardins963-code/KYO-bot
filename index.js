require('dotenv').config();
const http = require('http');
const { 
    Client, GatewayIntentBits, EmbedBuilder, REST, Routes, 
    SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ActivityType
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- MINI SERVEUR RENDER ---
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Kyo Bot en ligne ! 🚀');
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
            coins: 0, 
            streak: 0,
            lastMissionDate: null,
            todayDate: getTodayString(),
            messagesToday: 0,
            imageToday: false,
            lastMessageTime: 0
        };
        writeDB(db);
    }
    // Reset quotidien
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

// --- COMMANDES ---
const commands = [
    new SlashCommandBuilder().setName('put')
        .setDescription('[ADMIN] Déploie un panel statique (Guide ou Hub Kyo Points)')
        .addStringOption(o => o.setName('type')
            .setDescription('Choisis le panel à afficher')
            .setRequired(true)
            .addChoices(
                { name: 'Panel Hub (Profil Kyo Points)', value: 'panel' },
                { name: 'Panel Guide (Explications)', value: 'guide' }
            )
        ),
    new SlashCommandBuilder().setName('giveaway').setDescription('Lance un giveaway').addStringOption(o=>o.setName('lot').setDescription('Le cadeau').setRequired(true)).addIntegerOption(o=>o.setName('duree').setDescription('Durée en minutes').setRequired(true)).addIntegerOption(o=>o.setName('prix').setDescription('Prix d\'entrée en Kyo Points').setRequired(true)),
    new SlashCommandBuilder().setName('fakeban').setDescription('Simule un faux bannissement').addUserOption(o=>o.setName('cible').setDescription('La victime').setRequired(true)),
    new SlashCommandBuilder().setName('fakeappeal').setDescription('Dénonce quelqu\'un à la police du serveur (Faux)').addUserOption(o=>o.setName('cible').setDescription('Le criminel').setRequired(true)).addStringOption(o=>o.setName('motif').setDescription('Le crime').setRequired(true)),
    new SlashCommandBuilder().setName('trahison').setDescription('Lance le jeu de la trahison !')
];

client.once('ready', async () => {
    console.log(`🎁 ${client.user.tag} est connecté !`);
    client.user.setActivity('Distribuer des Kyo Points', { type: ActivityType.Playing });
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
});

// --- TRACKING DES MISSIONS QUOTIDIENNES ---
client.on('messageCreate', message => {
    if (message.author.bot || !message.guild) return;

    const uData = getUserData(message.author.id);
    const now = Date.now();
    let updated = false;

    if (uData.lastMissionDate === getTodayString()) return;

    if (message.attachments.size > 0 && !uData.imageToday) {
        uData.imageToday = true;
        updated = true;
    }

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
        
        message.channel.send(`🎉 **Félicitations ${message.author} !** Tu as complété ta mission quotidienne. \n🔥 Streak : **${uData.streak} jours** (+${reward} Kyo Points !)`).then(m => setTimeout(() => m.delete().catch(()=>{}), 10000));
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

// --- GESTION DES COMMANDES ---
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) return handleButtons(interaction);
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, guild, channel, member } = interaction;

    if (commandName === 'put') {
        const hasRole = member.roles.cache.some(r => ADMIN_ROLES.includes(r.id));
        if (!hasRole && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Tu n'es pas autorisé à utiliser cette commande.", ephemeral: true });
        }

        const type = options.getString('type');

        if (type === 'panel') {
            const emb = new EmbedBuilder().setColor(CONFIG.color)
                .setTitle('💠 Kyo Points Hub')
                .setDescription('Parle pour gagner des coins.\nUne image = bonus du jour.\nReviens chaque jour pour ton streak.\n\n*Ouvre ton espace perso pour voir ta progression !*');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_profile').setLabel('Ouvrir mon profil').setStyle(ButtonStyle.Primary).setEmoji('👤')
            );
            await channel.send({ embeds: [emb], components: [row] });
            return interaction.reply({ content: '✅ Panel Kyo Points déployé ici !', ephemeral: true });
        }

        if (type === 'guide') {
            const emb = new EmbedBuilder().setColor(CONFIG.color)
                .setTitle('📖 Guide du serveur')
                .setDescription('Bienvenue dans le centre d\'aide !\nIci tu peux apprendre comment fonctionnent les Kyo Points, comment gagner des récompenses et participer aux giveaways.\n\n*Clique sur le bouton ci-dessous pour lire le guide complet.*');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_guide').setLabel('Lire le guide').setStyle(ButtonStyle.Success).setEmoji('📚')
            );
            await channel.send({ embeds: [emb], components: [row] });
            return interaction.reply({ content: '✅ Guide déployé ici !', ephemeral: true });
        }
    }

    if (commandName === 'fakeban') {
        const target = options.getUser('cible');
        await interaction.reply(`🚨 **BANNISSEMENT EN COURS** 🚨\nAdieu ${target}, tu as été frappé par le marteau de la justice !`);
        setTimeout(() => interaction.channel.send(`*...Haha je rigole, c'était un faux ban !* 😜`), 3000);
        return;
    }

    if (commandName === 'fakeappeal') {
        const target = options.getUser('cible');
        const motif = options.getString('motif');
        return interaction.reply(`🚓 **ALLO LA POLICE ?**\n${user} vient de dénoncer ${target} pour le motif suivant : **"${motif}"**.\n*Les autorités sont en route (ou pas).*`);
    }

    if (commandName === 'giveaway') {
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: "❌ Admin uniquement.", ephemeral: true });
        const lot = options.getString('lot');
        const duree = options.getInteger('duree');
        const prix = options.getInteger('prix');

        const emb = new EmbedBuilder().setColor(CONFIG.color)
            .setTitle('🎉 NOUVEAU GIVEAWAY 🎉')
            .setDescription(`**Lot :** ${lot}\n**Frais d'entrée :** ${prix} Kyo Points\n**Temps :** ${duree} minute(s)\n\n*Cliquez sur le bouton ci-dessous pour participer !*`);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`gw_join_${prix}`).setLabel('Participer').setStyle(ButtonStyle.Success).setEmoji('💠')
        );

        const msg = await interaction.reply({ embeds: [emb], components: [row], fetchReply: true });
        
        client.giveaways = client.giveaways || {};
        client.giveaways[msg.id] = [];

        setTimeout(async () => {
            const participants = client.giveaways[msg.id];
            const fetchedMsg = await channel.messages.fetch(msg.id).catch(()=>{});
            if (fetchedMsg) await fetchedMsg.edit({ components: [] });

            if (!participants || participants.length === 0) {
                return channel.send(`😭 Personne n'a participé au giveaway pour **${lot}**...`);
            }
            const winnerId = participants[Math.floor(Math.random() * participants.length)];
            channel.send(`🏆 Le giveaway est terminé ! Bravo à <@${winnerId}> qui remporte **${lot}** !`);
            delete client.giveaways[msg.id];
        }, duree * 60000);
        return;
    }

    if (commandName === 'trahison') {
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: "❌ Admin uniquement.", ephemeral: true });
        
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        
        const emb = new EmbedBuilder().setColor("#000000")
            .setTitle('🔪 JEU DE LA TRAHISON')
            .setDescription('Le salon est verrouillé.\nSeuls les plus courageux survivront. Cliquez sur le bouton pour participer au jeu. Le bot choisira 2 finalistes pour le duel à mort.');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trahison_join').setLabel('Rejoindre le jeu').setStyle(ButtonStyle.Danger));
        
        const msg = await interaction.reply({ embeds: [emb], components: [row], fetchReply: true });
        
        let participants = [];
        const filter = i => i.customId === 'trahison_join';
        const collector = msg.createMessageComponentCollector({ filter, time: 20000 });

        collector.on('collect', async i => {
            if (!participants.includes(i.user.id)) {
                participants.push(i.user.id);
                await i.reply({ content: 'Tu es inscrit au jeu.', ephemeral: true });
            } else {
                await i.reply({ content: 'Tu es déjà inscrit.', ephemeral: true });
            }
        });

        collector.on('end', async () => {
            await msg.delete().catch(()=>{});
            if (participants.length < 2) {
                await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true });
                return channel.send("❌ Pas assez de joueurs (minimum 2). Le salon est déverrouillé.");
            }

            const shuffled = participants.sort(() => 0.5 - Math.random());
            const p1 = guild.members.cache.get(shuffled[0]);
            const p2 = guild.members.cache.get(shuffled[1]);

            await channel.send(`😈 La sélection a été faite. Les autres ont été éliminés.\n**Finalistes :** ${p1} et ${p2}.\n\n*Préparez-vous.*`);

            const tRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trahison_kick').setLabel('Trahir et Kick l\'autre').setStyle(ButtonStyle.Danger)
            );
            const tMsg = await channel.send({ content: `${p1} ${p2} : Voulez-vous gagner un avantage immédiat ? Cliquez ci-dessous pour KICK votre adversaire du serveur !`, components: [tRow] });

            setTimeout(async () => {
                await tMsg.delete().catch(()=>{});
                
                await channel.permissionOverwrites.edit(p1.id, { SendMessages: true });
                await channel.permissionOverwrites.edit(p2.id, { SendMessages: true });

                const isAddition = Math.random() > 0.5;
                const num1 = Math.floor(Math.random() * 20) + 5;
                const num2 = Math.floor(Math.random() * 20) + 5;
                const answer = isAddition ? (num1 + num2) : (num1 * num2);
                const symbol = isAddition ? '+' : 'x';

                await channel.send(`🔥 **DUEL FINAL !** 🔥\nSeuls vous deux pouvez parler. Le premier qui écrit la bonne réponse gagne !\n\n🔢 **Combien font : ${num1} ${symbol} ${num2} ?**`);

                const mathFilter = m => (m.author.id === p1.id || m.author.id === p2.id) && m.content.trim() === answer.toString();
                const mathCollector = channel.createMessageCollector({ filter: mathFilter, max: 1, time: 30000 });

                mathCollector.on('collect', async m => {
                    await channel.send(`🏆 **FÉLICITATIONS ${m.author} !** Tu as trouvé la bonne réponse (${answer}) et remporté le jeu de la trahison !`);
                });

                mathCollector.on('end', async collected => {
                    if (collected.size === 0) {
                        await channel.send(`⏳ Temps écoulé ! Personne n'a trouvé la réponse (${answer}). C'est triste.`);
                    }
                    await channel.permissionOverwrites.edit(p1.id, { SendMessages: null });
                    await channel.permissionOverwrites.edit(p2.id, { SendMessages: null });
                    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true });
                    channel.send("🔓 Le salon est à nouveau ouvert à tous.");
                });

            }, 7000);
        });
    }
});

// --- GESTION DES BOUTONS ---
async function handleButtons(interaction) {
    if (interaction.customId === 'btn_profile') {
        const uData = getUserData(interaction.user.id);
        const emb = new EmbedBuilder().setColor(CONFIG.color)
            .setTitle(`Profil de ${interaction.user.username}`)
            .addFields(
                { name: '💠 Kyo Points', value: `**${uData.coins}**`, inline: true },
                { name: '🔥 Streak Quotidien', value: `**${uData.streak} jours**`, inline: true },
                { name: '📊 Mission d\'aujourd\'hui', value: `- Messages : ${uData.messagesToday}/10\n- Image : ${uData.imageToday ? '✅' : '❌'}` }
            );
        return interaction.reply({ embeds: [emb], ephemeral: true });
    }

    if (interaction.customId === 'btn_guide') {
        const txt = `✨ **Guide des Kyo Points** ✨\nSur ce serveur, l'activité est récompensée ! Ta mission chaque jour : envoyer **10 messages utiles** (sans spam) et **1 image**. Si tu réussis, tu gagnes des Kyo Points. Fais-le plusieurs jours de suite pour faire exploser ton "Streak" et gagner encore plus de points ! Ces points te serviront à participer à des giveaways exclusifs.`;
        return interaction.reply({ content: txt, ephemeral: true });
    }

    if (interaction.customId === 'trahison_kick') {
        return interaction.reply({ content: "Haha désolé, je crois que tu n'es pas un bon ami... Cette option était fausse ! 😜", ephemeral: true });
    }

    if (interaction.customId.startsWith('gw_join_')) {
        const prix = parseInt(interaction.customId.split('_')[2]);
        const msgId = interaction.message.id;
        
        if (!client.giveaways || !client.giveaways[msgId]) return interaction.reply({ content: "Ce giveaway est terminé ou invalide.", ephemeral: true });
        
        if (client.giveaways[msgId].includes(interaction.user.id)) {
            return interaction.reply({ content: "Tu participes déjà à ce giveaway !", ephemeral: true });
        }

        const uData = getUserData(interaction.user.id);
        if (uData.coins < prix) {
            return interaction.reply({ content: `❌ Tu n'as pas assez de Kyo Points. Il t'en faut ${prix} (Tu en as ${uData.coins}).`, ephemeral: true });
        }

        updateUserData(interaction.user.id, 'coins', uData.coins - prix);
        client.giveaways[msgId].push(interaction.user.id);
        return interaction.reply({ content: `✅ Participation confirmée ! Tu as payé ${prix} Kyo Points.`, ephemeral: true });
    }
}

client.login(process.env.TOKEN);

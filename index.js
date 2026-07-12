const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, StringSelectMenuBuilder, REST, Routes 
} = require('discord.js');
const http = require('http'); 
require('dotenv').config();

// --- CRÉATION DU FAUX SERVEUR WEB POUR RENDER ---
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('KYO BOT: HYBRID UPDATE - SYSTÈME EN LIGNE');
    res.end();
}).listen(port, () => {
    console.log(`🌐 [RENDER FIX] Serveur Web factice activé sur le port ${port}`);
});

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// ID du rôle requis pour exécuter les commandes d'administration
const REQUIRED_ROLE_ID = '1502765782960967861';

// Base de données temporaire en mémoire
const userDatabase = new Map(); 

const getUserData = (id) => userDatabase.get(id) || { coins: 0, level: 1 };
const updateUserData = (id, coinsAdd, levelAdd) => {
    let data = getUserData(id);
    data.coins += coinsAdd;
    data.level += levelAdd;
    userDatabase.set(id, data);
};

// ==========================================
// NOUVEAU SYSTÈME : GAIN DE POINTS PAR MESSAGE + STREAK
// ==========================================
// Règles :
// - Un message rapporte des Kyo Points seulement si 10 minutes se sont
//   écoulées depuis le dernier message récompensé (cooldown anti-spam).
// - Maximum 6 messages récompensés par jour (6 x 10 min = 1 heure d'activité).
// - Si le maximum journalier est atteint plusieurs jours d'affilée,
//   le "streak" augmente de +1 chaque jour.
// - Le streak ajoute des points bonus à CHAQUE message (10 + streak),
//   jusqu'à un maximum de +25 points bonus (donc 35 points/message au max).
// - Si une journée est ratée (le max de 6 messages n'est pas atteint),
//   le streak retombe à 0.

const MESSAGE_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes entre chaque message récompensé
const MAX_DAILY_REWARDED_MESSAGES = 6;      // 6 x 10 min = 1 heure d'activité par jour
const BASE_MESSAGE_POINTS = 10;             // Points de base par message
const MAX_STREAK_BONUS = 25;                // Bonus maximum lié au streak

const userActivityData = new Map();

const getActivityData = (id) => {
    if (!userActivityData.has(id)) {
        userActivityData.set(id, {
            lastRewardTime: 0,       // Timestamp du dernier message récompensé
            dailyCount: 0,           // Nombre de messages récompensés aujourd'hui
            activeDate: null,        // Date (YYYY-MM-DD) du jour en cours de suivi
            streak: 0,               // Nombre de jours consécutifs réussis
            lastCompletedDate: null  // Dernier jour où le max journalier a été atteint
        });
    }
    return userActivityData.get(id);
};

const getTodayString = () => new Date().toISOString().split('T')[0];

// --- LISTENER : MESSAGES TEXTUELS (GAIN DE POINTS) ---
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const now = Date.now();
    const today = getTodayString();
    const data = getActivityData(userId);

    // --- Gestion du changement de jour + validation du streak ---
    if (data.activeDate !== today) {
        if (data.activeDate) {
            const lastDate = new Date(data.activeDate);
            const currentDate = new Date(today);
            const diffDays = Math.round((currentDate - lastDate) / (1000 * 60 * 60 * 24));

            // Le streak casse si le jour précédent n'a pas été complété
            // OU si plus d'un jour s'est écoulé depuis la dernière activité.
            if (diffDays !== 1 || data.lastCompletedDate !== data.activeDate) {
                data.streak = 0;
            }
        }
        data.dailyCount = 0;
        data.activeDate = today;
    }

    // --- Cooldown : il faut attendre 10 minutes entre chaque message récompensé ---
    if (now - data.lastRewardTime < MESSAGE_COOLDOWN_MS) return;

    // --- Plafond journalier atteint : plus de points aujourd'hui ---
    if (data.dailyCount >= MAX_DAILY_REWARDED_MESSAGES) return;

    // --- Calcul des points (base + bonus de streak plafonné) ---
    const streakBonus = Math.min(data.streak, MAX_STREAK_BONUS);
    const pointsEarned = BASE_MESSAGE_POINTS + streakBonus;

    updateUserData(userId, pointsEarned, 0);
    data.lastRewardTime = now;
    data.dailyCount++;

    // --- Si le max journalier vient d'être atteint : le jour est "complété" ---
    if (data.dailyCount === MAX_DAILY_REWARDED_MESSAGES) {
        data.lastCompletedDate = today;
        data.streak++;

        const nextBonus = Math.min(data.streak, MAX_STREAK_BONUS);
        message.channel.send({
            content: `🔥 <@${userId}> vient de compléter son heure d'activité du jour !\n` +
                      `**Streak actuel :** \`${data.streak} jour(s)\`\n` +
                      `Demain, chaque message récompensé rapportera **${BASE_MESSAGE_POINTS + nextBonus} Kyo Points** au lieu de ${BASE_MESSAGE_POINTS}.`
        }).catch(() => null);
    }

    userActivityData.set(userId, data);
});

// --- CONFIGURATION DES COMMANDES SLASH ---
const commands = [
    {
        name: 'chiffre-devine',
        description: '✦ [BOUTON] Lancer une session Chiffre Devine (En aveugle)',
        options: [{ name: 'chiffre', type: 4, description: 'Le chiffre secret à deviner (1-50)', required: true }]
    },
    {
        name: 'coffre-magique',
        description: '✦ [EN DIRECT] Lancer un coffre interactif dans le chat (1m 20s)'
    },
    {
        name: 'miniguerre-click',
        description: '✦ Lancer une arène interactive de clics par équipe'
    },
    {
        name: 'kyo-hub',
        description: '✦ Faire apparaître le panel principal KYO HUB'
    },
    {
        name: 'guide-kyo',
        description: '✦ Déployer le guide officiel du serveur avec menu interactif'
    },
    {
        name: 'kyo-give',
        description: '✦ Ajouter des Kyo Coins à un utilisateur (Admin)',
        options: [
            { name: 'cible', type: 6, description: 'L\'utilisateur à créditer', required: true }, 
            { name: 'montant', type: 4, description: 'Nombre de pièces', required: true } 
        ]
    },
    {
        name: 'kyo-giveaway',
        description: '✦ Lancer un giveaway payant (Entrée en Kyo Coins)',
        options: [
            { name: 'recompense', type: 3, description: 'Le lot à gagner', required: true },
            { name: 'prix_entree', type: 4, description: 'Coût en Kyo Coins pour participer', required: true },
            { name: 'minutes', type: 4, description: 'Durée du giveaway en minutes', required: true }
        ]
    },
    {
        name: 'mute',
        description: '✦ Isoler un membre du réseau pendant 1 heure (Timeout)',
        options: [
            { name: 'cible', type: 6, description: 'Le sujet à déconnecter temporairement', required: true },
            { name: 'motif', type: 3, description: 'Raison de l\'isolement', required: false }
        ]
    }
];

// --- AUTO-DEPLOYMENT DES COMMANDES ---
client.once('clientReady', async () => {
    console.log(`📡 [KYO BOT] Connecté sur ${client.user.tag} (Mode Hybrid Connecté)`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('🔄 Actualisation des commandes applicatives (Slash)...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID || client.user.id),
            { body: commands }
        );
        console.log(`✅ Les ${commands.length} commandes Slash ont été injectées avec succès !`);
    } catch (error) {
        console.error('❌ Erreur lors du déploiement des commandes:', error);
    }
});

// --- ROUTEUR PRINCIPAL DES INTERACTIONS ---
client.on('interactionCreate', async interaction => {
    
    // FILTRE DE SÉCURITÉ STRICT
    if (interaction.isChatInputCommand()) {
        if (!interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return interaction.reply({ 
                content: `✕ **Accès refusé.** Cette commande nécessite le privilège de commandement de la faction KYO.`, 
                ephemeral: true 
            });
        }
    }

    // ==========================================
    // 1. COMMANDE : /CHIFFRE-DEVINE (MODIFIÉE)
    // ==========================================
    if (interaction.commandName === 'chiffre-devine') {
        const secretValue = interaction.options.getInteger('chiffre');
        if (secretValue < 1 || secretValue > 50) return interaction.reply({ content: '✕ Le chiffre doit impérativement être compris entre 1 et 50.', ephemeral: true });

        const gameEmbed = new EmbedBuilder()
            .setAuthor({ name: 'KYO PROTOCOLE • CHIFFRE DEVINE' })
            .setDescription(`───\nUn nombre secret a été généré.\n**Règle :** Proposez un chiffre entre **1 et 50** en cliquant sur le bouton.\n**Fin du protocole :** <t:${Math.floor((Date.now() + 30000) / 1000)}:R>\n───`)
            .setColor('#1e1f22');

        const triggerRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('guess_action').setLabel('Tentez ma chance').setStyle(ButtonStyle.Secondary)
        );

        const promptMessage = await interaction.reply({ embeds: [gameEmbed], components: [triggerRow], fetchReply: true });
        
        const submissions = new Map();
        const componentCollector = promptMessage.createMessageComponentCollector({ time: 30000 });

        componentCollector.on('collect', async btnInteraction => {
            if (btnInteraction.customId === 'guess_action') {
                const modal = new ModalBuilder().setCustomId(`modal_${btnInteraction.id}`).setTitle('Estimation Secrète');
                const field = new TextInputBuilder().setCustomId('user_number').setLabel('Entrez votre valeur (1-50)').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(field));
                await btnInteraction.showModal(modal);

                const modalSubmit = await btnInteraction.awaitModalSubmit({ time: 15000 }).catch(() => null);
                if (modalSubmit) {
                    const chosenNum = parseInt(modalSubmit.fields.getTextInputValue('user_number'));
                    if (isNaN(chosenNum) || chosenNum < 1 || chosenNum > 50) {
                        await modalSubmit.reply({ content: '✕ Donnée invalide.', ephemeral: true });
                    } else {
                        submissions.set(modalSubmit.user.id, chosenNum);
                        await modalSubmit.reply({ content: `✓ Enregistré : Option **${chosenNum}** prise en compte.`, ephemeral: true });
                    }
                }
            }
        });

        // NOUVEAU : Affichage de toutes les réponses et des gagnants en bas
        componentCollector.on('end', async () => {
            let winnersList = [];
            let allResponses = [];

            submissions.forEach((guess, user) => {
                allResponses.push(`> <@${user}> a proposé : **${guess}**`);
                if (guess === secretValue) { 
                    winnersList.push(`<@${user}>`); 
                    updateUserData(user, 100, 0); 
                }
            });

            const responsesText = allResponses.length > 0 ? allResponses.join('\n') : '> Aucune participation.';
            const winnersText = winnersList.length > 0 ? `✦ **Vainqueur(s) :**\n└ ${winnersList.join(', ')} (+100 Coins)` : '└ Aucun vainqueur.';

            const closingEmbed = new EmbedBuilder()
                .setTitle('◎ RÉSULTATS DU PROTOCOLE')
                .setDescription(`Le numéro requis était : **${secretValue}**\n\n**Toutes les réponses :**\n${responsesText}\n\n${winnersText}`)
                .setColor('#2b2d31');
            
            await interaction.editReply({ embeds: [closingEmbed], components: [] });
        });
    }

    // ==========================================
    // 2. NOUVELLE COMMANDE : /COFFRE-MAGIQUE
    // ==========================================
    if (interaction.commandName === 'coffre-magique') {
        const secretValue = Math.floor(Math.random() * 50) + 1; // Bot génère entre 1 et 50
        const durationMs = 80 * 1000; // 1 min 20 s

        const chestEmbed = new EmbedBuilder()
            .setAuthor({ name: '🔐 KYO PROTOCOLE • COFFRE MAGIQUE' })
            .setDescription(
                `───\nUn coffre mystique vient d'apparaître !\n` +
                `**Objectif :** Trouvez le code secret entre **1 et 50**.\n` +
                `**Règle :** Écrivez directement votre chiffre dans ce salon.\n` +
                `**Récompense :** \`100 Kyo Coins\` pour le premier qui trouve.\n` +
                `**Fin de l'événement :** <t:${Math.floor((Date.now() + durationMs) / 1000)}:R>\n───`
            )
            .setColor('#FFD700');

        await interaction.reply({ embeds: [chestEmbed] });

        // On écoute le salon textuel en direct
        const filter = m => !m.author.bot && !isNaN(parseInt(m.content));
        const collector = interaction.channel.createMessageCollector({ filter, time: durationMs });

        collector.on('collect', async m => {
            const guess = parseInt(m.content);
            if (guess < 1 || guess > 50) return; 

            if (guess === secretValue) {
                // Gagné !
                collector.stop('win');
                updateUserData(m.author.id, 100, 0);

                const winEmbed = new EmbedBuilder()
                    .setTitle('🎉 COFFRE DÉVERROUILLÉ !')
                    .setDescription(`Bravo <@${m.author.id}> ! Tu as trouvé le code exact : **${secretValue}**\nTu remportes le trésor de \`100 Kyo Coins\` !`)
                    .setColor('#5865F2');
                
                return m.reply({ embeds: [winEmbed] });
            } else if (guess < secretValue) {
                // Trop bas
                m.reply('🔼 Plus haut !').then(msg => setTimeout(() => msg.delete().catch(()=>null), 3000));
            } else {
                // Trop haut
                m.reply('🔽 Plus bas !').then(msg => setTimeout(() => msg.delete().catch(()=>null), 3000));
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason !== 'win') {
                const failEmbed = new EmbedBuilder()
                    .setTitle('🔒 COFFRE PERDU')
                    .setDescription(`Temps écoulé ! Personne n'a réussi à pirater le coffre.\nLe code secret était : **${secretValue}**.`)
                    .setColor('#1e1f22');
                interaction.channel.send({ embeds: [failEmbed] });
            }
        });
    }

    // ==========================================
    // 3. COMMANDE : /MINIGUERRE-CLICK
    // ==========================================
    if (interaction.commandName === 'miniguerre-click') {
        const pool = new Map();
        const scores = { blue: 0, white: 0 };
        const setupEmbed = new EmbedBuilder().setTitle('⚔️ ALLIANCE ENRÔLEMENT').setDescription("Déploiement dans **20 secondes**.").setColor('#1e1f22');
        const setupRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_b').setLabel('Division Bleue').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('join_w').setLabel('Division Blanche').setStyle(ButtonStyle.Secondary)
        );
        const warMessage = await interaction.reply({ embeds: [setupEmbed], components: [setupRow], fetchReply: true });
        const setupCollector = warMessage.createMessageComponentCollector({ time: 20000 });
        setupCollector.on('collect', i => { pool.set(i.user.id, i.customId === 'join_b' ? 'blue' : 'white'); i.reply({ content: `✓ Intégration confirmée.`, ephemeral: true }); });
        setupCollector.on('end', async () => {
            const combatEmbed = new EmbedBuilder().setTitle('⚔️ PROTOCOLE DE FRAPPE ACTIVÉ').setDescription("**Temps restant :** 25 secondes.").setColor('#5865F2');
            const combatRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hit_b').setLabel('Impact Bleu').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('hit_w').setLabel('Impact Blanc').setStyle(ButtonStyle.Secondary)
            );
            await interaction.editReply({ embeds: [combatEmbed], components: [combatRow] });
            const combatCollector = warMessage.createMessageComponentCollector({ time: 25000 });
            combatCollector.on('collect', i => {
                const assignedTeam = pool.get(i.user.id);
                if (!assignedTeam) return i.reply({ content: "✕ Non inscrit.", ephemeral: true });
                if (assignedTeam === 'blue' && i.customId === 'hit_b') scores.blue++;
                if (assignedTeam === 'white' && i.customId === 'hit_w') scores.white++;
                i.deferUpdate();
            });
            combatCollector.on('end', async () => {
                let winSummary = "Égalité parfaite.";
                if (scores.blue > scores.white) winSummary = "Victoire de la **Division Bleue** !";
                if (scores.white > scores.blue) winSummary = "Victoire de la **Division Blanche** !";
                const ultimateWinner = scores.blue > scores.white ? 'blue' : (scores.white > scores.blue ? 'white' : null);
                if (ultimateWinner) pool.forEach((team, userId) => { if (team === ultimateWinner) updateUserData(userId, 50, 1); });
                const reportEmbed = new EmbedBuilder().setTitle('🏁 RAPPORT DE GUERRE').setDescription(`├ Bleu : \`${scores.blue}\`\n└ Blanc : \`${scores.white}\`\n\n**Résultat :** ${winSummary}`).setColor('#2b2d31');
                await interaction.editReply({ embeds: [reportEmbed], components: [] });
            });
        });
    }

    // ==========================================
    // 4. COMMANDE : /KYO-HUB
    // ==========================================
    if (interaction.commandName === 'kyo-hub') {
        const hubMain = new EmbedBuilder()
            .setAuthor({ name: 'KYO NETWORK • INTERFACE INTERNE', iconURL: client.user.displayAvatarURL() })
            .setDescription(
                "───\n" +
                "**◎ ACQUISITION DE FLUX**\n" +
                "└ Envoie un message toutes les **10 minutes** pour gagner **10 Kyo Points**.\n" +
                "└ Complète **1 heure** d'activité (6 messages) par jour pour construire ton **streak**.\n" +
                "└ Chaque jour de streak consécutif ajoute **+1 point bonus** par message (max **+25**).\n\n" +
                "**◎ MODULES D'ANALYSE**\n" +
                "└ Accédez à vos statistiques personnelles.\n" +
                "───"
            )
            .setColor('#1e1f22');
        const hubRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trigger_profile').setLabel('Ouvrir mon profil').setStyle(ButtonStyle.Primary));
        await interaction.reply({ embeds: [hubMain], components: [hubRow] });
    }

    if (interaction.isButton() && interaction.customId === 'trigger_profile') {
        const currentStats = getUserData(interaction.user.id);
        const activityStats = getActivityData(interaction.user.id);
        const currentBonus = Math.min(activityStats.streak, MAX_STREAK_BONUS);
        const profilePanel = new EmbedBuilder()
            .setAuthor({ name: `DOSSIER PERSONNEL • ${interaction.user.username.toUpperCase()}` })
            .setDescription(
                `───\n` +
                `💰 **Kyo Coins :** \` ${currentStats.coins} \` \n\n` +
                `📈 **Kyo Level :** \` Nv. ${currentStats.level} \` \n\n` +
                `🔥 **Streak Actuel :** \` ${activityStats.streak} jour(s) \`\n` +
                `✦ **Bonus par message :** \` +${currentBonus} points (Total : ${BASE_MESSAGE_POINTS + currentBonus}/msg) \`\n` +
                `───`
            )
            .setColor('#5865F2');
        await interaction.reply({ embeds: [profilePanel], ephemeral: true });
    }

    // ==========================================
    // 5. COMMANDE : /GUIDE-KYO
    // ==========================================
    if (interaction.commandName === 'guide-kyo') {
        const masterGuide = new EmbedBuilder().setTitle('◎ GUIDE CENTRAL KYO').setDescription("Utilisez le menu déroulant ci-dessous.").setColor('#1e1f22');
        const menuSelector = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('guide_router').setPlaceholder('Choisir une section').addOptions([
                { label: 'Gagner des Kyo Coins', value: 'g_coins' }, { label: 'Exploiter le Kyo Hub', value: 'g_hub' }, { label: 'Règlement', value: 'g_rules' }
            ])
        );
        await interaction.reply({ embeds: [masterGuide], components: [menuSelector] });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'guide_router') {
        let outputMessage;

        if (interaction.values[0] === 'g_coins') {
            outputMessage =
                `# ✦ GAGNER DES KYO COINS\n\n` +
                `**📩 Système de messages (Cooldown)**\n` +
                `Envoie un message dans **n'importe quel salon** pour gagner des points. ` +
                `Un seul message récompensé toutes les **10 minutes** — spammer ne sert à rien, ` +
                `le cooldown se réinitialise à chaque message compté.\n\n` +
                `> 💰 **10 Kyo Points** par message récompensé (de base)\n\n` +
                `**⏳ Plafond journalier**\n` +
                `Tu peux gagner des points sur un maximum de **1 heure d'activité par jour**, ` +
                `soit **6 messages récompensés** (6 x 10 minutes).\n\n` +
                `**🔥 Le système de STREAK**\n` +
                `Si tu atteins ton plafond de 6 messages **chaque jour, sans interruption**, ` +
                `ton **streak** augmente de **+1** à chaque nouvelle journée complétée.\n\n` +
                `Ce streak ajoute un **bonus permanent à CHAQUE message** que tu envoies :\n` +
                `> **Points par message = 10 + Streak** (au lieu de 10 fixe)\n\n` +
                `Exemple : après 3 jours de streak, chaque message récompensé donne **13 Kyo Points** ` +
                `au lieu de 10, et ce dès le premier message de ta journée.\n\n` +
                `**🚫 Bonus Maximum**\n` +
                `Le bonus de streak est **plafonné à +25 points**, donc le maximum absolu est ` +
                `**35 Kyo Points par message** (10 de base + 25 de streak).\n\n` +
                `**⚠️ Attention : Streak fragile**\n` +
                `Si tu **rates une seule journée** (tu n'atteins pas les 6 messages ce jour-là), ` +
                `ton streak **retombe immédiatement à 0**. Reste actif chaque jour pour ne pas perdre ta progression !`;
        } else if (interaction.values[0] === 'g_hub') {
            outputMessage = `# ✦ EXPLOITER LE KYO HUB\nLe Kyo Hub te permet de consulter tes statistiques personnelles : tes Kyo Coins, ton niveau, ainsi que ton streak d'activité actuel et le bonus de points qui y est associé.`;
        } else {
            outputMessage = `# ✦ RÈGLEMENT\nRespecte les règles du serveur en tout temps. Tout abus du système de points (spam, multi-comptes, etc.) pourra entraîner une sanction.`;
        }

        await interaction.reply({ content: outputMessage, ephemeral: true });
    }

    // ==========================================
    // 6. COMMANDE : /KYO-GIVE
    // ==========================================
    if (interaction.commandName === 'kyo-give') {
        const targetUser = interaction.options.getUser('cible');
        const amountToGive = interaction.options.getInteger('montant');
        updateUserData(targetUser.id, amountToGive, 0);
        await interaction.reply({ content: `✓ **${amountToGive} Kyo Coins** versés à ${targetUser}.`, ephemeral: true });
    }

    // ==========================================
    // 7. COMMANDE : /KYO-GIVEAWAY
    // ==========================================
    if (interaction.commandName === 'kyo-giveaway') {
        const prize = interaction.options.getString('recompense');
        const entryCost = interaction.options.getInteger('prix_entree');
        const durationMins = interaction.options.getInteger('minutes');
        
        const durationMs = durationMins * 60 * 1000;
        const endTimeStamp = Math.floor((Date.now() + durationMs) / 1000);

        const gwEmbed = new EmbedBuilder()
            .setAuthor({ name: '🎁 KYO PROTOCOLE • TIRAGE AU SORT' })
            .setDescription(`───\n**Lot mis en jeu :** ${prize}\n**Frais d'accès :** \`${entryCost} Kyo Coins\`\n\n**Fin du recrutement :** <t:${endTimeStamp}:R>\n───`)
            .setColor('#5865F2')
            .setFooter({ text: 'Cliquez sur le bouton pour payer et participer' });

        const gwRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_giveaway').setLabel(`S'inscrire (-${entryCost} Coins)`).setStyle(ButtonStyle.Success)
        );

        const gwMessage = await interaction.reply({ embeds: [gwEmbed], components: [gwRow], fetchReply: true });

        const participants = new Set();
        const gwCollector = gwMessage.createMessageComponentCollector({ time: durationMs });

        gwCollector.on('collect', async i => {
            if (i.customId === 'join_giveaway') {
                if (participants.has(i.user.id)) return i.reply({ content: '✕ Vous êtes déjà enregistré dans la base de données de ce tirage.', ephemeral: true });
                const userStats = getUserData(i.user.id);
                if (userStats.coins < entryCost) return i.reply({ content: `✕ **Fonds insuffisants.** Il vous faut ${entryCost} Kyo Coins pour entrer.`, ephemeral: true });
                updateUserData(i.user.id, -entryCost, 0);
                participants.add(i.user.id);
                await i.reply({ content: `✓ **Inscription validée.** \`${entryCost} Kyo Coins\` ont été débités de votre compte.`, ephemeral: true });
            }
        });

        gwCollector.on('end', async () => {
            const partArray = Array.from(participants);
            if (partArray.length === 0) {
                const failEmbed = new EmbedBuilder().setTitle('🎁 TIRAGE AVORTÉ').setDescription(`───\nAucun membre n'a pu s'acquitter des frais d'entrée pour : **${prize}**.\n───`).setColor('#1e1f22');
                return interaction.editReply({ embeds: [failEmbed], components: [] });
            }
            const winnerId = partArray[Math.floor(Math.random() * partArray.length)];
            const winEmbed = new EmbedBuilder().setAuthor({ name: '🎁 KYO PROTOCOLE • RÉSULTATS' }).setDescription(`───\n**Lot remporté :** ${prize}\n**Vainqueur officiel :** <@${winnerId}>\n**Total des participants :** ${partArray.length}\n───`).setColor('#1e1f22');
            await interaction.editReply({ embeds: [winEmbed], components: [] });
            await interaction.followUp({ content: `🎉 Transmission terminée. <@${winnerId}> remporte l'accès à : **${prize}** !` });
        });
    }

    // ==========================================
    // 8. COMMANDE : /MUTE (ISOLEMENT BRUTAL)
    // ==========================================
    if (interaction.commandName === 'mute') {
        const targetMember = interaction.options.getMember('cible');
        const reason = interaction.options.getString('motif') || 'Violation des protocoles KYO';

        if (!targetMember) {
            return interaction.reply({ content: '✕ Utilisateur introuvable sur le réseau local.', ephemeral: true });
        }

        const durationMs = 60 * 60 * 1000; // 1 Heure

        try {
            await targetMember.timeout(durationMs, reason);

            const muteEmbed = new EmbedBuilder()
                .setAuthor({ name: '◎ PROTOCOLE D\'ISOLEMENT ACTIVÉ' })
                .setDescription(
                    `───\n` +
                    `**Cible :** <@${targetMember.id}>\n` +
                    `**Durée :** 1 Heure\n` +
                    `**Motif :** \`${reason}\`\n` +
                    `───\n` +
                    `*Le sujet a été déconnecté des canaux de communication.*`
                )
                .setColor('#1e1f22');

            await interaction.reply({ embeds: [muteEmbed] });
            
        } catch (error) {
            await interaction.reply({ content: '✕ Échec de la frappe. (Bloqué par Discord, cible intouchable). N\'oublie pas de monter le rôle de ton bot tout en haut de la liste !', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);

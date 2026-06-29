const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, StringSelectMenuBuilder, REST, Routes 
} = require('discord.js');
const http = require('http'); // Ajout du module HTTP natif de Node.js
require('dotenv').config();

// --- CRÉATION DU FAUX SERVEUR WEB POUR RENDER ---
// Cela empêche l'erreur "Port scan timeout reached"
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

// ID du rôle requis pour exécuter les commandes d'administration/lancement
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

// --- CONFIGURATION DES 5 COMMANDES SLASH ---
const commands = [
    {
        name: 'chiffre-devine',
        description: '✦ Lancer une session de jeu Chiffre Devine',
        options: [{
            name: 'chiffre',
            type: 4, 
            description: 'Le chiffre secret à deviner (1-50)',
            required: true
        }]
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
    }
];

// --- AUTO-DEPLOYMENT DES COMMANDES ---
// Correction du "ready" en "clientReady" pour éviter l'avertissement DeprecationWarning de Discord.js v14/v15
client.once('clientReady', async () => {
    console.log(`📡 [KYO BOT] Connecté sur ${client.user.tag} (Mode Hybrid Connecté)`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('🔄 Actualisation des commandes applicatives (Slash)...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID || client.user.id),
            { body: commands }
        );
        console.log('✅ Toutes les commandes Slash ont été injectées avec succès.');
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

    // 1. COMMANDE : /CHIFFRE-DEVINE
    if (interaction.commandName === 'chiffre-devine') {
        const secretValue = interaction.options.getInteger('chiffre');
        if (secretValue < 1 || secretValue > 50) {
            return interaction.reply({ content: '✕ Le chiffre doit impérativement être compris entre 1 et 50.', ephemeral: true });
        }

        const gameEmbed = new EmbedBuilder()
            .setAuthor({ name: 'KYO PROTOCOLE • CHIFFRE DEVINE' })
            .setDescription(
                "───\n" +
                "Un nombre secret a été généré par l'administration.\n" +
                "Aurez-vous l'instinct nécessaire pour le découvrir ?\n\n" +
                "**Règle :** Cliquez sur le bouton ci-dessous et proposez un chiffre entre **1 et 50**.\n" +
                "**Fin du protocole :** <t:" + Math.floor((Date.now() + 30000) / 1000) + ":R>\n" +
                "───"
            )
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
                const field = new TextInputBuilder()
                    .setCustomId('user_number')
                    .setLabel('Entrez votre valeur (1-50)')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(2)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(field));
                await btnInteraction.showModal(modal);

                const modalSubmit = await btnInteraction.awaitModalSubmit({ time: 15000 }).catch(() => null);
                if (modalSubmit) {
                    const chosenNum = parseInt(modalSubmit.fields.getTextInputValue('user_number'));
                    if (isNaN(chosenNum) || chosenNum < 1 || chosenNum > 50) {
                        await modalSubmit.reply({ content: '✕ Donnée invalide. Répétez l\'action avec un chiffre correct.', ephemeral: true });
                    } else {
                        submissions.set(modalSubmit.user.id, chosenNum);
                        await modalSubmit.reply({ content: `✓ Enregistré : Option **${chosenNum}** prise en compte.`, ephemeral: true });
                    }
                }
            }
        });

        componentCollector.on('end', async () => {
            let winnersList = [];
            submissions.forEach((guess, user) => {
                if (guess === secretValue) {
                    winnersList.push(`<@${user}>`);
                    updateUserData(user, 100, 0); 
                }
            });

            const closingEmbed = new EmbedBuilder()
                .setTitle('◎ RÉSULTATS DU PROTOCOLE')
                .setDescription(
                    `Le numéro requis pour la victoire était : **${secretValue}**\n\n` +
                    `${winnersList.length > 0 ? `✦ **Gagnants de la session :**\n└ ${winnersList.join(', ')} (+100 Kyo Coins)` : '└ Aucun sujet n\'a trouvé la configuration exacte.'}`
                )
                .setColor('#2b2d31');

            await interaction.editReply({ embeds: [closingEmbed], components: [] });
        });
    }

    // 2. COMMANDE : /MINIGUERRE-CLICK
    if (interaction.commandName === 'miniguerre-click') {
        const pool = new Map();
        const scores = { blue: 0, white: 0 };

        const setupEmbed = new EmbedBuilder()
            .setTitle('⚔️ ALLIANCE ENRÔLEMENT • MINI GUERRE')
            .setDescription("Sélectionnez votre faction immédiatement.\nDéploiement des modules de combat dans **20 secondes**.")
            .setColor('#1e1f22');

        const setupRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_b').setLabel('Division Bleue').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('join_w').setLabel('Division Blanche').setStyle(ButtonStyle.Secondary)
        );

        const warMessage = await interaction.reply({ embeds: [setupEmbed], components: [setupRow], fetchReply: true });

        const setupCollector = warMessage.createMessageComponentCollector({ time: 20000 });
        setupCollector.on('collect', i => {
            pool.set(i.user.id, i.customId === 'join_b' ? 'blue' : 'white');
            i.reply({ content: `✓ Intégration confirmée dans l'équipe ${i.customId === 'join_b' ? 'Bleue' : 'Blanche'}.`, ephemeral: true });
        });

        setupCollector.on('end', async () => {
            const combatEmbed = new EmbedBuilder()
                .setTitle('⚔️ PROTOCOLE DE FRAPPE ACTIVÉ')
                .setDescription("Cliquez de manière intensive sur votre module assigné.\n**Temps restant :** 25 secondes.")
                .setColor('#5865F2');

            const combatRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hit_b').setLabel('Impact Bleu').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('hit_w').setLabel('Impact Blanc').setStyle(ButtonStyle.Secondary)
            );

            await interaction.editReply({ embeds: [combatEmbed], components: [combatRow] });

            const combatCollector = warMessage.createMessageComponentCollector({ time: 25000 });
            combatCollector.on('collect', i => {
                const assignedTeam = pool.get(i.user.id);
                if (!assignedTeam) return i.reply({ content: "✕ Vous n'avez pas rejoint de faction pendant la phase d'enrôlement.", ephemeral: true });

                if (assignedTeam === 'blue' && i.customId === 'hit_b') scores.blue++;
                if (assignedTeam === 'white' && i.customId === 'hit_w') scores.white++;
                i.deferUpdate();
            });

            combatCollector.on('end', async () => {
                let winSummary = "Égalité parfaite sur le champ de tir.";
                if (scores.blue > scores.white) winSummary = "Victoire stratégique de la **Division Bleue** !";
                if (scores.white > scores.blue) winSummary = "Victoire stratégique de la **Division Blanche** !";

                const ultimateWinner = scores.blue > scores.white ? 'blue' : (scores.white > scores.blue ? 'white' : null);
                if (ultimateWinner) {
                    pool.forEach((team, userId) => {
                        if (team === ultimateWinner) updateUserData(userId, 50, 1);
                    });
                }

                const reportEmbed = new EmbedBuilder()
                    .setTitle('🏁 RAPPORT DE FIN DE GUERRE')
                    .setDescription(
                        `**Statistiques globales :**\n` +
                        `├ Clics Division Bleue : \`${scores.blue}\`\n` +
                        `└ Clics Division Blanche : \`${scores.white}\`\n\n` +
                        `**Résultat :** ${winSummary}\n*Les vainqueurs reçoivent +50 Kyo Coins et +1 Level.*`
                    )
                    .setColor('#2b2d31');

                await interaction.editReply({ embeds: [reportEmbed], components: [] });
            });
        });
    }

    // 3. COMMANDE : /PUT THE KYO HUB
    if (interaction.commandName === 'kyo-hub') {
        const hubMain = new EmbedBuilder()
            .setAuthor({ name: 'KYO NETWORK • INTERFACE INTERNE', iconURL: client.user.displayAvatarURL() })
            .setDescription(
                "───\n" +
                "**◎ ACQUISITION DE FLUX**\n" +
                "└ Générez de l'activité textuelle pour collecter des **Kyo Points**.\n\n" +
                "**◎ MODULES D'ANALYSE**\n" +
                "└ Obtenez une vision directe de votre rang et de vos finances.\n" +
                "└ Échangez vos gains lors des déploiements d'événements.\n" +
                "───\n" +
                "*Utilisez le terminal sécurisé ci-dessous pour ouvrir vos paramètres système.*"
            )
            .setColor('#1e1f22');

        const hubRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('trigger_profile').setLabel('Ouvrir mon profil').setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [hubMain], components: [hubRow] });
    }

    // Intercepteur pour le bouton du KYO HUB
    if (interaction.isButton() && interaction.customId === 'trigger_profile') {
        const currentStats = getUserData(interaction.user.id);
        
        const profilePanel = new EmbedBuilder()
            .setAuthor({ name: `DOSSIER PERSONNEL • ${interaction.user.username.toUpperCase()}` })
            .setDescription(
                `───\n` +
                `💰 **Kyo Coins :** \` ${currentStats.coins} \` \n\n` +
                `📈 **Kyo Level :** \` Nv. ${currentStats.level} \` \n` +
                `───`
            )
            .setColor('#5865F2')
            .setFooter({ text: 'Données chiffrées en temps réel' });

        await interaction.reply({ embeds: [profilePanel], ephemeral: true });
    }

    // 4. COMMANDE : /GUIDE-KYO
    if (interaction.commandName === 'guide-kyo') {
        const masterGuide = new EmbedBuilder()
            .setTitle('◎ GUIDE CENTRAL KYO')
            .setDescription(
                "Bienvenue sur l'infrastructure d'assistance.\n\n" +
                "Pour préserver le confort visuel global, veuillez utiliser le menu déroulant ci-dessous afin de cibler les données requises."
            )
            .setColor('#1e1f22');

        const menuSelector = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('guide_router')
                .setPlaceholder('Choisir une section du guide')
                .addOptions([
                    { label: 'Gagner des Kyo Coins', value: 'g_coins', description: 'Comprendre l\'algorithme d\'activité' },
                    { label: 'Exploiter le Kyo Hub', value: 'g_hub', description: 'Analyser la progression et le profil' },
                    { label: 'Règlement Intra-Serveur', value: 'g_rules', description: 'Les lois de la communauté' }
                ])
        );

        await interaction.reply({ embeds: [masterGuide], components: [menuSelector] });
    }

    // Intercepteur pour le Menu Déroulant du Guide
    if (interaction.isStringSelectMenu() && interaction.customId === 'guide_router') {
        let outputMessage = "";
        const targetSelection = interaction.values[0];

        if (targetSelection === 'g_coins') {
            outputMessage = "✦ **Gagner des Kyo Coins :** Vos interactions régulières dans les zones de discussion génèrent passivement des crédits de monnaie.";
        } else if (targetSelection === 'g_hub') {
            outputMessage = "✦ **Exploiter le Kyo Hub :** Via le panel principal, vous pouvez à tout moment charger votre base de données privée pour vérifier votre niveau de puissance.";
        } else if (targetSelection === 'g_rules') {
            outputMessage = "✦ **Règlement :** Tout comportement en désaccord avec la charte KYO provoquera une réinitialisation unilatérale de vos compteurs.";
        }

        await interaction.reply({ content: outputMessage, ephemeral: true });
    }

    // 5. COMMANDE : /KYO-GIVE (ADMIN)
    if (interaction.commandName === 'kyo-give') {
        const targetUser = interaction.options.getUser('cible');
        const amountToGive = interaction.options.getInteger('montant');

        updateUserData(targetUser.id, amountToGive, 0);

        await interaction.reply({ 
            content: `✓ Injection effectuée avec succès. **${amountToGive} Kyo Coins** ont été versés sur le compte de ${targetUser}.`, 
            ephemeral: true 
        });
    }
});

// Connexion globale sécurisée
client.login(process.env.TOKEN);

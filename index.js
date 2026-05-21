const express = require('express');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

// ---------------- SERVER WEB POUR RENDER ----------------
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send("Le bot Kyotaru Family Ultimate est actif et boosté !"));
app.listen(PORT, () => console.log(`Serveur connecté sur le port ${PORT}`));

// ---------------- CONFIGURATION DISCORD ----------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent // Pour le système de CHAT libre
    ]
});

const STAFF_ID = "1499852043408642099"; 
const LOG_CHANNEL_ID = "1506792520133251253"; 

// Base de données locale améliorée (Points, Profils, Inventaires)
const bddPath = path.join(__dirname, 'kyotarudata.json');
let bdd = { points: {}, profil: {}, inventaire: {} };

if (fs.existsSync(bddPath)) {
    try { bdd = JSON.parse(fs.readFileSync(bddPath, 'utf-8')); } catch (e) { console.error(e); }
}
if (!bdd.profil) bdd.profil = {};
if (!bdd.inventaire) bdd.inventaire = {};

function sauvegarderDonnees() { fs.writeFileSync(bddPath, JSON.stringify(bdd, null, 2)); }

// ---------------- ENREGISTREMENT DES SLASH COMMANDS ----------------
const commands = [
    // 📢 SYSTEME D'ANNONCES (BOOST)
    new SlashCommandBuilder().setName('annonce').setDescription('Fait une annonce officielle via le bot (Staff)')
        .addStringOption(opt => opt.setName('message').setDescription('Le contenu de l\'annonce').setRequired(true))
        .addStringOption(opt => opt.setName('style').setDescription('Le format de l\'annonce').setRequired(true)
            .addChoices({name: 'Embed Stylé (Recommandé)', value: 'embed'}, {name: 'Texte Simple (Ping)', value: 'texte'})),

    // 🪙 ÉCONOMIE & PROFIL RPG
    new SlashCommandBuilder().setName('profil').setDescription('Affiche ta carte d\'identité RPG Kyotaru').addUserOption(opt => opt.setName('membre').setDescription('Le membre')),
    new SlashCommandBuilder().setName('points').setDescription('Affiche tes KyotaruPoints').addUserOption(opt => opt.setName('membre').setDescription('Le membre')),
    new SlashCommandBuilder().setName('setpoints').setDescription('Définir les points (Staff)').addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true)).addIntegerOption(opt => opt.setName('montant').setDescription('Le montant').setRequired(true)),
    new SlashCommandBuilder().setName('daily').setDescription('Récupère ta récompense quotidienne de points (Toutes les 24h)'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Affiche le Top 10 des membres les plus riches de la famille'),
    new SlashCommandBuilder().setName('settitle').setDescription('Change le titre personnalisé sur ton /profil').addStringOption(opt => opt.setName('titre').setDescription('Ton nouveau titre').setRequired(true)),
    
    // 🎉 GIVEAWAYS & MINI-GIVEAWAYS
    new SlashCommandBuilder().setName('giveaway').setDescription('Lancer un grand giveaway (Staff)').addIntegerOption(opt => opt.setName('temps').setDescription('Temps en minutes').setRequired(true)).addStringOption(opt => opt.setName('lot').setDescription('Le lot à gagner').setRequired(true)),
    new SlashCommandBuilder().setName('minigiveaway').setDescription('Lancer un mini giveaway rapide (Staff)').addIntegerOption(opt => opt.setName('temps').setDescription('Temps en minutes').setRequired(true)).addStringOption(opt => opt.setName('lot').setDescription('Le lot').setRequired(true)),
    
    // 🛡️ MODÉRATION ULTRA-COMPLETE
    new SlashCommandBuilder().setName('kick').setDescription('Exclure un membre').addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true)).addStringOption(opt => opt.setName('raison').setDescription('Raison')),
    new SlashCommandBuilder().setName('ban').setDescription('Bannir un membre').addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true)).addStringOption(opt => opt.setName('raison').setDescription('Raison')),
    new SlashCommandBuilder().setName('mute').setDescription('Rendre muet temporairement (Staff)').addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true)).addIntegerOption(opt => opt.setName('minutes').setDescription('Durée en minutes').setRequired(true)),
    new SlashCommandBuilder().setName('unmute').setDescription('Retirer le mute d\'un membre (Staff)').addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true)),
    new SlashCommandBuilder().setName('clear').setDescription('Supprimer des messages en masse (Staff)').addIntegerOption(opt => opt.setName('nombre').setDescription('Nombre de messages (1-100)').setRequired(true)),
    new SlashCommandBuilder().setName('warn').setDescription('Donner un avertissement officiel (Staff)').addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true)).addStringOption(opt => opt.setName('raison').setDescription('Raison')),

    // 🕹️ MEGA PACK FUN & JEUX COMPLETS
    new SlashCommandBuilder().setName('slots').setDescription('Machine à sous : double tes points !').addIntegerOption(opt => opt.setName('mise').setDescription('Montant à miser').setRequired(true)),
    new SlashCommandBuilder().setName('coinflip').setDescription('Pile ou Face avec mise de points').addStringOption(opt => opt.setName('choix').setDescription('pile ou face').setRequired(true).addChoices({name:'Pile', value:'pile'}, {name:'Face', value:'face'})).addIntegerOption(opt => opt.setName('mise').setDescription('Mise').setRequired(true)),
    new SlashCommandBuilder().setName('crime').setDescription('Tente un crime mafieux pour voler des points (Risqué !).'),
    new SlashCommandBuilder().setName('rob').setDescription('Tente de voler les points d\'un autre membre !').addUserOption(opt => opt.setName('cible').setDescription('Le membre à dépouiller').setRequired(true)),
    new SlashCommandBuilder().setName('hack').setDescription('Cyber-Attaque sur un membre').addUserOption(opt => opt.setName('membre').setDescription('La victime').setRequired(true)),
    new SlashCommandBuilder().setName('fruit').setDescription('Ouvre une boîte de fruits de l\'intendant Kyotaru'),
    new SlashCommandBuilder().setName('respect').setDescription('Calcule le taux de respect').addUserOption(opt => opt.setName('membre').setDescription('Le membre')),
    new SlashCommandBuilder().setName('bounty').setDescription('Découvre ta prime de recherche de pirate'),
    new SlashCommandBuilder().setName('duel').setDescription('Défie un membre en duel à mort').addUserOption(opt => opt.setName('adversaire').setDescription('Ton adversaire').setRequired(true)),
    new SlashCommandBuilder().setName('boss').setDescription('Lâche une punchline de Parrain'),
    new SlashCommandBuilder().setName('slap').setDescription('Donne une balayette réglementaire').addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true)),
    new SlashCommandBuilder().setName('alliance').setDescription('Affinité fraternelle entre deux membres').addUserOption(opt => opt.setName('membre').setDescription('L\'allié').setRequired(true)),
    new SlashCommandBuilder().setName('secret').setDescription('Fuite de l\'historique secret d\'un membre').addUserOption(opt => opt.setName('membre').setDescription('Le membre')),
    new SlashCommandBuilder().setName('avatar').setDescription('Affiche l\'avatar en grand').addUserOption(opt => opt.setName('membre').setDescription('Le membre'))
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`[Kyotaru Family] En ligne : ${client.user.tag}`);
    client.user.setActivity('Protéger la Kyotaru Family ⚔️');
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Toutes les commandes Slash chargées avec succès !');
    } catch (error) { console.error(error); }
});

// ---------------- 💬 SYSTÈME DE CHAT INTEGRÉ (PARLER AU BOT) ----------------
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.mentions.has(client.user) || message.channel.isDMs()) {
        const blaguesEtRepliques = [
            "Je suis le protecteur de la Kyotaru Family. Que veux-tu savoir, recrue ?",
            "Ne parle pas trop fort, les murs ont des oreilles dans ce salon... 🕶️",
            "Actuellement en train de compter les KyotaruPoints. Tu as besoin d'une avance ?",
            "Je t'observe... Utilise les commandes `/` pour voir de quoi je suis capable !",
            "Ma puissance vient directement du Parrain de la Kyotaru Family. Respecte le crew !",
            "Tu veux un fruit ? Utilise `/fruit`. Pour discuter, sache que je ne dors jamais.",
            "Si tu cherches les noises, sache que ma commande `/ban` fonctionne au quart de tour."
        ];
        const reponseAleatoire = blaguesEtRepliques[Math.floor(Math.random() * blaguesEtRepliques.length)];
        return message.reply(`💬 **[KYO-BOT AI]** : ${reponseAleatoire}`);
    }
});

// ---------------- GESTION DES COMMANDES ----------------
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, guild, member } = interaction;
    const logChannel = guild ? guild.channels.cache.get(LOG_CHANNEL_ID) : null;

    // Initialisation forcée des profils pour éviter les bugs de lecture
    if (!bdd.points[user.id]) bdd.points[user.id] = 0;
    if (!bdd.profil[user.id]) bdd.profil[user.id] = { titre: "Nouvelle Recrue 🪙", dailyCooldown: 0, warns: 0 };
    if (!bdd.inventaire[user.id]) bdd.inventaire[user.id] = [];

    // 📢 SYSTEME D'ANNONCE (BOOST)
    if (commandName === 'annonce') {
        if (user.id !== STAFF_ID && (!member || !member.roles.cache.has(STAFF_ID))) {
            return interaction.reply({ content: "❌ Seuls les hauts gradés peuvent utiliser le haut-parleur de la famille.", ephemeral: true });
        }
        
        const messageAnnonce = options.getString('message');
        const style = options.getString('style');

        // On répond de manière éphémère pour ne pas polluer le salon
        await interaction.reply({ content: "📢 Annonce envoyée !", ephemeral: true });

        if (style === 'embed') {
            const embedAnnonce = new EmbedBuilder()
                .setTitle('📢 COMMUNIQUE OFFICIEL - KYOTARU FAMILY')
                .setDescription(messageAnnonce)
                .setColor('#e74c3c')
                .setThumbnail(guild.iconURL())
                .setFooter({ text: `Annonce par ${user.username}`, iconURL: user.displayAvatarURL() })
                .setTimestamp();
            return interaction.channel.send({ embeds: [embedAnnonce] });
        } else {
            return interaction.channel.send(`📢 **Annonce de la direction :**\n\n${messageAnnonce}`);
        }
    }

    // 🪙 COMMANDES D'ÉCONOMIE & PROFIL
    if (commandName === 'profil') {
        const cible = options.getUser('membre') || user;
        const pts = bdd.points[cible.id] || 0;
        const data = bdd.profil[cible.id] || { titre: "Nouvelle Recrue 🪙", warns: 0 };
        const inv = bdd.inventaire[cible.id] || ["Aucun objet"];

        const embedProfil = new EmbedBuilder()
            .setTitle(`📇 Carte d'identité : ${cible.username}`)
            .setColor('#1a1a1a')
            .setThumbnail(cible.displayAvatarURL())
            .addFields(
                { name: '🎖️ Titre Honorifique', value: `${data.titre}`, inline: true },
                { name: '🪙 KyotaruPoints', value: `**${pts} pts**`, inline: true },
                { name: '⚠️ Avertissements', value: `\`${data.warns}/3\``, inline: true },
                { name: '🎒 Sac à dos / Inventaire', value: `\`${inv.join(', ')}\`` }
            ).setTimestamp();
        return interaction.reply({ embeds: [embedProfil] });
    }

    if (commandName === 'points') {
        const cible = options.getUser('membre') || user;
        return interaction.reply(`🪙 **${cible.username}** possède **${bdd.points[cible.id] || 0} KyotaruPoints**.`);
    }

    if (commandName === 'settitle') {
        const nvTitre = options.getString('titre');
        bdd.profil[user.id].titre = nvTitre;
        sauvegarderDonnees();
        return interaction.reply(`✅ Ton titre sur ton profil a été changé en : \`${nvTitre}\` !`);
    }

    if (commandName === 'daily') {
        const mtn = Date.now();
        const cooldown = bdd.profil[user.id].dailyCooldown || 0;
        if (mtn < cooldown) {
            const restant = Math.ceil((cooldown - mtn) / 3600000);
            return interaction.reply({ content: `⏱️ Tu as déjà réclamé tes points ! Reviens dans **${restant} heure(s)**.`, ephemeral: true });
        }
        bdd.points[user.id] += 250;
        bdd.profil[user.id].dailyCooldown = mtn + 86400000; // 24 heures
        sauvegarderDonnees();
        return interaction.reply(`🎁 **Récompense Journalière !** Tu as reçu **250 KyotaruPoints** !`);
    }

    if (commandName === 'leaderboard') {
        const tri = Object.entries(bdd.points).sort((a, b) => b[1] - a[1]).slice(0, 10);
        let str = "";
        tri.forEach(([id, score], index) => {
            str += `${index + 1}. <@${id}> - **${score} pts**\n`;
        });
        const embed = new EmbedBuilder().setTitle("🏆 Classement de la Richesse Kyotaru").setDescription(str || "Aucun joueur enregistré.").setColor('#f1c40f');
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'setpoints') {
        if (user.id !== STAFF_ID && (!member || !member.roles.cache.has(STAFF_ID))) return interaction.reply({ content: "Privilège du staff.", ephemeral: true });
        const cible = options.getUser('membre');
        bdd.points[cible.id] = options.getInteger('montant');
        sauvegarderDonnees();
        return interaction.reply(`✅ Points de ${cible.username} fixés à **${options.getInteger('montant')}**.`);
    }

    // 🛡️ MODÉRATION COMPLÈTE
    if (commandName === 'warn') {
        if (user.id !== STAFF_ID && (!member || !member.roles.cache.has(STAFF_ID))) return interaction.reply("Fermé.");
        const cible = options.getUser('membre');
        if (!bdd.profil[cible.id]) bdd.profil[cible.id] = { titre: "Nouvelle Recrue 🪙", warns: 0 };
        bdd.profil[cible.id].warns += 1;
        sauvegarderDonnees();
        return interaction.reply(`⚠️ **Avertissement officiel** donné à <@${cible.id}> (${bdd.profil[cible.id].warns}/3).`);
    }

    if (commandName === 'mute') {
        if (user.id !== STAFF_ID && (!member || !member.roles.cache.has(STAFF_ID))) return interaction.reply("Fermé.");
        const cible = options.getMember('membre');
        const min = options.getInteger('minutes');
        await cible.timeout(min * 60 * 1000, "Sanction Staff");
        return interaction.reply(`🔇 **${cible.user.username}** a été rendu muet pour **${min} minutes**.`);
    }

    if (commandName === 'unmute') {
        if (user.id !== STAFF_ID && (!member || !member.roles.cache.has(STAFF_ID))) return interaction.reply("Fermé.");
        const cible = options.getMember('membre');
        await cible.timeout(null);
        return interaction.reply(`🔊 Mute retiré pour **${cible.user.username}**.`);
    }

    if (commandName === 'clear') {
        if (user.id !== STAFF_ID && (!member || !member.roles.cache.has(STAFF_ID))) return interaction.reply("Fermé.");
        const nb = options.getInteger('nombre');
        await interaction.channel.bulkDelete(nb, true);
        return interaction.reply({ content: `🗑️ **${nb} messages** nettoyés avec succès !`, ephemeral: true });
    }

    if (commandName === 'kick' || commandName === 'ban') {
        if (user.id !== STAFF_ID && (!member || !member.roles.cache.has(STAFF_ID))) return interaction.reply("Fermé.");
        const cible = options.getMember('membre');
        if (!cible) return interaction.reply("Cible introuvable.");
        const raison = options.getString('raison') || "Décision de la direction.";

        if (commandName === 'kick') {
            await cible.kick(raison);
            return interaction.reply(`🥾 ${cible.user.tag} expulsé.`);
        }
        if (commandName === 'ban') {
            await cible.ban({ reason: raison });
            return interaction.reply(`🚨 ${cible.user.tag} banni.`);
        }
    }

    // 🕹️ MINI & GRAND GIVEAWAYS
    if (commandName === 'giveaway' || commandName === 'minigiveaway') {
        if (user.id !== STAFF_ID && (!member || !member.roles.cache.has(STAFF_ID))) return interaction.reply("Fermé.");
        const lot = options.getString('lot');
        const embed = new EmbedBuilder()
            .setTitle(commandName === 'minigiveaway' ? "🎁 MINI CONCOURS RAPIDE !" : "🎉 ENORME GIVEAWAY !")
            .setDescription(`Réagissez avec 🎉 pour tenter votre chance !\n\n**Lot :** ${lot}\n**Temps :** ${options.getInteger('temps')} min.`)
            .setColor('#e74c3c');
        const m = await interaction.reply({ embeds: [embed], fetchReply: true });
        return await m.react("🎉");
    }

    // 🕹️ JEUX & FUN (PACK AVANCÉ)
    if (commandName === 'slots') {
        const mise = options.getInteger('mise');
        if ((bdd.points[user.id] || 0) < mise || mise <= 0) return interaction.reply("❌ Tu n'as pas assez de KyotaruPoints pour miser ce montant !");
        
        const emo = ["🍎", "💎", "👑", "🍇", "🍋"];
        const r1 = emo[Math.floor(Math.random()*emo.length)];
        const r2 = emo[Math.floor(Math.random()*emo.length)];
        const r3 = emo[Math.floor(Math.random()*emo.length)];

        if (r1 === r2 && r2 === r3) {
            bdd.points[user.id] += mise * 3;
            sauvegarderDonnees();
            return interaction.reply(`🎰 **[ ${r1} | ${r2} | ${r3} ]**\n🎉 **JACKPOT !** Tu gagnes **${mise * 3} pts** !`);
        } else {
            bdd.points[user.id] -= mise;
            sauvegarderDonnees();
            return interaction.reply(`🎰 **[ ${r1} | ${r2} | ${r3} ]**\n❌ **Perdu !** Tu perds ta mise de **${mise} pts**.`);
        }
    }

    if (commandName === 'coinflip') {
        const choix = options.getString('choix');
        const mise = options.getInteger('mise');
        if ((bdd.points[user.id] || 0) < mise || mise <= 0) return interaction.reply("Points insuffisants.");

        const res = Math.random() < 0.5 ? 'pile' : 'face';
        if (choix === res) {
            bdd.points[user.id] += mise;
            sauvegarderDonnees();
            return interaction.reply(`🪙 La pièce tombe sur **${res}** ! Gagné ! Tu remportes **${mise} pts**.`);
        } else {
            bdd.points[user.id] -= mise;
            sauvegarderDonnees();
            return interaction.reply(`🪙 La pièce tombe sur **${res}**... Perdu ! Tu laisses **${mise} pts** au tapis.`);
        }
    }

    if (commandName === 'crime') {
        const chance = Math.random() < 0.45; // 45% de réussite
        if (chance) {
            const gain = Math.floor(Math.random() * 150) + 50;
            bdd.points[user.id] += gain;
            sauvegarderDonnees();
            return interaction.reply(`🕵️‍♂️ **Braquage Réussi !** Tu infiltres un serveur rival et voles **${gain} KyotaruPoints** !`);
        } else {
            const perte = 100;
            bdd.points[user.id] = Math.max(0, (bdd.points[user.id] || 0) - perte);
            sauvegarderDonnees();
            return interaction.reply(`🚨 **Alerte !** La police de Discord t'attrape en plein flagrant délit. Tu paies une amende de **100 pts**.`);
        }
    }

    if (commandName === 'rob') {
        const cible = options.getUser('cible');
        if (cible.id === user.id) return interaction.reply("Tu ne peux pas te voler toi-même !");
        if ((bdd.points[cible.id] || 0) < 50) return interaction.reply("Ta cible est trop pauvre, laisse-la tranquille.");

        const reussite = Math.random() < 0.35; // 35% de chance
        if (reussite) {
            const vol = Math.floor(Math.random() * 50) + 20;
            bdd.points[cible.id] -= vol;
            bdd.points[user.id] += vol;
            sauvegarderDonnees();
            return interaction.reply(`🥷 C'est un coup parfait ! Tu détrousses secrètement **${cible.username}** et lui piques **${vol} pts** !`);
        } else {
            return interaction.reply(`🛡️ **Répulsif activé !** ${cible.username} te repère de loin et te met une droite. Vol raté !`);
        }
    }

    if (commandName === 'fruit') {
        const fruits = ['🍌 Kilo', '🍏 Spin', '🔥 Flame', '❄️ Ice', '💡 Light', '🌋 Magma', '✨ Buddha', '🍩 Dough', '🐆 Leopard', '🐉 Dragon'];
        const f = fruits[Math.floor(Math.random() * fruits.length)];
        if (!bdd.inventaire[user.id].includes(f)) {
            bdd.inventaire[user.id].push(f);
            sauvegarderDonnees();
        }
        return interaction.reply(`🎁 **Fruit du Démon !** L'intendant t'a remis le fruit : **${f}** ! Il a été ajouté à ton \`/profil\`.`);
    }

    if (commandName === 'hack') {
        const cible = options.getUser('membre');
        await interaction.reply(`🛰️ Infiltration de **${cible.username}** via \`Kyotaru_Core\`...`);
        setTimeout(() => interaction.editReply(`🌐 IP compromise : \`10.24.${Math.floor(Math.random()*254)}.${Math.floor(Math.random()*254)}\``), 1500);
        setTimeout(() => interaction.editReply(`🏴 Piratage validé ! Historique Roblox vidé et jetons interceptés avec succès. 🔥`), 4000);
    }

    if (commandName === 'respect') {
        const cible = options.getUser('membre') || user;
        return interaction.reply(`📊 Taux de respect de **${cible.username}** : **${Math.floor(Math.random() * 101)}%** dans l'organisation.`);
    }

    if (commandName === 'bounty') {
        return interaction.reply(`🏴 Ta prime de recherche actuelle s'élève à **${(Math.random() * 50).toFixed(1)} Millions** de Berrys.`);
    }

    if (commandName === 'duel') {
        const adv = options.getUser('adversaire');
        const vainqueur = Math.random() < 0.5 ? user : adv;
        return interaction.reply(`⚔️ **DUEL !** Un combat au sabre s'engage ! Après un affrontement sanglant, **${vanguard.username}** terrasse son adversaire !`);
    }

    if (commandName === 'boss') {
        const punch = ["Le respect ne s'achète pas, il se gagne chez Kyotaru.", "Un pas de travers, et c'est le salon de logs qui s'allume.", "On dirige l'ombre pour posséder la lumière."];
        return interaction.reply(`🕶️ *Punchline du Parrain :* "${punch[Math.floor(Math.random()*punch.length)]}"`);
    }

    if (commandName === 'slap') {
        const cible = options.getUser('membre');
        return interaction.reply(`💥 **${user.username}** balance une balayette laser monumentale à **${cible.username}** !`);
    }

    if (commandName === 'alliance') {
        const cible = options.getUser('membre');
        return interaction.reply(`🤛 Taux de fraternité et d'alliance avec **${cible.username}** : **${Math.floor(Math.random()*101)}%**.`);
    }

    if (commandName === 'secret') {
        const cible = options.getUser('membre') || user;
        const list = ["Recherche : Comment tricher au casino du bot", "Tuto : Devenir fort sur Blox Fruits sans bras", "Achat compulsif de Robux à 3h du matin"];
        return interaction.reply(`🔍 Fuite de l'historique de **${cible.username}** :\n*"${list[Math.floor(Math.random()*list.length)]}"*`);
    }

    if (commandName === 'avatar') {
        const cible = options.getUser('membre') || user;
        const emb = new EmbedBuilder().setTitle(`📸 Image de ${cible.username}`).setImage(cible.displayAvatarURL({ size: 1024 })).setColor('#000000');
        return interaction.reply({ embeds: [emb] });
    }
});

// Anti-crash global
process.on('unhandledRejection', (reason) => console.error('⚠️ [ANTI-CRASH] Rejet non géré :', reason));
process.on('uncaughtException', (err) => console.error('⚠️ [ANTI-CRASH] Exception non capturée :', err));

client.login(process.env.TOKEN);

const express = require('express');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

// ---------------- SERVER WEB POUR RENDER ----------------
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send("Le bot Kyotaru Family Business & Casino est actif !"));
app.listen(PORT, () => console.log(`Serveur connecté sur le port ${PORT}`));

// ---------------- CONFIGURATION DISCORD ----------------
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

const STAFF_ID = "1499852043408642099"; 
const LOG_CHANNEL_ID = "1506792520133251253"; 

// Base de données locale (Points, Profils, Entreprises, Investissements)
const bddPath = path.join(__dirname, 'kyotarudata.json');
let bdd = { points: {}, profil: {}, entreprises: {}, investissements: {} };

if (fs.existsSync(bddPath)) {
    try { bdd = JSON.parse(fs.readFileSync(bddPath, 'utf-8')); } catch (e) { console.error(e); }
}
if (!bdd.profil) bdd.profil = {};
if (!bdd.entreprises) bdd.entreprises = {};
if (!bdd.investissements) bdd.investissements = {};

function sauvegarderDonnees() { fs.writeFileSync(bddPath, JSON.stringify(bdd, null, 2)); }

// Données des Bâtiments / Entreprises achetables
const BATIMENTS = {
    serveur: { nom: "💻 Serveur de Bot clandestin", prix: 500, revenu: 25 },
    bunker: { nom: "🛡️ Bunker Kyotaru-Data", prix: 2000, revenu: 120 },
    casino: { nom: "🎰 Mini-Casino Kyotaru", prix: 7500, revenu: 500 },
    syndicat: { nom: "👑 Quartier Général du Syndicat", prix: 25000, revenu: 2000 }
};

// ---------------- ENREGISTREMENT DES SLASH COMMANDS ----------------
const commands = [
    // GENERAL & HELP
    new SlashCommandBuilder().setName('help').setDescription('Affiche la liste complète de toutes les commandes du bot'),
    new SlashCommandBuilder().setName('annonce').setDescription('Fait une annonce officielle via le bot (Staff)')
        .addStringOption(opt => opt.setName('message').setDescription('Le contenu').setRequired(true))
        .addStringOption(opt => opt.setName('style').setDescription('Le format').setRequired(true).addChoices({name: 'Embed', value: 'embed'}, {name: 'Texte', value: 'texte'})),

    // 🪙 ÉCONOMIE, PROFIL & EMPIRE
    new SlashCommandBuilder().setName('profil').setDescription('Affiche ton empire, tes points et tes bâtiments').addUserOption(opt => opt.setName('membre').setDescription('Le membre')),
    new SlashCommandBuilder().setName('points').setDescription('Affiche tes KyotaruPoints et comment en obtenir régulièrement').addUserOption(opt => opt.setName('membre').setDescription('Le membre')),
    new SlashCommandBuilder().setName('setpoints').setDescription('Définir les points (Staff)').addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true)).addIntegerOption(opt => opt.setName('montant').setDescription('Le montant').setRequired(true)),
    new SlashCommandBuilder().setName('daily').setDescription('Récupère tes dividendes quotidiens (Points gratuits)'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Affiche le Top 10 des membres les plus riches de la famille'),
    new SlashCommandBuilder().setName('settitle').setDescription('Change ton titre sur ton /profil').addStringOption(opt => opt.setName('titre').setDescription('Ton nouveau titre').setRequired(true)),
    
    // 🏢 BUSINESS & INVESTISSEMENTS
    new SlashCommandBuilder().setName('boutique').setDescription('Affiche la liste des bâtiments et entreprises disponibles à l\'achat'),
    new SlashCommandBuilder().setName('acheter').setDescription('Acheter un bâtiment pour générer des points automatiquement')
        .addStringOption(opt => opt.setName('id').setDescription('L\'ID du bâtiment (serveur, bunker, casino, syndicat)').setRequired(true)),
    new SlashCommandBuilder().setName('investir').setDescription('Placer des points en bourse / crypto (Risque de gain ou de perte !)')
        .addIntegerOption(opt => opt.setName('montant').setDescription('Montant à investir').setRequired(true)),
    new SlashCommandBuilder().setName('recolter').setDescription('Récolter les points générés par tes entreprises et bâtiments achetés'),

    // 🎰 CASINO
    new SlashCommandBuilder().setName('slots').setDescription('Machine à sous : aligne les symboles pour le Jackpot !').addIntegerOption(opt => opt.setName('mise').setDescription('Montant à miser').setRequired(true)),
    new SlashCommandBuilder().setName('coinflip').setDescription('Double ou quitte sur un lancer de pièce').addStringOption(opt => opt.setName('choix').setDescription('pile ou face').setRequired(true).addChoices({name:'Pile', value:'pile'}, {name:'Face', value:'face'})).addIntegerOption(opt => opt.setName('mise').setDescription('Mise').setRequired(true)),
    new SlashCommandBuilder().setName('roulette').setDescription('Mise sur une couleur au casino (Rouge x2, Noir x2, Vert x14)').addStringOption(opt => opt.setName('couleur').setDescription('Rouge, Noir ou Vert').setRequired(true).addChoices({name:'Rouge (x2)', value:'rouge'}, {name:'Noir (x2)', value:'noir'}, {name:'Vert (x14)', value:'vert'})).addIntegerOption(opt => opt.setName('mise').setDescription('Mise').setRequired(true)),

    // 🛡️ MODÉRATION
    new SlashCommandBuilder().setName('kick').setDescription('Exclure un membre').addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true)).addStringOption(opt => opt.setName('raison').setDescription('Raison')),
    new SlashCommandBuilder().setName('ban').setDescription('Bannir un membre').addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true)).addStringOption(opt => opt.setName('raison').setDescription('Raison')),
    new SlashCommandBuilder().setName('mute').setDescription('Rendre muet temporairement (Staff)').addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true)).addIntegerOption(opt => opt.setName('minutes').setDescription('Durée en minutes').setRequired(true)),
    new SlashCommandBuilder().setName('unmute').setDescription('Retirer le mute d\'un membre (Staff)').addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true)),
    new SlashCommandBuilder().setName('clear').setDescription('Supprimer des messages en masse (Staff)').addIntegerOption(opt => opt.setName('nombre').setDescription('Nombre de messages (1-100)').setRequired(true)),
    new SlashCommandBuilder().setName('warn').setDescription('Donner un avertissement officiel (Staff)').addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true)).addStringOption(opt => opt.setName('raison').setDescription('Raison')),

    // 🎭 HUMOUR & HACK
    new SlashCommandBuilder().setName('hack').setDescription('Lancer un protocole de cyber-attaque destructeur sur un membre').addUserOption(opt => opt.setName('membre').setDescription('La victime').setRequired(true)),
    new SlashCommandBuilder().setName('pourcentage').setDescription('Test de pourcentage d\'humour du clan (Gay, Furry, Gigachad...)')
        .addStringOption(opt => opt.setName('type').setDescription('Le test à effectuer').setRequired(true)
            .addChoices({name: ' % Gay 🏳️‍🌈', value: 'gay'}, {name: ' % Furry 🐾', value: 'furry'}, {name: ' % Gigachad 🗿', value: 'gigachad'}, {name: ' % Traître 🐍', value: 'traitre'}))
        .addUserOption(opt => opt.setName('membre').setDescription('Le membre à tester (optionnel)'))
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`[Kyotaru Family] Connecté : ${client.user.tag}`);
    client.user.setActivity('Gérer l\'Empire Kyotaru 📈');
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Base de commandes mise à jour !');
    } catch (error) { console.error(error); }
});

// ---------------- GESTION DES COMMANDES INTERACTION ----------------
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, guild, member } = interaction;

    // Initialisation des structures de données pour éviter tout crash 'undefined'
    if (!bdd.points[user.id]) bdd.points[user.id] = 100; 
    if (!bdd.profil[user.id]) bdd.profil[user.id] = { titre: "Actionnaire Kyotaru 🪙", dailyCooldown: 0, warns: 0 };
    if (!bdd.entreprises[user.id]) bdd.entreprises[user.id] = { serveur: 0, bunker: 0, casino: 0, syndicat: 0 };
    if (!bdd.investissements[user.id]) bdd.investissements[user.id] = { dernierRecolte: Date.now() };

    // 📖 COMMANDE HELP
    if (commandName === 'help') {
        const embedHelp = new EmbedBuilder()
            .setTitle('📖 GUIDE DES COMMANDES - KYOTARU FAMILY')
            .setDescription('Voici l\'intégralité des outils mis à ta disposition pour fonder ton empire et régner sur l\'économie.')
            .setColor('#34495e')
            .addFields(
                { name: '🪙 Économie & Empire', value: '`/profil` • `/points` • `/daily` • `/leaderboard` • `/settitle`', inline: false },
                { name: '🏢 Business & Entreprises', value: '`/boutique` • `/acheter` • `/investir` • `/recolter`', inline: false },
                { name: '🎰 Casino Impérial', value: '`/slots` • `/coinflip` • `/roulette`', inline: false },
                { name: '🎭 Tests & Cyber-Attaque', value: '`/hack` • `/pourcentage`', inline: false },
                { name: '🛡️ Gestion du Personnel (Staff)', value: '`/annonce` • `/warn` • `/mute` • `/unmute` • `/clear` • `/kick` • `/ban` • `/setpoints`', inline: false }
            ).setTimestamp();
        return interaction.reply({ embeds: [embedHelp] });
    }

    // 🪙 POINTS
    if (commandName === 'points') {
        const cible = options.getUser('membre') || user;
        const pts = bdd.points[cible.id] || 0;

        const embedPoints = new EmbedBuilder()
            .setTitle(`🪙 Compte de KyotaruPoints : ${cible.username}`)
            .setDescription(`Solde actuel : **${pts} pts**\n\n💡 **Comment gagner des points régulièrement ?**\n1️⃣ Utilisez la commande \`/daily\` toutes les 24h pour récupérer un virement gratuit.\n2️⃣ Achetez des entreprises dans la \`/boutique\` et récupérez des gains passifs toutes les heures avec \`/recolter\`.\n3️⃣ Prenez des risques boursiers avec \`/investir\` ou défiez la chance au casino (\`/slots\`, \`/roulette\`).`)
            .setColor('#f39c12');
        return interaction.reply({ embeds: [embedPoints] });
    }

    // 📇 PROFIL EVOLUÉ
    if (commandName === 'profil') {
        const cible = options.getUser('membre') || user;
        const pts = bdd.points[cible.id] || 0;
        const data = bdd.profil[cible.id] || { titre: "Actionnaire Kyotaru 🪙", warns: 0 };
        
        // Initialisation à la volée si la cible n'existe pas encore en BDD
        if (!bdd.entreprises[cible.id]) bdd.entreprises[cible.id] = { serveur: 0, bunker: 0, casino: 0, syndicat: 0 };
        const ent = bdd.entreprises[cible.id];

        let strEntreprises = `💻 Serveurs : **${ent.serveur || 0}**\n🛡️ Bunkers : **${ent.bunker || 0}**\n🎰 Casinos : **${ent.casino || 0}**\n👑 QG Syndicats : **${ent.syndicat || 0}**`;

        const embedProfil = new EmbedBuilder()
            .setTitle(`🏢 Statut Impérial de ${cible.username}`)
            .setColor('#2c3e50')
            .setThumbnail(cible.displayAvatarURL())
            .addFields(
                { name: '🎖️ Titre Économique', value: `${data.titre}`, inline: true },
                { name: '🪙 Liquidités', value: `**${pts} pts**`, inline: true },
                { name: '⚠️ Alertes Staff', value: `\`${data.warns || 0}/3\``, inline: true },
                { name: '🏬 Immobilier & Entreprises possédées', value: strEntreprises }
            ).setTimestamp();
        return interaction.reply({ embeds: [embedProfil] });
    }

    // 🏬 BOUTIQUE IMMOBILIÈRE
    if (commandName === 'boutique') {
        const embedBoutique = new EmbedBuilder()
            .setTitle('🏬 BOUTIQUE IMMOBILIÈRE & ENTREPRISES')
            .setDescription('Achetez des structures pour générer des revenus passifs récoltables via la commande `/recolter`.')
            .setColor('#2ecc71')
            .addFields(
                { name: '💻 Serveur de Bot clandestin (ID: `serveur`)', value: `Prix: **500 pts** • Revenu: **+25 pts / heure**` },
                { name: '🛡️ Bunker Kyotaru-Data (ID: `bunker`)', value: `Prix: **2000 pts** • Revenu: **+120 pts / heure**` },
                { name: '🎰 Mini-Casino Kyotaru (ID: `casino`)', value: `Prix: **7500 pts** • Revenu: **+500 pts / heure**` },
                { name: '👑 QG du Syndicat (ID: `syndicat`)', value: `Prix: **25000 pts** • Revenu: **+2000 pts / heure**` }
            ).setFooter({ text: 'Pour acheter, faites /acheter <id>' });
        return interaction.reply({ embeds: [embedBoutique] });
    }

    // 🏢 ACHETER UN BATIMENT
    if (commandName === 'acheter') {
        const buildingId = options.getString('id').toLowerCase();
        const choisi = BATIMENTS[buildingId];

        if (!choisi) return interaction.reply({ content: "❌ ID de bâtiment invalide. Choisissez parmi : `serveur`, `bunker`, `casino`, `syndicat`.", ephemeral: true });

        const prix = choisi.prix;
        if (bdd.points[user.id] < prix) return interaction.reply(`❌ Solde insuffisant ! Il te manque **${prix - bdd.points[user.id]} pts** pour t'offrir cette structure.`);

        bdd.points[user.id] -= prix;
        if (!bdd.entreprises[user.id][buildingId]) bdd.entreprises[user.id][buildingId] = 0;
        bdd.entreprises[user.id][buildingId] += 1;
        sauvegarderDonnees();

        return interaction.reply(`🏢 **Félicitations !** Tu as acheté : **${choisi.nom}** ! Elle produit maintenant des gains réguliers.`);
    }

    // 📈 RECOLTER LES PROFITS
    if (commandName === 'recolter') {
        const ent = bdd.entreprises[user.id];
        const investData = bdd.investissements[user.id] || { dernierRecolte: Date.now() };
        
        const mtn = Date.now();
        const tempsEcouleMs = mtn - investData.dernierRecolte;
        const heures = Math.floor(tempsEcouleMs / 3600000); 

        if (heures < 1) {
            const minutesRestantes = Math.ceil((3600000 - tempsEcouleMs) / 60000);
            return interaction.reply({ content: `⏱️ Vos usines tournent encore. Revenez dans **${minutesRestantes} minute(s)** pour collecter les bénéfices.`, ephemeral: true });
        }

        const revServeur = (ent.serveur || 0) * BATIMENTS.serveur.revenu;
        const revBunker = (ent.bunker || 0) * BATIMENTS.bunker.revenu;
        const revCasino = (ent.casino || 0) * BATIMENTS.casino.revenu;
        const revSyndicat = (ent.syndicat || 0) * BATIMENTS.syndicat.revenu;

        const totalParHeure = revServeur + revBunker + revCasino + revSyndicat;
        const gainTotal = totalParHeure * heures;

        if (gainTotal <= 0) return interaction.reply("❌ Tu ne possèdes aucun bâtiment productif pour le moment. Fais un tour dans la `/boutique` !");

        bdd.points[user.id] += gainTotal;
        bdd.investissements[user.id].dernierRecolte = mtn;
        sauvegarderDonnees();

        return interaction.reply(`💰 **Récolte de l'Empire !** Tes bâtiments ont tourné pendant **${heures}h** et viennent de te verser **+${gainTotal} KyotaruPoints** !`);
    }

    // 📉 INVESTISSEMENT BOURSIER RISQUÉ
    if (commandName === 'investir') {
        const montant = options.getInteger('montant');
        if (bdd.points[user.id] < montant || montant <= 0) return interaction.reply("❌ Liquidités insuffisantes ou montant incorrect.");

        bdd.points[user.id] -= montant;
        const multiplicateurs = [0, 0.2, 0.5, 1.5, 2.0, 3.5]; 
        const resultatMulti = multiplicateurs[Math.floor(Math.random() * multiplicateurs.length)];
        const gainFinal = Math.floor(montant * resultatMulti);

        bdd.points[user.id] += gainFinal;
        sauvegarderDonnees();

        if (resultatMulti === 0) {
            return interaction.reply(`📉 **Crash Boursier Majeur !** La courbe s'est effondrée... Tu as perdu l'intégralité de ton investissement de **${montant} pts**.`);
        } else if (resultatMulti < 1) {
            return interaction.reply(`📉 **Marché en baisse.** Tes actions perdent de la valeur. Tu ne récupères que **${gainFinal} pts**.`);
        } else {
            return interaction.reply(`📈 **BULL RUN CRYPTO !** Ton placement explose ! Tu récupères un chèque massif de **${gainFinal} KyotaruPoints** (Gain net de +${gainFinal - montant} pts) !`);
        }
    }

    // 🎰 CASINO : SLOTS
    if (commandName === 'slots') {
        const mise = options.getInteger('mise');
        if (bdd.points[user.id] < mise || mise <= 0) return interaction.reply("❌ Solde insuffisant pour cette table.");

        const symboles = ["👑", "💎", "🎰", "💰", "🍒", "❌"];
        const s1 = symboles[Math.floor(Math.random() * symboles.length)];
        const s2 = symboles[Math.floor(Math.random() * symboles.length)];
        const s3 = symboles[Math.floor(Math.random() * symboles.length)];

        bdd.points[user.id] -= mise;

        if (s1 === s2 && s2 === s3) {
            let multi = 4;
            if (s1 === '👑') multi = 10; 
            const gains = mise * multi;
            bdd.points[user.id] += gains;
            sauvegarderDonnees();
            return interaction.reply(`🎰 **[ ${s1} | ${s2} | ${s3} ]**\n👑 **JACKPOT MAJESTUEUX !** Les trois symboles s'alignent ! Multiplicateur x${multi}. Tu gagnes **${gains} pts** !`);
        } else if (s1 === s2 || s2 === s3 || s1 === s3) {
            const gains = Math.floor(mise * 1.5);
            bdd.points[user.id] += gains;
            sauvegarderDonnees();
            return interaction.reply(`🎰 **[ ${s1} | ${s2} | ${s3} ]**\n✨ **Petite combinaison !** Deux symboles identiques. Tu récupères **${gains} pts**.`);
        } else {
            sauvegarderDonnees();
            return interaction.reply(`🎰 **[ ${s1} | ${s2} | ${s3} ]**\n❌ **Rien du tout.** La maison du casino l'emporte. Tu perds **${mise} pts**.`);
        }
    }

    // 🎰 CASINO : ROULETTE
    if (commandName === 'roulette') {
        const couleurChoisie = options.getString('couleur');
        const mise = options.getInteger('mise');
        if (bdd.points[user.id] < mise || mise <= 0) return interaction.reply("❌ Fonds insuffisants.");

        bdd.points[user.id] -= mise;
        const de = Math.floor(Math.random() * 37); 
        let couleurResultat = '';

        if (de === 0) couleurResultat = 'vert';
        else if (de % 2 === 0) couleurResultat = 'noir';
        else couleurResultat = 'rouge';

        if (couleurChoisie === couleurResultat) {
            let multi = 2;
            if (couleurResultat === 'vert') multi = 14;
            const gains = mise * multi;
            bdd.points[user.id] += gains;
            sauvegarderDonnees();
            return interaction.reply(`🎡 **La roulette tourne...** La bille s'arrête sur le numéro **${de} (${couleurResultat.toUpperCase()})** ! ✅ **Gagné !** Tu remportes **${gains} pts** !`);
        } else {
            sauvegarderDonnees();
            return interaction.reply(`🎡 **La roulette tourne...** La bille s'arrête sur le numéro **${de} (${couleurResultat.toUpperCase()})**... ❌ **Perdu !** Le casino encaisse tes **${mise} pts**.`);
        }
    }

    // 🎰 CASINO : COINFLIP
    if (commandName === 'coinflip') {
        const choix = options.getString('choix');
        const mise = options.getInteger('mise');
        if (bdd.points[user.id] < mise || mise <= 0) return interaction.reply("Points insuffisants.");

        bdd.points[user.id] -= mise;
        const res = Math.random() < 0.5 ? 'pile' : 'face';

        if (choix === res) {
            bdd.points[user.id] += mise * 2;
            sauvegarderDonnees();
            return interaction.reply(`🪙 La pièce tourne et tombe sur **${res.toUpperCase()}** ! Gagné ! Tu doubles ta mise : **${mise * 2} pts** !`);
        } else {
            sauvegarderDonnees();
            return interaction.reply(`🪙 La pièce tourne et tombe sur **${res.toUpperCase()}**... Cruelle déception, tu perds tes **${mise} pts**.`);
        }
    }

    // 🕵️‍♂️ PROTOCOLE DE CYBER-ATTAQUE CORRIGÉ
    if (commandName === 'hack') {
        const cible = options.getUser('membre');
        await interaction.reply(`🛸 **[ALERTE SYSTEME]** Lancement du terminal de piratage offensif contre **${cible.username}**...`);

        setTimeout(() => interaction.editReply(`📡 **[STEP 1]** Injecting exploitative payload into Discord Webhook Token Bypass... \`[OK]\``), 1500);
        setTimeout(() => interaction.editReply(`🌐 **[STEP 2]** Interception de la passerelle IP : \`192.168.${Math.floor(Math.random()*254)}.${Math.floor(Math.random()*254)}\` • Fournisseur local localisé.`), 3200);
        setTimeout(() => interaction.editReply(`📂 **[STEP 3]** Analyse des répertoires sensibles... Extraction en cours...`), 5000);
        setTimeout(() => interaction.editReply(`🎮 **[STEP 4]** Tentative de vidage du coffre-fort de la cible... Injection réussie.`), 6800);
        
        setTimeout(() => {
            if (!bdd.points[cible.id]) bdd.points[cible.id] = 100;
            const chanceVol = Math.random() < 0.5;

            if (chanceVol && bdd.points[cible.id] > 20) {
                const volPoints = Math.floor(Math.random() * 40) + 10;
                bdd.points[cible.id] -= volPoints;
                bdd.points[user.id] += volPoints;
                sauvegarderDonnees();
                return interaction.editReply(`🏴‍☠️ **[HACK TERMINÉ]** Piratage complété avec brio ! Le coupe-feu de **${cible.username}** a fondu. Tu lui as dérobé **${volPoints} KyotaruPoints** ! 🔥`);
            } else {
                return interaction.editReply(`🏴‍☠️ **[HACK TERMINÉ]** L'attaque a détruit les données de **${cible.username}**, mais ses pare-feu financiers ont tenu. Aucun point n'a pu être extrait !`);
            }
        }, 8500);
    }

    // 🎭 COMMANDES POURCENTAGE (HUMOUR)
    if (commandName === 'pourcentage') {
        const type = options.getString('type');
        const cible = options.getUser('membre') || user;
        const pourcentage = Math.floor(Math.random() * 101);

        let icone = "📊";
        let phrase = "";

        if (type === 'gay') {
            icone = "🏳️‍🌈";
            if (pourcentage < 20) phrase = "Un hétéro pur et dur, droit comme un i !";
            else if (pourcentage < 60) phrase = "Il y a un petit doute, l'analyseur radar s'agite...";
            else phrase = "Alerte maximale ! Le détecteur de la Kyotaru Family s'affole complètement !";
        } else if (type === 'furry') {
            icone = "🐾";
            if (pourcentage < 30) phrase = "Humain à 100%. Aucune envie suspecte de porter un costume d'animal.";
            else if (pourcentage < 70) phrase = "Aime un peu trop les émojis chats... À surveiller de près.";
            else phrase = "Préparez la cage, on a détecté un loup anthropomorphe dans les rangs !";
        } else if (type === 'gigachad') {
            icone = "🗿";
            if (pourcentage < 40) phrase = "La mâchoire n'est pas encore assez carrée. Continue la muscu.";
            else phrase = "La prestance est totale. Les rumeurs disent qu'il soulève le serveur à lui tout seul.";
        } else if (type === 'traitre') {
            icone = "🐍";
            if (pourcentage < 30) phrase = "Frère d'arme loyal. Prêt à mourir pour le clan.";
            else phrase = "L'attitude est suspecte... Ne lui donnez aucun mot de passe admin.";
        }

        return interaction.reply(`${icone} **DÉTECTEUR DU SYNDICAT (Humour)**\nLe taux de **${type.toUpperCase()}** chez **${cible.username}** est estimé à : **${pourcentage}%** !\n*» ${phrase}*`);
    }

    // 🪙 FONCTIONS SECONDAIRES & DIRECTION
    if (commandName === 'daily') {
        const mtn = Date.now();
        const cooldown = bdd.profil[user.id].dailyCooldown || 0;
        if (mtn < cooldown) {
            const restant = Math.ceil((cooldown - mtn) / 3600000);
            return interaction.reply({ content: `⏱️ Vos dividendes ne sont pas prêts. Reviens dans **${restant} heure(s)**.`, ephemeral: true });
        }
        bdd.points[user.id] += 300;
        bdd.profil[user.id].dailyCooldown = mtn + 86400000;
        sauvegarderDonnees();
        return interaction.reply(`🎁 **Dividendes récoltés !** La banque Kyotaru t'a versé **300 pts** de bonus.`);
    }

    if (commandName === 'leaderboard') {
        const tri = Object.entries(bdd.points).sort((a, b) => b[1] - a[1]).slice(0, 10);
        let str = "";
        tri.forEach(([id, score], index) => { str += `${index + 1}. <@${id}> - **${score} pts**\n`; });
        const embed = new EmbedBuilder().setTitle("🏆 Classement de la Richesse Impériale").setDescription(str || "Aucun capitaliste ici.").setColor('#f1c40f');
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'settitle') {
        const nvTitre = options.getString('titre');
        bdd.profil[user.id].titre = nvTitre;
        sauvegarderDonnees();
        return interaction.reply(`✅ Titre corporatif mis à jour : \`${nvTitre}\``);
    }

    if (commandName === 'setpoints') {
        if (user.id !== STAFF_ID && (!member || !member.roles.cache.has(STAFF_ID))) return interaction.reply({ content: "Fermé.", ephemeral: true });
        const cible = options.getUser('membre');
        bdd.points[cible.id] = options.getInteger('montant');
        sauvegarderDonnees();
        return interaction.reply(`✅ Solde de ${cible.username} ajusté à **${options.getInteger('montant')} pts**.`);
    }

    if (commandName === 'annonce') {
        if (user.id !== STAFF_ID && (!member || !member.roles.cache.has(STAFF_ID))) return interaction.reply({ content: "Fermé.", ephemeral: true });
        const messageAnnonce = options.getString('message');
        const style = options.getString('style');
        await interaction.reply({ content: "Annonce envoyée.", ephemeral: true });

        if (style === 'embed') {
            const embed = new EmbedBuilder().setTitle('📢 NOTE DE LA DIRECTION').setDescription(messageAnnonce).setColor('#e74c3c').setTimestamp();
            return interaction.channel.send({ embeds: [embed] });
        } else {
            return interaction.channel.send(`📢 **Annonce importante :**\n\n${messageAnnonce}`);
        }
    }

    // MODERATION
    if (commandName === 'warn' || commandName === 'mute' || commandName === 'unmute' || commandName === 'clear' || commandName === 'kick' || commandName === 'ban') {
        if (user.id !== STAFF_ID && (!member || !member.roles.cache.has(STAFF_ID))) return interaction.reply({ content: "Refusé.", ephemeral: true });
        const cibleMember = options.getMember('membre');
        const raison = options.getString('raison') || "Non spécifiée.";

        if (commandName === 'warn') {
            const cibleUser = options.getUser('membre');
            if (!bdd.profil[cibleUser.id]) bdd.profil[cibleUser.id] = { titre: "Recrue", warns: 0 };
            bdd.profil[cibleUser.id].warns = (bdd.profil[cibleUser.id].warns || 0) + 1;
            sauvegarderDonnees();
            return interaction.reply(`⚠️ **Avertissement émis** pour <@${cibleUser.id}> (${bdd.profil[cibleUser.id].warns}/3).`);
        }
        if (commandName === 'mute') {
            const min = options.getInteger('minutes');
            await cibleMember.timeout(min * 60 * 1000, raison);
            return interaction.reply(`🔇 **${cibleMember.user.username}** réduit au silence pour **${min} min**.`);
        }
        if (commandName === 'unmute') {
            await cibleMember.timeout(null);
            return interaction.reply(`🔊 Mute révoqué pour **${cibleMember.user.username}**.`);
        }
        if (commandName === 'clear') {
            const nb = options.getInteger('nombre');
            await interaction.channel.bulkDelete(nb, true);
            return interaction.reply({ content: `🗑️ **${nb} messages** nettoyés.`, ephemeral: true });
        }
        if (commandName === 'kick') { await cibleMember.kick(raison); return interaction.reply(`🥾 Membre expulsé.`); }
        if (commandName === 'ban') { await cibleMember.ban({ reason: raison }); return interaction.reply(`🚨 Membre banni.`); }
    }
});

// Anti-crash global
process.on('unhandledRejection', (reason) => console.error('⚠️ Rejet non géré :', reason));
process.on('uncaughtException', (err) => console.error('⚠️ Exception non capturée :', err));

client.login(process.env.TOKEN);


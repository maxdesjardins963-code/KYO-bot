const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
require('dotenv').config();

// ---------------- SERVER WEB POUR RENDER ----------------
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send("Le bot Kyotaru Family est en ligne et protégé contre la mise en veille !");
});

app.listen(PORT, () => {
    console.log(`Serveur Web Kyotaru activé sur le port ${PORT} (Anti-crash Render).`);
});

// ---------------- CONFIGURATION DISCORD ----------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Configuration des IDs fournis
const ALLOWED_ROLE_ID = "1499852043408642099";
const LOG_CHANNEL_ID = "1506792520133251253";
const PREFIX = "?"; // Préfixe personnalisé pour la Kyotaru Family

client.once('ready', () => {
    console.log(`[Kyotaru Family] Bot connecté en tant que : ${client.user.tag}`);
    client.user.setActivity('Protéger la Kyotaru Family ⚔️');
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);

    // ==========================================
    // 🛡️ MODÉRATION KYOTARU (RÔLE STAFF STRICT)
    // ==========================================

    if (command === 'ban' || command === 'kick') {
        // Vérification de sécurité sur le rôle
        if (!message.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return message.reply("❌ `Erreur :` Tu ne possèdes pas le rôle requis pour exécuter la modération de la Kyotaru Family.");
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        if (!target) return message.reply(`❌ Utilisation correcte : \`${PREFIX}${command} @pseudo [raison]\``);
        const reason = args.slice(1).join(" ") || "Exclu par un haut gradé de la famille.";

        if (command === 'ban') {
            if (!target.bannable) return message.reply("❌ Impossible de bannir ce membre. Mes permissions sont trop basses.");
            await target.ban({ reason });
            message.reply(`🚨 **🚨 ${target.user.tag}** a été banni définitivement de la Kyotaru Family.`);
            
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🚷 [BAN] Bannissement Kyotaru')
                    .setColor('#8b0000') // Rouge foncé style mafia/famille
                    .addFields(
                        { name: 'Membre Banni', value: `${target.user.tag} (${target.id})` },
                        { name: 'Exécuté par', value: `${message.author.tag}` },
                        { name: 'Raison officielle', value: reason }
                    ).setTimestamp();
                logChannel.send({ embeds: [embed] });
            }
        }

        if (command === 'kick') {
            if (!target.kickable) return message.reply("❌ Impossible d'expulser ce membre.");
            await target.kick(reason);
            message.reply(`🥾 **${target.user.tag}** a été éjecté du serveur.`);

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🥾 [KICK] Expulsion Kyotaru')
                    .setColor('#d2691e')
                    .addFields(
                        { name: 'Membre Expulsé', value: `${target.user.tag} (${target.id})` },
                        { name: 'Exécuté par', value: `${message.author.tag}` },
                        { name: 'Raison officielle', value: reason }
                    ).setTimestamp();
                logChannel.send({ embeds: [embed] });
            }
        }
    }

    // ==========================================
    // 🎉 10 COMMANDES FUN (POUR LES MEMBRES)
    // ==========================================

    // 1. FAKE HACK (Style Cyber-Attaque Kyotaru)
    if (command === 'hack') {
        const target = message.mentions.users.first();
        if (!target) return message.reply("💻 Cible manquante ! Utilise : `?hack @pseudo`");

        const msg = await message.channel.send(`🛰️ Initialisation du protocole \`Kyotaru_NetCrack.sh\`...`);
        
        setTimeout(() => msg.edit(`🕵️‍♂️ Infiltration des bases de données de **${target.username}** en cours...`), 1500);
        setTimeout(() => msg.edit(`🌐 Adresse IP locale interceptée : \`172.16.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}\``), 3000);
        setTimeout(() => msg.edit(`⚠️ Dossier secret découvert : *"Comment battre la Kyotaru Family en 1v1 (Tuto raté)"*`), 4500);
        setTimeout(() => msg.edit(`🧬 Statut Blox Fruits compromis : Utilise le style de combat 'Combat' de base à cause d'un manque de fragments.`), 6000);
        setTimeout(() => msg.edit(`💥 Destruction à distance des jetons Discord effectuée.`), 7500);
        setTimeout(() => msg.edit(`🏴 **${target} a été piraté avec succès par la Kyotaru Family.** Désinstallation de son système...`), 9000);
    }

    // 2. FRUIT DU CHEF
    if (command === 'fruit') {
        const fruits = [
            '🍌 Kilo', '🍏 Spin', '🕵️‍♂️ Chop', '🔥 Flame', '❄️ Ice', '💡 Light', 
            '🌋 Magma', '✨ Buddha (Le favori du crew)', '⚡ Rumble', '🍩 Dough', 
            '🦕 T-Rex', '🐆 Leopard', '🐉 Dragon (Futur Rework !)'
        ];
        const randomFruit = fruits[Math.floor(Math.random() * fruits.length)];
        message.reply(`🎁 L'intendant de la Kyotaru Family t'offre le fruit suivant : **${randomFruit}** ! C'est cadeau.`);
    }

    // 3. STATUT DANS LA FAMILLE (Jauge de Respect)
    if (command === 'respect') {
        const target = message.mentions.users.first() || message.author;
        const respectPercent = Math.floor(Math.random() * 101);
        
        let grade = "Nouvelle Recrue 🪙";
        if (respectPercent > 40) grade = "Membre Respectable ⚔️";
        if (respectPercent > 75) grade = "Bras Droit de confiance 🎖️";
        if (respectPercent === 100) grade = "Parrain de la Famille 👑";

        message.channel.send(`📊 Le taux de respect de **${target.username}** au sein de la Kyotaru Family est de **${respectPercent}%**.\n**Statut :** \`${grade}\``);
    }

    // 4. PRIME DE RECHERCHE (Bounty Crew)
    if (command === 'bounty') {
        const fakeBounty = (Math.random() * 30).toFixed(1);
        message.reply(`🏴 Si la Marine mettait ta tête à prix, tu vaudrais environ **${fakeBounty} Millions** de Berrys ! (Selon nos experts)`);
    }

    // 5. DUEL DE REGARDS (Coinflip)
    if (command === 'duel') {
        const issues = [
            '⚔️ Tu as sorti ton sabre en premier, tu gagnes le duel !',
            '🌊 Tu as glissé dans l\'eau avant même le début du combat. Défaite humiliante.'
        ];
        message.reply(issues[Math.floor(Math.random() * issues.length)]);
    }

    // 6. PHRASE DE BOSS
    if (command === 'boss') {
        const punchlines = [
            "On ne choisit pas la Kyotaru Family, c'est la Kyotaru Family qui nous choisit.",
            "T'as le style d'un mec qui possède la v4 maximale de chaque race.",
            "Ta puissance fait trembler les boss de la troisième mer.",
            "Ne parle pas de skill à quelqu'un qui maîtrise le jeu comme toi."
        ];
        message.reply(`🕶️ ${punchlines[Math.floor(Math.random() * punchlines.length)]}`);
    }

    // 7. PUNITION DE LA FAMILLE (Slap)
    if (command === 'slap') {
        const target = message.mentions.users.first();
        if (!target) return message.reply("👊 Qui a manqué de respect ? Donne un nom : `?slap @pseudo`");
        if (target.id === message.author.id) return message.reply("Tu ne peux pas te corriger toi-même !");
        message.channel.send(`💥 **${message.author.username}** remet les idées en place de **${target.username}** avec une énorme balayette réglementaire !`);
    }

    // 8. ALLIANCE DE CREW (Love meter)
    if (command === 'alliance') {
        const target = message.mentions.users.first();
        if (!target) return message.reply("🤝 Mentionne un autre membre pour tester votre alliance fraternelle !");
        const alliancePercent = Math.floor(Math.random() * 101);
        message.channel.send(`🤛 **Taux de fraternité** entre **${message.author.username}** et **${target.username}** : **${alliancePercent}%** d'affinité !`);
    }

    // 9. SECRET DE POLICHINELLE (Fake Google)
    if (command === 'secret') {
        const secrets = [
            "Comment faire croire qu'on a du skill en spammant ?",
            "Est-ce que c'est normal de perdre contre un PNJ niveau 50 ?",
            "Acheter un faux badge d'administrateur Roblox",
            "Pourquoi mon clavier a volé à travers la pièce après un ragequit ?"
        ];
        message.reply(`🔍 Fuite de l'historique secret de **${message.author.username}** :\n*"${secrets[Math.floor(Math.random() * secrets.length)]}"*`);
    }

    // 10. CARTE D'IDENTITÉ DE L'AVATAR
    if (command === 'avatar') {
        const user = message.mentions.users.first() || message.author;
        const embed = new EmbedBuilder()
            .setTitle(`📸 Fiche d'identité visuelle de : ${user.username}`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setColor('#1a1a1a');
        message.channel.send({ embeds: [embed] });
    }
});

// Anti-crash global pour Render
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [ANTI-CRASH KYOTARU] Rejet non géré :', reason);
});
process.on('uncaughtException', (err, origin) => {
    console.error('⚠️ [ANTI-CRASH KYOTARU] Exception non capturée :', err);
});

client.login(process.env.TOKEN);
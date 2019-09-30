/*
 * File name: colorme_bot.js
 * Description: Handles text commands and color role setup.
 */

const colorUtils = require('./utils_color.js');

// require() this and pass in the discord.js logged in client
module.exports = function(discordClient) {
    const COLORME_PREFIX = process.env.COLORME_PREFIX;
    const CONTRAST_CHECK = process.env.CONTRAST_CHECK === 'true';
    const CONTRAST_THEME = process.env.CONTRAST_THEME;
    const CONTRAST_MIN = parseFloat(process.env.CONTRAST_MIN);

    const CMD_COLORME = '!colorme ';
    const MSG_INVALID_FORMAT = 'Format is !colorme [#RRGGBB]';
    const MSG_ROLE_ERR = 'Error while setting color. Bot owner should check the logs.';
    const RGB_REGEX = /^#[0-9A-F]{6}$/i; // match #, then six hex digits
    const DARK_CHAT = '36393F'; // dark theme chat background
    const DARK_MEM_LIST = '2F3136'; // dark theme member list background
    const LIGHT_CHAT = 'FFFFFF'; // light theme chat background
    const LIGHT_MEM_LIST = 'F2F3F5'; // light theme member list background

    // takes in a hex color str of format #RRGGBB (no handling of #RGB length right now)
    // and returns true if valid, false if not
    const validateColorStr = function(colorStr) {
        if (colorStr.length !== 7) { // include the pound sign
            return false;
        }

        return RGB_REGEX.test(colorStr);
    };

    // checks color against discord theme
    // returns an array of elements that have bad contrast (therefore, empty array if good)
    const checkContrastTheme = function(colorStr, theme) {
        let bad = [];
        let color = colorStr.substring(1);

        let chat, members;
        if (theme === 'light') {
            chat = LIGHT_CHAT;
            members = LIGHT_MEM_LIST;
        } else {
            chat = DARK_CHAT;
            members = DARK_MEM_LIST;
        }

        let chatContrast = colorUtils.contrastRatio(color, chat, 2);
        let memContrast = colorUtils.contrastRatio(color, members, 2);
        console.log(`${theme} theme chat contrast ratio with ${colorStr} is ${chatContrast}`);
        console.log(`${theme} theme members list contrast ratio with ${colorStr} is ${memContrast}`);

        if (chatContrast < CONTRAST_MIN) {
            bad.push(`${theme} theme chat contrast ratio is ${chatContrast}`);
        }

        if (memContrast < CONTRAST_MIN) {
            bad.push(`${theme} theme members list contrast ratio is ${memContrast}`);
        }

        return bad;
    };

    const checkContrastHandler = function(colorStr) {
        let bad = [];
        if (CONTRAST_THEME === 'both') {
            bad = bad.concat(checkContrastTheme(colorStr, 'dark'));
            bad = bad.concat(checkContrastTheme(colorStr, 'light'));
        } else {
            bad = bad.concat(checkContrastTheme(colorStr, CONTRAST_THEME));
        }

        return bad;
    };

    // returns role if found, null if not
    const findRole = async function(colorStr, guild) {
        let roleName = COLORME_PREFIX + colorStr;

        try {
            let roles = guild.roles;
            let role = roles.find(val => val.name === roleName);
            if (role == null) {
                return null;
            }

            console.log('Found role ' + roleName);
            return role;
        } catch (err) {
            console.error(`Error while finding role. Reason is: ${err}`);
            return null;
        }
    };

    // return created role if success, null if not
    const createRole = async function(colorStr, guild) {
        let roleName = COLORME_PREFIX + colorStr;

        try {
            let existingRole = await findRole(colorStr, guild);
            if (existingRole !== null && !existingRole.deleted) {
                return existingRole;
            }

            let newRoleData = {
                'name': roleName,
                'color': colorStr,
                'hoist': false,
                'position': Number.MAX_SAFE_INTEGER,
                'permissions': 0,
                'mentionable': false
            };

            let newRole = await guild.createRole(newRoleData);
            return newRole;
        } catch (err) {
            console.error(`Error while creating role. Reason is: ${err}`);
            return null;
        }
    };

    // return true if success, false if not
    const setRole = async function(role, guild, member) {
        try {
            await member.addRole(role);
            return true;
        } catch (err) {
            console.error(`Error while setting role. Reason is: ${err}`);
            return false;
        }
    };

    // checks for an existing role for the member, and deletes it if they were the only one
    // returns true if an old role was deleted
    const clearOldRole = async function(member) {
        try {
            let roles = member.roles;
            let role = roles.find((val) => {
                return val.name.startsWith(COLORME_PREFIX);
            });

            if (role == null) {
                return false;
            }

            await member.removeRole(role);
            if (role.members.size !== 0) {
                return false;
            }

            await role.delete();
            return true;
        } catch (err) {
            console.error(`Error in clearOldRole(). Reason is: ${err}`);
            return false;
        }
    };

    const handleColorMe = async function(msgContent, guild, channel, member) {
        let colorStr = msgContent.substring(CMD_COLORME.length).toUpperCase();

        let valid = validateColorStr(colorStr);
        if (!valid) {
            console.error(MSG_INVALID_FORMAT);
            sendErrMsg(channel, MSG_INVALID_FORMAT);
            return;
        }

        if (CONTRAST_CHECK) {
            let bad = checkContrastHandler(colorStr);
            if (bad.length > 0) {
                let errContrast = `${colorStr} failed contrast checks for this server's minimum, ${CONTRAST_MIN}:\n\n`;
                bad.forEach((badReason) => {
                    errContrast += `- ${badReason}\n`;
                });

                sendErrMsg(channel, errContrast);
                return;
            }
        }

        await clearOldRole(member);
        let newRole = await createRole(colorStr, guild);
        if (newRole === null) {
            sendErrMsg(channel, undefined);
            return;
        }

        let setSuccess = await setRole(newRole, guild, member);
        if (!setSuccess) {
            sendErrMsg(channel, undefined);
            return;
        }

        channel.send('', {
            'embed': {
                'title': 'Success',
                'description': `Set ${member}'s color to ${colorStr}`,
                'color': parseInt(colorStr.substring(1), 16)
            }
        });
    };

    const sendErrMsg = function(channel, error) {
        if (error !== undefined) {
            channel.send('', {
                'embed': {
                    'title': 'Error',
                    'description': error,
                    'color': 0xFF0000
                }
            });
        } else {
            channel.send('', {
                'embed': {
                    'title': 'Error',
                    'description': MSG_ROLE_ERR,
                    'color': 0xFF0000
                }
            });
        }
    };

    discordClient.on('message', async (msg) => {
        let msgContent = msg.content;
        let channel = msg.channel;
        let member = msg.member;
        let guild = msg.guild;

        // ignore self
        if (msg.author.id === discordClient.user.id) {
            return;
        }

        if (msgContent.startsWith(CMD_COLORME)) {
            handleColorMe(msgContent, guild, channel, member);
        }
    });

    // init
    (() => {
        const allowedThemes = ['dark', 'light', 'both'];

        if (CMD_COLORME === undefined) {
            throw 'CMD_COLORME was not found.';
        }

        if (isNaN(CONTRAST_MIN)) {
            throw 'CONTRAST_CHECK was not found/is not a number.';
        }

        if (!allowedThemes.includes(CONTRAST_THEME)) {
            throw 'CONTRAST_THEME was not found/is not a valid value.';
        }
    })();
};

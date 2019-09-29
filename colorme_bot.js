/*
* File name: colorme_bot.js
* Description: Handles text commands and color role setup.
*/

// require() this and pass in the discord.js logged in client
module.exports = function(discordClient) {
    const CMD_COLORME = '!colorme ';
    const MSG_INVALID_FORMAT = 'Format is !colorme [#RRGGBB]';
    const MSG_ROLE_ERR = 'Error while setting color. Bot owner should check the logs.';
    const PREFIX_MISSING = 'COLORME_PREFIX was not set/found.';
    const COLORME_PREFIX = process.env.COLORME_PREFIX;
    const RGB_REGEX = /^#[0-9A-F]{6}$/i; // match #, then six hex digits

    // takes in a hex color str of format #RRGGBB (no handling of #RGB length right now)
    // and returns true if valid, false if not
    const validateColorStr = function(colorStr) {
        if (colorStr.length !== 7) { // include the pound sign
            return false;
        }

        return RGB_REGEX.test(colorStr);
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

    // return true if success, false if not
    // const deleteRole = async function(colorStr, guild) {
    //     let roleName = COLORME_PREFIX + colorStr;

    //     try {
    //         let role = await findRole(colorStr, guild);
    //         if (role === null) {
    //             throw `${roleName} not found`;
    //         }

    //         await role.delete();
    //         console.log('Deleted role ' + roleName);
    //         return true;
    //     } catch (err) {
    //         console.error(`Error while deleting role. Reason is: ${err}`);
    //         return false;
    //     }
    // };

    // return created role if success, null if not
    const createRole = async function(colorStr, guild) {
        let roleName = COLORME_PREFIX + colorStr;

        try {
            let existingRole = await findRole(colorStr, guild);
            if (existingRole !== null && !existingRole.deleted) {
                throw `${roleName} already exists`;
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
            channel.send(MSG_INVALID_FORMAT);
            return;
        }

        await clearOldRole(member);
        let newRole = await createRole(colorStr, guild);
        if (newRole === null) {
            sendErrMsg(channel);
            return;
        }

        let setSuccess = await setRole(newRole, guild, member);
        if (!setSuccess) {
            sendErrMsg(channel);
        }
    };

    const sendErrMsg = function(channel) {
        channel.send('', {
            'embed': {
                'title': 'Error',
                'description': MSG_ROLE_ERR,
                'color': 0xFF0000
            }
        });
    };

    discordClient.on('message', async (msg) => {
        let msgContent = msg.content;
        let channel = msg.channel;
        let member = msg.member;
        let guild = msg.guild;

        if (msgContent.startsWith(CMD_COLORME)) {
            handleColorMe(msgContent, guild, channel, member);
        }
    });

    // init
    (() => {
        if (CMD_COLORME === undefined) {
            console.error(PREFIX_MISSING);
            throw PREFIX_MISSING;
        }
    })();
};

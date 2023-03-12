import { ChatInputCommandInteraction, CommandInteraction, RoleCreateOptions, EmbedBuilder, GatewayIntentBits, Guild, GuildMember, GuildMemberManager, HexColorString, Role, SlashCommandBuilder } from "discord.js";
import { BotInterface } from "../../BotInterface";
import { readYamlConfig } from "../../utils/ConfigUtils";
import { contrastRatio, validateHexColorString } from "./utils/colorUtils";

// eslint-disable-next-line no-unused-vars
enum DiscordThemes {
    // eslint-disable-next-line no-unused-vars
    Dark = "dark",
    // eslint-disable-next-line no-unused-vars
    Light = "light",
    // eslint-disable-next-line no-unused-vars
    Both = "both"
}

type ColorMeConfig = {
    prefix: string,
    contrastCheck: boolean,
    contrastTheme: DiscordThemes,
    contrastMin: number
};

export class ColorMeBot implements BotInterface {
    private static readonly SUBCMD_SET = "set";
    private static readonly SUBCMD_SET_OPT_COLOR = "color";
    private static readonly SUBCMD_CLEAR = "clear";

    private static readonly DARK_CHAT = "36393F"; // dark theme chat background
    private static readonly DARK_MEM_LIST = "2F3136"; // dark theme member list background
    private static readonly LIGHT_CHAT = "FFFFFF"; // light theme chat background
    private static readonly LIGHT_MEM_LIST = "F2F3F5"; // light theme member list background

    intents: GatewayIntentBits[];
    commands: [SlashCommandBuilder];
    private slashColorMe: SlashCommandBuilder;
    private config!: ColorMeConfig;

    constructor() {
        this.intents = [GatewayIntentBits.Guilds];
        this.slashColorMe = new SlashCommandBuilder()
            .setName("colorme")
            .setDescription("Sets or removes your name's color.")
            .addSubcommand(subcommand =>
                subcommand
                    .setName(ColorMeBot.SUBCMD_SET)
                    .setDescription("Sets your color.")
                    .addStringOption(option =>
                        option
                            .setName(ColorMeBot.SUBCMD_SET_OPT_COLOR)
                            .setDescription("Your desired color, in the format #RRGGBB.")
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName(ColorMeBot.SUBCMD_CLEAR)
                    .setDescription("Clears your color.")
            ) as SlashCommandBuilder;
        this.commands = [this.slashColorMe];
    }

    async processCommand(interaction: CommandInteraction): Promise<void> {
        if (!interaction.isChatInputCommand()) {
            return;
        }

        console.log(`[ColorMeBot]: got interaction: ${interaction}`);
        try {
            switch(interaction.options.getSubcommand()) {
                case ColorMeBot.SUBCMD_SET:
                    await this.handleSet(interaction);
                    break;
                case ColorMeBot.SUBCMD_CLEAR:
                    await this.handleClear(interaction);
                    break;
            }
        } catch (error) {
            console.error(`[ColorMe] Uncaught error in processSlashCommand(): ${error}`);
        }
    }

    async init(): Promise<string | null> {
        try {
            this.config = await readYamlConfig<ColorMeConfig>(import.meta, "config.yaml");
        } catch (error) {
            const errMsg = `[ColorMeBot] Unable to read config: ${error}`;
            console.error(errMsg);
            return errMsg;
        }

        return null;
    }

    async handleSet(interaction: ChatInputCommandInteraction): Promise<void> {
        try {
            const member = interaction.member as GuildMember;
            const colorStr = interaction.options.getString(ColorMeBot.SUBCMD_SET_OPT_COLOR, true);
            console.log(`[ColorMe] Got set with color string ${colorStr} from member ${member}`);
            const valid = validateHexColorString(colorStr);
            if (!valid) {
                await this.sendErrorMessage(interaction, "Invalid color string. Must be a hex string exactly of format `#RRGGBB`.");
                return;
            }

            if (this.config.contrastCheck) {
                const bad = this.checkContrastHandler(colorStr);
                if (bad.length > 0) {
                    let errContrast = `${colorStr} failed contrast checks for this server's minimum, ${this.config.contrastMin}:\n\n`;
                    bad.forEach((badReason) => {
                        errContrast += `- ${badReason}\n`;
                    });

                    console.log(`[ColorMe] Color string ${colorStr} from member ${member} failed contrast check: ${errContrast}`);
                    await this.sendErrorMessage(interaction, errContrast);
                    return;
                }
            }

            const clearSuccess = await this.clearRoles(member, interaction.guild!.members);
            if (!clearSuccess) {
                await this.sendErrorMessage(interaction);
                return;
            }

            const newRole = await this.createRole(colorStr as HexColorString, interaction.guild!);
            if (newRole === null) {
                await this.sendErrorMessage(interaction);
                return;
            }

            const setSuccess = await this.setRole(newRole, member.id, interaction.guild!.members);
            if (!setSuccess) {
                await this.sendErrorMessage(interaction);
                return;
            }

            await interaction.reply({ embeds: [
                new EmbedBuilder()
                    .setTitle("Success")
                    .setDescription(`Set ${member}'s color to ${colorStr}`)
                    .setColor(parseInt(colorStr.substring(1), 16))
            ]});

            console.log("[ColorMe] handleSet() success");
        } catch (error) {
            console.error(`[ColorMe] Error in handleSet(): ${error}`);
            await this.sendErrorMessage(interaction, error);
        }
    }

    checkContrastHandler(colorStr: string): string[] {
        let bad: string[] = [];
        if (this.config.contrastTheme === DiscordThemes.Both) {
            bad = bad.concat(this.checkContrastTheme(colorStr, DiscordThemes.Dark));
            bad = bad.concat(this.checkContrastTheme(colorStr, DiscordThemes.Light));
        } else {
            bad = bad.concat(this.checkContrastTheme(colorStr, this.config.contrastTheme));
        }

        return bad;
    }

    checkContrastTheme(colorStr: string, theme: DiscordThemes): string[] {
        const bad = [];
        const color = colorStr.substring(1);

        let chat: string, members: string;
        if (theme === DiscordThemes.Light) {
            chat = ColorMeBot.LIGHT_CHAT;
            members = ColorMeBot.LIGHT_MEM_LIST;
        } else {
            chat = ColorMeBot.DARK_CHAT;
            members = ColorMeBot.DARK_MEM_LIST;
        }

        const chatContrast = contrastRatio(color, chat);
        const memContrast = contrastRatio(color, members);
        console.log(`[ColorMe] ${theme} theme chat contrast ratio with ${colorStr} is ${chatContrast}`);
        console.log(`[ColorMe] ${theme} theme members list contrast ratio with ${colorStr} is ${memContrast}`);

        if (chatContrast < this.config.contrastMin) {
            bad.push(`${theme} theme chat contrast ratio is ${chatContrast.toFixed(2)}`);
        }

        if (memContrast < this.config.contrastMin) {
            bad.push(`${theme} theme members list contrast ratio is ${memContrast.toFixed(2)}`);
        }

        return bad;
    }

    async handleClear(interaction: ChatInputCommandInteraction): Promise<void> {
        try {
            const member = interaction.member as GuildMember;
            console.log(`[ColorMe] Got clear subcommand from member ${member}`);
            const result = await this.clearRoles(member, interaction.guild!.members);
            if (!result) {
                await this.sendErrorMessage(interaction);
                return;
            }

            await interaction.reply({ embeds: [
                new EmbedBuilder()
                    .setTitle("Success")
                    .setDescription(`Cleared all ${this.config.prefix} roles for ${member}`)
                    .setColor(0x00FF00)
            ]});

            console.log("[ColorMe] handleClear() success");
        } catch (error) {
            console.error(`[ColorMe] Error in handleClear(): ${error}`);
            await this.sendErrorMessage(interaction, error);
        }
    }

    /**
     * Tries to find a color bot role
     * @param colorStr The color string to find
     * @param guild The discord.js Guild
     * @returns Role if found, null if not
     */
    async findRole(colorStr: string, guild: Guild): Promise<Role | null> {
        const roleName = this.config.prefix + colorStr;

        try {
            const role = guild.roles.cache.find((val) => val.name === roleName);
            if (role === undefined) {
                return null;
            }

            console.log(`[ColorMe] Found role: ${roleName}`);
            return role;
        } catch (error) {
            console.error(`[ColorMe] Error while finding role: ${error}`);
            return null;
        }
    }

    /**
     * Creates a role if not found
     * @param colorStr The color string to create
     * @param guild The Guild
     * @returns The Role if found or created, null if not
     */
    async createRole(colorStr: HexColorString, guild: Guild): Promise<Role | null> {
        const roleName = this.config.prefix + colorStr;

        try {
            const existingRole = await this.findRole(colorStr, guild);
            if (existingRole !== null) {
                return existingRole;
            }

            const newRoleData: RoleCreateOptions = {
                name: roleName,
                color: colorStr,
                hoist: false,
                position: Number.MAX_SAFE_INTEGER,
                permissions: undefined,
                mentionable: false
            };

            const newRole = await guild.roles.create(newRoleData);
            return newRole;
        } catch (err) {
            console.error(`[ColorMe] Error while creating role: ${err}`);
            return null;
        }
    }

    async setRole(role: Role, memberId: string, manager: GuildMemberManager): Promise<boolean> {
        try {
            await manager.addRole({
                user: memberId,
                role: role
            });
            return true;
        } catch (err) {
            console.error(`[ColorMe] Error while setting role: ${err}`);
            return false;
        }
    }

    /**
     * Clears all color roles from a member, and then deletes the role if there are no more members.
     * @param member The member
     * @returns true if deletion was successful, false if failed.
     */
    async clearRoles(member: GuildMember, manager: GuildMemberManager): Promise<boolean> {
        try {
            const role = member.roles.cache.find((val) => val.name.startsWith(this.config.prefix));
            if (role === undefined) {
                return true;
            }

            const roleId = role.id;
            await manager.removeRole({
                user: member.id,
                role: roleId
            });

            const oldRole = await member.guild.roles.fetch(roleId);
            if (oldRole !== null &&
                (oldRole.members.size === 0
                    || (oldRole.members.size === 1 && oldRole.members.has(member.id)))) {
                await role.delete();
            }

            return true || await this.clearRoles(member, manager);
        } catch (err) {
            console.error(`[ColorMe] Error while clearing role: ${err}`);
            return false;
        }
    }

    /**
     * Replies to the interaction with an error message. Tries to figure out what to print.
     * @param interaction The discord.js CommandInteraction
     * @param error The error. Could be typeof Error, string, or null.
     */
    async sendErrorMessage(interaction: CommandInteraction, error: unknown = null): Promise<void> {
        let description = "Error while setting color. Bot owner should check the logs.";
        if (error instanceof Error) {
            description = error.message;
        } else if (typeof error === "string") {
            description = error;
        }

        await interaction.reply({ embeds: [
            new EmbedBuilder()
                .setTitle("Error")
                .setDescription(description)
                .setColor(0xFF0000)
        ]});
    }
}

export default new ColorMeBot();

const rgbRegex = /^#[0-9A-F]{6}$/i; // match #, then six hex digits

type Rgb = {
    red: number,
    green: number,
    blue: number
}

/**
 * Validates a color string in the specific format #RRGGBB.
 * @param hexStr The hex string
 * @returns True if valid, false if not
 */
export function validateHexColorString(hexStr: string): boolean {
    if (hexStr.length !== 7) { // include the pound sign
        return false;
    }

    return rgbRegex.test(hexStr);
}

/**
 * Calculates the contrast ratio between color1 and color2.
 * Math from {@link https://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef}
 * @param color1Str The first color as a hex string
 * @param color2Str The second color as a hex string
 * @returns The calculated contrast ratios
 */
export function contrastRatio(color1Str: string, color2Str: string): number {
    const color1L = relativeLuminance(color1Str);
    const color2L = relativeLuminance(color2Str);

    const L1 = Math.max(color1L, color2L);
    const L2 = Math.min(color1L, color2L);

    const contrast = (L1 + 0.05) / (L2 + 0.05);

    return contrast;
}

/**
 * Converts a hex string and converts it to a object with RGB
 * @param rgbStr The hex string
 * @returns The RGB object
 */
function rgbStrToObj(rgbStr: string): Rgb {
    const red = parseInt(rgbStr.substring(0, 2), 16);
    const green = parseInt(rgbStr.substring(2, 4), 16);
    const blue = parseInt(rgbStr.substring(4, 6), 16);

    return {
        red: red,
        green: green,
        blue: blue
    };
}

/**
 * ?????
 * Math from {@link https://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef}
 * @param num
 * @returns
 */
function srgbHigh(num: number): number {
    return Math.pow((num + 0.055) / 1.055, 2.4);
}

/**
 * Calculates the relative brightness of a color in the SRGB colorspace.
 * Math from {@link https://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef}
 * @param rgbStr Hex RGB string
 * @returns The calculated relative brightness
 */
function relativeLuminance(rgbStr: string): number {
    const srgbThresh = 0.03928;
    const srgbLow = 1 / 12.92;

    const rgb = rgbStrToObj(rgbStr);

    const r_srgb = rgb.red / 255;
    const g_srgb = rgb.green / 255;
    const b_srgb = rgb.blue / 255;

    let red, green, blue;

    if (r_srgb <= srgbThresh) {
        red = r_srgb * srgbLow;
    } else {
        red = srgbHigh(r_srgb);
    }

    if (g_srgb <= srgbThresh) {
        green = g_srgb * srgbLow;
    } else {
        green = srgbHigh(g_srgb);
    }

    if (b_srgb <= srgbThresh) {
        blue = b_srgb * srgbLow;
    } else {
        blue = srgbHigh(b_srgb);
    }

    red *= 0.2126;
    green *= 0.7152;
    blue *= 0.0722;

    return red + green + blue;
}

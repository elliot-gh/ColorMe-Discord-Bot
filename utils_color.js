/*
 * File name: utils_color.js
 * Description: Handles calculating contrast ratio.
 */

module.exports = {
    // takes a hex string and converts it to an object with parsed rgb
    rgbStrToObj: function(rgbStr) {
        let r = parseInt(rgbStr.substring(0, 2), 16);
        let g = parseInt(rgbStr.substring(2, 4), 16);
        let b = parseInt(rgbStr.substring(4, 6), 16);

        return {
            'r': r,
            'g': g,
            'b': b
        };
    },

    // https://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
    relativeLuminance: function(rgbStr) {
        const srgbThresh = 0.03928;
        const srgbLow = 1 / 12.92;
        const srgbHigh = function(num) {
            return Math.pow((num + 0.055) / 1.055, 2.4);
        };

        let rgb = this.rgbStrToObj(rgbStr);

        let r_srgb = rgb.r / 255;
        let g_srgb = rgb.g / 255;
        let b_srgb = rgb.b / 255;

        let r, g, b;

        if (r_srgb <= srgbThresh) {
            r = r_srgb * srgbLow;
        } else {
            r = srgbHigh(r_srgb);
        }

        if (g_srgb <= srgbThresh) {
            g = g_srgb * srgbLow;
        } else {
            g = srgbHigh(g_srgb);
        }

        if (b_srgb <= srgbThresh) {
            b = b_srgb * srgbLow;
        } else {
            b = srgbHigh(b_srgb);
        }

        r *= 0.2126;
        g *= 0.7152;
        b *= 0.0722;

        return r + g + b;
    },

    // https://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef
    contrastRatio: function(color1Str, color2Str, decimals) {
        let color1L = this.relativeLuminance(color1Str);
        let color2L = this.relativeLuminance(color2Str);

        let L1 = Math.max(color1L, color2L);
        let L2 = Math.min(color1L, color2L);

        let contrast = (L1 + 0.05) / (L2 + 0.05);

        return contrast.toFixed(decimals);
    }
};

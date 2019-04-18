/**
 * We avoid returning full 0 from any rule, because that wipes out the tuner's
 * ability to adjust its impact by raising it to a power. .08 is big enough
 * that raising it to an annealer-accessible 1/6 power gets it up to a
 * respectable .65.
 */
const ZEROISH = .08;
/**
 * Likewise, .9 is low enough that raising it to 5 gets us down to .53. This is
 * a pretty arbitrary selection. I feel like ZEROISH and ONEISH should be
 * symmetric in some way, but it's not obvious to me how. If they're equal
 * distances from the extremes at ^(1/4) and ^4, for example, they won't be at
 * ^(1/5) and ^5. So I expect we'll revisit this.
 */
const ONEISH = .9;

/**
 * Scale a number to the range [ZEROISH, ONEISH].
 *
 * For a rising trapezoid, the result is ZEROISH until the input
 * reaches zeroAt, then increases linearly until oneAt, at which it
 * becomes ONEISH. To make a falling trapezoid, where the result is
 * ONEISH to the left and ZEROISH to the right, use a zeroAt greater
 * than oneAt.
 */
function trapezoid(number, zeroAt, oneAt) {
    const isRising = zeroAt < oneAt;
    if (isRising) {
        if (number <= zeroAt) {
            return ZEROISH;
        } else if (number >= oneAt) {
            return ONEISH;
        }
    } else {
        if (number >= zeroAt) {
            return ZEROISH;
        } else if (number <= oneAt) {
            return ONEISH;
        }
    }
    const slope = (ONEISH - ZEROISH) / (oneAt - zeroAt);
    return slope * (number - zeroAt) + ZEROISH;
}

// returns a logistic function. Ideally we should input the growth rate as
// a hyperparameter from the optimization
function logisticFuncGenerator(maxVal, xMid, growthRate, yInt = 0){
    return x=> ((maxVal)/(1+Math.exp(-1*growthRate*(x-xMid)))+yInt);
}

/**
 * Return the extracted [r, g, b, a] values from a string like "rgba(0, 5, 255, 0.8)",
 * and scale them to 0..1. If no alpha is specified, return undefined for it.
 */
function rgbaFromString(str) {
    const m = str.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d+(?:\.\d+)?)\s*)?\)$/i);
    if (m) {
        return [m[1] / 255, m[2] / 255, m[3] / 255, m[4] === undefined ? undefined : parseFloat(m[4])];
    } else {
        throw new Error("Color " + str + " did not match pattern rgb[a](r, g, b[, a]).");
    }
}

/**
 * Return the saturation 0..1 of a color defined by RGB values 0..1.
 */
function saturation(r, g, b) {
    const cMax = Math.max(r, g, b);
    const cMin = Math.min(r, g, b);
    const delta = cMax - cMin;
    const lightness = (cMax + cMin) / 2;
    const denom = (1 - (Math.abs(2 * lightness - 1)));
    // Return 0 if it's black (R, G, and B all 0).
    return (denom === 0) ? 0 : delta / denom;
}

function getMaxZIndex() {
     return Array.from(document.querySelectorAll('body *'))
           .map(a => parseFloat(window.getComputedStyle(a).zIndex))
           .filter(a => !isNaN(a))
           .sort()
           .pop();
}

export {
    trapezoid as trapezoid, 
    logisticFuncGenerator as logisticFuncGenerator,
    getMaxZIndex as getMaxZIndex,
    rgbaFromString as rgba,
    saturation as saturation,
    ONEISH as ONEISH, 
    ZEROISH as ZEROISH
};
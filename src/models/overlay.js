import {ruleset, rule, dom, type, score, out} from 'fathom-web';
import {ancestors} from 'fathom-web/utilsForFrontend';
import * as util from './utils.js';

const bigGenerator = (fnode) => {
    // Compare the size of the fnode to the size of the viewport. So far, spot-
    // checking shows the overlay is never the size of the whole document, just
    // the viewport.
    const rect = fnode.element.getBoundingClientRect();
    const hDifference = Math.abs(rect.height - window.innerHeight);
    const wDifference = Math.abs(rect.width - window.innerWidth);
    return util.trapezoid(hDifference + wDifference, 250, 0);  
    // 250px is getting into "too tall to just be nav or something" territory.
}

const nearlyOpaqueGenerator = (fnode) => {
    const style = getComputedStyle(fnode.element);
    const opacity = parseFloat(style.getPropertyValue('opacity'));
    let bgColorAlpha = util.rgba(style.getPropertyValue('background-color'))[3];
    if (bgColorAlpha === undefined) {
        bgColorAlpha = 1;
    }
    const totalOpacity = opacity * bgColorAlpha;
    let ret;
    if (totalOpacity === 1) {  // seems to work even though a float
        ret = util.ZEROISH;
    } else {
        ret = util.trapezoid(totalOpacity, .4, .6);
    }
    return ret;
}

const monochromeGenerator = (fnode) => {
    const rgba = util.rgba(getComputedStyle(fnode.element).getPropertyValue('background-color'));
    return util.trapezoid(1 - util.saturation(...rgba), .96, 1);
}

// *
//  * Score hidden things real low.
//  *
//  * For training, this avoids false failures (and thus gives us more
//  * accurate accuracy numbers) since some pages have multiple
//  * popups, all but one of which are hidden in our captures.
//  * However, for actual use, consider dropping this rule, since
//  * deleting popups before they pop up may not be a bad thing.
 
const visibleGenerator=(fnode) => {
    const element = fnode.element;
    for (const ancestor of ancestors(element)) {
        const style = getComputedStyle(ancestor);
        if (style.getPropertyValue('visibility') === 'hidden' ||
            style.getPropertyValue('display') === 'none') {
            return util.ZEROISH ;
        }
        // Could add opacity and size checks here, but the
        // "nearlyOpaque" and "big" rules already deal with opacity
        // and size. If they don't do their jobs, maybe repeat
        // their work here (so it gets a different coefficient).
    }
    return util.ONEISH;
}

const susWordGen = (fnode, keywords) => { 
    const element = fnode.element;
    const attributeNames = ['class', 'id'];
    let numOccurences = 0;
    function numberOfSuspiciousSubstrings(value, keywords) {
        return keywords.map(x=>value.includes(x)).reduce((x,y)=>{return x+y;})
    }

    for (const name of attributeNames) {
        let values = element.getAttribute(name);
        if (values) {
            if (!Array.isArray(values)) {
                values = [values];
            }
            for (const value of values) {
                numOccurences += numberOfSuspiciousSubstrings(value, keywords);
            }
        }
    }
    return (-((.3 + util.ZEROISH) ** (numOccurences + .1685)) + util.ONEISH);
}

const overlayModel = {coeffs: [2, 1, 3, 1, 1],  // 93.8% training-set accuracy with exponentiation-based weights

 // viewportSize: {width: 1024, height: 768},
 //
 // The content-area size to use while training. Defaults to 1024x768.

 // successFunction: (facts, traineeId) => trueOrFalse,
 //
 // By default, elements with a data-fathom attribute that matches the
 // trainee ID are considered a successful find for the ruleset.
 //
 // The successFunction property allows for alternative success
 // functions. A success function receives two arguments--a BoundRuleset
 // and the current trainee ID--and returns whether the ruleset succeeded.
 //
 // The default function for this example ruleset is essentially...
 // successFunction: facts.get('overlay')[0].element.dataset.fathom === 'overlay'

 rulesetMaker:
    function ([coeffBig, coeffNearlyOpaque, coeffMonochrome, coeffClassOrId, coeffVisible]) {
        /**
         * Return whether the passed-in div is the size of the whole viewport/document
         * or nearly so.
         */
        function big(fnode){return bigGenerator(fnode) ** coeffBig;}

        /**
         * Return whether the fnode is almost but not entirely opaque.
         */
        function nearlyOpaque(fnode) {return nearlyOpaqueGenerator(fnode) ** coeffNearlyOpaque;}

        /**
         * Return whether the fnode's bgcolor is nearly black or white.
         */
        function monochrome(fnode) {return monochromeGenerator(fnode) ** coeffMonochrome;}

        function suspiciousClassOrId(fnode) {
            return susWordGen(fnode, ['popup','modal','overlay','underlay','backdrop']) ** coeffClassOrId;
        }

        // Score hidden things real low.
        function visible(fnode) {return visibleGenerator(fnode) ** coeffVisible;}

        /* The actual ruleset */
        const rules = ruleset(
            rule(dom('div'), type('overlay')),
            rule(type('overlay'), score(big)),
            rule(type('overlay'), score(nearlyOpaque)),
            rule(type('overlay'), score(monochrome)),
            rule(type('overlay'), score(suspiciousClassOrId)),
            rule(type('overlay'), score(visible)),
            rule(type('overlay').max(), out('overlay'))
        );
        return rules;
    }
};

export default overlayModel;

export {
    bigGenerator as bigGenerator, 
    nearlyOpaqueGenerator as nearlyOpaqueGenerator, 
    monochromeGenerator as monochromeGenerator,
    susWordGen as susWordGen,
    visibleGenerator as visibleGenerator
};
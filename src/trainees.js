import {ruleset, rule, dom, type, score, out} from 'fathom-web';
import {ancestors} from 'fathom-web/utilsForFrontend';


/**
 * Rulesets to train.
 */
const trainees = new Map();


trainees.set(
    'popUp',
    {coeffs: [2,2,1,2,2],  

     rulesetMaker:
        function ([coeffAncestorArea, coeffForm, coeffClassOrId, coeffCentered, coeffButton]) {

            const ZEROISH = .08;
            const ONEISH = .9;


            function largeAncestor(fnode) {
                const element = fnode.element;
                const ancestor = element.parentElement;

                const elementRect = element.getBoundingClientRect();
                const ancestorRect = ancestor.getBoundingClientRect();

                const elementArea = elementRect.width * elementRect.height;
                const ancestorArea = ancestorRect.width * ancestorRect.height;

                const windowArea = window.innerWidth * window.innerHeight;
                const areaDiff = ancestorArea - elementArea;

                return (trapezoid(areaDiff, 0, windowArea)+1) ** coeffAncestorArea;
            }

            function isCentered(fnode) {
                const element = fnode.element;
                const rect = element.getBoundingClientRect();

                const leftDiff = rect.x;
                const rightDiff = window.innerWidth - rect.x - rect.width;

                const ratio = Math.min(leftDiff, rightDiff)/Math.max(leftDiff, rightDiff);

                const logisticFunction = logisticFuncGenerator(1,0.8, 30, 1);
                return logisticFunction(ratio) ** coeffCentered;
            }

            // exponentially decrease each level's score multiplier
            function containsForm(fnode) {
                const element = fnode.element;
                let queue = [element];
                let formMultiplier = 1;

                for (let i = 1; i < 5; i++){
                    let nextQueue = [];
                    while (queue.length > 0){
                        let e = queue.pop();
                        nextQueue = nextQueue.concat(Array.from(e.children));
                        if (e.nodeName === "FORM"){
                            formMultiplier = formMultiplier * (1+coeffForm/i);
                        }
                    }
                    queue = nextQueue;
                }
                return formMultiplier;
            }


            function suspiciousClassOrId(fnode) {
                const element = fnode.element;
                const attributeNames = ['class', 'id'];
                let numOccurences = 0;
                function numberOfSuspiciousSubstrings(value) {
                    return value.includes('popup') + value.includes('subscription') + value.includes('newsletter')+ value.includes('modal');
                }

                for (const name of attributeNames) {
                    let values = element.getAttribute(name);
                    if (values) {
                        if (!Array.isArray(values)) {
                            values = [values];
                        }
                        for (const value of values) {
                            numOccurences += numberOfSuspiciousSubstrings(value);
                        }
                    }
                }
                
                const logisticFunction = logisticFuncGenerator(2,0,coeffClassOrId);
                return logisticFunction(numOccurences);
            }

            function buttons(fnode) {
                // make more specific queryselector
                let descendants = Array.from(fnode.element.querySelectorAll("*"));
                let buttonCounter = 0;
                for (const d of descendants){
                    if(d.nodeName === "INPUT") {
                        buttonCounter += 1;
                    }
                }
                return (buttonCounter > 4) ? 1 + 1/buttonCounter : buttonCounter;
            }

            

            /* Utility procedures */

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

            /* The actual ruleset */

            const rules = ruleset(
                rule(dom('div'), type('popUp')),
                rule(dom('form'), type('popUp')),
                rule(type('popUp'), score(largeAncestor)),
                rule(type('popUp'), score(suspiciousClassOrId)),
                rule(type('popUp'), score(containsForm)),
                rule(type('popUp'), score(isCentered)),
                // rule(type('popUp'), score(buttons)),
                rule(type('popUp').max(), out('popUp'))
            );
            return rules;
        }
    }
);

trainees.set(
    // A ruleset that finds the close button associated with a pop-up
    'closeButton',
    {coeffs: [1,1,1,1,1,1,1,1],

     rulesetMaker:

        function ([coeffSmall, coeffSquare, coeffTopHalfPage, coeffAbsolutePosition, coeffCloseString, coeffModalString, coeffHiddenString, coeffVisible]) {
            
            const ZEROISH = .08;
            
            const ONEISH = .9;

            function small(fnode) {
                const rect = fnode.element.getBoundingClientRect();
                const size = Math.abs(rect.height + rect.width);
                const lowerBound = 25;
                const upperBound = 150;

                return ((size >= lowerBound && size <= upperBound) ? ONEISH : ZEROISH) ** coeffSmall;
            }

            function square(fnode) {
                const rect = fnode.element.getBoundingClientRect();
                const lowerBound = 0.5;
                const upperBound = 1;
                const smallDim = Math.min(rect.height, rect.width);
                const largeDim = Math.max(rect.height, rect.width);

                if (smallDim <= 0 || largeDim <= 0)
                    return ZEROISH ** coeffSquare;

                const ratio = smallDim / largeDim;

                return trapezoid(ratio, lowerBound, upperBound) ** coeffSquare;
            }

            // Function isn't working; How can I tell the diference between a 'div' and 'button' tag?
            function onClick(fnode) {
                //console.log(fnode.element.tagName == 'button');
                return ((fnode.element.hasAttribute("onclick")) ? ONEISH : ZEROISH) ** coeffOnClick;
            }

            function topHalfPage(fnode) {
                const rect = fnode.element.getBoundingClientRect();
                const windowHeight = window.innerHeight;

                return ((rect.top <= windowHeight/2) ? ONEISH : ZEROISH) ** coeffTopHalfPage;
            }
            
            function largeZIndex(fnode) {
                const lowerBound = 0;
                const upperBound = 1000;

                return trapezoid(fnode.element.style.zIndex, lowerBound, upperBound) ** coeffZIndex;
            }

            function absolutePosition(fnode) {
                return ((fnode.element.style.position == "absolute") ? ONEISH : ZEROISH) ** coeffAbsolutePosition;
            }

            /*
            function suspiciousClassOrId(fnode) {
                const element = fnode.element;
                const attributeNames = ['class', 'id', 'type'];
                let numOccurences = 0;
                function numberOfSuspiciousSubstrings(value) {
                    return 3*value.includes('close') + value.includes('modal') + value.includes('button');
                }
                for (const name of attributeNames) {
                    let values = element.getAttribute(name);
                    if (values) {
                        if (!Array.isArray(values)) {
                            values = [values];
                        }
                        for (const value of values) {
                            numOccurences += numberOfSuspiciousSubstrings(value);
                        }
                    }
                }
                // Function is Equivalent to 0.9 - 0.38^(0.1685 + numOccurences)
                return (-((.3 + ZEROISH) ** (numOccurences + .1685)) + ONEISH) ** coeffClassOrId;
            }
            */

            function containsClose(fnode) {
                const element = fnode.element;
                const attributeNames = ['class', 'id', 'type'];
                let numOccurences = 0;
                function numberOfSuspiciousSubstrings(value) {
                    return value.includes('close');
                }

                for (const name of attributeNames) {
                    let values = element.getAttribute(name);
                    if (values) {
                        if (!Array.isArray(values)) {
                            values = [values];
                        }
                        for (const value of values) {
                            numOccurences += numberOfSuspiciousSubstrings(value);
                        }
                    }
                }

                // Function is Equivalent to 0.9 - 0.38^(0.1685 + numOccurences)
                return (-((.3 + ZEROISH) ** (numOccurences + .1685)) + ONEISH) ** coeffCloseString;
            }

            function containsModal(fnode) {
                const element = fnode.element;
                const attributeNames = ['class', 'id'];
                let numOccurences = 0;
                function numberOfSuspiciousSubstrings(value) {
                    return value.includes('modal');
                }

                for (const name of attributeNames) {
                    let values = element.getAttribute(name);
                    if (values) {
                        if (!Array.isArray(values)) {
                            values = [values];
                        }
                        for (const value of values) {
                            numOccurences += numberOfSuspiciousSubstrings(value);
                        }
                    }
                }

                // Function is Equivalent to 0.9 - 0.38^(0.1685 + numOccurences)
                return (-((.3 + ZEROISH) ** (numOccurences + .1685)) + ONEISH) ** coeffModalString;
            }

            function containsHidden(fnode) {
                const element = fnode.element;
                const attributeNames = ['class', 'id'];
                let numOccurences = 0;
                function numberOfSuspiciousSubstrings(value) {
                    return value.includes('hidden');
                }

                for (const name of attributeNames) {
                    let values = element.getAttribute(name);
                    if (values) {
                        if (!Array.isArray(values)) {
                            values = [values];
                        }
                        for (const value of values) {
                            numOccurences += numberOfSuspiciousSubstrings(value);
                        }
                    }
                }

                // Function is Equivalent to 0.9 - 0.38^(0.1685 + numOccurences)
                return (-((.3 + ZEROISH) ** (numOccurences + .1685)) + ONEISH) ** coeffHiddenString;
            }

            /*
            function caselessIncludes(haystack, needle) {
                return haystack.toLowerCase().includes(needle);
            }
            function weightedIncludes(haystack, needle, coeff) {
                return (caselessIncludes(haystack, needle) ? ONEISH : ZEROISH) ** coeff;
            }
            function hasCloseInClassName(fnode) {
                return weightedIncludes(fnode.element.className, 'close', coeffHasCloseInClass);
            }
            function hasCloseInID(fnode) {
                return weightedIncludes(fnode.element.id, 'close', coeffHasCloseInID);
            }
            */

            function visible(fnode) {
                const element = fnode.element;
                for (const ancestor of ancestors(element)) {
                    const style = getComputedStyle(ancestor);
                    if (style.getPropertyValue('visibility') === 'hidden' ||
                        style.getPropertyValue('display') === 'none') {
                        return ZEROISH ** coeffVisible;
                    }
                }
                return ONEISH ** coeffVisible;
            }

            /* Utility procedures */

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

            /* The actual ruleset */

            const rules = ruleset(
                rule(dom('div,button,a,i,span'), type('closeButton')),
                rule(type('closeButton'), score(small)),
                rule(type('closeButton'), score(square)),
                //rule(type('closeButton'), score(onClick)),
                rule(type('closeButton'), score(topHalfPage)),
                //rule(type('closeButton'), score(zIndex)),
                rule(type('closeButton'), score(absolutePosition)),
                //rule(type('closeButton'), score(suspiciousClassOrId)),
                rule(type('closeButton'), score(containsClose)),
                rule(type('closeButton'), score(containsModal)),
                rule(type('closeButton'), score(containsHidden)),
                rule(type('closeButton'), score(visible)),
                rule(type('closeButton').max(), out('closeButton'))
            );
            return rules;
        }
    }
);


trainees.set(
    // A ruleset that finds the full-screen, content-blocking overlays that
    // often go behind modal popups
    'overlay',
    {coeffs: [2, 1, 3, 1, 1],  // 93.8% training-set accuracy with exponentiation-based weights

     // viewportSize: {width: 1024, height: 768},
     //
     // The content-area size to use while training. Defaults to 1024x768.

     // successFunction: (facts, traineeId) => trueOrFalse,
     //
     // By default, elements with a `data-fathom` attribute that matches the
     // trainee ID are considered a successful find for the ruleset.
     //
     // The `successFunction` property allows for alternative success
     // functions. A success function receives two arguments--a BoundRuleset
     // and the current trainee ID--and returns whether the ruleset succeeded.
     //
     // The default function for this example ruleset is essentially...
     // successFunction: facts.get('overlay')[0].element.dataset.fathom === 'overlay'

     rulesetMaker:
        // I don't think V8 is smart enough to compile this once and then sub in
        // new coeff values. I'm not sure about Spidermonkey. We may want to
        // optimize by rolling it into a class and storing coeffs explicitly in an
        // instance var. [Nope, Spidermonkey does it as efficiently as one could
        // hope, with just a {code, pointer to closure scope} pair.]
        function ([coeffBig, coeffNearlyOpaque, coeffMonochrome, coeffClassOrId, coeffVisible]) {
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
             * Return whether the passed-in div is the size of the whole viewport/document
             * or nearly so.
             */
            function big(fnode) {
                // Compare the size of the fnode to the size of the viewport. So far, spot-
                // checking shows the overlay is never the size of the whole document, just
                // the viewport.
                const rect = fnode.element.getBoundingClientRect();
                const hDifference = Math.abs(rect.height - window.innerHeight);
                const wDifference = Math.abs(rect.width - window.innerWidth);
                return trapezoid(hDifference + wDifference, 250, 0) ** coeffBig;  // 250px is getting into "too tall to just be nav or something" territory.
            }

            /**
             * Return whether the fnode is almost but not entirely opaque.
             */
            function nearlyOpaque(fnode) {
                const style = getComputedStyle(fnode.element);
                const opacity = parseFloat(style.getPropertyValue('opacity'));
                let bgColorAlpha = rgbaFromString(style.getPropertyValue('background-color'))[3];
                if (bgColorAlpha === undefined) {
                    bgColorAlpha = 1;
                }
                const totalOpacity = opacity * bgColorAlpha;
                let ret;
                if (totalOpacity === 1) {  // seems to work even though a float
                    ret = ZEROISH;
                } else {
                    ret = trapezoid(totalOpacity, .4, .6);
                }
                return ret ** coeffNearlyOpaque;
            }

            /**
             * Return whether the fnode's bgcolor is nearly black or white.
             */
            function monochrome(fnode) {
                const rgba = rgbaFromString(getComputedStyle(fnode.element).getPropertyValue('background-color'));
                return trapezoid(1 - saturation(...rgba), .96, 1) ** coeffMonochrome;
            }

            function suspiciousClassOrId(fnode) {
                const element = fnode.element;
                const attributeNames = ['class', 'id'];
                let numOccurences = 0;
                function numberOfSuspiciousSubstrings(value) {
                    return value.includes('popup') + value.includes('modal') + value.includes('overlay') + value.includes('underlay') + value.includes('backdrop');
                }

                for (const name of attributeNames) {
                    let values = element.getAttribute(name);
                    if (values) {
                        if (!Array.isArray(values)) {
                            values = [values];
                        }
                        for (const value of values) {
                            numOccurences += numberOfSuspiciousSubstrings(value);
                        }
                    }
                }

                // 1 occurrence gets us to about 70% certainty; 2, 90%. It bottoms
                // out at ZEROISH and tops out at ONEISH.
                // TODO: Figure out how to derive the magic number .1685 from
                // ZEROISH and ONEISH.
                return (-((.3 + ZEROISH) ** (numOccurences + .1685)) + ONEISH) ** coeffClassOrId;
            }

            // *
            //  * Score hidden things real low.
            //  *
            //  * For training, this avoids false failures (and thus gives us more
            //  * accurate accuracy numbers) since some pages have multiple
            //  * popups, all but one of which are hidden in our captures.
            //  * However, for actual use, consider dropping this rule, since
            //  * deleting popups before they pop up may not be a bad thing.
             
            function visible(fnode) {
                const element = fnode.element;
                for (const ancestor of ancestors(element)) {
                    const style = getComputedStyle(ancestor);
                    if (style.getPropertyValue('visibility') === 'hidden' ||
                        style.getPropertyValue('display') === 'none') {
                        return ZEROISH ** coeffVisible;
                    }
                    // Could add opacity and size checks here, but the
                    // "nearlyOpaque" and "big" rules already deal with opacity
                    // and size. If they don't do their jobs, maybe repeat
                    // their work here (so it gets a different coefficient).
                }
                return ONEISH ** coeffVisible;
            }

            /* Utility procedures */

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

            /* The actual ruleset */

            const rules = ruleset(
                rule(dom('div'), type('overlay')),
                // Fuzzy AND is multiplication (at least that's the definition we use,
                // since Fathom already implements it and it allows participation of
                // all anded rules.

                // I'm thinking each rule returns a confidence, 0..1, reined in by a sigmoid or trapezoid. 
                //That seems to fit the features I've collected well. I can probably make up most of those coefficients.
                // Then we multiply the final results by a coeff each, for weighting. That will cap our total to the sum of the weights. 
                //We can then scale that sum down to 0..1 if we want, to build upon, by dividing by the product of the weights. 
                //[Actually, that weighting approach doesn't work, since the weights just get counteracted at the end. 
                //What we would need is a geometric mean-like approach, where individual rules' output is raised to a power to express its weight. 
                //Will Fathom's plain linear stuff suffice for now? If we want to keep an intuitive confidence-like meaning for each rule, 
                //we could have the coeffs be the powers each is raised to. I don't see the necessity of taking the root at the end 
                //(unless the score is being used as input to some intuitively meaningful threshold later), though we can outside the ruleset 
                //if we want. Going with a 0..1 confidence-based range means a rule can never boost a score--only add doubt--
                //but I'm not sure that's a problem. If a rule wants to say "IHNI", it can also return 1 and thus not change the product. 
                //(Though they'll add 1 to n in the nth-root. Is that a problem?)] 
                //The optimizer will have to consider fractional coeffs so we can lighten up unduly certain rules.
                rule(type('overlay'), score(big)),
                rule(type('overlay'), score(nearlyOpaque)),
                rule(type('overlay'), score(monochrome)),
                rule(type('overlay'), score(suspiciousClassOrId)),
                rule(type('overlay'), score(visible)),
                rule(type('overlay').max(), out('overlay'))
            );
            return rules;
        }
    }
);

trainees.set(
    'popUp',
    {coeffs: [2,2,1,2,2],  

     rulesetMaker:
        function ([coeffAncestorArea, coeffForm, coeffClassOrId, coeffCentered, coeffButton]) {

            const ZEROISH = .08;
            const ONEISH = .9;


            function largeAncestor(fnode) {
                const element = fnode.element;
                const ancestor = element.parentElement;

                const elementRect = element.getBoundingClientRect();
                const ancestorRect = ancestor.getBoundingClientRect();

                const elementArea = elementRect.width * elementRect.height;
                const ancestorArea = ancestorRect.width * ancestorRect.height;

                const windowArea = window.innerWidth * window.innerHeight;
                const areaDiff = ancestorArea - elementArea;

                return (trapezoid(areaDiff, 0, windowArea)+1) ** coeffAncestorArea;
            }

            function isCentered(fnode) {
                const element = fnode.element;
                const rect = element.getBoundingClientRect();

                const leftDiff = rect.x;
                const rightDiff = window.innerWidth - rect.x - rect.width;

                const ratio = Math.min(leftDiff, rightDiff)/Math.max(leftDiff, rightDiff);

                const logisticFunction = logisticFuncGenerator(1,0.8, 30, 1);
                return logisticFunction(ratio) ** coeffCentered;
            }

            // exponentially decrease each level's score multiplier
            function containsForm(fnode) {
                const element = fnode.element;
                let queue = [element];
                let formMultiplier = 1;

                for (let i = 1; i < 5; i++){
                    let nextQueue = [];
                    while (queue.length > 0){
                        let e = queue.pop();
                        nextQueue = nextQueue.concat(Array.from(e.children));
                        if (e.nodeName === "FORM"){
                            formMultiplier = formMultiplier * (1+coeffForm/i);
                        }
                    }
                    queue = nextQueue;
                }
                return formMultiplier;
            }


            function suspiciousClassOrId(fnode) {
                const element = fnode.element;
                const attributeNames = ['class', 'id'];
                let numOccurences = 0;
                function numberOfSuspiciousSubstrings(value) {
                    return value.includes('popup') + value.includes('subscription') + value.includes('newsletter')+ value.includes('modal');
                }

                for (const name of attributeNames) {
                    let values = element.getAttribute(name);
                    if (values) {
                        if (!Array.isArray(values)) {
                            values = [values];
                        }
                        for (const value of values) {
                            numOccurences += numberOfSuspiciousSubstrings(value);
                        }
                    }
                }
                
                const logisticFunction = logisticFuncGenerator(2,0,coeffClassOrId);
                return logisticFunction(numOccurences);
            }

            function buttons(fnode) {
                // make more specific queryselector
                let descendants = Array.from(fnode.element.querySelectorAll("*"));
                let buttonCounter = 0;
                for (const d of descendants){
                    if(d.nodeName === "INPUT") {
                        buttonCounter += 1;
                    }
                }
                return (buttonCounter > 4) ? 1 + 1/buttonCounter : buttonCounter;
            }

            

            /* Utility procedures */

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

            /* The actual ruleset */

            const rules = ruleset(
                rule(dom('div'), type('popUp')),
                rule(dom('form'), type('popUp')),
                rule(type('popUp'), score(largeAncestor)),
                rule(type('popUp'), score(suspiciousClassOrId)),
                rule(type('popUp'), score(containsForm)),
                rule(type('popUp'), score(isCentered)),
                // rule(type('popUp'), score(buttons)),
                rule(type('popUp').max(), out('popUp'))
            );
            return rules;
        }
    }
)

export default trainees;

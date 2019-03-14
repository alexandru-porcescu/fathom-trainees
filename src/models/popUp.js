import {ruleset, rule, dom, type, score, out} from 'fathom-web';
import {ancestors} from 'fathom-web/utilsForFrontend';
import {euclidean} from 'fathom-web/clusters';

const popUpModel = {
    coeffs: [
    2,
    1,
    3,
    5,
    8,
    1],  

     rulesetMaker:
        function ([
            coeffAncestorArea,
            coeffAncestorRelArea,
            coeffForm, 
            coeffClassOrId, 
            coeffCentered,
            coeffIsNearOverlay]) {

            const ZEROISH = .08;
            const ONEISH = .9;
            let coeffBigOverlay = 2;
            let coeffNearlyOpaqueOverlay = 1;
            let coeffMonochromeOverlay = 3;
            let coeffClassOrIdOverlay =1;
            let coeffVisibleOverlay =1;

            function bigOverlay(fnode) {
                // Compare the size of the fnode to the size of the viewport. So far, spot-
                // checking shows the overlay is never the size of the whole document, just
                // the viewport.
                const rect = fnode.element.getBoundingClientRect();
                const hDifference = Math.abs(rect.height - window.innerHeight);
                const wDifference = Math.abs(rect.width - window.innerWidth);
                return trapezoid(hDifference + wDifference, 250, 0) ** coeffBigOverlay;  // 250px is getting into "too tall to just be nav or something" territory.
            }

            function nearlyOpaqueOverlay(fnode) {
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
                return ret ** coeffNearlyOpaqueOverlay;
            }           

            function monochromeOverlay(fnode) {
                const rgba = rgbaFromString(getComputedStyle(fnode.element).getPropertyValue('background-color'));
                return trapezoid(1 - saturation(...rgba), .96, 1) ** coeffMonochromeOverlay;
            }    

            function suspiciousClassOrIdOverlay(fnode) {
                const element = fnode.element;
                const attributeNames = ['class', 'id'];
                let numOccurences = 0;
                function numberOfSuspiciousSubstrings(value) {
                    // return value.includes('popup') + value.includes('modal');
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
                return (-((.3 + ZEROISH) ** (numOccurences + .1685)) + ONEISH) ** coeffClassOrIdOverlay;
            }       
            function visibleOverlay(fnode) {
                const element = fnode.element;
                for (const ancestor of ancestors(element)) {
                    const style = getComputedStyle(ancestor);
                    if (style.getPropertyValue('visibility') === 'hidden' ||
                        style.getPropertyValue('display') === 'none') {
                        return ZEROISH ** coeffVisibleOverlay;
                    }
                    // Could add opacity and size checks here, but the
                    // "nearlyOpaque" and "big" rules already deal with opacity
                    // and size. If they don't do their jobs, maybe repeat
                    // their work here (so it gets a different coefficient).
                }
                return ONEISH ** coeffVisibleOverlay;
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
            function linearScale(number, zeroAt, oneAt) {
                const isRising = zeroAt < oneAt;
                if (isRising) {
                    if (number <= zeroAt) {
                        return ZEROISH;
                    }
                    if (number >= oneAt) {
                        return ONEISH;
                    }
                } else {
                    if (number >= zeroAt) {
                        return ZEROISH;
                    }
                    if (number <= oneAt) {
                        return ONEISH;
                    }
                }
                const slope = (ONEISH - ZEROISH) / (oneAt - zeroAt);
                return slope * (number - zeroAt) + ZEROISH;
            }


            function isNearOverlay(fnode) {
                const overlayFnode = getHighestScoringOverlay(fnode); 
                return linearScale(euclidean(fnode, overlayFnode), 1000, 0) ** coeffIsNearOverlay;
            }
            function getHighestScoringOverlay(fnode) {
                return fnode._ruleset.get('overlay')[0]; 
            }

            // might be good for sigmoid (i.e. at least 100 pixels diff to a fnode's container)
            function largeAncestor(fnode) {
                const element = fnode.element;
                const ancestor = element.parentElement;

                const elementRect = element.getBoundingClientRect();
                const ancestorRect = ancestor.getBoundingClientRect();

                const elementArea = elementRect.width * elementRect.height;
                const ancestorArea = ancestorRect.width * ancestorRect.height;

                const windowArea = window.innerWidth * window.innerHeight;
                const areaDiff = ancestorArea - elementArea;

                return (trapezoid(areaDiff, 0, windowArea)) ** coeffAncestorArea;
            }

            function largestAncestorRel(fnode){
                const element = fnode.element;
                const ancestor = element.parentElement;

                const elementRect = element.getBoundingClientRect();
                const ancestorRect = ancestor.getBoundingClientRect();

                const elementArea = elementRect.width * elementRect.height;
                const ancestorArea = ancestorRect.width * ancestorRect.height;

                const windowArea = window.innerWidth * window.innerHeight;
                const areaDiff = ancestorArea - elementArea;

                return (trapezoid(areaDiff, 0, ancestorArea)) ** coeffAncestorRelArea;
            }

            // TODO: try making a 1D growth comparator

            // TODO: position = absolute or fixed
            // TODO: align items: centered

            // TODO: try z-index again

            // TODO: try border

            // TODO: click in the middle of the page, make a note on it, and maybe try to traverse to it 
            //document.element.frompoint

            function isCentered(fnode) {
                const element = fnode.element;
                const rect = element.getBoundingClientRect();

                // use centerpoint of element instead

                const leftDiff = rect.x;
                //use rect.right
                const rightDiff = window.innerWidth - rect.x - rect.width;

                const ratio = Math.min(leftDiff, rightDiff)/Math.max(leftDiff, rightDiff);

                //maxVal, xMid, growthRate, yInt = 0)
                const logisticFunction = logisticFuncGenerator(1,0.8, 30, 0);
                return logisticFunction(ratio) ** coeffCentered;
            }

            function containsForm(fnode) {
                const element = fnode.element;

                const logisticFn = logisticFuncGenerator(1, 5, 10);

                let forms = document.forms;
                let candidates = [];
                for (var i = 0; i < forms.length; i++) {
                    let j = 0;
                    for (const ancestor of ancestors(forms[i])) {
                        if (ancestor == element){
                            candidates.push(j);
                            break;
                        }
                        j++;
                    }
                }

                return (candidates.length < 1) ? ZEROISH :  (1-logisticFn(Math.min(candidates))) ** coeffForm;
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
                rule(type('popUp'), score(isNearOverlay)),

                rule(type('popUp').max(), out('popUp')),

                rule(dom('div'), type('overlay')),
                rule(type('overlay'), score(bigOverlay)),
                rule(type('overlay'), score(nearlyOpaqueOverlay)),
                rule(type('overlay'), score(monochromeOverlay)),
                rule(type('overlay'), score(suspiciousClassOrIdOverlay)),
                rule(type('overlay'), score(visibleOverlay)),
                rule(type('overlay').max(), out('overlay'))
            );
            return rules;
        }
};

export default popUpModel;
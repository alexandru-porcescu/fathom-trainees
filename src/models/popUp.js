import {ruleset, rule, dom, type, score, out} from 'fathom-web';
import {ancestors} from 'fathom-web/utilsForFrontend';
import {euclidean} from 'fathom-web/clusters';
import * as overlay from './overlay.js';
import * as util from './utils.js';

const popUpModel = {
    coeffs: [
    3,
    6,
    2,
    3,
    4,
    0,
    0,
    0,
    -4],  

     rulesetMaker:
        function ([
            coeffAncestorArea,
            coeffAncestorRelArea,
            coeffForm, 
            coeffClassOrId, 
            coeffCentered,
            coeffIsNearOverlay,
            coeffAbsolutePosition,
            coeffZIndex,
            coeffContainedByOverlay]) {

            const ZEROISH = .08;
            const ONEISH = .9;
            let coeffBigOverlay = 2;
            let coeffNearlyOpaqueOverlay = 1;
            let coeffMonochromeOverlay = 3;
            let coeffClassOrIdOverlay =1;
            let coeffVisibleOverlay =1;

            function bigOverlay(fnode) {return overlay.bigGenerator(fnode) ** coeffBigOverlay;}
            function nearlyOpaqueOverlay(fnode) {return overlay.nearlyOpaqueGenerator(fnode) ** coeffNearlyOpaqueOverlay;}           
            function monochromeOverlay(fnode) {return overlay.monochromeGenerator(fnode) ** coeffMonochromeOverlay;}    
            function suspiciousClassOrIdOverlay(fnode) {return overlay.susWordGen(fnode, ['popup','modal','overlay','underlay','backdrop']) ** coeffClassOrIdOverlay;}
            function visibleOverlay(fnode) {return overlay.visibleGenerator(fnode) ** coeffVisibleOverlay;}
            /* Utility procedures */


            function isNearOverlay(fnode) {
                const overlayFnode = getHighestScoringOverlay(fnode); 
                return util.trapezoid(euclidean(fnode, overlayFnode), 1000, 0) ** coeffIsNearOverlay;
            }

            function containedByOverlay(fnode){
                const popup = fnode.element;                
                const overlayFnode = getHighestScoringOverlay(fnode); 

                const position = popup.compareDocumentPosition(overlayFnode.element);
                if (position & popup.DOCUMENT_POSITION_CONTAINED_BY) {
                    return ONEISH ** coeffContainedByOverlay;
                }

                return ZEROISH ** coeffContainedByOverlay;
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
            function absolutePosition(fnode) {
                return ((fnode.element.style.position == "absolute") ? ONEISH : ZEROISH) ** coeffAbsolutePosition;
            }
            // TODO: align items: centered



            // TODO: try z-index again
            
            function getMaxZIndex() {
                console.log('should only go into this once???');
                 return Array.from(document.querySelectorAll('body *'))
                       .map(a => parseFloat(window.getComputedStyle(a).zIndex))
                       .filter(a => !isNaN(a))
                       .sort()
                       .pop();
            }

            function inheritedZIndex(fnode){
                //maybe use a 'note' in the root element. there's a get root element util function
                if(!window.maxZ){
                    window.maxZ = getMaxZIndex();
                }
                for (const e of ancestors(fnode.element)){
                    if (window.getComputedStyle(e).zIndex !== 'auto'){
                        return trapezoid(window.getComputedStyle(e).zIndex, 0, window.maxZ) ** coeffZIndex;
                    }
                }
                return ZEROISH;
            }
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
                // comparedocumentposition

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
                rule(type('popUp'), score(absolutePosition)),
                rule(type('popUp'), score(inheritedZIndex)),
                rule(type('popUp'), score(isNearOverlay)),
                rule(type('popUp'), score(containedByOverlay)),


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
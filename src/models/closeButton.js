import {ruleset, rule, dom, type, score, out} from 'fathom-web';
import {ancestors} from 'fathom-web/utilsForFrontend';
import {euclidean} from 'fathom-web/clusters';
import * as overlay from './overlay.js';
import * as util from './utils.js';

// const closeButtonModel = {coeffs: [4,0,2,-1,7,1,6,0,5,4],
const closeButtonModel = {coeffs: [5,-2,2,-1,11,3,5,1,3,3],
// const closeButtonModel = {coeffs: [3,0,0,0,0,0,0,0,0],
// const closeButtonModel = {coeffs: [1],

     rulesetMaker:

        function ([
            coeffSmall, 
            coeffSquare,
            coeffTopHalfPage,
            coeffAbsolutePosition,
            coeffCloseString, 
            coeffModalString, 
            coeffHiddenString, 
            coeffSusElementText, 
            coeffVisible,
            coeffInPopup]) {
            
            const ZEROISH = .08;
            
            const ONEISH = .9;


            let coeffBigOverlay = 2;
            let coeffNearlyOpaqueOverlay = 1;
            let coeffMonochromeOverlay = 3;
            let coeffClassOrIdOverlay =1;
            let coeffVisibleOverlay =1;
            
            let coeffAncestorAreaPopup = 3;
            let coeffAncestorRelAreaPopup = 6;
            let coeffFormPopup = 2;
            let coeffClassOrIdPopup = 3;
            let coeffCenteredPopup = 4;
            let coeffIsNearOverlayPopup = 0;
            let coeffAbsolutePositionPopup = 0;
            let coeffZIndexPopup = 0;
            let coeffContainedByOverlayPopup = -4;

            function bigOverlay(fnode) {return overlay.bigGenerator(fnode) ** coeffBigOverlay;}
            function nearlyOpaqueOverlay(fnode) {return overlay.nearlyOpaqueGenerator(fnode) ** coeffNearlyOpaqueOverlay;}           
            function monochromeOverlay(fnode) {return overlay.monochromeGenerator(fnode) ** coeffMonochromeOverlay;}    
            function suspiciousClassOrIdOverlay(fnode) {return overlay.susWordGen(fnode, ['popup','modal','overlay','underlay','backdrop']) ** coeffClassOrIdOverlay;}
            function visibleOverlay(fnode) {return overlay.visibleGenerator(fnode) ** coeffVisibleOverlay;}

            /* Utility procedures */


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


            function isNearOverlayPopup(fnode) {
                const overlayFnode = getHighestScoringOverlay(fnode); 
                return linearScale(euclidean(fnode, overlayFnode), 1000, 0) ** coeffIsNearOverlayPopup;
            }

            function containedByOverlayPopup(fnode){
                const popup = fnode.element;                
                const overlayFnode = getHighestScoringOverlay(fnode); 

                const position = popup.compareDocumentPosition(overlayFnode.element);
                if (position & popup.DOCUMENT_POSITION_CONTAINED_BY) {
                    return ONEISH ** coeffContainedByOverlayPopup;
                }

                return ZEROISH ** coeffContainedByOverlayPopup;
            }

            function getHighestScoringOverlay(fnode) {
                return fnode._ruleset.get('overlay')[0]; 
            }

            // might be good for sigmoid (i.e. at least 100 pixels diff to a fnode's container)
            function largeAncestorPopup(fnode) {
                const element = fnode.element;
                const ancestor = element.parentElement;

                const elementRect = element.getBoundingClientRect();
                const ancestorRect = ancestor.getBoundingClientRect();

                const elementArea = elementRect.width * elementRect.height;
                const ancestorArea = ancestorRect.width * ancestorRect.height;

                const windowArea = window.innerWidth * window.innerHeight;
                const areaDiff = ancestorArea - elementArea;

                return (util.trapezoid(areaDiff, 0, windowArea)) ** coeffAncestorAreaPopup;
            }

            function largeAncestorPopup(fnode){
                const element = fnode.element;
                const ancestor = element.parentElement;

                const elementRect = element.getBoundingClientRect();
                const ancestorRect = ancestor.getBoundingClientRect();

                const elementArea = elementRect.width * elementRect.height;
                const ancestorArea = ancestorRect.width * ancestorRect.height;

                const windowArea = window.innerWidth * window.innerHeight;
                const areaDiff = ancestorArea - elementArea;

                return (util.trapezoid(areaDiff, 0, ancestorArea)) ** coeffAncestorRelAreaPopup;
            }

            // TODO: try making a 1D growth comparator

            // TODO: position = absolute or fixed
            function absolutePositionPopup(fnode) {
                return ((fnode.element.style.position == "absolute") ? ONEISH : ZEROISH) ** coeffAbsolutePositionPopup;
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

            function inheritedZIndexPopup(fnode){
                //maybe use a 'note' in the root element. there's a get root element util function
                if(!window.maxZ){
                    window.maxZ = getMaxZIndex();
                }
                for (const e of ancestors(fnode.element)){
                    if (window.getComputedStyle(e).zIndex !== 'auto'){
                        return util.trapezoid(window.getComputedStyle(e).zIndex, 0, window.maxZ) ** coeffZIndexPopup;
                    }
                }
                return ZEROISH;
            }
            // TODO: try border

            // TODO: click in the middle of the page, make a note on it, and maybe try to traverse to it 
            //document.element.frompoint

            function isCenteredPopup(fnode) {
                const element = fnode.element;
                const rect = element.getBoundingClientRect();

                // use centerpoint of element instead

                const leftDiff = rect.x;
                //use rect.right
                const rightDiff = window.innerWidth - rect.x - rect.width;

                const ratio = Math.min(leftDiff, rightDiff)/Math.max(leftDiff, rightDiff);

                //maxVal, xMid, growthRate, yInt = 0)
                const logisticFunction = logisticFuncGenerator(1,0.8, 30, 0);
                return logisticFunction(ratio) ** coeffCenteredPopup;
            }

            function containsFormPopup(fnode) {
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

                return (candidates.length < 1) ? ZEROISH :  (1-logisticFn(Math.min(candidates))) ** coeffFormPopup;
            }


            function suspiciousClassOrIdPopup(fnode) {
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
                
                const logisticFunction = logisticFuncGenerator(2,0,coeffClassOrIdPopup);
                return logisticFunction(numOccurences);
            }

            function buttonsPopup(fnode) {
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

            function isInPopup(fnode) {
                const e = fnode.element;
                const rect = e.getBoundingClientRect();

                const bestPopup = fnode._ruleset.get('popUp')[0];

                const position = e.compareDocumentPosition(bestPopup.element);
                if (position & e.DOCUMENT_POSITION_CONTAINED_BY) {
                    return ONEISH ** coeffInPopup;
                }

                return ZEROISH ** coeffInPopup;
            }

            function small(fnode) {
                const rect = fnode.element.getBoundingClientRect();
                const size = Math.abs(rect.height + rect.width);
                const lowerBound = 25;
                const upperBound = 125;

                //return trapezoid(size, lowerBound, upperBound) ** coeffSmall
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

                return util.trapezoid(ratio, lowerBound, upperBound) ** coeffSquare;
            }

            function topHalfPage(fnode) {
                const rect = fnode.element.getBoundingClientRect();
                const windowHeight = window.innerHeight;

                return ((rect.top <= windowHeight/2) ? ONEISH : ZEROISH) ** coeffTopHalfPage;
            }
            
            // function largeZIndex(fnode) {
            //     const lowerBound = 0;
            //     const upperBound = 1000;

            //     return trapezoid(window.getComputedStyle(fnode.element).getPropertyValue("z-index"), lowerBound, upperBound) ** coeffZIndex;
            // }

            function absolutePosition(fnode) {
                return ((window.getComputedStyle(fnode.element).getPropertyValue("position") == "absolute") ? ONEISH : ZEROISH) ** coeffAbsolutePosition;
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
                    return value.includes('hidden') + value.includes('continue') + value.includes('decline');
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

            function suspiciousElementText(fnode) {
                const element = fnode.element;
                var childNode = element.childNodes;

                if(childNode.length > 0) {
                    return ((checkForSusText(childNode)) ? ONEISH : ZEROISH) ** coeffSusElementText;
                }

                // if (checkForSusText(element)) {
                //     var childNode = element.firstChild;
                //     console.log("Found in first")
                //     return ((checkForSusText(childNode)) ? ZEROISH : ONEISH) ** coeffSusElementText;
                // }
            }

            function checkForSusText(element) {
                // No child element
                if (element[0].nodeValue == null) {
                    console.log("null")
                    return false;
                }

                const suspiciousStrings = ["no thanks", "don't show again", "close", "exit", "dismiss", "not interested", "not now", "decline"];
                var text = element[0].nodeValue;

                for (const susText of suspiciousStrings) {
                    if (text.toLowerCase().includes(susText)) {
                        console.log(text)
                        return true;
                    }
                }
                return false;
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

            function logisticFuncGenerator(maxVal, xMid, growthRate, yInt = 0){
                return x=> ((maxVal)/(1+Math.exp(-1*growthRate*(x-xMid)))+yInt);
            }


            /* The actual ruleset */

            const rules = ruleset(
                rule(dom('div'), type('popUp')),
                rule(dom('form'), type('popUp')),
                rule(type('popUp'), score(largeAncestorPopup)),
                rule(type('popUp'), score(suspiciousClassOrIdPopup)),
                rule(type('popUp'), score(containsFormPopup)),
                rule(type('popUp'), score(isCenteredPopup)),
                rule(type('popUp'), score(absolutePositionPopup)),
                rule(type('popUp'), score(inheritedZIndexPopup)),
                rule(type('popUp'), score(isNearOverlayPopup)),
                rule(type('popUp'), score(containedByOverlayPopup)),
                rule(type('popUp').max(), out('popUp')),

                rule(dom('div'), type('overlay')),
                rule(type('overlay'), score(bigOverlay)),
                rule(type('overlay'), score(nearlyOpaqueOverlay)),
                rule(type('overlay'), score(monochromeOverlay)),
                rule(type('overlay'), score(suspiciousClassOrIdOverlay)),
                rule(type('overlay'), score(visibleOverlay)),
                rule(type('overlay').max(), out('overlay')),

                rule(dom('div,button,a,i,span'), type('closeButton')),
                rule(type('closeButton'), score(small)),
                rule(type('closeButton'), score(square)),
                rule(type('closeButton'), score(topHalfPage)),
                rule(type('closeButton'), score(absolutePosition)),
                rule(type('closeButton'), score(containsClose)),
                rule(type('closeButton'), score(containsModal)),
                rule(type('closeButton'), score(containsHidden)),
                rule(type('closeButton'), score(suspiciousElementText)),
                rule(type('closeButton'), score(visible)),
                rule(type('closeButton'), score(isInPopup)),
                rule(type('closeButton').max(), out('closeButton'))
            );
            return rules;
        }
    };

export default closeButtonModel;
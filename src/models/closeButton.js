import {ruleset, rule, dom, type, score, out} from 'fathom-web';
import {ancestors} from 'fathom-web/utilsForFrontend';
import {euclidean} from 'fathom-web/clusters';
import * as overlay from './overlay.js';
import * as popUp from './popUp.js';
import * as util from './utils.js';

const closeButtonModel = {coeffs: [5,-2,2,-1,11,3,5,1,3,3],

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
            let coeffAncestorRelAreaPopup = 5;
            let coeffFormPopup = 1;
            let coeffClassOrIdPopup = 3;
            let coeffCenteredPopup = 4;
            let coeffIsNearOverlayPopup = 0;
            let coeffAbsolutePositionPopup = 0;
            let coeffZIndexPopup = 1;
            let coeffContainedByOverlayPopup = -3;

            function bigOverlay(fnode) {return overlay.bigGenerator(fnode) ** coeffBigOverlay;}
            function nearlyOpaqueOverlay(fnode) {return overlay.nearlyOpaqueGenerator(fnode) ** coeffNearlyOpaqueOverlay;}           
            function monochromeOverlay(fnode) {return overlay.monochromeGenerator(fnode) ** coeffMonochromeOverlay;}    
            function suspiciousClassOrIdOverlay(fnode) {return overlay.susWordGen(fnode, ['popup','modal','overlay','underlay','backdrop']) ** coeffClassOrIdOverlay;}
            function visibleOverlay(fnode) {return overlay.visibleGenerator(fnode) ** coeffVisibleOverlay;}

            function isNearOverlayPopup(fnode) {return popUp.isNearOverlayGen(fnode) ** coeffIsNearOverlayPopup;}
            function containedByOverlayPopup(fnode){return popUp.containedByOverlayGen(fnode) ** coeffContainedByOverlayPopup;}
            function largeAncestorPopup(fnode) {return popUp.largeAncestorGen(fnode) ** coeffAncestorAreaPopup;}
            function largestAncestorRelPopup(fnode){return popUp.largestAncestorRelGen(fnode) ** coeffAncestorRelAreaPopup;}
            function absolutePositionPopup(fnode) {return popUp.absolutePositionGen(fnode) ** coeffAbsolutePositionPopup;}
            function inheritedZIndexPopup(fnode){return popUp.inheritedZIndexGen(fnode) ** coeffZIndexPopup;}
            function isCenteredPopup(fnode) {return popUp.isCenteredGen(fnode) ** coeffCenteredPopup;}
            function containsFormPopup(fnode) {return popUp.containsFormGen(fnode) ** coeffFormPopup;}
            function suspiciousClassOrIdPopup(fnode) {
                const numOccurences = popUp.suspiciousClassOrIdPopup(fnode);

                const logisticFunction = util.logisticFuncGenerator(2,0,coeffClassOrIdPopup);
                return logisticFunction(numOccurences);
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

            function absolutePosition(fnode) {
                return ((window.getComputedStyle(fnode.element).getPropertyValue("position") == "absolute") ? ONEISH : ZEROISH) ** coeffAbsolutePosition;
            }

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

                return (-((.3 + ZEROISH) ** (numOccurences + .1685)) + ONEISH) ** coeffHiddenString;
            }

            function suspiciousElementText(fnode) {
                const element = fnode.element;
                var childNode = element.childNodes;

                if(childNode.length > 0) {
                    return ((checkForSusText(childNode)) ? ONEISH : ZEROISH) ** coeffSusElementText;
                }
            }

            function checkForSusText(element) {
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
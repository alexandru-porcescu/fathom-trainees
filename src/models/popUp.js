import {ruleset, rule, dom, type, score, out} from 'fathom-web';
import {ancestors} from 'fathom-web/utilsForFrontend';
import {euclidean} from 'fathom-web/clusters';
import * as overlay from './overlay.js';
import * as util from './utils.js';

const getHighestScoringOverlay = (fnode) => {
    return fnode._ruleset.get('overlay')[0]; 
}

const isNearOverlayGen = (fnode) => {
    const overlayFnode = getHighestScoringOverlay(fnode); 
    return util.trapezoid(euclidean(fnode, overlayFnode), 1000, 0);
}

const containedByOverlayGen = (fnode) => {
    const popup = fnode.element;                
    const overlayFnode = getHighestScoringOverlay(fnode); 

    const position = popup.compareDocumentPosition(overlayFnode.element);
    return (position & popup.DOCUMENT_POSITION_CONTAINED_BY) ? util.ONEISH : util.ZEROISH;
}

const largeAncestorGen = (fnode) => {
    const element = fnode.element;
    const ancestor = element.parentElement;

    const elementRect = element.getBoundingClientRect();
    const ancestorRect = ancestor.getBoundingClientRect();

    const elementArea = elementRect.width * elementRect.height;
    const ancestorArea = ancestorRect.width * ancestorRect.height;

    const windowArea = window.innerWidth * window.innerHeight;
    const areaDiff = ancestorArea - elementArea;

    return util.trapezoid(areaDiff, 0, windowArea);
}

const largestAncestorRelGen = (fnode) => {
    const element = fnode.element;
    const ancestor = element.parentElement;

    const elementRect = element.getBoundingClientRect();
    const ancestorRect = ancestor.getBoundingClientRect();

    const elementArea = elementRect.width * elementRect.height;
    const ancestorArea = ancestorRect.width * ancestorRect.height;

    const windowArea = window.innerWidth * window.innerHeight;
    const areaDiff = ancestorArea - elementArea;

    return util.trapezoid(areaDiff, 0, ancestorArea);
}

const absolutePositionGen = (fnode) => {
    return ((fnode.element.style.position == "absolute") ? util.ONEISH : util.ZEROISH);
}

const inheritedZIndexGen = (fnode) => {
    //maybe use a 'note' in the root element. there's a get root element util function
    if(!window.maxZ){
        window.maxZ = util.getMaxZIndex();
    }
    for (const e of ancestors(fnode.element)){
        if (window.getComputedStyle(e).zIndex !== 'auto'){
            return util.trapezoid(window.getComputedStyle(e).zIndex, 0, window.maxZ);
        }
    }
    return util.ZEROISH;
}

const isCenteredGen = (fnode) => {
    const element = fnode.element;
    const rect = element.getBoundingClientRect();

    // use centerpoint of element instead

    const leftDiff = rect.x;
    //use rect.right
    const rightDiff = window.innerWidth - rect.x - rect.width;

    const ratio = Math.min(leftDiff, rightDiff)/Math.max(leftDiff, rightDiff);

    //maxVal, xMid, growthRate, yInt = 0)
    const logisticFunction = util.logisticFuncGenerator(1,0.8, 30, 0);
    return logisticFunction(ratio);
}

const containsFormGen  = (fnode) => {
    const element = fnode.element;

    const logisticFn = util.logisticFuncGenerator(1, 5, 10);

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
    
    return (candidates.length < 1) ? util.ZEROISH :  (1-logisticFn(Math.min(candidates)));
}

const suspiciousClassOrIdPopup = (fnode) => {
    const element = fnode.element;
    const attributeNames = ['class', 'id'];
    let numOccurences = 0;
    function numberOfSuspiciousSubstrings(value) {
        return value.includes('popup') + 
        value.includes('subscription') + 
        value.includes('newsletter') + 
        value.includes('modal');
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
    return numOccurences;
}

const popUpModel = {
    coeffs: [
    3,
    5,
    1,
    3,
    4,
    0,
    0,
    1,
    -3],  

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
            function suspiciousClassOrIdOverlay(fnode) {
                return overlay.susWordGen(
                    fnode, 
                    ['popup','modal','overlay','underlay','backdrop']
                    ) ** coeffClassOrIdOverlay;
            }
            function visibleOverlay(fnode) {return overlay.visibleGenerator(fnode) ** coeffVisibleOverlay;}


            function isNearOverlay(fnode) {return isNearOverlayGen(fnode) ** coeffIsNearOverlay;}
            function containedByOverlay(fnode){return containedByOverlayGen(fnode) ** coeffContainedByOverlay;}
            function largeAncestor(fnode) {return largeAncestorGen(fnode) ** coeffAncestorArea;}
            function largestAncestorRel(fnode){return largestAncestorRelGen(fnode) ** coeffAncestorRelArea;}
            function absolutePosition(fnode) {return absolutePositionGen(fnode) ** coeffAbsolutePosition;}
            function inheritedZIndex(fnode){return inheritedZIndexGen(fnode) ** coeffZIndex;}
            function isCentered(fnode) {return isCenteredGen(fnode) ** coeffCentered;}
            function containsForm(fnode) {return containsFormGen(fnode) ** coeffForm;}

            function suspiciousClassOrId(fnode) {
                const numOccurences = suspiciousClassOrIdPopup(fnode);

                const logisticFunction = util.logisticFuncGenerator(2,0,coeffClassOrId);
                return logisticFunction(numOccurences);
            }

            /* The actual ruleset */

            const rules = ruleset(
                rule(dom('div'), type('popUp')),
                rule(dom('form'), type('popUp')),
                rule(type('popUp'), score(largeAncestor)),
                rule(type('popUp'), score(suspiciousClassOrId)),
                rule(type('popUp'), score(containsForm)),
                rule(type('popUp'), score(isCentered)),
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

export {
    largeAncestorGen as largeAncestorGen, 
    suspiciousClassOrIdPopup as suspiciousClassOrIdPopup,
    containsFormGen as containsFormGen,
    isCenteredGen as isCenteredGen,
    absolutePositionGen as absolutePositionGen,
    inheritedZIndexGen as inheritedZIndexGen,
    isNearOverlayGen as isNearOverlayGen,
    containedByOverlayGen as containedByOverlayGen
};
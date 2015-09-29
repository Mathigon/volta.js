// =============================================================================
// Boost.js | DOM Events
// (c) 2015 Mathigon
// =============================================================================



// TODO Improve performance after removing click, pointer and scroll events

import { uid } from 'utilities';
import { $ } from 'elements';
import Browser from 'browser';
import { animate } from 'animate';
import { isString } from 'types';
import { without } from 'arrays';


// -----------------------------------------------------------------------------
// Utilities

function isSupported(event) {
    event = 'on' + event;
    let $el = $N('div');
    let result = (event in $el._el);
    if (!result) {
        $el.attr(event, 'return;');
        result = (typeof $el._el[event] === 'function');
    }
    $el.delete();
    return result;
}

var scaleParentCache = {};
var scaleCache = {};
Browser.resize(function() { scaleCache = {}; });

function pointerOffset(event, $parent) {

    if (event.offsetX && $parent._el === event.target)
        return { x: event.offsetX, y: event.offsetY };

    // Cache the scale parent and scale transform for better performance
    var id = $parent._data.scaleid = $parent._data.scaleid || uid();
    if (!scaleParentCache[id]) scaleParentCache[id] = $parent.parents('.frame')[0] || $parent;
    if (!scaleCache[id]) scaleCache[id] = scaleParentCache[id].scale;
    
    if (!$parent) $parent = $(event.target);
    var parentXY = $parent.bounds;

    var eventX = event.touches ? event.touches[0].clientX : event.clientX;
    var eventY = event.touches ? event.touches[0].clientY : event.clientY;

    var offsetX = eventX - parentXY.left;
    var offsetY = eventY - parentXY.top;

    // If a CSS transform is applied, the offset is calculated in browser pixels, no $parent pixels
    return { x: offsetX/scaleCache[id][0], y: offsetY/scaleCache[id][1] };
}

function pointerPosition(e) {
    return {
        x: e.touches ? e.touches[0].clientX : e.clientX,
        y: e.touches ? e.touches[0].clientY : e.clientY
    };
}

function getWheelDelta(e) {
    let delta = 0;
    if (e.wheelDelta) delta = e.wheelDelta / 40;
    if (e.detail) delta = -e.detail / 3.5;
    return delta;
}

function stop(event) {
    event.preventDefault();
    event.stopPropagation();
}


// -----------------------------------------------------------------------------
// Click Events

function makeClickEvent($el) {
    if ($el._events._click) return;
    $el._events._click = true;

    let waitForEvent = false;
    let startX, startY;
    let preventMouse = false;

    $el._el.addEventListener('click', function(e){
        e.preventDefault();
    });

    $el._el.addEventListener('mousedown', function(e){
        if (preventMouse) return;
        waitForEvent = true;
        startX = e.clientX;
        startY = e.clientY;
    });

    $el._el.addEventListener('mouseup', function(e){
        if (preventMouse) {
            preventMouse = false;
            return;
        }
        if (waitForEvent) {
            let endX = e.clientX;
            let endY = e.clientY;
            if (Math.abs(endX - startX) < 2 && Math.abs(endY - startY) < 2) {
                $el.trigger('click', e);
            }
        }
        waitForEvent = false;
    });

    $el._el.addEventListener('touchstart', function(e){
        preventMouse = true;
        if (e.touches.length === 1) {
            waitForEvent = true;
            startX = e.changedTouches[0].clientX;
            startY = e.changedTouches[0].clientY;
        }
    });

    $el._el.addEventListener('touchend', function(e){
        if (waitForEvent && e.changedTouches.length === 1) {
            let endX = e.changedTouches[0].clientX;
            let endY = e.changedTouches[0].clientY;
            if (Math.abs(endX - startX) < 5 && Math.abs(endY - startY) < 5) {
                $el.trigger('click', e);
            }
        }
        waitForEvent = false;
    });

    $el._el.addEventListener('touchcancel', function(){
        waitForEvent = false;
    });
}


// -----------------------------------------------------------------------------
// Pointer Events
// TODO Make pointer more efficient more efficient using *enter and *leave

function checkInside(element, event) {
    var c = pointerPosition(event);
    return (element._el === document.elementFromPoint(c.x, c.y));
}

function makePointerPositionEvents(element) {
    if (element._data._pointerEvents) return;
    element._data._pointerEvents = true;

    let parent = element.offsetParent;
    let isInside = null;
    parent.on('pointerEnd', function(e) { isInside = null; });

    parent.on('pointerMove', function(e) {
        let wasInside = isInside;
        isInside = checkInside(element, e);
        if (wasInside != null && isInside && !wasInside) element.trigger('pointerEnter', e);
        if (!isInside && wasInside) element.trigger('pointerLeave', e);
        if (isInside) element.trigger('pointerOver', e);
    });
}


// -----------------------------------------------------------------------------
// Scroll Events

function makeScrollEvents(element) {
    if (element._data._scrollEvents) return;
    element._data._scrollEvents = true;

    let scrollTimeout = null;
    let scrolling = false;
    let scrollAnimation;
    let scrollTop;

    function onScroll() {
        var newScrollTop = element.scrollTop;

        if (Math.abs(newScrollTop - scrollTop) > 1) {
            if (scrollTimeout) window.clearTimeout(scrollTimeout);
            scrollTimeout = null;
            element.trigger('scroll', { top: newScrollTop });
            scrollTop = newScrollTop;
        } else if (!scrollTimeout) {
            scrollTimeout = window.setTimeout(end, 100);
        }
    }

    function start() {
        if (scrolling) return;
        scrolling = true;
        scrollTop = element.scrollTop;
        scrollAnimation = animate(onScroll);
        element.trigger('scrollstart');
    }

    function move() {
        if (!scrolling) start();
    }

    function end() {
        scrolling = false;
        scrollAnimation.cancel();
        element.trigger('scrollend');
    }

    function touchStart() {
        window.addEventListener('touchmove', move);
        window.addEventListener('touchend', touchEnd);
    }

    function touchEnd() {
        window.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', touchEnd);
    }

    if (!element._isWindow) element.fixOverflowScroll();

    var target = element._isWindow ? window : element._el;
    target.addEventListener('wheel', move);
    target.addEventListener('mousewheel', move);
    target.addEventListener('DOMMouseScroll', move);

    element._el.addEventListener('touchstart', touchStart);
}


// -----------------------------------------------------------------------------
// Event Bindings

const customEvents = {
    pointerStart: 'mousedown touchstart',
    pointerMove:  'mousemove touchmove',
    pointerEnd:   'mouseup touchend mousecancel touchcancel',

    change: 'propertychange keyup input paste',

    scrollwheel: 'DOMMouseScroll mousewheel',

    click: makeClickEvent,  // no capture!

    pointerEnter: makePointerPositionEvents,  // no capture!
    pointerLeave: makePointerPositionEvents,  // no capture!
    pointerOver: makePointerPositionEvents,  // no capture!

    scrollStart: makeScrollEvents,  // no capture!
    scroll: makeScrollEvents,  // no capture!
    scrollEnd: makeScrollEvents  // no capture!
};

function createEvent($el, event, fn, useCapture) {
    let custom = customEvents[event];

    if (isString(custom)) {
        $el.on(custom, fn, useCapture);
    } else if (custom) {
        custom($el);
    } else {
        $el._el.addEventListener(event, fn, !!useCapture);
    }

    if (event in $el._events) {
        if ($el._events[event].indexOf(fn) < 0) $el._events[event].push(fn);
    } else {
        $el._events[event] = [fn];
    }
}

function removeEvent($el, event, fn, useCapture) {
    let custom = customEvents[event];

    if (isString(custom)) {
        $el.off(custom, fn, useCapture);
        return;
    } else if (!custom) {
        $el._el.removeEventListener(event, fn, !!useCapture);
    }

    if (event in $el._events) $el._events[event] = without($el._events[event], fn);
}

// -----------------------------------------------------------------------------

export default { createEvent, removeEvent, pointerOffset };


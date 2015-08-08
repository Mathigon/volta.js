// =============================================================================
// Boost.js | Animations
// (c) 2015 Mathigon
// =============================================================================



const animationFrame = window.requestAnimationFrame ||
    function (callback) { return window.setTimeout(callback, 20); };


// -----------------------------------------------------------------------------
// Simple Animations

function animate(callback, duration) {
    var startTime = Date.now();
    var time = 0;
	var running = true;

    function getFrame() {
        if (running && (!duration || time <= duration)) animationFrame(getFrame);
        time = Date.now() - startTime;
        callback(duration ? Math.min(1,time/duration) : time);
    }

    getFrame();

	return {
		cancel: function() { running = false; }
	};
}


// -----------------------------------------------------------------------------
// Easing

function easeIn(type, t = 0, s = 0) {
    switch (type) {

        case 'quad':   return t * t;
        case 'cubic':  return t * t * t;
        case 'quart':  return t * t * t * t;
        case 'quint':  return t * t * t * t * t;
        case 'circ':   return 1 - Math.sqrt(1 - t * t);
        case 'sine':   return 1 - Math.cos(t * Math.PI / 2);
        case 'exp':    return (t <= 0) ? 0 : Math.pow(2, 10 * (t - 1));

        case 'back':
            if (s == null) s = 1.70158;
            return t * t * ((s + 1) * t - s);

        case 'elastic':
            if (s == null) s = 0.3;
            return - Math.pow(2, 10 * (t - 1)) * Math.sin(((t - 1) * 2 / s - 0.5) * Math.PI );

        case 'swing':
            return 0.5 - Math.cos(t * Math.PI) / 2;

        case 'spring':
            return 1 - (Math.cos(t * 4.5 * Math.PI) * Math.exp(-p * 6));

        case 'bounce':
            if (t < 1/11) return 1/64 - 7.5625 * (0.5/11 - t) * (0.5/11 - t);  // 121/16 = 7.5625
            if (t < 3/11) return 1/16 - 7.5625 * (  2/11 - t) * (  2/11 - t);
            if (t < 7/11) return 1/4  - 7.5625 * (  5/11 - t) * (  5/11 - t);
                          return 1    - 7.5625 * (     1 - t) * (     1 - t);

        default:
            return t;
    }
}

function ease(type, t = 0, s = 0) {

    if (t === 0) return 0;
    if (t === 1) return 1;
    type = type.split('-');

    if (type[1] === 'in')  return     easeIn(type[0], t, s);
    if (type[1] === 'out') return 1 - easeIn(type[0], 1 - t, s);
    if (t <= 0.5)          return     easeIn(type[0], 2 * t,     s) / 2;
                           return 1 - easeIn(type[0], 2 * (1-t), s) / 2;
}







// -----------------------------------------------------------------------------
// Element Animations (CSS)

M.$.prototype.getTransitions = function() {
    var s = window.getComputedStyle(this.$el);
    if (s.getPropertyValue('transition') === 'all 0s ease 0s') return [];

    var delay    = s.getPropertyValue('transition-delay').split(',');
    var duration = s.getPropertyValue('transition-duration').split(',');
    var property = s.getPropertyValue('transition-property').split(',');
    var timing   = s.getPropertyValue('transition-timing-function')
                    .match(/[^\(\),]+(\([^\(\)]*\))?[^\(\),]*/g) || [];

    var result = [];
    for (var i=0; i<property.length; ++i) {
        result.push({
            css:      property[i].trim(),
            delay:    M.cssTimeToNumber(delay[i]),
            duration: M.cssTimeToNumber(duration[i]),
            timing:   timing[i]
        });
    }

    return result;
};

M.$.prototype.setTransitions = function(transitions) {
    var css = [];

    M.each(transitions, function(options) {
        css.push([
            options.css,
            (options.duration || 1000) + 'ms',
            options.timing || 'linear',
            (options.delay || 0) + 'ms'
        ].join(' '));
    });

    this.css('transition', css.join(', '));
};

M.$.prototype.animate = function(props, callback) {
    var _this = this;
    if (!M.isArray(props)) props = [props];

    var cancelled = false;
    if (this._animation) this._animation.cancel();
    this._animation = null;

    // Set start property values of elements
    var s = window.getComputedStyle(this.$el);
    M.each(props, function(options) {
        if (options.css === 'height') _this.css('height', parseFloat(s.getPropertyValue('height')));
        if (options.css === 'width') _this.css('width', parseFloat(s.getPropertyValue('width')));
        if (options.from != null) _this.css(options.css, options.from);
    });

    // Set transition values of elements
    var oldTransition = s.getPropertyValue('transition').replace('all 0s ease 0s', '');
    this.setTransitions(M.merge(this.getTransitions(), props));
    M.redraw();

    // Set end property values of elements
    M.each(props, function(options) {
        _this.css(options.css, options.to);
    });

    // Remove new transition values
    this.transitionEnd(function() {
        if (!cancelled) {
            _this.css('transition', oldTransition);
            M.redraw();
            if (callback) callback.call(_this);
        }
    });

    this._animation = { cancel: function() {
        cancelled = true;
        _this.css('transition', oldTransition);
        M.redraw();
    } };
    return this._animation;
};


// -----------------------------------------------------------------------------
// Element Animations (Enter/Exit)

M.$.prototype.getStrokeLength = function() {
    if (this.$el.getTotalLength) {
        return this.$el.getTotalLength();
    } else {
        var dim = this.$el.getBoundingClientRect();
        return 2 * dim.height + 2 * dim.width;
    }
};

M.$.prototype.enter = function(effect, time, delay) {
    this.show();
    if (!time) return;
    if (!effect) effect = 'fade';

    if (effect === 'fade') {
        this.animate({ css: 'opacity', from: 0, to: 1, duration: time });

    } else if (effect === 'pop') {
        // TODO Remove ugly bug to get pop animations to work with transformed elements
        var transform = this.$el.style[M.prefix('transform')].replace('none', '')
                             .replace(/scale\([0-9\.]*\)/, '');
        var from = transform + ' scale(0.5)';
        var to   = transform + ' scale(1)';

        this.animate([
            { css: M.prefix('transform'), from: from, to: to, delay: delay,
              duration: time, timing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' },
            { css: 'opacity', from: 0, to: 1, delay: delay, duration: time }
        ]);

    } else if (effect === 'draw') {
        var l = this.getStrokeLength();
        this.css('stroke-dasharray', l + ' ' + l);
        this.animate({ css: 'stroke-dashoffset', from: l, to: 0, delay: delay, duration: time });
    }
};

M.$.prototype.exit = function(effect, time, delay) {
    var _this = this;
    var end = function() { _this.hide(); };
    if (!time) { end(); return; }
    if (!effect) effect = 'fade';

    if (effect === 'fade') {
        this.animate({ css: 'opacity', from: 1, to: 0, delay: delay, duration: time }, end);

    } else if (effect === 'pop') {
        // TODO Remove ugly bug to get pop animations to work with transformed elements
        var transform = this.$el.style[M.prefix('transform')].replace('none', '')
                             .replace(/scale\([0-9\.]*\)/, '');
        var from = transform + ' scale(1)';
        var to   = transform + ' scale(0.5)';

        this.animate([
            { css: M.prefix('transform'), from: from, to: to, delay: delay,
              duration: time, timing: 'cubic-bezier(0.68, -0.275, 0.825, 0.115)' },
            { css: 'opacity', from: 1, to: 0, delay: delay, duration: time }
        ], end, true);

    } else if (effect === 'draw') {
        var l = this.getStrokeLength();
        this.css('stroke-dasharray', l + ' ' + l);
        this.animate({
            css: 'stroke-dashoffset', from: 0, to: l,
            delay: delay, duration: time
        }, end);
    }
};

M.$.prototype.fadeIn = function(time) {
    this.show();
    this.animate({ css: 'opacity', from: 0, to: 1, duration: time });
};

M.$.prototype.fadeOut = function(time) {
    this.animate({ css: 'opacity', from: 1, to: 0, duration: time },
        function() { this.hide(); });
};

// Requires css transition: height, no padding or margin
M.$.prototype.slideUp = function(callback) {
    var _this = this;
    this._data.sliding = 'up';
    this.css('height', this.height() + 'px');
    M.redraw();
    this.css('height', '0px');

    this.transitionEnd(function() {
        if (_this._data.sliding === 'up' && callback) callback();
    });
};

// Requires css transition: height, no padding or margin, single wrapper child
M.$.prototype.slideDown = function(callback) {
    var _this = this;
    this._data.sliding = 'down';
    this.css('height', this.children(0).outerHeight() + 'px');

    this.transitionEnd(function() {
        if (_this._data.sliding === 'down') {
            _this.css('height', 'auto');
            if (callback) callback();
        }
    });
};


// -----------------------------------------------------------------------------
// Animated Effects

var effects = ['pulseDown', 'pulseUp', 'flash', 'bounceUp', 'bounceRight'];

effects.each(function(name){
    M.$.prototype[name] = function() {
        var _this = this;
        _this.animationEnd(function(){
            _this.removeClass('effects-'+name);
        });
        _this.addClass('effects-'+name);
    };
});


export default { animate, ease };

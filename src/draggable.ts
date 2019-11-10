// =============================================================================
// Boost.js | Draggable Component
// (c) Mathigon
// =============================================================================


import {EventTarget, applyDefaults} from '@mathigon/core';
import {Point} from '@mathigon/fermat';
import {SVGParentView, ElementView} from './elements';
import {Browser} from './browser';
import {slide} from './events';


interface DraggableOptions {
  moveX?: boolean;  // Whether it is draggable along the x-axis.
  moveY?: boolean;  // Whether it is draggable along the y-axis.
  snap?: number;  // Interval for snapping (in px)
  useTransform?: boolean;  //  Whether to use CSS transforms rather than `left` and `right`.
  margin?: number;  // Margin within the `$parent` element.
  round?: ((p: Point) => Point);  // Custom rounding function.
  width?: number;  //  Override `$parent` width.
  height?: number;  // Override `$parent` height.
}


/**
 * A draggable HTML element.
 * @emits {void} Draggable#start when the user starts dragging this element.
 * @emits {Point} Draggable#drag while the user is dragging this element.
 * @emits {void} Draggable#click when the user clicks on the this element.
 * @emits {void} Draggable#end after the user stops dragging this element.
 * @emits {Point} Draggable#move When the position of this element changes.
 */
export class Draggable extends EventTarget {
  private options: DraggableOptions;
  position = new Point(0, 0);
  disabled = false;
  width = 0;
  height = 0;

  constructor(readonly $el: ElementView, $parent: ElementView,
              options: DraggableOptions = {}) {
    super();

    this.options = applyDefaults(options, {moveX: true, moveY: true});
    this.setDimensions($parent);

    let startPosn: Point|null = null;
    slide($el, {
      start: () => {
        if (this.disabled) return;
        startPosn = this.position;
        this.trigger('start');
      },
      move: (posn, start) => {
        if (this.disabled) return;
        this.setPosition(startPosn!.x + posn.x - start.x,
                         startPosn!.y + posn.y - start.y);
        this.trigger('drag', this.position);
      },
      end: (last, start) => {
        if (this.disabled) return;
        this.trigger(last.equals(start) ? 'click' : 'end');
      }
    });

    Browser.onResize(() => {
      const oldWidth = this.width;
      const oldHeight = this.height;
      this.setDimensions($parent);
      this.setPosition(this.position.x * this.width / oldWidth || 0,
                       this.position.y * this.height / oldHeight || 0);
    });
  }

  private setDimensions($parent: ElementView) {
    if ($parent instanceof SVGParentView) {
      this.width = this.options.width || $parent.svgWidth;
      this.height = this.options.height || $parent.svgHeight;
    } else {
      this.width = this.options.width || $parent.width;
      this.height = this.options.height || $parent.height;
    }
  }

  /** Sets the position of the element. */
  setPosition(x: number, y: number) {
    const m = this.options.margin || 0;

    let p = new Point(this.options.moveX ? x : 0, this.options.moveY ? y : 0)
        .clamp(m, this.width - m, m, this.height - m)
        .round(this.options.snap || 1);

    if (this.options.round) p = this.options.round(p);

    if (p.equals(this.position)) return;
    this.position = p;

    if (this.options.useTransform) {
      this.$el.translate(p.x, p.y);
    } else {
      if (this.options.moveX) this.$el.css('left', p.x + 'px');
      if (this.options.moveY) this.$el.css('top', p.y + 'px');
    }

    this.trigger('move', p);
  }
}
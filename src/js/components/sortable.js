import $ from 'jquery';
import { util, mixin } from 'uikit';

var {extend, isWithin, Observer, pointerDown, pointerMove, pointerUp} = util;

var win = $(window), doc = $(document.documentElement);

UIkit.component('sortable', {

    mixins: [mixin.class],

    props: {
        group: String,
        animation: Number,
        threshold: Number,
        clsItem: String,
        clsPlaceholder: String,
        clsDrag: String,
        clsDragState: String,
        clsBase: String,
        clsNoDrag: String,
        clsEmpty: String,
        clsCustom: String,
        handle: String
    },

    defaults: {
        group: false,
        animation: 150,
        threshold: 5,
        clsItem: 'uk-sortable-item',
        clsPlaceholder: 'uk-sortable-placeholder',
        clsDrag: 'uk-sortable-drag',
        clsDragState: 'uk-drag',
        clsBase: 'uk-sortable',
        clsNoDrag: 'uk-sortable-nodrag',
        clsEmpty: 'uk-sortable-empty',
        clsCustom: '',
        handle: false
    },

    ready() {

        ['init', 'start', 'move', 'end'].forEach(key => {
            let fn = this[key];
            this[key] = e => {
                this.scrollY = win.scrollTop();
                var {pageX, pageY} = e.originalEvent.touches && e.originalEvent.touches[0] || e.originalEvent;
                this.pos = {x: pageX, y: pageY};

                fn(e);
            }
        });

        this.$el.on(pointerDown, '> *', this.init);

        if (this.clsEmpty) {
            var empty = () => this.$el.toggleClass(this.clsEmpty, !this.$el.children().length);
            (new Observer(empty)).observe(this.$el[0], {childList: true});
            empty();
        }

    },

    methods: {

        init(e) {

            var target = $(e.target);

            if (target.is(':input')
                || this.handle && !isWithin(target, this.handle)
                || e.button && e.button !== 0
                || isWithin(target, `.${this.clsNoDrag}`)
            ) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            this.touched = [this];
            this.element = $(e.currentTarget);
            this.origin = extend({target, index: this.element.index()}, this.pos);

            doc.on(pointerMove, this.move);
            doc.on(pointerUp, this.end);
            win.on('scroll', this.scroll);

            if (!this.threshold) {
                this.start(e);
            }

        },

        start(e) {

            this.ghost = $(`<div class="${`${this.clsDrag} ${this.clsCustom}`}" uk-no-boot></div>`)
                .css({
                    width: this.element.width(),
                    height: this.element.height(),
                    padding: this.element.css('padding')
                })
                .append(this.element.html()).appendTo('body');

            this.ghost.children().first().height(this.element.children().height());

            var {left, top} = this.element.offset();
            extend(this.origin, {left: left - this.pos.x, top: top - this.pos.y});

            this.element.addClass(this.clsPlaceholder);
            this.$el.children().addClass(this.clsItem);
            doc.addClass(this.clsDragState);

            this.$el.trigger('start', [this, this.element, this.ghost]);

            this.move(e);
        },

        move(e) {

            if (!this.ghost) {

                if (Math.abs(this.pos.x - this.origin.x) > this.threshold || Math.abs(this.pos.y - this.origin.y) > this.threshold) {
                    this.start(e);
                }

                return;
            }

            this.update();

            var target = e.type === 'mousemove' ? e.target : document.elementFromPoint(this.pos.x - document.body.scrollLeft, this.pos.y - document.body.scrollTop),
                sortable = getSortable(target),
                previous = getSortable(this.element[0]),
                move = sortable !== previous;

            if (!sortable || this.element.has(target).length || move && (!sortable.group || sortable.group !== previous.group)) {
                return;
            }

            target = sortable.$el.children().has(target);

            if (move) {
                previous.remove(this.element);
            } else if (!target.length) {
                return;
            }

            sortable.insert(this.element, target);

            if (this.touched.indexOf(sortable) === -1) {
                this.touched.push(sortable);
            }

        },

        scroll() {
            var scroll = win.scrollTop();
            if (scroll !== this.scrollY) {
                this.pos.y += scroll - this.scrollY;
                this.scrollY = scroll;
                this.update();
            }
        },

        end(e) {

            doc.off(pointerMove, this.move);
            doc.off(pointerUp, this.end);
            win.off('scroll', this.scroll);

            if (isWithin(this.origin.target, 'a[href]')) {
                if (this.pos.x !== this.origin.x || this.pos.y !== this.origin.y) {
                    $(e.target).one('click', e => e.preventDefault());
                } else if (e.type !== 'mouseup') {
                    location.href = this.origin.target.closest('a[href]').attr('href');
                }
            }

            if (!this.ghost) {
                return;
            }

            var sortable = getSortable(this.element[0]);

            if (this === sortable) {
                if (this.origin.index !== this.element.index()) {
                    this.$el.trigger('change', [this, this.element, 'moved']);
                }
            } else {
                sortable.$el.trigger('change', [sortable, this.element, 'added']);
                this.$el.trigger('change', [this, this.element, 'removed']);
            }

            this.$el.trigger('stop', [this]);

            this.ghost.remove();
            this.ghost = null;

            this.touched.forEach(sortable => sortable.$el.children().removeClass(`${sortable.clsPlaceholder} ${sortable.clsItem}`));

            doc.removeClass(this.clsDragState);

        },

        update() {

            this.ghost.offset({top: this.pos.y + this.origin.top, left: this.pos.x + this.origin.left});

            var top = this.ghost.offset().top, bottom = top + this.ghost.outerHeight();

            if (top > 0 && top < this.scrollY) {
                setTimeout(() => win.scrollTop(this.scrollY - 5), 5);
            } else if (bottom < doc[0].offsetHeight && bottom > window.innerHeight + this.scrollY) {
                setTimeout(() => win.scrollTop(this.scrollY + 5), 5);
            }
        },

        insert(element, target) {

            this.$el.children().addClass(this.clsItem);

            var insert = () => {

                if (target.length) {

                    if (!this.$el.has(element).length || element.prevAll().filter(target).length) {
                        element.insertBefore(target);
                    } else {
                        element.insertAfter(target);
                    }

                } else {
                    this.$el.append(element);
                }

                this.$updateParents();
            };

            if (this.animation) {
                this.animate(insert);
            } else {
                insert();
            }

        },

        remove(element) {

            if (!this.$el.has(element).length) {
                return;
            }

            var remove = () => {
                element.remove();
                this.$updateParents();
            };

            if (this.animation) {
                this.animate(remove);
            } else {
                remove();
            }

        },

        animate(action) {

            var props = [],
                children = this.$el.children().toArray().map(el => {
                    el = $(el);
                    props.push(extend({
                        position: 'absolute',
                        pointerEvents: 'none',
                        width: el.outerWidth(),
                        height: el.outerHeight()
                    }, el.position()));
                    return el;
                }),
                reset = {position: '', width: '', height: '', pointerEvents: '', top: '', left: ''};

            action();

            this.$el.children().css(reset);
            this.$updateParents();
            this.$el.css('min-height', this.$el.height());

            var positions = children.map(el => el.position());

            $.when.apply($, children.map((el, i) => {
                var def = $.Deferred();
                el.css(props[i]).animate(positions[i], this.animation, () => def.resolve(el));
                return def;
            })).then((...elements) => {
                elements.forEach(el => el.css(reset));
                this.$el.css('min-height', '');
                this.$updateParents();
            });

        }

    }

});

function getSortable(element) {
    return UIkit.getComponent(element, 'sortable') || element.parentNode && getSortable(element.parentNode);
}

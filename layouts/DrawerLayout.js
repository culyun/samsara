/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * @license MPL 2.0
 * @copyright Famous Industries, Inc. 2014
 */

/* Modified work copyright © 2015 David Valdman */

define(function(require, exports, module) {
    var Transform = require('samsara/core/Transform');
    var Transitionable = require('samsara/core/Transitionable');
    var View = require('samsara/core/view');
    var LayoutNode = require('samsara/core/nodes/LayoutNode');
    var Stream = require('samsara/streams/Stream');
    var Differential = require('samsara/streams/Differential');
    var Accumulator = require('samsara/streams/Accumulator');
    var EventMapper = require('samsara/events/EventMapper');

    var CONSTANTS = {
        DIRECTION : {
            X : 0,
            Y : 1
        },
        SIDE : {
            LEFT   : 0,
            TOP    : 1,
            RIGHT  : 2,
            BOTTOM : 3
        },
        ORIENTATION : {
            POSITIVE :  1,
            NEGATIVE : -1
        }
    };

    var DrawerLayout = View.extend({
        defaults : {
            side : CONSTANTS.SIDE.LEFT,
            drawerLength : 0,
            velocityThreshold : 0,
            positionThreshold : 0,
            transitionOpen : true,
            transitionClose : true
        },
        events : {
            change : _updateState
        },
        initialize : function initialize(options){
            this.direction = _getDirectionFromSide(options.side);
            this.orientation = _getOrientationFromSide(options.side);
            this.drawerLength = options.drawerLength;
            this.isOpen = false;

            this.input = new Stream();

            var gestureStream = new Stream({
                start : function (){
                    return 0;
                },
                update : function (data){
                    var delta = data.delta;
                    var newDelta = delta;

                    var currentPosition = this.position.get();
                    var newPosition = currentPosition + delta;

                    var MIN_LENGTH = 0;
                    var MAX_LENGTH = 0;

                    if (this.orientation === CONSTANTS.ORIENTATION.POSITIVE)
                        MAX_LENGTH = this.drawerLength;
                    else
                        MIN_LENGTH = this.drawerLength;

                    if (newPosition >= MAX_LENGTH || newPosition <= MIN_LENGTH){
                        if (newPosition > MAX_LENGTH && newPosition > MIN_LENGTH && currentPosition !== MAX_LENGTH)
                            newDelta = MAX_LENGTH - currentPosition;
                        else if (newPosition < MIN_LENGTH && currentPosition !== MIN_LENGTH)
                            newDelta = MIN_LENGTH - currentPosition;
                        else newDelta = 0;
                    }

                    return newDelta;
                }.bind(this),
                end : function (data){
                    var velocity = data.velocity;
                    var orientation = this.orientation;
                    var length = this.drawerLength;
                    var isOpen = this.isOpen;
                    var currentPosition = this.position.get();

                    var options = this.options;

                    var MAX_LENGTH = orientation * length;
                    var positionThreshold = options.positionThreshold || MAX_LENGTH / 2;
                    var velocityThreshold = options.velocityThreshold;

                    if (options.transition instanceof Object)
                        options.transition.velocity = velocity;

                    if (currentPosition === 0) {
                        this.isOpen = false;
                        return;
                    }

                    if (currentPosition === MAX_LENGTH) {
                        this.isOpen = true;
                        return;
                    }

                    var shouldToggle =
                        Math.abs(velocity) > velocityThreshold          ||
                        (!isOpen && currentPosition > positionThreshold) ||
                        (isOpen && currentPosition < positionThreshold);

                    (shouldToggle) ? this.toggle() : this.reset();
                }.bind(this)
            });

            gestureStream.subscribe(this.input);

            this.inertialStream = new Transitionable(0);
            var differential = new Differential();
            differential.subscribe(this.inertialStream);

            this.position = new Accumulator();
            this.position.subscribe(gestureStream);
            this.position.subscribe(differential);

            var outputMapper = new EventMapper(function(position){
                return {
                    value : position,
                    progress : position / this.drawerLength
                }
            }.bind(this));

            this._eventOutput.subscribe(outputMapper).subscribe(this.position);
        },
        addDrawer : function addDrawer(drawer){
            this.drawer = drawer;
            var layout = new LayoutNode({transform : Transform.behind});
            this.add(layout).add(this.drawer);
        },
        addContent : function addContent(content){
            var transform = this.position.map(function(position){
                return (this.direction === CONSTANTS.DIRECTION.X)
                    ? Transform.translateX(position)
                    : Transform.translateY(position)
            }.bind(this));

            var layout = new LayoutNode({transform : transform});

            this.add(layout).add(content);
        },
        /**
         * Reveals the drawer with a transition
         *   Emits an 'open' event when an opening transition has been committed to.
         *
         * @method open
         * @param [transition] {Boolean|Object} transition definition
         * @param [callback] {Function}         callback
         */
        open : function open(transition, callback){
            if (transition instanceof Function) callback = transition;
            if (transition === undefined) transition = this.options.transitionOpen;
            this.setPosition(this.drawerLength, transition, callback);
            if (!this.isOpen) {
                this.isOpen = true;
                this.emit('open');
            }
        },
        /**
         * Conceals the drawer with a transition
         *   Emits a 'close' event when an closing transition has been committed to.
         *
         * @method close
         * @param [transition] {Boolean|Object} transition definition
         * @param [callback] {Function}         callback
         */
        close : function close(transition, callback){
            if (transition instanceof Function) callback = transition;
            if (transition === undefined) transition = this.options.transitionClose;
            this.setPosition(0, transition, callback);
            if (this.isOpen){
                this.isOpen = false;
                this.emit('close');
            }
        },
        /**
         * Toggles between open and closed states
         *
         * @method toggle
         * @param [transition] {Boolean|Object} transition definition
         */
        toggle : function toggle(transition){
            if (this.isOpen) this.close(transition);
            else this.open(transition);
        },
        /**
         * Sets the position in pixels for the content's displacement
         *
         * @method setPosition
         * @param position {Number}             position
         * @param [transition] {Boolean|Object} transition definition
         * @param [callback] {Function}         callback
         */
        setPosition : function setPosition(position, transition, callback) {
            this.inertialStream.set(this.position.get());
            this.inertialStream.set(position, transition, callback);
        },
        /**
         * Resets to last state of being open or closed
         *
         * @method reset
         * @param [transition] {Boolean|Object} transition definition
         */
        reset : function reset(transition) {
            if (this.isOpen) this.open(transition);
            else this.close(transition);
        }
    }, CONSTANTS);

    function _getDirectionFromSide(side) {
        var SIDE = CONSTANTS.SIDE;
        var DIRECTION = CONSTANTS.DIRECTION;
        return (side === SIDE.LEFT || side === SIDE.RIGHT)
            ? DIRECTION.X
            : DIRECTION.Y;
    }

    function _getOrientationFromSide(side) {
        var SIDES = CONSTANTS.SIDE;
        return (side === SIDES.LEFT || side === SIDES.TOP)
            ? CONSTANTS.ORIENTATION.POSITIVE
            : CONSTANTS.ORIENTATION.NEGATIVE;
    }

    function _updateState(data){
        var key = data.key;
        var value = data.value;
        if (key !== 'side') {
            this.direction = _getDirectionFromSide(value);
            this.orientation = _getOrientationFromSide(value);
        }
    }

    module.exports = DrawerLayout;
});

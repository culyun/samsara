/* Copyright © 2015 David Valdman */

define(function(require, exports, module) {
    var Transform = require('samsara/core/Transform');
    var View = require('samsara/core/View');
    var ResizeStream = require('samsara/streams/ResizeStream');
    var LayoutNode = require('samsara/core/LayoutNode');
    var SizeNode = require('samsara/core/SizeNode');

    var CONSTANTS = {
        DIRECTION : {
            X : 0,
            Y : 1
        }
    };

    /**
     * A layout which arranges items in series based on their size.
     *  Items can be arranged vertically or horizontally.
     *
     * @class SequentialLayout
     * @constructor
     * @namespace Layouts
     * @extends Core.View
     * @param [options] {Object}                        Options
     * @param [options.direction]{Number}               Direction to lay out items
     * @param [options.spacing] {Transitionable|Array}  Gutter spacing between items
     */
    var SequentialLayout = View.extend({
        defaults : {
            direction : CONSTANTS.DIRECTION.X,
            spacing : 0
        },
        initialize : function initialize(){},
        /**
         * Add content as an array of Views or Surfaces.
         *
         * @method addItems
         * @param items {Array}  An array of Views or Surfaces
         */
        addItems : function addItems(items){
            var sizes = [];
            for (var i = 0; i < items.length; i++)
                sizes.push(items[i].size);

            var transformStream = ResizeStream.lift(function(){
                var sizes = arguments;
                var direction = this.options.direction;
                var transforms = [];

                var displacement = 0;
                for (var i = 0; i < sizes.length; i++){
                    var size = sizes[i];

                    var transform = direction === CONSTANTS.DIRECTION.X
                        ? Transform.translateX(displacement)
                        : Transform.translateY(displacement);

                    transforms.push(transform);

                    displacement += size[direction] + this.options.spacing;
                }

                return transforms;
            }.bind(this), sizes);

            for (var i = 0; i < items.length; i++){
                var node = items[i];
                var transform = transformStream.pluck(i);
                var layout = new LayoutNode({transform : transform});
                this.add(layout).add(node);
            }
        }
    }, CONSTANTS);

    module.exports = SequentialLayout;
});

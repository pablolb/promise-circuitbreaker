var EventEmitter = require('events').EventEmitter,
    util = require('util');


/**
 * An observer that watches one or more circuit breakers. It will
 * group their 'interval' event by name, and emit a single 'batch'
 * event with their combined data.
 *
 * @fires CBObserver#batch
 *
 * @constructor
 */
function CBObserver() {
    
    var EVENT = 'interval',
        watched = [],
        listeners = [],
        intervals = {},
        self = this;
    
    /**
     * Watch a circuit breaker
     *
     * @param {CircuitBreaker} cb - The circuit breaker on which we'll listen the 'interval' event.
     */
    this.watch = function(cb) {
        if (watched.indexOf(cb) > -1) {
            return;
        }
        watched.push(cb);
        var name = cb.getName();
        if (!(name in intervals)) {
            intervals[name] = [];
        }
        var listener = buildOnInterval(name);
        listeners.push(listener);
        cb.on(EVENT, listener);
    };
    
    /**
     * Stop watching this circuit breaker
     *
     * @param {CircuitBreaker} cb
     */
    this.unwatch = function(cb) {
        var index = watched.indexOf(cb);
        if (index > -1) {
            watched.splice(index, 1);
            var arr = listeners.splice(index, 1);
            cb.removeListener(EVENT, arr[0]);
        }
    };

    function buildOnInterval(cb) {
        return function(interval) {
            intervals[cb].push(interval);
            emitIfNecessary();
        };
    }

    function emitIfNecessary() {
        for (var name in intervals) {
            var cnt = intervals[name].length;
            if (cnt > 1) {
                doEmit();
                return;
            } else if (cnt === 0) {
                return false;
            }
        }
        doEmit();
    }
    
    function doEmit() {
        var data = intervals;
        intervals = {};
        for (var name in data) {
            intervals[name] = [];
        }

        /**
         * Batch event.  The keys of the object are the names of the circuit breakers.
         * The values of the object are arrays of {@link CircuitBreaker#event:interval}.
         *
         * @event CBObserver#batch
         * @type object
         */
        self.emit('batch', data);
    }

}
util.inherits(CBObserver, EventEmitter);

module.exports = CBObserver;

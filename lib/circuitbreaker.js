var _ = require('lodash'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    Counts = require('./counts').Counts,
    RollingCounts = require('./counts').RollingCounts;


var defaults = {
    /**
     * Bluebird Promise
     * @constructor
     * @external Promise
     * @see {@link https://github.com/petkaantonov/bluebird/blob/master/API.md#core}
     */
    Promise: require('bluebird'),
    
    name: "CircuitBreaker",
    isErrorHandler: isError,
    concurrency: 0,
    timeout: 3000,
    resetTime: 1000,
    volumeThreshold: 10,
    intervalSize: 1000,
    windowSize: 1000,
    windowCount: 10,
    errorThreshold: 0.05,
    errorNamesThresholds: {},
    emitIntervalEvent: true,
    emitCallbackEvent: false
};

function isError(error) {
    return error;
}

/**
 * Create a new circuit breaker wrapping function *fn*.  If the function
 * is a method of an object, pass the object as the *fnThis* parameter.
 *
 * You can configure it's behaviour with the *options* parameter, or through
 * various setters:
 *
 * @example
 * var cb = new CircuitBreaker(fn)
 *          .setTimeout(1000)
 *          .setErrorThreshold(0.5);
 *
 * @fires CircuitBreaker#interval
 * @fires CircuitBreaker#callback
 *
 * @constructor
 * @param {function} fn - The function to be executed
 * @param {object=} fnThis - If provided, call fn with fnThis as this argument
 * @param {object=} options - Options. All times are in milliseconds.
 * @param {function} options.Promise - Promise library (default: require('bluebird'))
 * @param {string} options.name - Name for this instance (default: 'CircuitBreaker')
 * @param {function} options.isErrorHandler - Function to get error from callback
 * @param {integer} options.concurrency - Set a limit for concurrent calls (default: 0 - unlimited)
 * @param {integer} options.timeout - Timeout limit for callback to be called (default: 3000)
 * @param {integer} options.resetTime - When circuit is tripped, time to wait before a test call is allowed (default: 1000)
 * @param {integer} options.volumeThreshold - Minimum number of calls in health window before circuit is checked
 *                                            for health. Circuit remains <b>closed</b> until then (default: 10)
 * @param {integer} options.intervalSize - Frequency with which the 'interval' event is emitted for reporting (default: 1000)
 * @param {integer} options.windowSize - Time size of each individual rolling window (default: 1000)
 * @param {integer} options.windowCount - Number of windows in health window (default: 10)
 * @param {float} options.errorThreshold - Error level between 0 and 1 at which the circuit is tripped (default: 0.05)
 * @param {object} options.errorNamesThresholds - Custom error levels for particular named errors (default: {})
 * @param {boolean} options.emitIntervalEvent - Enable/disable emitting the 'interval' event for reporting (default: true)
 * @param {boolean} options.emitCallbackEvent - Enable/disable emitting the 'callback' event (default: false)
 */
function CircuitBreaker(fn, fnThis, options) {
    options = _.defaults(options || {}, defaults);

    var opts = _.extend({}, options),
        active = 0,
        queue = [],
        lastErrorMs = null,
        testing = false,
        rollingCounts = new RollingCounts(opts.windowCount),
        interval = makeInterval(),
        self = this,
        rollIntervalTimeoutObj,
        rollWindowTimeoutObj;
    
    function makeInterval(now) {
        now = now || Date.now();
        return _.extend(new Counts(), {
            start: now,
            times: []
        });
    }
    
    /**
     * Set the timeout in milliseconds. Set to 0 to disable.
     *
     * @param {integer} ms
     * @returns {CircuitBreaker}
     */
    this.setTimeout = function(ms) {
        opts.timeout = ms;
        return self;
    };

    /**
     * Set the minimum amount of calls to start checking for circuit health.
     * Circuit will always be closed until it reaches this threshold.
     * Set to 0 to instantly start checking for circuit health.
     *
     * @param {integer} count - Minimum amount of calls to start checking circuit health.
     * @returns {CircuitBreaker}
     */
    this.setVolumeThreshold = function(count) {
        opts.volumeThreshold = count;
        return self;
    };
    
    /**
     * Set the error threshold which tirggers circuit.
     * Set to 0 open circuit on first error.
     *
     * @param {float} level - Float from 0 to 1
     * @returns {CircuitBreaker}
     */
    this.setErrorThreshold = function(level) {
        opts.errorThreshold = level;
        return self;
    };
    
    /**
     * Set the error threshold for a particular error type.
     * The error type is obtained from the name property of the error.
     *
     * @param {string} name - Error name
     * @param {float} level - Float from 0 to 1
     */
    this.setErrorNameThreshold = function(name, level) {
        opts.errorNamesThresholds[name] = level;
        return self;
    };
    
    /**
     * Set the sleep period until a test request is allowed to be made.
     * The circuit will remain open during this period of time.
     *
     * @param {integer} ms
     * @returns {CircuitBreaker}
     */
    this.setResetTime = function(ms) {
        opts.resetTime = ms;
        return self;
    };
    
    /**
     * Set the concurrency level. Set to 0 to disable (default behaviour).
     *
     * Requests will be queded if more than this number are currently active.
     *
     * @param {integer} num - The maximum number of requests allowed to be active.
     * @returns {CircuitBreaker}
     */
    this.setConcurrency = function(num) {
        opts.concurrency = num;
        return self;
    };
    
    /**
     * Set the reporting interval size.
     *
     * @param {integer} ms - The frequency with which the 'interval' event is emitted.
     */
    this.setIntervalSize = function(ms) {
        opts.intervalSize = ms;
        return self;
    };
    
    /**
     * Set the size in milliseconds of each individual window used in the rolling counts.
     *
     * @param {integer} ms
     * @returns {CircuitBreaker}
     */
    this.setWindowSize = function(ms) {
        opts.windowSize = ms;
        return self;
    };

    /**
     * Set the total amount of windows to keep in the rolling counts.
     *
     * @param {integer} count
     * @returns {CircuitBreaker}
     */
    this.setWindowCount = function(count) {
        rollingCounts.setSize(count);
        return self;
    };
    
    /**
     * Enables/disables emitting the 'interval' event for reporting.
     *
     * @param {boolean} bool
     * @returns {CircuitBreaker}
     */
    this.setEmitIntervalEvent = function(bool) {
        opts.emitIntervalEvent = bool ? true : false;
        return self;
    };

    /**
     * Enables/disables emitting the 'callback' event for reporting.
     *
     * @param {boolean} bool
     * @returns {CircuitBreaker}
     */
    this.setEmitCallbackEvent = function(bool) {
        opts.emitCallbackEvent = bool ? true : false;
        return self;
    };
    
    /**
     * Set a custom function to check if the callback was called with an error or not.
     *
     *
     * @example
     * var cb = new RequestCircuitBreaker();
     * cb.setIsErrorHandler(function(error, response, body) {
     *     if (error) return error;
     *     if (response.statusCode == 503) {
     *         var unavailableError = new Error();
     *         unavailableError.name = "ServiceUnavailableError";
     *         return unavailableError;
     *     }
     *     return null;
     * });
     *
     * @param {function} cb - A function which will be called with the callback arguments.
     * @returns {CircuitBreaker}
     */
    this.setIsErrorHandler = function(cb) {
        opts.isErrorHandler = cb;
        return self;
    };
    
    /**
     * Get the current reporting interval.

     * @returns {object}
     */
    this.getCurrentInteval = function() {
        return _.cloneDeep(interval);
    };
    
    /**
     * Get the current circuit breaker health rolling counts
     *
     * @returns {object}
     */
    this.getCurrentCounts = function() {
        return _.cloneDeep(rollingCounts.getCurrent());
    };

    /**
     * Get the amount of current active requests. That is,
     * calls which have started but have not timedout nor called-back.
     *
     * @returns {integer}
     */
    this.getActiveCount = function() {
        return active;
    };
    
    /**
     * Get the amount of requests in queue when concurrency is enabled.
     *
     * @returns {integer}
     */
    this.getQueuedCount = function() {
        return queue.length;
    };
    
    /**
     * Get this instance's name
     *
     * @returns {string}
     */
    this.getName = function() {
        return opts.name;
    };

    function recordError(error) {
        interval.addError(error);
        rollingCounts.addError(error);
        lastErrorMs = Date.now();
        testing = false;
    }

    function reset() {
        rollingCounts.reset();
        lastErrorMs = null;
        testing = false;
    }
    
    /**
     * Get current error percentage.
     *
     * @returns {float}
     */
    this.getErrorPercentage = function() {
        return rollingCounts.getCurrentErrorLevel();
    };
    
    /**
     * Get current circuit's [state]{@link CircuitBreaker.STATE}.
     *
     * @returns {string}
     */
    this.getState = function() {
        if (opts.volumeThreshold && rollingCounts.getCurrent().total < opts.volumeThreshold) {
            return STATE.CLOSED;
        }
        var errorLevel = rollingCounts.getCurrentErrorLevel();
        var isHalfOpen = !testing && opts.resetTime && lastErrorMs && Date.now() - lastErrorMs > opts.resetTime;
        if (errorLevel && errorLevel >= opts.errorThreshold) {
            if (isHalfOpen) {
                return STATE.HALF_OPEN;
            }
            return STATE.OPEN;
        }
        var namedErrorLevels = rollingCounts.getCurrentNamedErrorLevels(opts.errorNamesThresholds);
        for (var name in namedErrorLevels) {
            if (namedErrorLevels[name] && namedErrorLevels[name] >= opts.errorNamesThresholds[name]) {
                if (isHalfOpen) {
                    return STATE.HALF_OPEN;
                }
                return STATE.OPEN;
            }
        }
        return STATE.CLOSED;
    };
    
    this.toString = function() {
        return "[object CircuitBreaker " + name + " (" + self.getState() + ")]";
    };

    function rollInterval(firstTime) {
        var now = Date.now();
        if (!firstTime && opts.emitIntervalEvent) {
            interval.end = now;
            interval.state = self.getState();
            interval.active = active;
            interval.queued = queue.length;

            /**
             * Interval event
             *
             * @event CircuitBreaker#interval
             * @type object
             * @property {integer} start - Timestamp of start of the interval
             * @property {integer} end - Timestamp of the end of the interval
             * @property {string} state - Circuit's current state
             * @property {integer} active - Calls currently running
             * @property {integer} queued - Calls currently queued
             * @property {integer} total - Total calls
             * @property {integer} success - Total success calls
             * @property {integer} totalErrors - Total failed calls
             * @property {object} errors - Error counts by type
             * @property {integer} errors.TimeoutError - Total calls which timedout - if any
             * @property {integer} errors.OpenCircuitError - Total calls which were rejected (short-circuit) - if any
             * @property {array} times - Times of <b>successful</b> calls in milliseconds
             */
            self.emit('interval', interval);
        }
        interval = makeInterval(now);
        rollIntervalTimeoutObj = setTimeout(rollInterval, opts.intervalSize);
    }
    
    function rollWindow(firstTime) {
        if (!firstTime) {
            rollingCounts.roll();
        }
        rollWindowTimeoutObj = setTimeout(rollWindow, opts.windowSize);
    }
    
    /**
     * Start events. Events starts automatically upon the first request.
     * This forces start emitting events before any request is made.
     */
    this.startEvents = function() {
        if (opts.intervalSize && !rollIntervalTimeoutObj) {
            rollInterval(true);
        }
        
        if (opts.windowSize && !rollWindowTimeoutObj) {
            rollWindow(true);
        }
    };
    
    /**
     * Stop events. Clears the pending timeouts.
     */
    this.stopEvents = function() {
        if (rollIntervalTimeoutObj) {
            clearTimeout(rollIntervalTimeoutObj);
        }
        if (rollWindowTimeoutObj) {
            clearTimeout(rollWindowTimeoutObj);
        }
    };
    
    /**
     * Main entry point. Call the protected function and return a promise.
     * 
     * @returns {external:Promise}
     */
    this.exec = function() {
        var args = Array.prototype.slice.call(arguments);
        
        self.startEvents();

        if (opts.concurrency && active >= opts.concurrency) {
            return queueRequest(args);
        } else {
            return runRequest(args);
        }
    };

    function queueRequest(args) {
        var resolver = opts.Promise.defer();
        queue.unshift({args: args, resolver: resolver});
        return resolver.promise;
    }

    function runNextInQueue() {
        if (queue.length === 0) {
            return;
        }
        var queued = queue.pop();
        process.nextTick(function() {
            runRequest(queued.args, queued.resolver);
        });
    }

    function runRequest(callArgs, resolver) {
        
        resolver = resolver || opts.Promise.defer();
        var state = self.getState();
        var timedout = false;
        var start = Date.now();

        interval.total++;

        if (state == STATE.OPEN) {
            var error = new OpenCircuitError();
            rollingCounts.addError(error);
            interval.addError(error);
            resolver.reject(error);
            return resolver.promise;
        } else if (state == STATE.HALF_OPEN) {
            testing = true;
        }
        
        active += 1;
        
        var timeoutObject = null;
        if (opts.timeout > 0) {
            timeoutObject = setTimeout(function() {
                timedout = true;
                var error = new TimeoutError("Timed out after " + opts.timeout + " ms");
                active -= 1;
                recordError(error);
                resolver.reject(error);
                runNextInQueue();
            }, opts.timeout);
        }

        var cb = function() {
            var args = Array.prototype.slice.call(arguments);
            
            if (timeoutObject) {
                clearTimeout(timeoutObject);
            }
                   
            if (timedout) {
                return;
            }

            active -= 1;
            var now = Date.now();

            var err = opts.isErrorHandler.apply(null, args);
            
            if (opts.emitCallbackEvent) {
                /**
                 * Callback event. Emitted on calls which do not timeout.
                 *
                 * @event CircuitBreaker#callback
                 * @type object
                 * @property {array} args - Array or arguments in exec() call
                 * @property {integer} start - Timestamp of the start of the call
                 * @property {integer} end - Timestamp of the end of the call
                 * @property {array} result - Array of arguments with which callback was called
                 */
                self.emit('callback', {
                    args: callArgs.slice(0, -1),
                    start: start,
                    end: now,
                    result: args
                });
            }
            
            if (err) {
                recordError(err);
                resolver.reject(err);
                runNextInQueue();
                return;
            }
            
            interval.success++;
            interval.times.push(now - start);
            rollingCounts.addSuccess();

            if (testing) {
                reset();
            }
            
            // remove error
            args.shift();
            // if only one argument, resolve promise without array
            resolver.resolve(args.length == 1 ? args[0] : args);
            runNextInQueue();
        };
        
        callArgs.push(cb);
        // TODO fn THIS
        fn.apply(fnThis, callArgs);

        return resolver.promise;
    }

}
util.inherits(CircuitBreaker, EventEmitter);

/**
 * State enum
 * @readonly
 * @enum {string}
 */
CircuitBreaker.STATE = {
    /**
     * No calls are allowed
     */
    OPEN: 'open',

    /**
     * Calls are allowed
     */
    CLOSED: 'closed',

    /**
     * One call is allowed to test health
     */
    HALF_OPEN: 'half-open'
};
var STATE = Object.freeze(CircuitBreaker.STATE);

/**
 * Error returned when circuit is open.
 * @constructor
 * @extends external:Error
 * @param {string} message
 */
OpenCircuitError = function(message) {
    this.name = "OpenCircuitError";
    this.message = message || "Circuit Breaker was tripped";
};
OpenCircuitError.prototype = new Error();
OpenCircuitError.prototype.constructor = OpenCircuitError;

/**
 * Error returned when a call timesout
 * @constructor
 * @extends external:Error
 * @param {string} message
 */
TimeoutError = function(message) {
    this.name = "TimeoutError";
    this.message = message || "Timed out";
};
TimeoutError.prototype = new Error();
TimeoutError.prototype.constructor = TimeoutError;


/**
 * A circuit breaker which wraps the [request module]{@link https://www.npmjs.org/package/request}.
 * All options get passed to the CircuitBreaker (except the request option).
 *
 * @constructor
 * @extends CircuitBreaker
 * @param {object} options
 * @param {function} options.request - Request module (default: require('request')).
 */
function RequestCircuitBreaker(options) {
    options = options || {};
    /**
     * @external request
     * @see https://github.com/mikeal/request
     */
    var request = options.request || require('request');
    delete options.request;
    CircuitBreaker.call(this, request, null, options);
}
util.inherits(RequestCircuitBreaker, CircuitBreaker);


module.exports = CircuitBreaker;
module.exports.RequestCircuitBreaker = RequestCircuitBreaker;
module.exports.OpenCircuitError = OpenCircuitError;
module.exports.TimeoutError = TimeoutError;
module.exports.CBObserver = require('./observer');
module.exports.CBStats = require('./stats');


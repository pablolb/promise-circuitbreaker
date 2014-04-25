var util = require('util'),
    _ = require('lodash'),
    Stats = require('fast-stats').Stats;

var defaults = {
    timesLength: 60,
    countsLength: 120,
    healthLength: 10
};

/**
 * Circuit breaker statistics
 *
 * @constructor
 * @param {object} options
 * @param {integer} options.timesLength -  Amount of intervals to keep for call times statistics
 *                                         (default: 60)
 * @param {integer} options.countsLength - Amount of intervals to keep for summarized counters
 *                                         (default: 120)
 * @param {integer} options.healthLength - Amount of intervals to keep for the health summary
 *                                         (default: 10)
 */
function CBStats(options) {
    options = _.extend({}, options || {});
    var opts = _.defaults(options, defaults);
    
    var timeStats = new Stats(),
        intervalLengths = [],
        counters = [],
        countersSum = makeStats(),
        healths = [],
        healthsSum = makeStats(),
        summary = {};

    delete countersSum.active;
    delete countersSum.queued;
    delete healthsSum.active;
    delete healthsSum.queued;

    function addInterval(interval) {
        addTimeStats(interval);
        addCounters(interval);
        updateHealthWindow(interval);
    }

    function addTimeStats(interval) {
        intervalLengths.push(interval.times.length);
        timeStats.push(interval.times);
        var extra = intervalLengths.length - opts.timesLength;
        for (var i = 0; i < extra; i++) {
            var n = intervalLengths.shift();
            for (var j = 0; j < n; j++) {
                timeStats.shift();
            }
        }
        /**
         * @typedef {object} CBStats~TimesSummary
         * @property {float} amean - Arithmetic mean
         * @property {float} median - Median
         * @property {integer} p900 - 90th percentile
         * @property {integer} p990 - 99th percentile
         */
        summary.times = {
            amean: timeStats.amean(),
            median: timeStats.median(),
            p900: timeStats.percentile(90),
            p990: timeStats.percentile(99)
        };
    }

    function addCounters(interval) {
        var stats = getStatsFromInterval(interval);
        counters.push(stats);
        if (counters.length > opts.countsLength) {
            var out = counters.shift();
            substractStats(out, countersSum);
        }
        addStats(stats, countersSum);
        /**
         * @typedef {object} CBStats~CountsSummary
         * @property {integer} total
         * @property {integer} success
         * @property {integer} totalErrors
         * @property {object}  errors - Error counts by name
         */
        summary.counts = countersSum;
    }

    function getStatsFromInterval(interval) {
        var stats = makeStats();
        stats.total = interval.total;
        stats.success = interval.success;
        stats.totalErrors = interval.totalErrors;
        stats.active = interval.active;
        stats.queued = interval.queued;
        for (var err in interval.errors) {
            stats.errors[err] = interval.errors[err];
        }
        stats.start = interval.start;
        stats.end = interval.end;
        return stats;
    }

    function updateHealthWindow(interval) {
        var stats = getStatsFromInterval(interval);
        healths.push(stats);
        if (healths.length > opts.healthLength) {
            var out = healths.shift();
            substractStats(out, healthsSum);
        }
        addStats(stats, healthsSum);
        var wlength = (interval.end - healths[0].start) / 1000;
        /**
         * @typedef CBStats~HealthSummary
         * @property {integer} total - Total amount of calls
         * @property {integer} success - Total amount of successful calls
         * @property {integer} totalErrors - Total errors
         * @property {integer} timeouts - Total amount of TimeoutError errors
         * @property {integer} rejected - Total amount of OpenCircuitError errors
         * @property {integer} otherErrors - Total amount of errors which are neither timeouts nor rejections
         * @property {object} errors - Total error counts by name
         * @property {float} callRate - Calls per second
         * @property {integer} active - Current active calls
         * @property {integer} queued - Current queued calls
         */
        summary.health = {
            total: healthsSum.total,
            success: healthsSum.success,
            totalErrors: healthsSum.totalErrors,
            timeouts: healthsSum.errors.TimeoutError || 0,
            rejected: healthsSum.errors.OpenCircuitError || 0,
            otherErrors: healthsSum.totalErrors - (healthsSum.errors.TimeoutError || 0) - (healthsSum.errors.OpenCircuitError || 0),
            errors: healthsSum.errors,
            callRate: wlength ? healthsSum.total / wlength : 0,
            errorRate: healthsSum.total ? healthsSum.totalErrors / healthsSum.total : 0,
            active: interval.active,
            queued: interval.queued,
            state: interval.state
        };
    }

    function substractStats(stats, cummulative) {
        cummulative.total -= stats.total;
        cummulative.success -= stats.success;
        cummulative.totalErrors -= stats.totalErrors;
        for (var err in stats.errors) {
            cummulative.errors[err] -= stats.errors[err];
            if (cummulative.errors[err] === 0) {
                delete cummulative.errors[err];
            }
        }
    }
    
    function addStats(stats, cummulative) {
        cummulative.total += stats.total;
        cummulative.success += stats.success;
        cummulative.totalErrors += stats.totalErrors;
        if (!cummulative.errors) {
            cummulative.errors = {};
        }
        for (var err in stats.errors) {
            if (!cummulative.errors[err]) {
                cummulative.errors[err] = 0;
            }
            cummulative.errors[err] += stats.errors[err];
        }
    }

    function makeStats() {
        return {
            total: 0,
            success: 0,
            totalErrors: 0,
            active: 0,
            queued: 0,
            errors: {}
        };
    }
    
    /**
     * Add intervals emitted by the {@link CircuitBreaker#event:interval} event.
     *
     * @param {object[]} intervals - Array of {@link CircuitBreaker#event:interval} instances
     */
    this.add = function(intervals) {
        for (var i = 0, l = intervals.length; i < l; i++) {
            addInterval(intervals[i]);
        }
    };
    
    /**
     * Get statistics summary
     *
     * @return {CBStats~Summary} stats
     * 
     */
    this.getSummary = function() {
        return summary;
    };

    this.getCounters = function() {
        return counters;
    };

}

/**
 * @typedef {object} CBStats~Summary
 * @property {CBStats~TimesSummary} times - Times summary
 * @property {CBStats~CountsSummary} counts - Cummulative counts summary
 * @property {CBStats~HealthSummary} health - Health summary
 */

module.exports = CBStats;

var CircuitBreaker = require('../lib/circuitbreaker'),
    Bluebird = require('bluebird');

/*
 * When run, this example should print:
 *
 * $ node simple.js
 * This call succeeds 10 0.8985337508571343
 * This fails
 * This call times out
 *
 */

// A contrived example with a made up example function
// that after the configured time (in ms) either fails
// with the error passed or succeeds returning the ms argument
// and a random one
var sleepFun = function(ms, err, callback) {
    setTimeout(function() {
        if (err) {
            callback(err);
        } else {
            callback(null, ms, Math.random());
        }
    }, ms);
};
var promises = [];

// Create a circuit breaker with a 100ms timeout threshold
var cb = new CircuitBreaker(sleepFun, null, {
    timeout: 100
});

// this promise should succeed
var p = cb.exec(10, null)
.spread(function(ms, random) {
    console.log("This call succeeds", ms, random);
});
promises.push(p);

// this call should timeout
p = cb.exec(200, null)
.then(function() {
    console.log("This doesn't get executed");
}).catch(CircuitBreaker.TimeoutError, function(error) {
    console.log("This call times out");
});
promises.push(p);

// this throws the given error
p = cb.exec(10, new Error())
.then(function() {
    console.log("This doesn't get executed");
}).catch(function(error) {
    console.log("This fails");
});

Bluebird.settle(promises).then(function() {
    cb.stopEvents();
});

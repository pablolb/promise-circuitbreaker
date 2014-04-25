var CircuitBreaker = require('../lib/circuitbreaker'),
    Promise = require('bluebird');

var sleepFun = function(ms, err, cb) {
    setTimeout(function() {
        if (err) {
            cb(err);
        } else {
            cb();
        }
    }, ms);
};
var promises = [];

var cb = new CircuitBreaker(sleepFun, null, {
    timeout: 100
});

var p = cb.exec(10, null)
.then(function() {
    console.log("This call succeeds");
});
promises.push(p);


p = cb.exec(200, null)
.then(function() {
    console.log("This doesn't get executed");
}).catch(CircuitBreaker.TimeoutError, function(error) {
    console.log("This call times out");
});
promises.push(p);

p = cb.exec(10, new Error())
.then(function() {
    console.log("This doesn't get executed");
}).catch(function(error) {
    console.log("This fails");
});

Promise.settle(promises).then(function() {
    cb.stopEvents();
});

var mysql = require('mysql'),
    Promise = require('bluebird'),
    CircuitBreaker = require('../lib/circuitbreaker'),
    TimeoutError = CircuitBreaker.TimeoutError,
    OpenCircuitError = CircuitBreaker.OpenCircuitError;

var pool = mysql.createPool({
    host: 'localhost',
    database: 'test'
});

var addNamedError = function(error) {
    if (error) {
        error.name = error.code;
        return error;
    }
};

var opts = {
    timeout: 1000,
    volumeThreshold: 0,
    errorThreshold: 0,
    isErrorHandler: addNamedError
};

var logError = function(error) {
    console.log("Error!", error);
};
var cb = new CircuitBreaker(pool.query, pool, opts);
var promises = [],
    p;

p = cb.exec('SELECT sleep(1.5)')
.then(function() {
    console.log("Error! Should timeout!");
})
.catch(TimeoutError, function(error) {
    console.log("OK!", error);
}).catch(logError);
promises.push(p);

p = cb.exec('SELECT sleep(0.1)')
.spread(function(rows, fields) {
    console.log("OK!", rows);
}).catch(logError);
promises.push(p);

p = cb.exec('SELECT BadQuery')
.spread(function(rows, fields) {
    console.log("Error! Should have failed!");
}).catch(function(error) {
    console.log("OK!", error.name);
    p = cb.exec('SELECT 1')
    .spread(function() {
        console.log("Error! Should have failed!");
    }).catch(OpenCircuitError, function(error) {
        console.log("OK!", error);
    }).catch(logError);
    promises.push(p);
});
promises.push(p);


Promise.settle(promises)
.finally(function() {
    process.exit();
});

/*
OK! ER_BAD_FIELD_ERROR
OK! { name: 'OpenCircuitError',
  message: 'Circuit Breaker was tripped' }
OK! [ { 'sleep(0.1)': 0 } ]
OK! { name: 'TimeoutError', message: 'Timed out after 1000 ms' }
*/

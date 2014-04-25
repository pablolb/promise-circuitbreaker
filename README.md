#Install
You can install locally with `npm install promise-circuitbreaker`.

#Introduction
A circuit breaker implementation for node with three main features:

* It wraps "node functions" and uses [bluebird](https://www.npmjs.org/package/bluebird)
Promise library to "promisify" the response.
* It uses a rolling window to calculate the circuit's health.
* It can use different error thresholds for different error types.

For more information about the Circuit Breaker pattern you can read 
Martin Fowler's [CircuitBreaker](http://martinfowler.com/bliki/CircuitBreaker.html).

The rolling window is based on Netflix's [Hystrix](https://github.com/Netflix/Hystrix/),
as is the half-open state in which a test request will be made to close the circuit on success.

The package provides two main classes, the CircuitBreaker, and the RequestCircuitBreaker
which wraps the [request](https://www.npmjs.org/package/request) module.

#Quick Start

```javascript
var mysql = require('mysql'),
    CircuitBreaker = require('promise-circuitbreaker'),
    TimeoutError = CircuitBreaker.TimeoutError,
    OpenCircuitError = CircuitBreaker.OpenCircuitError;

var pool = mysql.createPool({
    host: 'localhost',
    database: 'test'
});

var cb = new CircuitBreaker(pool.query, pool, {
    timeout: 1000,
    errorThreshold: 0.1
});

cb.exec('SELECT sleep(0.1)').spread(function(rows, fields) {
    console.log("OK!", rows);
}).catch(TimeoutError, function(error) {
    console.log("Handle timeout here");
}).catch(OpenCircuitError, function(error) {
    console.log("Handle open circuit error here");
}).catch(function(error) {
    console.log("Handle any error here");
}).finally(function() {
    cb.stopEvents();
    pool.end();
});

```
#Request Circuit Breaker Quick Start
```javascript
var CircuitBreaker = require('promise-circuitbreaker'),
    RequestCircuitBreaker = CircuitBreaker.RequestCircuitBreaker,
    TimeoutError = CircuitBreaker.TimeoutError,
    OpenCircuitError = CircuitBreaker.OpenCircuitError;

var isError = function(error, response, body) {
    if (error) return error;
    if (response.statusCode == 503) {
        var unavailableError = new Error();
        unavailableError.name = "ServiceUnavailableError";
        return unavailableError;
    }
    return null;
};

var cb = new RequestCircuitBreaker({
    isErrorHandler: isError,
    errorThreshold: 0.1, // allow 10% error rate
    errorNamesThresholds: {
        ServiceUnavailableError: 0 // but close circuit on first unavailable error
    }
});

cb.exec({url: 'https://graph.facebook.com/19292868552', json: true})
.spread(function(response, page) {
    console.log(page);
}).catch(TimeoutError, function(error) {
    console.log("Timeout!", error);
}).catch(OpenCircuitError, function(error) {
    console.log("Circuit is open!");
}).catch(function(error) {
    console.log("Other error");
}).finally(function() {
    cb.stopEvents();
});
```

#Health Window
The circuit breaker monitors the health using a rolling window.  The
total period of time is determined by the number of windows and the
size of each window.  This is the same as the "buckets" in
[Netflix's Circuit Breaker](https://github.com/Netflix/Hystrix/wiki/How-it-Works#CircuitBreaker)
The defaults are the same as in Netflix's implementation (10 intervals of 1 second each).

#Concurrency
The circuit breaker keeps a count of the current "active" calls.
These are calls which have begun but whose callback has not yet been called
*and* which have not yet timedout.
Disabled by default, you can configure the circuit breaker to queue requests once
the active counter reaches a certain level.
This might help you protect your backend by limiting the simultaneous calls made
to it.  There are, however, some things to keep in mind.

First of all, the wrapped resource might have it's own control. This is the case if you are using a
mysql pool of connections, for example. The [request](https://github.com/mikeal/request) module uses
pooling which defaults to node's global [http.agent.maxSockets](http://nodejs.org/api/http.html#http_agent_maxsockets).
So if you are using the RequestCircuitBreaker, even if you do not restrict the concurrency
at the circuit breaker's level, you might notice that there are never more than 5 active connections (per host)
which is node's default.

You might want to use the circuit breaker's concurrency throttling to alter this behaviour. Consider a RESTful API,
you could set node's (or the request module) pooling to 100 but have different circuit breakers
with different concurrency settings for different resources.

However, please notice that the current implementation *does not care* how much time a call remains
in the queue. The timeout control starts once the call is actually executed.  So, the end-user could end waiting
a more than expected even if the call succeeds very quickly, because it might have spent some time
in the queue.

#Example App
If you download the project you can run a more complete example.
For more information please read its
[readme](https://github.com/pablolb/promise-circuitbreaker/tree/master/example/app/).

#Configuration
There are several parameters which allow you to configure the circuit breaker's
behaviour, allowing you to adjust it to your particular needs.
Please look at the [docs](http://pablolb.github.io/promise-circuitbreaker/CircuitBreaker.html)
for more details.

##Volume Threshold
The minimum amount of total calls in the health window required to start
calculating the circuit's health. The circuit remains *closed* until this level is reached.
You can set it to zero to always calculate the circuit's health. With a positive errorThreshold,
this means that if the first request is an error, the circuit will trip.

##Timeout
The maximum amount of time the circuit breaker waits for the callback before failing
with a TimeoutError. You can set it to zero to disable this functionality. The circuit breaker
will only trip on errors.

##Error Threshold
The ratio of errors in the current health window which trips (opens) the circuit.
The value is expressed as a float between 0 and 1. Setting it two 0 trips the circuit
on the first error. Setting it to one, forces the circuit to always remain closed.
You can also set a lower error rate for particular errors.

#Running the tests
You can run the tests with `make test`.  The main test is written with
[yadda](https://github.com/acuminous/yadda) and run through mocha.

#License
The MIT License (MIT)

Copyright (c) 2014 Pablo de León Belloc

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

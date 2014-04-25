var English = require('yadda').localisation.English,
    sinon = require('sinon'),
    should = require('chai').should(),
    util = require('util'),
    CircuitBreaker = require('../../lib/circuitbreaker'),
    STATE = CircuitBreaker.STATE;

function MockError() {
    this.name = "MockError";
    this.message = "Mocked Error";
}
util.inherits(MockError, Error);
global.MockError = MockError; // make it accessible as global['MockError']

var timeoutStub = function(ms, error, returnValue) {
    return function() {
        var args = Array.prototype.slice.call(arguments);
        setTimeout(function() {
            var cb = args.pop();
            if (error) {
                cb(error);
            } else {
                cb(null, returnValue);
            }
        }, ms);
    };
};

var okStub = function(cb) {
    cb();
};

var errStub = function(error) {
    error = error || new MockError();
    return function(cb) {
        cb(error);
    };
};

module.exports = (function() {
    
    var library = English.library();

    var sut,
        fn,
        stubs,
        clock,
        spy,
        eventSpy,
        callbackEventSpy,
        expectedCallbackArg,
        promise;

    beforeEach(function(done) {
        stubs = [];
        fn = function() {
            var stub = stubs.shift();
            var args = Array.prototype.slice.call(arguments);
            return stub.apply(null, args);
        };
        clock = sinon.useFakeTimers();
        // don't start on 0
        clock.tick(1);
        spy = sinon.spy();
        eventSpy = sinon.spy();
        callbackEventSpy = sinon.spy();
        done();
    });

    afterEach(function(done) {
        clock.restore();
        done();
    });

    return library
    .given("a circuit breaker", function(next) {
        sut = new CircuitBreaker(fn);
        next();
    })
    .given("setting the timeout to $MS ms", function(ms, next) {
        sut.setTimeout(parseInt(ms));
        next();
    })
    .given("setting the reset time to $MS ms", function(ms, next) {
        sut.setResetTime(parseInt(ms));
        next();
    })
    .given("setting the interval size to $MS ms", function(ms, next) {
        sut.setIntervalSize(parseInt(ms));
        next();
    })
    .given("setting the window size to $MS ms", function(ms, next) {
        sut.setWindowSize(parseInt(ms));
        next();
    })
    .given("setting the window count to $COUNT", function(count, next) {
        sut.setWindowCount(parseInt(count));
        next();
    })
    .given("setting the interval event to $BOOL", function(bool, next) {
        sut.setEmitIntervalEvent(bool === "true");
        next();
    })
    .given("setting the callback event to $BOOL", function(bool, next) {
        sut.setEmitCallbackEvent(bool === "true");
        next();
    })
    .given("setting the error threshold to $THRESHOLD", function(threshold, next) {
        sut.setErrorThreshold(parseFloat(threshold));
        next();
    })
    .given("setting the $ERROR error threshold to $THRESHOLD", function(error, threshold, next) {
        sut.setErrorNameThreshold(error, parseFloat(threshold));
        next();
    })
    .given("setting the volume threshold to $THRESHOLD", function(threshold, next) {
        sut.setVolumeThreshold(parseInt(threshold));
        next();
    })
    .given("setting the concurrency level to $NUM", function(num, next) {
        sut.setConcurrency(parseInt(num));
        next();
    })
    .given("setting a custom isError handler", function(next) {
        sut.setIsErrorHandler(function() {
            return new MockError(); 
        });
        next();
    })
    .when("a call that lasts $MS ms is made", function(ms, next) {
        stubs.push(timeoutStub(parseInt(ms)));
        promise = sut.exec();
        next();
    })
    .when("$NUM calls that last $MS ms are made", function(count, ms, next) {
        count = parseInt(count);
        for (var i = 0; i < count; i++) {
            stubs.push(timeoutStub(parseInt(ms)));
            promise = sut.exec();
        }
        next();
    })
    .when("time advances by $MS ms", function(ms, next) {
        clock.tick(parseInt(ms));
        next();
    })
    .when("one call that fails is made", function(next) {
        stubs.push(errStub());
        promise = sut.exec().catch(MockError, function(error) {});
        next();
    })
    .when("$NUM calls that fail are made", function(num, next) {
        for (var i = 0; i < num; i++) {
            stubs.push(errStub());
            sut.exec().catch(MockError, function(error) {});
        }
        next();
    })
    .when("$NUM calls that fail are made catching all errors", function(num, next) {
        for (var i = 0; i < num; i++) {
            stubs.push(errStub());
            sut.exec().catch(function(error) {});
        }
        next();
    })
    .when("$NUM calls that timeout are made", function(num, next) {
        for (var i = 0; i < num; i++) {
            stubs.push(timeoutStub(1));
            sut.exec().catch(TimeoutError, function(error) {});
            clock.tick(1);
        }
        next();
    })
    .when("one call that succeeds is made", function(next) {
        stubs.push(okStub);
        promise = sut.exec();
        next();
    })
    .when("$NUM calls that succeed are made", function(num, next) {
        for (var i = 0; i < num; i++) {
            stubs.push(okStub);
            sut.exec();
        }
        next();
    })
    .when("I make a call which I spy", function(next) {
        stubs.push(spy);
        promise = sut.exec();
        next();
    })
    .when("I catch $ERROR", function(error, next) {
        promise.catch(global[error], function() {});
        next();
    })
    .when("one call that fails with not-an-error", function(next) {
        stubs.push(errStub("A String"));
        sut.exec().catch(function() {});
        next();
    })
    .when("I listen to the interval event", function(next) {
        sut.on('interval', eventSpy);
        next();
    })
    .when("I listen to the callback event", function(next) {
        sut.on('callback', callbackEventSpy);
        next();
    })
    .when("I call circuit breaker's startEvents", function(next) {
        sut.startEvents();
        next();
    })
    .when("I make a call which lasts 100 and remember the expected callback", function(next) {
        var arg1 = "arg1",
            arg2 = 12,
            returnValue = "any return value";
        stubs.push(timeoutStub(100, null, returnValue));
        promise = sut.exec(arg1, arg2);
        expectedCallbackArg = {
            start: Date.now(),
            args: [arg1, arg2],
            end: Date.now() + 100,
            result: [returnValue]
        };
        next();
    })
    .when("I make a call which lasts 100 and fails and remember the expected callback", function(next) {
        var arg1 = "arg1",
            arg2 = 12,
            returnValue = "any return value";
        var error = new MockError("Any Error");
        stubs.push(timeoutStub(100, error));
        promise = sut.exec(arg1, arg2).catch(MockError, function() {});
        expectedCallbackArg = {
            start: Date.now(),
            args: [arg1, arg2],
            end: Date.now() + 100,
            result: [error]
        };
        next();
    })
    .when("I make a call which lasts 100 and short-circuits and remember the expected callback", function(next) {
        var arg1 = "arg1",
            arg2 = 12,
            returnValue = "any return value";
        stubs.push(timeoutStub(100, null, returnValue));
        promise = sut.exec(arg1, arg2).catch(OpenCircuitError, function() {});
        expectedCallbackArg = {
            start: Date.now(),
            args: [arg1, arg2],
            end: null,
            result: [new OpenCircuitError()]
        };
        next();
    })
    .then("the promise succeeds", function(next) {
        promise.then(function() {
            next();
        }).catch(function(error) {
            next(error);
        });
    })
    .then("the promise fails with $ERROR", function(error, next) {
        promise.then(function() {
            next(new Error("Should failed!"));
        }).catch(global[error], function(error) {
            next();
        });
    })
    .then("the circuit should be $STATE", function(state, next) {
        var states = {
            open: STATE.OPEN,
            closed: STATE.CLOSED,
            'half-open': STATE.HALF_OPEN
        };
        sut.getState().should.equal(states[state]);
        next();
    })
    .then("the protected call should not be made", function(next) {
        sinon.assert.notCalled(spy);
        next();
    })
    .then("there should be $NUM active requests", function(num, next) {
        num = parseInt(num);
        num.should.equal(sut.getActiveCount());
        next();
    })
    .then("the current counts should include one _NoName", function(next) {
        sut.getCurrentCounts().errors._NoName.should.equal(1);
        next();
    })
    .then("the current counts is empty", function(next) {
        var counts = sut.getCurrentCounts();
        counts.total.should.equal(0, "Total");
        counts.success.should.equal(0, "Success");
        counts.totalErrors.should.equals(0, "Total Errors");
        counts.errors.should.eql({}, "Errors");
        next();
    })
    .then("the listener should have been called $NUM times", function(num, next) {
        num = parseInt(num);
        sinon.assert.callCount(eventSpy, num);
        next();
    })
    .then("the callback listener should have been called $NUM times", function(num, next) {
        num = parseInt(num);
        sinon.assert.callCount(callbackEventSpy, num);
        next();
    })
    .then("the error percentage is $PERCENTAGE", function(percentage, next) {
        percentage = parseFloat(percentage);
        sut.getErrorPercentage().should.equal(percentage, "Error Percentage");
        next();
    })
    .then("the callback listener should be called with the correct argument", function(next) {
        sinon.assert.calledOnce(callbackEventSpy);
        var call = callbackEventSpy.getCall(0).args[0];
        call.should.eql(expectedCallbackArg, "Callback event argument");
        next();
    });
})();

var CircuitBreaker = require('../lib/circuitbreaker'),
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

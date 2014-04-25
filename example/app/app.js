var express = require('express'),
    Promise = require('bluebird'),
    request = require('request'),
    getRandomInt = require('./random_int'),
    RequestCircuitBreaker = require('../../lib/circuitbreaker').RequestCircuitBreaker,
    CBObserver = require('../../lib/circuitbreaker').CBObserver;

module.exports = function(port) {
    var app = express(),
        cbs = [],
        statsPort = null,
        reqs = 0;
    var isErrorHandler = function(error, response, body) {
        if (error) {
            return error;
        }
        if (response.statusCode == 503) {
            var unavailableError = new Error();
            unavailableError.name = "ServiceUnavailableError";
            return unavailableError;
        }
        return null;
    };

    this.configure = function(config) {
        statsPort = config.statsPort;
        config.services.forEach(function(service) {
            var cb = new RequestCircuitBreaker({
                name: "CB:" + service.port + ":" + port,
                errorThreshold: service.errorThreshold,
                errorNamesThresholds: service.errorNamesThresholds,
                timeout: service.timeout,
                resetTime: service.resetTime,
                concurrency: service.concurrency,
                windowSize: 10000,
                intervalSize: 1000,
                isErrorHandler: isErrorHandler
            });
            cb.service = service;
            cbs.push(cb);
        });
    };
       
    app.get("/", function(req, res) {
        var promises = [];
        cbs.forEach(function(cb) {
            var n = getRandomInt(1, cb.service.calls);
            for (var i = 0; i < n; i++) {
                var url = "http://localhost:" + cb.service.port + "/random-sleep/" + cb.service.sleep;
                promises.push(cb.exec(url));
            }
        });
        Promise.map(promises, function(res) { return res[1]; }).then(function(results) {
            res.send(results.join("\n"));
            res.set('Content-Type', 'text/plain');
            reqs++;
        }).catch(function(error) {
            reqs++;
            res.send("Error: " + error);
        });
    });

    this.start = function() {
        process.title = 'node (app:' + port + ')';
        app.listen(port, function() {
            var start = Date.now();
    
            var observer = new CBObserver();
            cbs.forEach(function(cb) {
                observer.watch(cb);
            });
            
            var ioClient = require('socket.io-client');
            setTimeout(function() {
                var socket = ioClient.connect('http://localhost:' + statsPort);
                socket.on('connect', function() {
                    console.log("Connected to stats server");
                    observer.on('batch', function(data) {
                        socket.emit('circuit-breakers', data);
                    });
                });
            }, 1000);

            console.log("[%d] APP Listening on %d", process.pid, port);
            setInterval(function() {
                var elapsed = (Date.now() - start) / 1000;
                var rps = elapsed ? reqs / elapsed : 0;
                console.log("App req/s: " + rps);
            }, 1000);
        });
    };

};

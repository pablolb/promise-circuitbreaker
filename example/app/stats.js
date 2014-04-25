var express = require('express'),
    _ = require('lodash'),
    CBStats = require('../../lib/circuitbreaker').CBStats;

module.exports = function(config) {
    
    var app = express();
    app.use(express.static(__dirname + "/static"));

    var stats = {};
    function processStats(cbs) {
        for (var k in cbs) {
            if (!(k in stats)) {
                stats[k] = new CBStats();
            }
            stats[k].add(cbs[k]);
        }
    }

    this.start = function() {
        process.title = "node (stats server)";
        var server = app.listen(config.webPort, function() {
            console.log("[%d] STATS listening on %d", process.pid, config.webPort);
        });
    
        var io = require('socket.io').listen(server);
    
        io.sockets.on('connection', function (socket) {
            var last = {};
    
            var timeoutObj = setInterval(function() {
                var news = {};
                
                for (var k in stats) {
                    var history = stats[k].getCounters();
                    news[k] = {
                        summary: stats[k].getSummary(),
                        series: null
                    };
                    if (undefined === last[k]) {
                        last[k] = null;
                    }
                    if (last[k]) {
                        var i;
                        for (i = 0; i < history.length; i++) {
                            if (_.isEqual(last[k], history[i])) {
                                break;
                            }
                        }
                        if (i < history.length) {
                            news[k].series = history.slice(i + 1);
                        } else {
                            news[k].series = history;
                        }
                    } else {
                        news[k].series = history;
                    }
                    last[k] = news[k].series[news[k].series.length - 1];
                    //console.log(k, last[k].start, news[k].series.length);
                }
                
                socket.emit('cbs', news);
            }, 1000);
            
            socket.on('disconnect', function () {
                clearInterval(timeoutObj);
            });
        });
    
        var iob = require('socket.io').listen(config.ioPort);
        iob.on('connection', function(socket) {
            socket.on('circuit-breakers', function(data) {
                processStats(data);
            });
        });
    };

};

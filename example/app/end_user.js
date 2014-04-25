var request = require('request'),
    getRandomInt = require('./random_int');

module.exports = function(ports) {
    
    var opts;

    function doRequest(ctx) {
        if (!ctx) {
            ctx = {
                cycle: 0,
                minTime: 0,
                maxTime: 0
            };
        }
        var i = getRandomInt(0, ports.length - 1);
        request("http://localhost:" + ports[i], function(error, response, body) {
            if (error) {
                console.log("[USER] Got error: ", error);
            }
        });
        if (ctx.cycle === 0) {
            ctx.cycle = getRandomInt(10, 100);
            ctx.minTime = getRandomInt(opts.minSleep, opts.maxSleep);
            ctx.maxTime = getRandomInt(ctx.minTime, opts.maxSleep);
        }
        setTimeout(function() {
            doRequest(ctx);
        }, getRandomInt(ctx.minTime, ctx.maxTime));
        ctx.cycle--;
    }
    
    this.start = function(options) {
        opts = options;
        process.title = 'node (user worker)';
        for (var i = 0; i < opts.users; i++) {
            setTimeout(doRequest, 1000);
        }
    };

};

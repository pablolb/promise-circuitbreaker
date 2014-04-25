var cluster = require('cluster'),
    minimist = require('minimist'),
    Stats = require('./stats'),
    Service = require('./service'),
    EndUser = require('./end_user'),
    App = require('./app');

var opts = {
    USER_WORKERS: 2,
    USERS_PER_WORKER: 5,
    USERS_MIN_SLEEP: 100,
    USERS_MAX_SLEEP: 750,
    SERVICE_PORT_1: 3001,
    SERVICE_PORT_2: 3002,
    SERVICE_PORT_3: 3003,
    APP_PORT_1: 3003,
    APP_PORT_2: 3004,
    STATS_S2S_PORT: 3005,
    STATS_WEBUI_PORT: 3000,
    GLOBALAGENT_MAXSOCKETS: 1000
};

function help() {
    console.log("usage: %s [options]", process.argv.slice(0, 2).join(" "));
    console.log("\n\nThis example will spawn several node processes simulating two app servers, three backend services, one stats server, and a configurable amount of 'user workers' simulating end-user requests.\n\nThe app servers make requests to the three backend services through circuit breakers and push their metrics to the stats server, which has a monitoring web-UI.\n\n");
    console.log("-h, --help                 Print this help and exit");
    console.log("--user-workers             Number of childs to fork which simulate end-user requests (default: %d)",
                                            opts.USER_WORKERS);
    console.log("--users-per-worker         Number or users to simulate per worker child (default: %d)",
                                            opts.USERS_PER_WORKER);
    console.log("--users-min-sleep          Minimum milliseconds to sleep before performing another request (default: %d)",
                                            opts.USERS_MIN_SLEEP);
    console.log("--users-max-sleep          Maximum milliseconds to sleep before performing another request (default: %d)",
                                            opts.USERS_MAX_SLEEP);
    console.log("--service-port-{1,2,3}     Port to listen on for the service number N (1,2,3) (defaults: %d, %d, %d)",
                                            opts.SERVICE_PORT_1, opts.SERVICE_PORT_2, opts.SERVICE_PORT_3);
    console.log("--app-port-{1,2}           Port to listen on for the app N (1,2) (defaults: %d, %d)",
                                            opts.APP_PORT_1, opts.APP_PORT_2);
    console.log("--stats-s2s-port           Port to listen for stats collection (default: %d)",
                                            opts.STATS_S2S_PORT);
    console.log("--stats-webui-port         Port where the stats server servers the web UI (default: %d)",
                                            opts.STATS_WEBUI_PORT);
    console.log("--globalagent-maxsockets   http.globalAgent.maxSockets value (default: %d)",
                                            opts.GLOBALAGENT_MAXSOCKETS);
}

var argv = minimist(process.argv.slice(2));

if (argv.h || argv.help) {
    help();
    process.exit();
}
for (var capsK in opts) {
    var k = capsK.toLowerCase().replace(/_/g, '-');
    if (!(k in argv)) {
        continue;
    }
    var num = parseInt(argv[k]);
    if (isNaN(num)) {
        console.log("Option --%s should be a number! (%s given)", k, argv[k]);
        process.exit(1);
    }
    opts[capsK] = num;
}


require('http').globalAgent.maxSockets = opts.GLOBALAGENT_MAXSOCKETS;

var services = [{
    port: opts.SERVICE_PORT_1,
    timeout: 500,
    resetTime: 1000,
    concurrency: 20,
    errorThreshold: 0.1,
    errorNamesThresholds: {
        ServiceUnavailableError: 0
    },

    // app will make N calls to this service per user request
    calls: 3,
    // app will tell service to random sleep until N ms
    sleep: 300
}, {
    port: opts.SERVICE_PORT_2,
    timeout: 300,
    resetTime: 600,
    concurrency: 50,
    errorThreshold: 0.1,
    errorNamesThresholds: {
        ServiceUnavailableError: 0
    },
    calls: 6,
    sleep: 200
}, {
    port: opts.SERVICE_PORT_3,
    timeout: 300,
    resetTime: 600,
    concurrency: 10,
    errorThreshold: 0.1,
    errorNamesThresholds: {
        ServiceUnavailableError: 0
    },
    calls: 2,
    sleep: 100
}];

var apps = [opts.APP_PORT_1, opts.APP_PORT_2];

var statsServer = {
    webPort: opts.STATS_WEBUI_PORT,
    ioPort: opts.STATS_S2S_PORT
};

if (cluster.isMaster) {
    var statsWorker = null,
        serviceWorkers = [],
        appWorkers = [],
        userWorkers = [];
    
    console.log("The web UI will be on http://localhost:%d/", opts.STATS_WEBUI_PORT);
    console.log("You have 5 seconds to abort...");
    function countdown(n) {
        if (n >= 1) {
            console.log("%d...", n);
            setTimeout(function() {
                countdown(n-1);
            }, 1000);
        } else {
            console.log("This will get a bit verbose...");
            setTimeout(start, 1000);
        }
    }
    countdown(5);

    function start() {
    
    statsWorker = cluster.fork({statsServer: true});

    services.forEach(function(service) {
        serviceWorkers.push(cluster.fork({service: service.port}));
    });

    apps.forEach(function(port) {
        appWorkers.push(cluster.fork({app: port}));
    });

    for (var i = 0; i < opts.USER_WORKERS; i++) {
        userWorkers.push(cluster.fork());
    }

    statsWorker.send('start');

    serviceWorkers.forEach(function(worker) {
        worker.send('start');
    });

    appWorkers.forEach(function(worker) {
        worker.send({
            msg: 'start',
            config: {services: services, statsPort: statsServer.ioPort}
        });
    });

    userWorkers.forEach(function(worker) {
        worker.send('start');
    });
    }
} else {
    if (process.env.statsServer) {
        var server = new Stats(statsServer);
        process.on('message', function(msg) {
            if (msg == 'start') {
                server.start();
            }
        });
    } else if (process.env.service) {
        var service = new Service(parseInt(process.env.service));
        process.on('message', function(msg) {
            if (msg == 'start') {
                service.start();
            }
        });
    } else if (process.env.app) {
        var app = new App(parseInt(process.env.app));
        process.on('message', function(msg) {
            if (msg.msg == 'start') {
                app.configure(msg.config);
                app.start();
            }
        });
    } else {
        var user = new EndUser(apps);
        process.on('message', function(msg) {
            if (msg == 'start') {
                user.start({
                    users: opts.USERS_PER_WORKER,
                    minSleep: opts.USERS_MIN_SLEEP,
                    maxSleep: opts.USERS_MAX_SLEEP
                });
            }
        });
    }
}


requirejs.config({
    baseUrl: 'js/lib',
    shim: {
        'socketio': {
            exports: 'io'
        },
        'handlebars': {
            exports: 'Handlebars'
        }
    },
    map: {
      '*': {'jquery': 'jquery-private'},
      'jquery-private': {'jquery': 'jquery'}
    },
    paths: {
        jquery: 'jquery-2.1.0.min',
        socketio: '../../socket.io/socket.io',
        lodash: 'lodash.min',
        d3: 'd3.v3.min',
        handlebars: 'handlebars-v1.3.0'
    },


});


require(['socketio', 'jquery', 'circuitbreaker-view'], function(io, $, CircuitBreakerView) {
    var $container = $('#circuitbreakers');
    var views = {};
    
    var socket = io.connect('http://' + window.location.host);
    socket.on('cbs', function (cbs) {
        for (var k in cbs) {
            if (!views[k]) {
                views[k] = new CircuitBreakerView(k, $container, {
                    requestsPerPixel: 300
                });
            }
            views[k].update(cbs[k]);
        }
    });

});

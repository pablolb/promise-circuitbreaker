var CircuitBreaker = require('../lib/circuitbreaker'),
    fs = require('fs');

  /*
   * When run, this example should print:
   *
   * $ node simple-fs.js
   * [ 'app',
   *   'mysql.js',
   *   'request-circuitbreaker.js',
   *   'simple-fs.js',
   *   'simple.js' ]
   */

var cb = new CircuitBreaker(fs.readdir);

cb.exec(__dirname)
.then(function(dirContents) {
    console.log(dirContents);
});

cb.stopEvents();

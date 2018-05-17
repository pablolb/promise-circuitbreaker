var Yadda = require('yadda'),
    path = require('path');

if (typeof Promise === "function") {

  Yadda.plugins.mocha.AsyncScenarioLevelPlugin.init();

  new Yadda.FeatureFileSearch(path.join(__dirname, 'features')).each(function(file) {
      featureFile(file, function(feature) {

          var library = require('./steps/circuitbreaker')({Promise: Promise});
          var yadda = new Yadda.Yadda(library);

          scenarios(feature.scenarios, function(scenario, done) {
              yadda.yadda(scenario.steps, done);
          });

      });
  });

}

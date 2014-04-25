function Counts() {
    this.total = 0;
    this.success = 0;
    this.totalErrors = 0;
    this.errors = {};
}
Counts.prototype.addError = function(error) {
    var name = error.name || '_NoName';
    this.totalErrors++;
    if (name in this.errors) {
        this.errors[name]++;
    } else {
        this.errors[name] = 1;
    }
};

function RollingCounts(size) {
    var mySize = (undefined === size) ? 10 : size,
        self = this,
        counts, current, sum;

    this.reset = function() {
        current = new Counts();
        sum = new Counts();
        counts = [];
    };

    this.addSuccess = function() {
        current.total++;
        current.success++;
        sum.success++;
        sum.total++;
    };

    this.addError = function(error) {
        current.addError(error);
        current.total++;
        sum.addError(error);
        sum.total++;
    };

    this.setSize = function(size) {
        mySize = size;
    };

    this.roll = function() {
        counts.push(current);
        current = new Counts();
        if (counts.length + 1 > mySize) {
            var shifted = counts.shift();
            sum.total -= shifted.total;
            sum.success -= shifted.success;
            sum.totalErrors -= shifted.totalErrors;
            for (var k in shifted.errors) {
                sum.errors[k] -= shifted.errors[k];
                if (sum.errors[k] === 0) {
                    delete sum.errors[k];
                }
            }
        }
    };

    this.getSize = function() {
        return mySize;
    };

    this.getCurrent = function() {
        return sum;
    };

    this.getCurrentErrorLevel = function() {
        return sum.total ? sum.totalErrors / sum.total : 0;
    };
    
    this.getCurrentNamedErrorLevels = function(thresholds) {
        var levels = {};
        for (var name in thresholds) {
            levels[name] = sum.errors[name] ? sum.errors[name] / sum.total : 0;
        }
        return levels;
    };

    self.reset();
}

module.exports = {
    Counts: Counts,
    RollingCounts: RollingCounts
};

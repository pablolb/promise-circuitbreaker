var should = require('chai').should(),
    Counts = require('../lib/counts').Counts,
    STATE = require('../lib/circuitbreaker').STATE,
    CBStats = require('../lib/circuitbreaker').CBStats;


describe('CBStats', function() {
    
    it('should start empty', function() {
        var sut = new CBStats();
        sut.getSummary().should.eql({}, "Empty summary");
    });

    it('should add times from intervals', function() {
        var sut = new CBStats({
            timesLength: 2
        });

        var interval1 = fakeInterval();
        interval1.times = [1, 1, 2];
        
        var interval2 = fakeInterval();
        interval2.times = [3, 5, 6];

        var expectedTimes = {
            amean: 3,
            median: 2.5,
            p900: 6,
            p990: 6
        };

        sut.add([interval1, interval2]);

        sut.getSummary().times.should.eql(expectedTimes, "Times");
    });

    it('should substract times when they fall off the counters period', function() {
        var sut = new CBStats({
            timesLength: 1
        });

        var interval1 = fakeInterval();
        interval1.times = [1, 1, 2];
        
        var interval2 = fakeInterval();
        interval2.times = [1, 5, 6];

        var expectedTimes = {
            amean: 4,
            median: 5,
            p900: 6,
            p990: 6
        };

        sut.add([interval1, interval2]);

        sut.getSummary().times.should.eql(expectedTimes, "Times");
    });
    
    it('should add counters from intervals', function() {
        var sut = new CBStats({
            countsLength: 2
        });

        var interval1 = fakeCountsInterval();
        var interval2 = fakeCountsInterval();
        interval2.errors = {
            Error: 1,
            TimeoutError: 1
        };

        var expectedCounts = {
            total: 20,
            success: 16,
            totalErrors: 4,
            errors: {
                Error: 2,
                _NoName: 1,
                TimeoutError: 1
            }
        };

        sut.add([interval1, interval2]);
        sut.getSummary().counts.should.eql(expectedCounts, "Counts");
    });
    
    it('should substract counters from intervals when they fall off the counters period', function() {
        var sut = new CBStats({
            countsLength: 1
        });

        var interval1 = fakeCountsInterval();
        var interval2 = fakeCountsInterval();
        interval2.errors = {
            Error: 1,
            TimeoutError: 1
        };

        var expectedCounts = {
            total: 10,
            success: 8,
            totalErrors: 2,
            errors: {
                Error: 1,
                TimeoutError: 1
            }
        };

        sut.add([interval1, interval2]);
        sut.getSummary().counts.should.eql(expectedCounts, "Counts");
    });
    
    it('should add interval and update health window', function() {
        var sut = new CBStats({
            healthsLength: 2
        });

        var interval1 = fakeCountsInterval();
        interval1.sate = STATE.CLOSED;
        
        var interval2 = fakeCountsInterval();
        interval2.active = 2;
        interval2.queued = 1;
        interval2.start = 2000;
        interval2.end = 3000;
        interval2.state = STATE.OPEN;

        var expectedHealth = {
            total: 20,
            success: 16,
            totalErrors: 4,
            timeouts: 0,
            rejected: 0,
            otherErrors: 4,
            callRate: 10,
            errorRate: 0.2,
            errors: {
                Error: 2,
                _NoName: 2,
            },
            active: 2,
            queued: 1,
            state: STATE.OPEN
        };

        sut.add([interval1, interval2]);
        sut.getSummary().health.should.eql(expectedHealth, "Health");
    });
    
    it('should substract interval when it falls off the health period', function() {
        var sut = new CBStats({
            healthLength: 1
        });

        var interval1 = fakeCountsInterval();
        interval1.sate = STATE.CLOSED;
        
        var interval2 = fakeCountsInterval();
        interval2.start = 2000;
        interval2.end = 4000;
        interval2.errors = {
            TimeoutError: 1,
            OpenCircuitError: 1
        };
        interval2.active = 2;
        interval2.queued = 1;
        interval2.state = STATE.OPEN;

        var expectedHealth = {
            total: 10,
            success: 8,
            totalErrors: 2,
            timeouts: 1,
            rejected: 1,
            otherErrors: 0,
            callRate: 5,
            errorRate: 0.2,
            errors: {
                TimeoutError: 1,
                OpenCircuitError: 1,
            },
            active: 2,
            queued: 1,
            state: STATE.OPEN
        };

        sut.add([interval1, interval2]);
        sut.getSummary().health.should.eql(expectedHealth, "Health");
    });

});

function fakeInterval() {
    var out = new Counts();
    out.start = 1000;
    out.end = 2000;
    out.errors = {};
    out.times = [];
    out.state = STATE.CLOSED;
    return out;
}


function fakeCountsInterval() {
    var out = fakeInterval();
    out.total = 10;
    out.success = 8;
    out.totalErrors = 2;
    out.errors = {
        Error: 1,
        _NoName: 1
    };
    return out;
}

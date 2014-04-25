var counts = require('../lib/counts'),
    Counts = counts.Counts,
    RollingCounts = counts.RollingCounts,
    should = require('chai').should();

describe('Counts', function() {
    
    var sut;
    
    beforeEach(function() {
        sut = new Counts();
    });

    it('should start empty', function() {
        sut.total.should.equal(0, "total");
        sut.success.should.equal(0, "success");
        sut.totalErrors.should.equal(0, "totalErrors");
        sut.errors.should.eql({}, "errors");
    });

    it('should add errors an increment totalErrors', function() {
        sut.addError(new Error());
        sut.totalErrors.should.equal(1, "totalErrors");
    });

    it('should add error counts by name property', function() {
        var error = new Error();
        error.name = "AnyName";
        sut.addError(error);
        sut.errors.AnyName.should.equal(1, "Named error");
    });

    it('should add unnamed errors under _NoName', function() {
        var error = new Error();
        error.name = null;
        sut.addError(error);
        sut.errors._NoName.should.equal(1, "Unnamed error");
    });

});

describe('RollingCounts', function() {

    it('should start empty', function() {
        var sut = new RollingCounts();
        var counts = sut.getCurrent();
        counts.total.should.equal(0, "total");
        counts.success.should.equal(0, "success");
        counts.totalErrors.should.equal(0, "totalErrors");
        counts.errors.should.eql({}, "errors");
    });

    it('the default size should be 10', function() {
        var sut = new RollingCounts();
        sut.getSize().should.equal(10, "default size");
    });

    it('should increment counts', function() {
        var sut = new RollingCounts();
        sut.addSuccess();
        sut.addError(new Error());
        var counts = sut.getCurrent();
        counts.total.should.equal(2, "total");
        counts.success.should.equal(1, "success");
        counts.totalErrors.should.equal(1, "totalErrors");
        counts.errors.should.eql({Error: 1}, "errors");
    });
    
    it('should increment counts after roll if not shifted', function() {
        var sut = new RollingCounts(2);
        sut.addSuccess();
        sut.addError(new Error());
        sut.roll();
        sut.addSuccess();
        sut.addError(new Error());
        var counts = sut.getCurrent();
        counts.total.should.equal(4, "total");
        counts.success.should.equal(2, "success");
        counts.totalErrors.should.equal(2, "totalErrors");
        counts.errors.should.eql({Error: 2}, "errors");
    });

    it('should decrement counts after roll if shifted', function() {
        var sut = new RollingCounts(1);
        sut.addSuccess();
        sut.addError(new Error());
        sut.roll();
        sut.addSuccess();
        sut.addError(new Error());
        var counts = sut.getCurrent();
        counts.total.should.equal(2, "total");
        counts.success.should.equal(1, "success");
        counts.totalErrors.should.equal(1, "totalErrors");
        counts.errors.should.eql({Error: 1}, "errors");
    });
    
    it('should delete errors if count is 0 after roll if shifted', function() {
        var sut = new RollingCounts(1);
        sut.addSuccess();
        sut.addError(new Error());
        sut.roll();
        sut.addSuccess();
        var error = new Error();
        error.name = 'AnyName';
        sut.addError(error);
        var counts = sut.getCurrent();
        counts.total.should.equal(2, "total");
        counts.success.should.equal(1, "success");
        counts.totalErrors.should.equal(1, "totalErrors");
        counts.errors.should.eql({AnyName: 1}, "errors");
    });

});

var CBObserver = require('../lib/circuitbreaker').CBObserver,
    events = require('events'),
    util = require('util'),
    sinon = require('sinon'),
    should = require('chai').should();

function MockCB(name) {
    name = name || 'MockCB';
    this.getName = function() {
        return name;
    };
}
util.inherits(MockCB, events.EventEmitter);


describe('CircuitBreakerObserver', function() {

    it('should listen to the interval event', function() {
        var sut = new CBObserver();
        var cb = new MockCB();
        var mock = sinon.mock(cb);
        mock.expects('on').withArgs('interval', sinon.match.func);

        sut.watch(cb);
        
        mock.verify();
    });

    it('should emit batch event if all CB have emitted grouped by name', function() {
        var stub = new MockCB("name");
        var spy = sinon.spy();
        var sut = new CBObserver();
        sut.on('batch', spy);
        sut.watch(stub);
        var anyData = {key: 'value'};
        
        stub.emit('interval', anyData);

        sinon.assert.calledOnce(spy);
        var call = spy.getCalls()[0];
        call.args[0].should.eql({name: [anyData]});
    });

    it('should emit batch event if more than one per name has emitted', function() {
        var stub1 = new MockCB("one");
        var stub2 = new MockCB("two");
        
        var spy = sinon.spy();
        var sut = new CBObserver();
        sut.on('batch', spy);
        sut.watch(stub1);
        sut.watch(stub2);
        var anyData1 = {key: 'value1'};
        var anyData2 = {key: 'value2'};
        
        stub1.emit('interval', anyData1);
        stub1.emit('interval', anyData2);

        sinon.assert.calledOnce(spy);
        var call = spy.getCalls()[0];
        call.args[0].should.eql({one: [anyData1, anyData2], two: []});
    });

    it('should be able to unwatch a circuit breaker', function() {
        var stub = new MockCB();
        var spy = sinon.spy();
        var sut = new CBObserver();
        sut.on('batch', spy);
        sut.watch(stub);
        sut.unwatch(stub);

        stub.emit('interval', {});

        sinon.assert.notCalled(spy);
    });

});

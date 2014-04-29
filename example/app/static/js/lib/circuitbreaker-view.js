define(['lodash', 'jquery', 'handlebars', 'd3'], function(_, $, Handlebars, d3) {
    
    Handlebars.registerHelper('perc', function(percentage, options) {
      if (typeof percentage == "number") {
        return (100 * percentage).toFixed(options.hash.decimals) + "%";
      } else {
        return "?";
      }
    });
    
    Handlebars.registerHelper('toFixed', function(num, options) {
      if (typeof num == "number") {
        return num.toFixed(options.hash.decimals);
      } else {
        return "?";
      }
    });
    
    
    var defaults = {
        chartMargins: [5, 5, 5, 5],
        chartWidth: 160,
        chartHeight: 80,
        requestsPerPixel: 100,
        containerTmpl: '#tmplContainer',
        infoTmpl: '#tmplInfo',
        svgSelector: '.svg-container',
        infoSelector: '.info-container',
        granularitySelector: 'input[name="granularity"]',
        requestsPerPixelSelector: 'input[name="requestsPerPixel"]',
        history: 120,
        dataGranularity: 2
    };
    
    function CircleView(svg, opts) {
        var circle = svg.append("svg:circle"),
            title = circle.append("svg:title"),
            color = d3.scale.linear()
                .domain([10, 25, 40, 50])
                .range(["green", "#FFCC00", "#FF9900", "red"]),
            cx = opts.chartWidth / 2,
            cy = opts.chartHeight / 2,
            r = function(total) {
                return total / opts.requestsPerPixel;
            };
    
        this.update = function(total, errorRate) {
            circle.transition()
            .duration(100)
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("r", r(total))
            .attr("fill", function() {
                return color(100 * errorRate);
            })
            .attr("fill-opacity", 0.2);
            title.text(function() {
                return total.toLocaleString();
            });
        };
    }
    
    function LineView(svg, opts) {
        var path = svg.append("svg:path"),
            length = parseInt(opts.history / opts.dataGranularity),
            series = [],
            cseries = [];
        
        function map(data) {
            return  {
                time: data.end,
                total: data.total
            };
        }
    
        function sort(a, b) {
            return a.time - b.time;
        }
        
        function condense(series) {
            var out = [], i, j, chunk, total,
                chunkSize = opts.dataGranularity;
            for (i = 0, j = series.length; i < j; i += chunkSize) {
                chunk = series.slice(i, i + chunkSize);
                total = 0;
                for (var k in chunk) {
                    total += chunk[k].total;
                }
                if (chunk.length == chunkSize) {
                    out.push({
                        time: chunk[chunk.length - 1].time,
                        total: total
                    });
                }
            }
            return out;
        }
        
        function updateSeries(data) {
            Array.prototype.push.apply(series, _.map(data, map));
            series.sort(sort);
            cseries = condense(series);
            var extra = cseries.length - length;
            if (extra > 0) {
                cseries.splice(0, extra);
            }
            extra = series.length - opts.history;
            if (extra >= opts.dataGranularity) {
                series.splice(0, opts.dataGranularity);
            }
        }
    
        this.update = function(data) {
            updateSeries(data);
            if (cseries.length === 0) {
                return;
            }
    		var lastInSeries = cseries[cseries.length - 1];
            var x = d3.scale.linear().domain([cseries[0].time, lastInSeries.time])
                .range([0 + opts.chartMargins[1], opts.chartWidth - opts.chartMargins[3]]);
            var yvalues = _.pluck(cseries, 'total');
    		var y = d3.scale.linear().domain([_.min(yvalues), _.max(yvalues)])
                .range([0 + opts.chartMargins[0], opts.chartHeight - opts.chartMargins[2]]);
            var line = d3.svg.line()
                .interpolate("basis")
    			.x(function(d,i) { 
    				return x(d.time); 
    			})
    			.y(function(d) { 
    				return y(d.total); 
    			});
            path.attr("d", line(cseries));
        };
    }
    
    return function CircuitBreakerView(name, $container, options) {
    
        var opts = _.defaults(_.extend({}, options || {}), defaults);
    
        var containerTmpl = Handlebars.compile($(opts.containerTmpl).html()),
            infoTmpl = Handlebars.compile($(opts.infoTmpl).html()),
            $me = $(containerTmpl()),
            $info,
            $granularity = $(opts.granularitySelector),
            $rpPixel = $(opts.requestsPerPixelSelector);
    
        $container.append($me);
        $info = $(opts.infoSelector, $me);
        
        $granularity.val(opts.dataGranularity);
        $granularity.on('change', function() {
            opts.dataGranularity = parseInt($granularity.val());
            length = parseInt(opts.history / opts.dataGranularity);
        });
        
        $rpPixel.val(opts.requestsPerPixel);
        $rpPixel.on('change', function() {
            opts.requestsPerPixel = parseInt($rpPixel.val());
        });
    
        var svg = d3.select($(opts.svgSelector, $me)[0])
            .append("svg:svg")
            .attr("width", opts.chartWidth)
            .attr("height", opts.chartHeight);
    
        var circle = new CircleView(svg, opts);
        var line = new LineView(svg, opts);
        var errorRateColorRange = d3.scale.linear()
            .domain([0, 10, 35, 50])
            .range(["grey", "black", "#FF9900", "red"]);
    
        this.update = function(data) {
            if (data.series.length === 0) {
                return;
            }
            line.update(data.series);
            circle.update(data.summary.counts.total, data.summary.health.errorRate);
            $info.empty().html(infoTmpl({name:name, health: data.summary.health, times:data.summary.times}));
            d3.select($(".error-rate", $me)[0]).style("color", function() {
                return errorRateColorRange(100 * data.summary.health.errorRate);
            });
            d3.select($(".circuit-state", $me)[0]).style("color", function() {
                if (data.summary.health.state == "closed") {
                    return "green";
                } else if (data.summary.health.state == "open") {
                    return "red";
                } else if (data.summary.health.state == "half-open") {
                    return "orange";
                }
            });
        };
    };

});

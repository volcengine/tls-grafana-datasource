"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.GenericDatasource = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require("lodash");

var _lodash2 = _interopRequireDefault(_lodash);

var _tls = require("./tls");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var GenericDatasource = exports.GenericDatasource = function () {
    function GenericDatasource(instanceSettings, $q, backendSrv, templateSrv) {
        _classCallCheck(this, GenericDatasource);

        this.type = instanceSettings.type;
        this.url = instanceSettings.url;
        this.name = instanceSettings.name;
        this.q = $q;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.withCredentials = instanceSettings.withCredentials;
        this.topic = instanceSettings.jsonData.topic;
        this.accessKey = instanceSettings.jsonData.accessKey;
        this.secret = instanceSettings.jsonData.secret;
        this.region = instanceSettings.jsonData.region;
        this.tlsConfig = {
            accessKey: this.accessKey,
            secret: this.secret,
            topic: this.topic,
            url: this.url,
            region: this.region
        };
        this.tlsService = new _tls.TLSService(this.tlsConfig, this.backendSrv);
    }

    _createClass(GenericDatasource, [{
        key: "query",
        value: function query(options) {
            var _this = this;

            if (options.targets.length <= 0) {
                return Promise.resolve({ data: [] });
            }
            var start = options.range.from._d.getTime();
            var end = options.range.to._d.getTime();
            var query = this.buildSearchParameters(options);
            var promise = Promise.resolve();
            var queries = [];
            (0, _lodash2.default)(query.targets).forEach(function (target) {
                var refId = target.refId;
                var body = {
                    'TopicId': _this.tlsConfig.topic,
                    'Query': target.query,
                    'StartTime': start,
                    'EndTime': end,
                    'Limit': 1000,
                    'Sort': 'desc'
                };
                // 检索结果
                var req = _this.tlsService.searchLogs(body).then(function (result) {
                    // 分析和检索数据分开处理
                    if (result.data.Analysis) {
                        return result.data.AnalysisResult.Data;
                    } else {
                        return result.data.Logs;
                    }
                }, function (err) {
                    if (err.data) {
                        return Promise.reject(new Error(JSON.stringify(err.data)));
                    } else {
                        return Promise.reject(new Error("unknown error"));
                    }
                }).then(function (logs) {
                    // x轴名称是table就表示返回表格数据，表格只有表头y轴
                    var yValues = {};
                    var ycolumn = target.ycolumn.split(",");
                    if (target.xcolumn === "table") {
                        var meta = [];
                        _lodash2.default.forEach(ycolumn, function (item) {
                            meta.push({ text: item });
                        });
                        var rows = [];
                        _lodash2.default.forEach(logs, function (log) {
                            var row = [];
                            _lodash2.default.forEach(ycolumn, function (col) {
                                row.push(log[col]);
                            });
                            rows.push(row);
                        });
                        yValues[refId] = {
                            type: "table",
                            columns: meta,
                            rows: rows
                        };
                    } else {
                        // x轴不是table就是曲线图
                        var xcolumn = target.xcolumn;
                        _lodash2.default.forEach(logs, function (log) {
                            var xvalue = log[xcolumn];
                            _lodash2.default.forOwn(log, function (value, key) {
                                if (ycolumn.includes(key)) {
                                    if (yValues[key] === undefined) {
                                        yValues[key] = {
                                            refId: refId,
                                            target: key,
                                            datapoints: [[log[key], xvalue]]
                                        };
                                    } else {
                                        yValues[key].datapoints.push([log[key], xvalue]);
                                    }
                                }
                            });
                        });
                        // 按照时间戳升序排序
                        _lodash2.default.forOwn(yValues, function (value, key) {
                            value.datapoints.sort(function (a, b) {
                                if (a[1] < b[1]) {
                                    return -1;
                                }
                                if (a[1] > b[1]) {
                                    return 1;
                                }
                                return 0;
                            });
                        });
                    }
                    return yValues;
                });
                queries.push(req);
            });
            return Promise.all(queries).then(function (requests) {
                var dataResult = [];
                _lodash2.default.forEach(requests, function (logs) {
                    _lodash2.default.forOwn(logs, function (points, key) {
                        dataResult.push(points);
                    });
                });
                return {
                    data: dataResult
                };
            });
        }
    }, {
        key: "testDatasource",
        value: function testDatasource() {
            return this.tlsService.testDataSource().then(function (result) {
                return { status: "success", message: "tls Connection OK", title: "Success" };
            }, function (err) {
                if (err.data) {
                    return { status: "error", message: JSON.stringify(err.data), title: "Error" };
                } else {
                    return { status: "error", message: "bad datasource params error", title: "Error" };
                }
            });
        }
    }, {
        key: "annotationQuery",
        value: function annotationQuery(options) {
            var query = this.templateSrv.replace(options.annotation.query, {}, 'glob');
            var annotationQuery = {
                range: options.range,
                annotation: {
                    name: options.annotation.name,
                    datasource: options.annotation.datasource,
                    enable: options.annotation.enable,
                    iconColor: options.annotation.iconColor,
                    query: query
                },
                rangeRaw: options.rangeRaw
            };

            return this.doRequest({
                url: this.url + '/annotations',
                method: 'POST',
                data: annotationQuery
            }).then(function (result) {
                return result.data;
            });
        }
    }, {
        key: "metricFindQuery",
        value: function metricFindQuery(query) {
            // 从topic中动态获取下拉菜单值
            var q = this.templateSrv.replace(query, {}, 'glob');
            var start = this.templateSrv.timeRange.from.unix() * 1000;
            var end = this.templateSrv.timeRange.to.unix() * 1000;
            var body = {
                'TopicId': this.tlsConfig.topic,
                'Query': q,
                'StartTime': start,
                'EndTime': end,
                'Limit': 1000,
                'Sort': 'desc'
            };
            return this.tlsService.searchLogs(body).then(this.mapToTextValue);
        }
    }, {
        key: "mapToTextValue",
        value: function mapToTextValue(result) {
            var fieldName = result.data.AnalysisResult.Schema[0];
            return _lodash2.default.map(result.data.AnalysisResult.Data, function (d) {
                return { text: d[fieldName], value: d[fieldName] };
            });
        }
    }, {
        key: "doRequest",
        value: function doRequest(options) {
            options.withCredentials = this.withCredentials;
            options.headers = this.headers;
            return this.backendSrv.datasourceRequest(options);
        }
    }, {
        key: "buildSearchParameters",
        value: function buildSearchParameters(options) {
            var _this2 = this;

            options.targets = _lodash2.default.filter(options.targets, function (target) {
                return target.target !== 'select metric';
            });

            options.targets = _lodash2.default.map(options.targets, function (target) {
                return {
                    target: _this2.templateSrv.replace(target.target, options.scopedVars, 'regex'),
                    refId: target.refId,
                    query: _this2.replaceQueryParameters(target, options),
                    xcolumn: _this2.templateSrv.replace(target.xcolumn, options.scopedVars, 'regex'),
                    ycolumn: _this2.templateSrv.replace(target.ycolumn, options.scopedVars, 'regex'),
                    mode: target.mode
                };
            });

            return options;
        }
    }, {
        key: "replaceQueryParameters",
        value: function replaceQueryParameters(target, options) {
            if (typeof target.query == "undefined") {
                target.query = "";
            }
            var query = this.templateSrv.replace(target.query, options.scopedVars, function (value, variable) {
                if ((typeof value === "undefined" ? "undefined" : _typeof(value)) == "object" && (variable.multi || variable.includeAll)) {
                    var a = [];
                    value.forEach(function (v) {
                        if (variable.name == variable.label) a.push(variable.name + ':"' + v + '"');else a.push('"' + v + '"');
                    });
                    return a.join(" OR ");
                }
                if (_lodash2.default.isArray(value)) {
                    return value.join(' OR ');
                }
                return value;
            });
            var re = /\$([0-9]+)([dmhs])/g;
            var reArray = query.match(re);
            (0, _lodash2.default)(reArray).forEach(function (col) {
                var old = col;
                col = col.replace("$", '');
                var sec = 1000;
                if (col.indexOf("s") != -1) sec = 1 * sec;else if (col.indexOf("m") != -1) sec = 60 * sec;else if (col.indexOf("h") != -1) sec = 3600 * sec;else if (col.indexOf("d") != -1) sec = 3600 * 24 * sec;
                col = col.replace(/[smhd]/g, '');
                var v = parseInt(col);
                v = v * sec;
                console.log(old, v, col, sec, query);
                query = query.replace(old, v);
            });
            return query;
        }
    }]);

    return GenericDatasource;
}();
//# sourceMappingURL=datasource.js.map

'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.TLSService = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _cryptoJs = require('./external/crypto-js');

var CryptoJS = _interopRequireWildcard(_cryptoJs);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var util = {
    crypto: {
        hmac: function hmac(key, string) {
            return CryptoJS.HmacSHA256(string, key);
        },

        sha256: function sha256(data) {
            return CryptoJS.SHA256(data);
        }
    }
};

/**
 * @api private
 */
var expiresHeader = 'presigned-expires';

var unsignableHeaders = ['authorization', 'content-type', 'content-length', 'user-agent', expiresHeader, 'expect', 'x-amzn-trace-id'];

var TLSService = exports.TLSService = function () {
    function TLSService(tlsConfig, backendSrv) {
        _classCallCheck(this, TLSService);

        this.tlsConfig = tlsConfig;
        this.backendSrv = backendSrv;
    }

    _createClass(TLSService, [{
        key: 'testDataSource',
        value: function testDataSource() {
            //最近15min数据进行检索
            var end = Date.now();
            var start = end - 15 * 60 * 1000;
            var body = {
                'TopicId': this.tlsConfig.topic,
                'Query': '*',
                'StartTime': start,
                'EndTime': end,
                'Limit': 100,
                'Sort': 'desc'
            };
            console.log("test datasource data ", body);
            return this.searchLogs(body);
        }
    }, {
        key: 'searchLogs',
        value: function searchLogs(body) {
            var headers = {
                'ServiceName': 'TLS',
                'AccessKey': this.tlsConfig.accessKey,
                'SecretKey': this.tlsConfig.secret,
                'Accept': '*/*',
                'Region': this.tlsConfig.region
            };
            var AccessKey = headers.AccessKey,
                SecretKey = headers.SecretKey,
                ServiceName = headers.ServiceName,
                Region = headers.Region,
                _headers$isVolcEngine = headers.isVolcEngine,
                isVolcEngine = _headers$isVolcEngine === undefined ? 'true' : _headers$isVolcEngine,
                sessionToken = headers['X-Security-Token'];

            // 经过处理的header 不再透传

            var handleKeys = ['AccessKey', 'SecretKey', 'ServiceName', 'Region', 'isVolcEngine', 'X-Security-Token'];
            handleKeys.forEach(function (key) {
                delete headers[key];
            });

            // 构造签名对象
            var signObj = {
                region: Region,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': '*/*',
                    'x-tls-apiversion': '0.3.0'
                }, // 默认不签名用户传递的headers 防止tlb改header导致的签名错误 本代码用于开发自测 这部分安全性可以忽略
                params: {},
                url: this.tlsConfig.url,
                method: 'POST',
                pathname: '/SearchLogs',
                body: body
            };
            // 执行签名
            var signer = new AWSSignersV4(signObj, ServiceName, {
                isVolcengine: isVolcEngine !== 'false'
            });
            signer.addAuthorization({
                accessKeyId: AccessKey,
                secretAccessKey: SecretKey,
                sessionToken: sessionToken
            });

            // 将签名后的headers注入到请求的headers中
            Object.keys(signer.request.headers).forEach(function (key) {
                signObj.headers[key] = signer.request.headers[key];
            });
            var url = '' + signObj.url + signObj.pathname;
            return this.backendSrv.datasourceRequest({
                headers: signObj.headers,
                url: url,
                method: 'POST',
                data: body
            });
        }
    }]);

    return TLSService;
}();

var uriEscape = function uriEscape(str) {
    try {
        return encodeURIComponent(str).replace(/[^A-Za-z0-9_.~\-%]+/g, escape).replace(/[*]/g, function (ch) {
            return '%' + ch.charCodeAt(0).toString(16).toUpperCase();
        });
    } catch (e) {
        return '';
    }
};

var queryParamsToString = function queryParamsToString(params) {
    var sort = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    return (sort ? Object.keys(params).sort() : Object.keys(params)).map(function (key) {
        var val = params[key];
        if (typeof val === 'undefined' || val === null) {
            return;
        }

        var escapedKey = uriEscape(key);
        if (!escapedKey) {
            return;
        }

        if (Array.isArray(val)) {
            return escapedKey + '=' + val.map(uriEscape).sort().join('&' + escapedKey + '=');
        }

        return escapedKey + '=' + uriEscape(val);
    }).filter(function (v) {
        return v;
    }).join('&');
};

var AWSSignersV4 = function () {
    function AWSSignersV4(request, serviceName, options) {
        _classCallCheck(this, AWSSignersV4);

        this.request = request;
        this.request.headers = request.headers || {};
        this.serviceName = serviceName;
        options = options || {};
        this.signatureCache = typeof options.signatureCache === 'boolean' ? options.signatureCache : true;
        this.operation = options.operation;
        this.signatureVersion = options.signatureVersion;
        this.constant = options.isVolcengine ? {
            algorithm: 'HMAC-SHA256',
            v4Identifier: 'request',
            dateHeader: 'X-Date',
            tokenHeader: 'x-security-token',
            contentSha256Header: 'X-Content-Sha256',
            kDatePrefix: ''
        } : {
            algorithm: 'AWS4-HMAC-SHA256',
            v4Identifier: 'aws4_request',
            dateHeader: 'X-Amz-Date',
            tokenHeader: 'x-amz-security-token',
            contentSha256Header: 'X-Amz-Content-Sha256',
            kDatePrefix: 'AWS4'
        };
        this.bodySha256 = options.bodySha256;
    }

    _createClass(AWSSignersV4, [{
        key: 'addAuthorization',
        value: function addAuthorization(credentials, date) {
            var datetime = this.iso8601(date).replace(/[:\-]|\.\d{3}/g, '');
            this.addHeaders(credentials, datetime);
            this.request.headers['Authorization'] = this.authorization(credentials, datetime);
        }
    }, {
        key: 'getAuthorization',
        value: function getAuthorization(credentials, date) {
            var datetime = this.iso8601(date).replace(/[:\-]|\.\d{3}/g, '');
            this.addHeaders(credentials, datetime);
            return this.authorization(credentials, datetime);
        }
    }, {
        key: 'addHeaders',
        value: function addHeaders(credentials, datetime) {
            this.request.headers[this.constant.dateHeader] = datetime;
            if (credentials.sessionToken) {
                this.request.headers[this.constant.tokenHeader] = credentials.sessionToken;
            }
            if (this.request.body) {
                var body = this.request.body;
                if (typeof body !== 'string') {
                    if (body instanceof URLSearchParams) {
                        body = body.toString();
                    } else {
                        body = JSON.stringify(body);
                    }
                }
                this.request.headers[this.constant.contentSha256Header] = this.bodySha256 || util.crypto.sha256(body).toString();
            }
        }
    }, {
        key: 'authorization',
        value: function authorization(credentials, datetime) {
            var parts = [];
            var credString = this.credentialString(datetime);
            parts.push(this.constant.algorithm + ' Credential=' + credentials.accessKeyId + '/' + credString);
            parts.push('SignedHeaders=' + this.signedHeaders());
            var signature = this.signature(credentials, datetime);
            parts.push('Signature=' + signature);
            return parts.join(', ');
        }
    }, {
        key: 'signature',
        value: function signature(credentials, datetime) {
            var signingKey = this.getSigningKey(credentials, datetime.substring(0, 8), this.request.region, this.serviceName, this.signatureCache);
            var signStr = this.stringToSign(datetime);
            return util.crypto.hmac(signingKey, signStr, 'hex');
        }
    }, {
        key: 'stringToSign',
        value: function stringToSign(datetime) {
            var parts = [];
            parts.push(this.constant.algorithm);
            parts.push(datetime);
            parts.push(this.credentialString(datetime));
            var canonicalString = this.canonicalString();
            parts.push(this.hexEncodedHash(canonicalString));

            return parts.join('\n');
        }
    }, {
        key: 'canonicalString',
        value: function canonicalString() {
            var parts = [],
                pathname = this.request.pathname || '/';

            parts.push(this.request.method.toUpperCase());
            parts.push(pathname);
            parts.push(queryParamsToString(this.request.params) || '');
            parts.push(this.canonicalHeaders() + '\n');
            parts.push(this.signedHeaders());
            parts.push(this.hexEncodedBodyHash());
            return parts.join('\n');
        }
    }, {
        key: 'canonicalHeaders',
        value: function canonicalHeaders() {
            var _this = this;

            var headers = [];
            Object.keys(this.request.headers).forEach(function (key) {
                headers.push([key, _this.request.headers[key]]);
            });
            headers.sort(function (a, b) {
                return a[0].toLowerCase() < b[0].toLowerCase() ? -1 : 1;
            });
            var parts = [];
            headers.forEach(function (item) {
                var key = item[0].toLowerCase();
                if (_this.isSignableHeader(key)) {
                    var value = item[1];
                    if (typeof value === 'undefined' || value === null || typeof value.toString !== 'function') {
                        throw new Error('Header ' + key + ' contains invalid value');
                    }
                    parts.push(key + ':' + _this.canonicalHeaderValues(value.toString()));
                }
            });
            return parts.join('\n');
        }
    }, {
        key: 'canonicalHeaderValues',
        value: function canonicalHeaderValues(values) {
            return values.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
        }
    }, {
        key: 'signedHeaders',
        value: function signedHeaders() {
            var _this2 = this;

            var keys = [];
            Object.keys(this.request.headers).forEach(function (key) {
                key = key.toLowerCase();
                if (_this2.isSignableHeader(key)) {
                    keys.push(key);
                }
            });
            return keys.sort().join(';');
        }
    }, {
        key: 'credentialString',
        value: function credentialString(datetime) {
            return this.createScope(datetime.substring(0, 8), this.request.region, this.serviceName);
        }
    }, {
        key: 'hexEncodedHash',
        value: function hexEncodedHash(string) {
            return util.crypto.sha256(string);
        }
    }, {
        key: 'hexEncodedBodyHash',
        value: function hexEncodedBodyHash() {
            if (this.request.headers[this.constant.contentSha256Header]) {
                return this.request.headers[this.constant.contentSha256Header];
            }

            if (this.request.body) {
                return this.hexEncodedHash(queryParamsToString(this.request.body));
            }
            return this.hexEncodedHash('');
        }
    }, {
        key: 'isSignableHeader',
        value: function isSignableHeader(key) {
            if (key.toLowerCase().indexOf('x-amz-') === 0) {
                return true;
            }
            return unsignableHeaders.indexOf(key) < 0;
        }
    }, {
        key: 'iso8601',
        value: function iso8601(date) {
            if (date === undefined) {
                date = new Date();
            }
            return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
        }
    }, {
        key: 'getSigningKey',
        value: function getSigningKey(credentials, date, region, service) {

            var kDate = util.crypto.hmac('' + this.constant.kDatePrefix + credentials.secretAccessKey, date);
            // debugger;
            var kRegion = util.crypto.hmac(kDate, region);
            var kService = util.crypto.hmac(kRegion, service);

            var signingKey = util.crypto.hmac(kService, this.constant.v4Identifier);

            return signingKey;
        }
    }, {
        key: 'createScope',
        value: function createScope(date, region, serviceName) {
            return [date.substring(0, 8), region, serviceName, this.constant.v4Identifier].join('/');
        }
    }]);

    return AWSSignersV4;
}();
//# sourceMappingURL=tls.js.map

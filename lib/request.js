/**
 * To make the requests asynchronously
 */

var logger = require('./logger'),
 OAuth = require('oauth-1.0a'),
 querystring = require('querystring');

/**
 * Constructor sets the options for the script
 * @param {object} options:
 * hostname: the hostname for the request (required)
 * ssl: true/false (default: false)
 * port: the port number... (default: 80)
 * headers: the headers to be sent (optional)
 * consumerKey: the consumer key
 * secret: the generated secret
 * logLevel: the level of logging done (optional)
 */
var Request = function(options) {

  this.options = options || {};
  if (!this.options.hostname) {
    throw new Error('hostname is a required option');
  }

  this.options.port = this.options.port || 80;
  this.options.ssl = this.options.ssl || false;

  // Set the log level to errors only by default
  logger.level = this.options.logLevel || 0;
};

Request.prototype.completeRequest = function(method, path, data, cb) {
  var _this = this;

  logger.info('Requesting Data from: https://' +
    this.options.hostname + path + ' Using the ' +
    method + ' method');

  var protocol = this.options.ssl ? require('https') : require('http');
  var dataString = JSON.stringify(data);
  var options = {
    hostname: this.options.hostname,
    path: path,
    method: method.toUpperCase(),
    port: this.options.port,
    headers: {
      'User-Agent': 'node-woocommerce/1.0.0'
    }
  };
  // Set Custom Headers
  if (this.options.headers) {
    for (var key in this.options.headers) {
      options.headers[key] = this.options.headers[key];
    }
  }

  if (this.options.ssl) {
    if (this.options.auth) {
      options.auth = this.options.consumerKey + ':' +
      this.options.secret;
    }
  } else {
    var oauth = OAuth({
      consumer: {
        public: this.options.consumerKey,
        secret: this.options.secret
      },
      'signature_method': 'HMAC-SHA256',
      version: null
    });

    var requestData = {
      url: 'http://' +
        this.options.hostname +
        path,
      method: method,
      data : {}
    };

    var query = '?',
      oauth = oauth.authorize(requestData);

    for (var key in oauth) {
      query += key + '=' + oauth[key] + '&';
    }
    query = query.substr(0, query.length-1);

    options.path += query;
    //options.headers['Authorization'] = oauth.toHeader(oauth.authorize(requestData)).Authorization;
  }

  if (data) {
    options.headers['Content-Length'] = new Buffer(dataString).length;
  }

  logger.info('Starting Request, with options: ' +
    require('util').inspect(options));

  var req = protocol.request(options, function(res) {
    logger.info('Status Returned: ' + res.statusCode);
    logger.info('Headers Returned: ' + JSON.stringify(res.headers));
    //logger.info('Headers Sent: ' + require('util').inspect(req));

    res.setEncoding('utf8');

    var body = '';

    res.on('data', function(chunk) {
      body += chunk;
    });

    res.on('end', function() {

      console.log('Request complete: ' + body);

      if (res.statusCode === 400 || res.statusCode === 500) {
        var error = 'Request failed with code: ' +
          res.statusCode + ' and body: ' + body;
        logger.error(error);
        return cb(new Error(error), null, res);
      }

      try {

        var pattern = new RegExp('application/json');
        if (!pattern.test(res.headers['content-type'])) {
          return cb(null, body, res);
        }

        var json = {};
        if (body.trim() !== '') {

          logger.info('Body is not empty, parsing.');

          json = JSON.parse(body);
          if (json.hasOwnProperty('error') || json.hasOwnProperty(
            'errors')) {
            return cb(new Error(json.error || JSON.stringify(json.errors)),
              null, res);
          }
        }
        logger.info('Request complete, returning data and response.');
        return cb(null, json, res);
      } catch (e) {
        logger.error('Error parsing JSON: ' + e);
        return cb(e, null, res);
      }

    });

  });

  if (data) {
    logger.info('Sending Data: ' + dataString);
    req.write(dataString);
  }

  req.end();

}

module.exports = Request;
'use strict';

var restify = require('restify'),
  async = require('async');

module.exports = function(config, elasticsearch) {
  var elasticClient;

  elasticClient = new elasticsearch.Client({
    // The following is used for authentication for those using searchguard
    host: [
      {
        host: 'elasticsearch.my.com',
        auth: 'Username:Password',
        protocol: 'https',
        port: 9200
      }
    ],
//    log: 'trace',
    log: 'error',
//    log: 'info;',
    apiVersion: config.ElasticSearchVersion
  });

  return function(req, res, next) {
    var cspData;
    var timestamp = new Date().toISOString();
    async.waterfall([
      function cspDataParse(next) {
        var userAgent = req.headers['user-agent'];
        var referer = req.headers['referer'];
        var realIP = req.headers['x-real-ip'] || req.connection.remoteAddress;
        var xffor = req.headers['x-forwarded-for'];

        if (xffor) {
          realIP = xffor;
        }
        try {
          cspData = req.body;
          cspData["@timestamp"] = timestamp;
          cspData["source.ip"]  = realIP;
          cspData["user-agent"] = userAgent;
          cspData["referer"]    = referer;

          if (cspData["csp-report"]) {
            cspData["parse"] = "valid";
            cspData["error.message"] = "";
          }
          else {
            cspData["parse"] = "error";
            cspData["error.message"] = "csp-report object not found";
          }
        } 
        catch (e) {
          cspData["parse"] = "error";
          cspData["error.message"] = e;
        }

        return next(null, cspData);
      },
      function indexIntoElasticSearch(cspData, next) {
//        console.log("Indexing to Elastic data %s", cspData);
//        req.log.info(sprintf("Indexing to Elastic data %s", cspData));
        var yearMonthDay = timestamp.substr(0, 10).replace(/-/g, '.');  
        elasticClient.index({
          index: config.ElasticSearchIndex + '-' + yearMonthDay,
          type: '_doc',
          body: cspData
        }, function(err) {
          if (err) {
            return next(new restify.errors.InternalServerError(err, "Error indexing ElasticSearch for cspData"));
          }
          return next(null);
        });
      }
    ], function(err) {
      if (err) {
        return next(err);
      }
      res.send(200);
      return next();
    });
  };
};

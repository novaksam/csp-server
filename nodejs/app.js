'use strict';

var restify = require('restify'),
  config = require('./config'),
  healthcheck = require('./healthcheck'),
  elasticsearch = require('elasticsearch'),
  index = require('./index')(config, elasticsearch),
  app = restify.createServer({});

app.use(restify.plugins.jsonBodyParser({ mapParams: false, rejectUnknown: false }));
app.get('/_healthcheck', healthcheck);
app.post('/index', index);

module.exports = app;

const bunyan = require('bunyan');
const _ = require('lodash');
const request = require('request');
const axios = require('axios');
const Promise = require('bluebird');
const JSONStream = require('JSONStream');
const stream = require('stream');
const requireyml = require('require-yml');
const path = require('path');

module.exports = client;

function client (initOptions) {
  var log_level = _.get(initOptions, 'log_level', 'error');
  this.logger = bunyan.createLogger({ name: 'talentsoft-client', level: log_level });

  this.host = _.assign({}, _.get(initOptions, 'host', {}));
  var self = this;
  
  /*
  self.login = function () {
    //var opts = { url: url, headers: { "Content-Type": "application/json" }};
    return axios.post('https://testbankdata.talent-soft.com/api/token', {
      client_id: 'cc7f302c-fd05-4cf8-ba40-c00ea20e9602',
      client_secret: '963b5b22-bc56-46ba-8a56-32c3b1231d91',
      grant_type: 'client_credentials'
    })
    .then(function (response) {
      console.log(response);
    })
  };*/
  
  this.login = (args) => {
    requireyml
    var configFromFile = requireyml(path.resolve('dev-test/config.yml'));
    console.log(configFromFile)
    return new Promise((resolve, reject) => {
      var formData = 'client_id=' + configFromFile.clientId + '&client_secret=' + configFromFile.clientSecret + '&grant_type=client_credentials';
      console.log(formData);
      var opts = {
        url: 'https://testbankdata.talent-soft.com/api/token',
        headers: {
          "Content-type": "application/x-www-form-urlencoded"
        },
        body: formData
      };
      if (self.rejectUnauthorized === false) {
        opts.rejectUnauthorized = false;
      }
      var stream = request.post(opts);
      stream.on('response', (response) => {
        if (response.statusCode === 400) {
          reject(new Error('incorrect credentials'));
        }
        if (response.statusCode !== 200) {
          reject(new Error('error logging in'));
        }
      });
      stream.on('error', (error) => {
        reject(error);
      });

      var resultData = '';
      stream.on('data', (data) => {
        if (data) {
          resultData += data.toString();
        }
      });

      stream.on('end', (data) => {
        try {
          var authentication = JSON.parse(resultData.toString());
          self.authorization = 'Bearer ' + authentication.access_token;
          resolve(authentication);
        } catch (error) {
          console.error({ err: error}, 'error while parsing authentication');
        }
      });
    });
  };
  
  this.get = function (url, args) {
    var opts = {
      url: url,
      headers: {
        'authorization': self.authorization,
        'content-type': 'application/json; charset=utf-8'
      }
    };
    if (self.rejectUnauthorized === false) {
      opts.rejectUnauthorized = false;
    }
    var requestStream = request.get(opts);
    return requestStream;
  }
  
  this.post = function (url, inputStream, args) {
    args = args || {};
    var opts = {
      url: url,
      headers: {
        'authorization': self.authorization,
        'content-type': 'application/json; charset=utf-8'
      }
    };
    if (self.rejectUnauthorized === false) {
      opts.rejectUnauthorized = false;
    }
    var requestStream = request.post(opts);
    
    if (inputStream) {
      return inputStream.pipe(requestStream);
    } else {
      return requestStream;
    }
  };
  
  var promisifyStream = (stream) => {
    return new Promise((resolve, reject) => {
      stream.on('error', (error) => {
        reject(error);
      });
      var dataResult = '';
      stream.on('data', (data) => {
        dataResult += data.toString();
      });
      var contentType = '';
      stream.on('response', (response) => {
        if (response.statusCode === 401) {
          reject(new Error('unauthorized'));
        }
        if (response.statusCode === 403) {
          reject(new Error('forbidden'));
        }
        contentType = response.headers['content-type'] || '';
      });
      
      stream.on('end', () => {
        resolve(dataResult);
      });
    });
  };
  
  this.promisifyStream = promisifyStream;
}

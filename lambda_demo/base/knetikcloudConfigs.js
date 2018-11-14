const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });
const s3 = new AWS.S3();
const Q = require('q');

class JsapiConfigs {
    constructor() {
    }
    init(app) {
        const defer = Q.defer();
        // retrieve access_token from S3
        let s3Params = {
            Bucket: "lambda-knetikcloud-environment-data",
            Key: `${app}.json`
        };
        s3.getObject(s3Params, function (err, data) {
            if (err) {
                console.log('ERROR getting knetikcloud environment data: ', err, err.stack); // an error occurred
                defer.reject(err);
            }
            else {
                console.log(`SUCCESS getting knetikcloud environment data`);
                const jsonString = data.Body.toString('ascii');
                const configData = JSON.parse(jsonString);
                defer.resolve(configData);
            }
        });
        return defer.promise;
    }
}

module.exports = JsapiConfigs;
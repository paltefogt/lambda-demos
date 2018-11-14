const responder = require('./base/responder');
const autoLoad = require('auto-load');

exports.handler = (event, context, callback) => {
    const done = (err, res) => {
        if (err) {
            const response = responder.internalServerError(err);
            console.log('ERROR RESPONSE: ', response);
            return callback(response);
        }
        // in order to access the path and query parameters from the event
        // the API Gateway endpoint has to use Lambda Proxy integration.
        // with this turned on, the response has to look like this, or you
        // get a 'Malformed Lambda proxy response' 502
        //let response = {
        //    "isBase64Encoded": false,
        //    "statusCode": 200,
        //    "headers": { "Content-Type": "application/json" },
        //    "body": JSON.stringify(res) // body needs to be stringified
        //};
        if (!res) res = { success: true, msg: 'SUCCESS OF SOME SORT? YOUR RESPONSE WAS FALSEY' };
        const response = responder.success(res);
        return callback(null, response);
    };

    //console.log('EVENT: ', event);
    if (event.httpMethod === 'POST' && event.body) {
        event.body = JSON.parse(event.body);
    }

    const Libs = autoLoad('./lib');
    const libToUse = new Libs['prominentEdge']();

    libToUse[event.httpMethod](null, event)
        .then(res => {
            console.log();
            done(null, res);
        })
        .catch(err => {
            console.log();
            done(err, null);
        });
};

const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });
const lambda = new AWS.Lambda();
const Q = require('q');
const get = require('get-value');
const set = require('set-value');
const _ = require('lodash');
// const errorHandler = require('../base/errorHandler');

class Batch {
    process(sdk, event) {
        // if there is an array of batch data in the event
        if (event.opts.batch_data && event.opts.batch_data.length > 0) {
            const genObj = genFunc(event.opts.batch_data);
            this.runGenFunc(genObj);
            return Q.resolve({ success: true, msg: 'SUCCESS: batch.process' });
        } else { // if we need to do an api call first to get a batch of data to send for processing
            const getDataApi = event.opts.get_batch_data.api;
            const getDataFunction = event.opts.get_batch_data.function;
            const getDataOpts = event.opts.get_batch_data.opts;
            // get all the function parameters in a single array - this way we can
            // pass them all into the api function using the spread operator
            const getDataFunctionArguments = sdk.getApiFunctionOptsAsArray(getDataOpts);

            return sdk.getApi(getDataApi)[getDataFunction](...getDataFunctionArguments)
                .then(response => {
                    const genFuncData = this.assembleBatchData(event, response);
                    const genObj = genFunc(genFuncData);
                    this.runGenFunc(genObj);
                    return Q.resolve({ success: true, msg: 'SUCCESS: batch.process'});
                })
                .catch(err => {
                    console.log(err);
                    return Q.reject(err);
                });
        }

        // our generator function for running the batch
        function* genFunc(batchData) {
            for (let apiFunction of batchData) {
                var params = {
                    FunctionName: 'knetikcloud_util_api_function',
                    Payload: JSON.stringify(apiFunction)
                };
                lambda.invoke(params, function (err, data) {
                    if (err) {
                        console.log(err, err.stack); // an error occurred
                    } else {
                        const response = data;
                        console.log(`SUCCESS Batch Call: ${JSON.stringify(response)}`);
                    }
                });
                yield apiFunction;
            }
        } 
    }

    // build the batch of knetikcloud api calls
    assembleBatchData(event, response) {
        const batchData = [];
        const batchJsapiApp = event.opts.get_batch_data.batch_config.jsapi_app;
        const batchJsapiEnv = event.opts.get_batch_data.batch_config.jsapi_env;
        const batchApi = event.opts.get_batch_data.batch_config.api;
        const batchFunction = event.opts.get_batch_data.batch_config.function;
        const propMaps = event.opts.get_batch_data.batch_config.data_prop_maps;

        // build an array of batch data based on the response
        response.content.forEach(jsapiThing => {
            let batchOpts = event.opts.get_batch_data.batch_config.opts;
            // need to build the opts
            // for some opts properties, we need data from the get_batch_data response
            // using npm get-data & set-data packages to allow us to access nested properties
            // via string representation of dot notation.
            // Like if this actually would work -> jsapiThing['user.id'];
            // if res_prop is null, then set the whole jsapiThing to the batch_opts_prop
            // https://www.npmjs.com/package/get-value
            // https://www.npmjs.com/package/set-value
            propMaps.forEach(propMap => {
                // if res_prop exists, but is null, then put the entire jsapi data
                // into batch_data_prop
                if (!propMap.res_prop) {
                    set(batchOpts, propMap.batch_data_prop, jsapiThing);
                }
                // if res_prop exists and is not null, copy its value
                // into the batch_data_prop
                else {
                    const responseData = get(jsapiThing, propMap.res_prop);
                    set(batchOpts, propMap.batch_data_prop, responseData);
                }
            });

            let dataItem = {
                jsapi_app: batchJsapiApp,
                jsapi_env: batchJsapiEnv,
                api: batchApi,
                function: batchFunction,
                opts: _.cloneDeep(batchOpts)
            };
            batchData.push(dataItem);
        });
        console.log(`Running ${batchData.length} batch calls`);
        return batchData;
    }

    // run the batch of knetikcloud api calls
    runGenFunc(genObj) {
        let interval = setInterval(() => {
            let val = genObj.next();
            if (val.done) {
                clearInterval(interval);
                return 'FINISHED';
            } else {
                console.log('Ran batch call');
                console.log(val.value);
            }
        }, 100);
    }
}

module.exports = Batch;
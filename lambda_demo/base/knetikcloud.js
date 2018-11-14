const KnetikCloudSDK = require('@knetik/knetikcloud-sdk');
const KnetikcloudConfigsLib = require('./knetikcloudConfigs');
const KnetikcloudConfigs = new KnetikcloudConfigsLib();
const Q = require('q');

const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });
const s3 = new AWS.S3();

class KnetikCloud {
    constructor() {
        const self = this;
        self.configData = {};
        self.KnetikCloud = KnetikCloudSDK;
        self.oauth2_client_credentials_grant = null;
    }

    init(app, env, token) {
        const self = this;
        const defer = Q.defer();

        if (app.length === 0 ||
            env.length === 0) {
            console.log('ERROR knetikcloud.js init: app or env is empty.');
            defer.resolve('ERROR knetikcloud.js init: app or env is empty.');
            return;
        }

        let jsapiUrl = `https://${app}.${env}.knetikcloud.com`;
        if (env === 'prod')
            jsapiUrl = `https://${app}.knetikcloud.com`;
        const defaultClient = self.KnetikCloud.ApiClient.instance;
        defaultClient.basePath = jsapiUrl;

        // if a token is supplied, we can just configure the sdk with it
        if (token && token.length !== 0) {
            console.log(`User token supplied: ${token}`);
            self.oauth2_client_credentials_grant = defaultClient.authentications['oauth2_client_credentials_grant'];
            self.oauth2_client_credentials_grant.accessToken = token;
            defer.resolve(self);
        } else {
            KnetikcloudConfigs.init(app)
                .then(configData => {
                    // stash it in case a library needs access to the category_id 
                    // or anything else in configData
                    self.configData = configData[env];
                    const knetikcloudConfigData = configData[env];

                    let s3Params = {
                        Bucket: "lambda-tokens",
                        Key: `${app}_${env}.txt`
                    };
                    s3.getObject(s3Params, function (err, data) {
                        if (err) console.log(err, err.stack); // an error occurred
                        else {
                            console.log(data.Body.toString('ascii'));
                            const token = data.Body.toString('ascii');
                            defaultClient.basePath = jsapiUrl;
                            self.oauth2_client_credentials_grant = defaultClient.authentications['oauth2_client_credentials_grant'];
                            self.oauth2_client_credentials_grant.accessToken = token;

                            const apiInstance = new self.KnetikCloud.UtilSecurityApi();
                            apiInstance.getUserTokenDetails()
                                .then(data => {
                                    // token is good, we are all set
                                    console.log(`SUCCESS /m: ${data}`);
                                    defer.resolve(self);
                                })
                                .catch(err => {
                                    console.error('ERROR /me: ', err.status);
                                    if (err.status === 401) {
                                        // token is bad, time to get a new one
                                        const authApi = new self.KnetikCloud.Access_TokenApi();
                                        const grantType = 'client_credentials';
                                        const clientId = knetikcloudConfigData.client_id;
                                        const params = {
                                            clientSecret: knetikcloudConfigData.client_secret
                                        };
                                        self.oauth2_client_credentials_grant = defaultClient.authentications['oauth2_client_credentials_grant'];
                                        authApi.getOAuthToken(grantType, clientId, params)
                                            .then(res => {
                                                console.log('SUCCESS getting access token: ', res.access_token);
                                                self.oauth2_client_credentials_grant.accessToken = res.access_token;
                                                // store the new token back in s3
                                                s3Params = {
                                                    Bucket: "lambda-tokens",
                                                    Key: `${app}_${env}.txt`,
                                                    Body: res.access_token
                                                };
                                                s3.putObject(s3Params, (err, data) => {
                                                    if (err) {
                                                        console.log('ERROR putObject: ', err);
                                                        defer.reject(error);
                                                    } else {
                                                        console.log('SUCCESS putObject: ', data);
                                                        defer.resolve(self);
                                                    }
                                                });
                                            })
                                            .catch(err => {
                                                const error = {
                                                    msg: 'ERROR getting access_token',
                                                    data: err
                                                };
                                                defer.reject(error);
                                            });
                                    } else {
                                        // WTF?
                                        console.log('WTF');
                                        console.log(err);
                                        defer.reject(err);
                                    }
                                });
                        }
                    });
                })
                .catch(err => {
                    console.log(err);
                    return err;
                });
        }

        
        return defer.promise;
    }

    // pass in the name of the api - get api names from
    // https://github.com/knetikcloud/knetikcloud-javascript-client
    getApi(api_name) {
        const self = this;
        return new self.KnetikCloud[api_name]();
    }

    // we are making a call to the knetikcloud javascript sdk. the function we call will require
    // some number of arguments in this order: apiFunction(path1, path2, query, body).
    // we want to get all the arguments in a single array in order: path -> query -> body
    // so that we can call the function like this apiFunction(...optsArray)
    // opts will have up to three properties: "path", "query", "body"
    // each property will be an object
    getApiFunctionOptsAsArray(opts) {
        const apiFunctionOptsArray = [];
        if (opts.path && Object.keys(opts.path).length > 0) {
            Object.keys(opts.path).forEach(key => {
                apiFunctionOptsArray.push(opts.path[key]);
            });
        }
        if (opts.query)
            apiFunctionOptsArray.push(opts.query);
        if (opts.body)
            apiFunctionOptsArray.push(opts.body);

        return apiFunctionOptsArray;
    }
}

module.exports = KnetikCloud;
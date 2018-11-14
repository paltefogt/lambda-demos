// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');
// Set the region 
AWS.config.update({
    region: 'us-east-1'
});
const docClient = new AWS.DynamoDB.DocumentClient({ convertEmptyValues: true });

const Q = require('q');
const nanoid = require('nanoid');
const rp = require('request-promise');

class ProminentEdge {
    POST(sdk, event) {
        const defer = Q.defer();
        const reqData = JSON.parse(event.body.opts.data);
        //const reqData = event.body.opts.data;
        reqData.parcelData = {};
        // first, get the weather data
        const opts_weather = {
            uri: 'https://www.ncdc.noaa.gov/cdo-web/api/v2/data',
            qs: {
                datasetid: 'GHCND',
                locationid: 'CITY:US510015',
                startdate: reqData.description.event_opened.split('T')[0],
                enddate: reqData.description.event_opened.split('T')[0],
                limit: 50
            },
            headers: {
                'token': 'KDhsaNAopxfgzusKrgSbADqPCySBarpF'
            },
            json: true // Automatically parses the JSON string in the response
        };

        const opts_parcelData1 = {
            uri: 'http://gis.richmondgov.com/ArcGIS/rest/services/StatePlane4502/Base/MapServer/1/query',
            qs: {
                f: 'json',
                inSR: 4326,
                outSR: 4326,
                outFields: '*',
                geometry: `${reqData.address.longitude},${reqData.address.latitude}`
            },
            json: true
        };
        const opts_parcelData2 = {
            uri: 'http://gis.richmondgov.com/ArcGIS/rest/services/StatePlane4502/CommonBoundaries/MapServer/1/query',
            qs: {
                f: 'json',
                inSR: 4326,
                outSR: 4326,
                outFields: '*',
                geometry: `${reqData.address.longitude},${reqData.address.latitude}`
            },
            json: true
        };

        rp(opts_parcelData1)
            .then(pd1 => {
                reqData.parcelData.pointsRaw = [];
                pd1.features[0].geometry.rings[0].forEach(r => {
                    const point = {
                        lat: r[1],
                        lng: r[0]
                    };
                    reqData.parcelData.pointsRaw.push(point);
                });
                reqData.parcelData.data = { ...pd1.features[0].attributes };
                return rp(opts_parcelData2);
            })
            .then(pd2 => {
                reqData.parcelData.data = { ...reqData.parcelData.data, ...pd2.features[0].attributes };
                return rp(opts_weather);
            })
            .then(weatherData => {
                const minTempArray = weatherData.results.filter(wd => wd.datatype === 'TMIN');
                const maxTempArray = weatherData.results.filter(wd => wd.datatype === 'TMAX');
                const precipArray = weatherData.results.filter(wd => wd.datatype === 'PRCP');
                const minTempCelsius = minTempArray[0].value / 10;
                const maxTempCelsius = maxTempArray[0].value / 10;
                const precipMills = precipArray[0].value;

                reqData.weather = {
                    minTemp: minTempCelsius,
                    maxTemp: maxTempCelsius,
                    precipitation: precipMills
                };

                // Call DynamoDB to add the item to the table
                reqData.Id = nanoid();
                const params = {
                    TableName: 'PEDemo',
                    Item: reqData
                };
                docClient.put(params, function (err, data) {
                    if (err) {
                        console.log("Error", err);
                        return defer.reject(err);
                    } else {
                        console.log("Success", data);
                        return defer.resolve(data);
                    }
                });
            })
            .catch(error => {
                console.log(error);
                return defer.reject(error);
            });
        return defer.promise;
    }

    GET(sdk, event) {
        const defer = Q.defer();

        var params = {
            TableName: 'PEDemo'
        };
        docClient.scan(params, function (err, data) {
            if (err) {
                console.log("Error", err);
                return defer.reject(err);
            } else {
                console.log("Success", data);
                return defer.resolve(data.Items);
            }
        });
        return defer.promise;
    }
}

module.exports = ProminentEdge;
// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');
// Set the region 

const docClient = new AWS.DynamoDB.DocumentClient({ convertEmptyValues: true });

const Q = require('q');
const nanoid = require('nanoid');

class SkiGame {
    POST(event) {
        const defer = Q.defer();

        // Call DynamoDB to add the item to the table
        event.body.Id = nanoid();
        event.body.date = new Date().toString();
        const params = {
            TableName: 'SkiGame',
            Item: event.body
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
        return defer.promise;
    }

    GET(event) {
        const defer = Q.defer();

        var params = {
            TableName: 'SkiGame'
        };
        docClient.scan(params, function (err, data) {
            if (err) {
                console.log("Error", err);
                return defer.reject(err);
            } else {
                console.log("Success", data);
                const scores = data.Items.sort((a, b) => a.score - b.score).reverse().slice(0, 10)
                return defer.resolve(scores);
            }
        });
        return defer.promise;
    }
}

module.exports = SkiGame;
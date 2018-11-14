module.exports = {
    success: (result) => {
        console.log(`SUCCESS: ${result.length}`);
        return {
            isBase64Encoded: false,
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
                "Content-Type": "text/plain"
            },
            body: JSON.stringify(result)
        };
    },
    internalServerError: (err) => {
        console.log(`internalServerError: ${err.msg}`);
        return {
            isBase64Encoded: false,
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
                "Content-Type": "text/plain"
            },
            body: JSON.stringify({
                statusCode: 500,
                error: 'Internal Server Error',
                internalError: JSON.stringify(err)
            })
        };
    }
}; // add more responses here.
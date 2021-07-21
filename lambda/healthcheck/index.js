/**
 * This Lambda function requires the following parameters
 * API_ENDPOINT	- Needs to be the execute API endpoint for the API
 * RECORD_ID	HEALTH_CHECK_<envname>
 * TABLE	TradingOrders<envname>
 * 
 **/
const https = require('https');
const DynamoDB = require('aws-sdk/clients/dynamodb');
const dynamoDBclient = new DynamoDB.DocumentClient();
const CloudWatch = require('aws-sdk/clients/cloudwatch');
const cloudWatchClient = new CloudWatch();

// This is a helper function to put the code to sleep for some time
function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve,milliseconds));
}

// This is a helper function for https requests in an async way
function httpsRequest(params, postData) {
    return new Promise(function(resolve, reject) {
        var req = https.request(params, function(res) {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error('statusCode=' + res.statusCode));
            }

            var body = [];
            res.on('data', function(chunk) {
                body.push(chunk);
            });
            
            res.on('end', function() {
                try {
                    body = JSON.parse(Buffer.concat(body).toString());
                } catch(e) {
                    reject(e);
                }
                resolve(body);
            });
        });
        req.on('error', function(err) {
            reject(err);
        });
        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

// This function checks the streaming path, from calling API Gateway to deleting the recently inserted test record from DynamoDB 
async function checkStreamingPath() {
  let streamingPathStatus = false;
  let payload = 
    {  
        "User" : process.env.RECORD_ID, 
        "Client" : "00000000-0000-0000-0000-00000000000", 
        "Timestamp" :  (new Date(1970,00,01)).toJSON(),
        "Order" : { "Symbol" : "HEALTH_CHECK", "Volume" : 0, "Price" : 0 } 
    };
  let payloadAsString = JSON.stringify(payload);
  let params = {
    hostname: process.env.API_ENDPOINT,
    path: '/prod/putOrder',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payloadAsString.length
    }
  };
  let response = await httpsRequest(params,payloadAsString);
  // The response must have the format
  // {"EncryptionType":"KMS","SequenceNumber":"<a big number>","ShardId":"shardId-<12digits>"}
  if (response.EncryptionType && response.SequenceNumber && response.ShardId) streamingPathStatus = true;
  else streamingPathStatus = false;
  if (streamingPathStatus) {
      // let's check if it is on DynamoDB
      // the id below should have be constructed using a Lambda Layer
    let id = 
            payload.User+"#"+
            payload.Client+"#"+
            payload.Order.Symbol+"#"+
            payload.Order.Volume+"#"+
            payload.Order.Price+"#"+
            payload.Timestamp;
    let ddbParameter = {
        TableName : process.env.TABLE,
        Key : {
            TransactionId : id
        }
    };
    console.log(`Querying DynamoDB with this parameter: ${JSON.stringify(ddbParameter)}`);
    // wait a bit to check DynamoDB because of the overall architecture latency
    await sleep(3000);
    let ddbRecord = await dynamoDBclient.get(ddbParameter).promise();
    if (ddbRecord instanceof Error) {
        console.log("Error reading from dynamoDBclient: ", ddbRecord);
        streamingPathStatus = streamingPathStatus && false;
    } else {
        // We could query dynamodb
        console.log(`Result from DynamoDB: ${JSON.stringify(ddbRecord)}`);
        //await sleep(100);
        ddbRecord = await dynamoDBclient.delete(ddbParameter).promise();
        console.log(`Delete result: ${JSON.stringify(ddbRecord)}`);
        streamingPathStatus = streamingPathStatus && true;
    }
  }
  return streamingPathStatus;
}


// this function publishes the metric
// 1 - Healthy
// 0/null - Unhealthy
async function putMetric(status) {
    var params = {
      MetricData: [
        {
          MetricName: "HEALTH_CHECK",
          Dimensions: [
            { Name: 'Region',Value: process.env.AWS_REGION },
            { Name : 'Environment' , Value: process.env.RECORD_ID }
          ],
          Unit: 'None',
          Value: status ? 1 : 0
        },
      ],
      Namespace: 'TRADING_APP'
    };
    let putMetricResult = await cloudWatchClient.putMetricData(params).promise();
    console.log(`PUT METRIC RESULT: ${JSON.stringify(putMetricResult)}`);
}

exports.handler = async (event) => {
    let response = null;
    let everythingOk = true;
    // request coming from Route53
    console.log(`EVENT: ${JSON.stringify(event)}`);
    let streamingPathOk = await checkStreamingPath();
    everythingOk = everythingOk && streamingPathOk;
    await putMetric(everythingOk);
    if (everythingOk) {
        response = {
            statusCode: 200,
            body: JSON.stringify('success'),
        };
    }
    // if it is not, respond with 500
    else {
        response = {
            statusCode: 500,
            body: JSON.stringify('failure'),
        };
    }
    console.log(`Response from Lambda ${JSON.stringify(response)}`);
    return response;
};
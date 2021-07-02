# Improving Observability

This lab considers that:
- You are working from a Cloud9 environment.
- That you have cloned this repository and have already deployed the environment.
- You have already implemented the [DLQ](./../dlq/README.md) for the architecture.

***

## Getting started

1. Check or export your API endpoint
    1. To check if you have it already exported:
        ~~~ 
        echo $API_ENDPOINT
        ~~~
        if you get any value back, you have exported it already. Skip the next step here.
    2. `(If you have not exported it)` Export the execute-API endpoint to an environment variable (replace `<api>` whith your API endpoint, and `<region>` with the region where it is deployed)
        ~~~
        export API_ENDPOINT=https://<api>.execute-api.<region>.amazonaws.com/prod/putOrder
        ~~~
2. Send a **VALID** payload:
    ~~~
    eval $( echo curl -X POST -H 'content-type:application/json' --data "'"'{  "User" : "theuser@amazon.com", "Client" : "13522bac-89fb-4f14-ac37-92642eec2b06", "Timestamp" : "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "Order" : { "Symbol" : "USDJPY", "Volume" : '$RANDOM', "Price" : 104.987 } }'"'" $API_ENDPOINT )
    ~~~
3. Visit DynamoDB to confirm the data insertion.
4. Visit CloudWatch logs. Check that the record is properly registered there.
5. Send an **INVALID** payload
    ~~~
    eval $(echo curl -X POST -H 'content-type:application/json' --data '"INVALID PAYLOAD - $(date -u +%Y-%m-%dT%H:%M:%SZ)"' $API_ENDPOINT)
    ~~~
6. Visit X-Ray. 
    1. If you get into the *"Getting Started"* page, access the service page again.
    2. Click on `Traces`. See that **no traces** will show up.
    3. Click on `Service map`. See that **no map** will show up.

 
## Enable logs and x-ray for the whole architecture.

### 1. Enabling API gateway

1. On **API Gateway**, visit the *`prod`* stage of your API:
2. Enable CloudWatch Logs, in with log level `INFO`, and `Log full requests/responses data` marked.
3. Mark `Enable X-Ray Tracing`
4. Send a few valid payloads.
5. Send a single invalid payload (check that it is going to get into your DLQ).
6. Check the X-Ray, the function logs, and Service Map on CloudWatch.
   - You are expected to see a trace going from API Gateway to Kinesis.

### 2. Make the Lambda function *“traceable”*  

1. Visit your Lambda function, and go to the *"Monitoring and operations tools"*
2. Enable *`Active tracing`* and *`Enhanced monitoring`*.
4. Check that the IAM role for your Lambda function got the proper permissions to post data into X-Ray.
3. Send a single valid payload.
4. On CloudWatch Logs, check the logs for your Lambda Function, for API Gateway, and see that now there's a log group for Lambda Insights.
5. Check X-Ray.
6. Send a single invalid payload.
7. Revisit CloudWatch Logs, CloudWatch Application Monitoring, CloudWatch Insights/Lambda Insights (also Performance Monitoring in there), and X-Ray
8. Explore a few request traces (either from X-Tray, or from CloudWatch / Application Monitoring)

## 3. Add DynamoDB tracing

1. Go back to your Cloud9 environment
2. On the terminal, be sure of being at the folder `serverless-streaming-demo/lambda/storeOrders`. You should see something like this:
    ~~~
    Admin:~/environment/serverless-streaming-demo/lambda/storeOrders (main) $
    ~~~
3. Run the following command:
    ~~~
    npm init
    ~~~
    - Confirm all the inputs without changing anything.
4. Run the following command:
    ~~~
    npm install aws-xray-sdk
    ~~~
5. Open the file `lambda/storeOrders/index.js`
6. Comment the first two lines (with *const*) of that code using `//`.
7. Copy and paste the following content right below the lines that you have just commented:
    ~~~
    const AWSXRay = require('aws-xray-sdk');
    const AWS = AWSXRay.captureAWS(require('aws-sdk'));
    const dynamoDBclient = new AWS.DynamoDB.DocumentClient();
    ~~~
4. Save the file.
5. Get back to the `~/environment/serverless-streaming-demo` folder
6. Run `cdk diff` on the terminal. Check the differences.
7. Run `cdk deploy`.
8. Send a few more payloads (valid and invalid ones).
9. Give a few seconds for the system to get the traces, and then check again: CloudWatch Logs, CloudWatch Application Monitoring / Service Map, Traces, and X-Ray.


### Extras
- Create a trace group using 
  ~~~
  http.url = "https://<api>.execute-api.<region>.amazonaws.com/prod/putOrder" or resource.arn = "<your lambda function arn"
  ~~~
- Use CloudWatch Logs Insights, and explore your Lambda Function
  ~~~
    fields @timestamp, @message
    | filter @message like /ERROR/ 
    | sort @timestamp desc
    | limit 20
  ~~~

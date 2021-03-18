# serverless-streaming-demo
A very simple serverless data streaming processing that I use to talk to customers and students





## Observability Lab

1. Create a Cloud9 instance
2. Clone this repository: https://github.com/fabianmartins/serverless-streaming-demo
3. cd serverless-streaming-demo/
4. npm install
5. npm run build
6. cdk synth
7. (if this is the first time using cdk in this accunt/region)
   - cdk bootstrap
8. cdk deploy
9. Explore the deployed environment
10. Export the execute-API endpoint to an environment variable (replace `<api>` whith your API endpoint, and `<region>` with the region where it is deployed)
    ~~~
    export API_ENDPOINT=https://<api>.execute-api.<region>.amazonaws.com/prod/putOrder
    ~~~
11. Send a valid payload:
    ~~~
    eval $( echo curl -X POST -H 'content-type:application/json' --data "'"'{  "User" : "theuser@amazon.com", "Client" : "13522bac-89fb-4f14-ac37-92642eec2b06", "Timestamp" : "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "Order" : { "Symbol" : "USDJPY", "Volume" : '$RANDOM', "Price" : 104.987 } }'"'" $API_ENDPOINT )
    ~~~
12. Visit DynamoDB to confirm the data insertion.
13. Visit CloudWatch logs. See what’s in there.
14. Send an invalid payload
    ~~~
    eval $(echo curl -X POST -H 'content-type:application/json' --data '"INVALID PAYLOAD - $(date -u +%Y-%m-%dT%H:%M:%SZ)"' $API_ENDPOINT)
    ~~~
15. Check again DynamoDB and CloudWatch logs. Describe the behavior. Can you see the exponential backoff?
16. Visit X-Ray. Check that there’s no Traces, no Service map.
17. Work in pairs, and fix the architecture by:
    1. Enabling logs and ray-tracing for the whole architecture.
    2. Making the Lambda function (“traceable”)
    3. Adding a DLQ for the Lambda function to send failed payloads.
    4. Before adding the DLQ, send a few new payloads. What happens?
    5. Send a few valid payloads after adding the DLQ.
    6. Check logs and X-Ray again. For X-Ray you might need to expand the timeline evaluated.
18. Send a single invalid payload.
19. Check logs and X-Ray again. 
20. Check the DLQ.
    - What happened with the previously sent invalid payloads? How to guarantee that they are going to be processed? Can you fix it?
21. Revisit CloudWatch Logs and X-Ray
22. Explore Lambda Insights / Performance Monitoring
23. Explore a few request traces (either from X-Tray, or from CloudWatch / Service Lens
24. Add DynamoDB tracing
    1. Go back to your Cloud9 environment
    2. On the terminal, be sure of being at the folder `serverless-streaming-demo/lambda/storeOrders `. You should see something like this:
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
    6. Replace the first two lines (with *const*) of that code with the following content: 
        ~~~
        const AWSXRay = require('aws-xray-sdk');
        const AWS = AWSXRay.captureAWS(require('aws-sdk'));
        const dynamoDBclient = new AWS.DynamoDB.DocumentClient();
        ~~~
    4. Save the file.
    5. Run `cdk diff` on the terminal. Check the differences.
    6. Run `cdk deploy`.
    8. Send more payloads.
    9. Give a few seconds for the system to get the traces, and then check again: CloudWatch Logs, CloudWatch Service Lens / Service Map, Traces, and X-Ray.

### Closing the lab
- Run `cdk destroy`. If some elements are not deleted (because they were changed by hand), delete them via console.
    - Particularly, if you have changed/updated the Lambda-Kinesis integration by hand, it can remain orphan in your account. To check that, do this:
        - Run `aws lambda list-event-source-mappings` to get the list of source mappings.
        - If you find any involving TradingStream and StoreOrders, get its uuid.
        - Run `aws lambda delete-event-source-mapping --uuid <the uuid you got>` to delete it.


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

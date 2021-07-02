# Adding a DLQ

This lab considers that:
- You are working from a Cloud9 environment.
- That you have cloned this repository and have already deployed the environment.

***

1. Export the execute-API endpoint to an environment variable (replace `<api>` whith your API endpoint, and `<region>` with the region where it is deployed)
    ~~~
    export API_ENDPOINT=https://<api>.execute-api.<region>.amazonaws.com/prod/putOrder
    ~~~
2. Send a valid payload:
    ~~~
    eval $( echo curl -X POST -H 'content-type:application/json' --data "'"'{  "User" : "theuser@amazon.com", "Client" : "13522bac-89fb-4f14-ac37-92642eec2b06", "Timestamp" : "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "Order" : { "Symbol" : "USDJPY", "Volume" : '$RANDOM', "Price" : 104.987 } }'"'" $API_ENDPOINT )
    ~~~
3. Visit DynamoDB to confirm the data insertion.
4. Visit CloudWatch logs. Search for the log group for the Lambda function. See what’s in there.
   - Use [Base64Encode/Decode](https://www.base64decode.org/) to decode the field `data` that came from the Kinesis record.
5. Send an *INVALID* payload
    ~~~
    eval $(echo curl -X POST -H 'content-type:application/json' --data '"INVALID PAYLOAD - $(date -u +%Y-%m-%dT%H:%M:%SZ)"' $API_ENDPOINT)
    ~~~
6. Check again DynamoDB and CloudWatch logs. Describe the behavior. Can you see the exponential backoff? Can you explain what is happening?
7. Take note of this record received from Kinesis in a helper file.

### Adding queues to our system
1. Go to SQS and create a queue named StoreOrdersDLQ.
    - Save the Arn of this queue to use it later.
2. Give to your StoreOrders Lambda function the permissions to send messages the StoreOrdersDLQ SQS queue.
3. Send a new invalid payload.
4. Check again the CloudWatch Logs for your Lambda function. What do you see in the records received from Kinesis?
5. Go to your StoreOrders Lambda function and take note of the configuration of the Kinesis trigger associated with the function.
8. Delete the Kinesis trigger (triggers cannot be changed).
9. Create a new Kinesis Trigger, but now be sure of adding the created SQS queue as a DLQ for the trigger
    - Set `Retry attempts` to `0` (Why?)
    - Set `Maximum age of record` to `-1` (Why?)
    - Mark `Split batch on error` (Why?)
    - Mark `Report batch item failures` (Why?)
    - When confirming it, if you have not previously configured the permissions to your Lambda function, you are going to get this error: *"...execution role does not have permissions to call SendMessage on SQS"*. Fix this.
10. Check CloudWatch Logs for the Lambda function.
11. Pool for messages on the DLQ. Do you see anything? Can you explain?
12. Send a few **VALID** payloads after adding the queues. Did they appear on DynamoDB?
13. Send an **INVALID** payload.
14. Check the logs of your Lambda function.
15. Take note of the record received from Kinesis.
16. Pool for messages on the queue again.
    - Do you understand what's in that message?
    - What happened with the previously sent invalid payloads? If in your case they are not processed, how to guarantee that they are going to be processed? Can you fix it?
        - *Tip*: this has to do with the *"Starting position"* when you configure the trigger.

***
### Additional content
- [*"AWS re:Invent 2020: Handling errors in a serverless world*](https://www.youtube.com/watch?v=ZplOXryhX4k), on Youtube
- [*"6 Common Pitfalls of AWS Lambda with Kinesis Trigger"*](https://dashbird.io/blog/lambda-kinesis-trigger/), by Dashbird, an AWS partner.
- [*"Optimizing batch processing with custom checkpoints in AWS Lambda"*](https://aws.amazon.com/blogs/compute/optimizing-batch-processing-with-custom-checkpoints-in-aws-lambda/), AWS Compute blog.
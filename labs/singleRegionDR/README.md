# `<UNDER CONSTRUCTION>`

# Single-region DR

This is a 400-level lab. If you are new to AWS, or not familiar with the console, I suggest you to work with someone that is more experienced.

Implementing a single-region DR does not make much sense because the concept of DR for AWS is based on using multiple regions.  Of course, for many customers and for some of their workloads deploying environments in 2 AZ might correspond to a DR design if compared to what they have currently on-premises, but that is not AWS recommendation because as *"things fail all the time"* a region outage, although unlikely, is possible.

This lab is available to cope with situations when one cannot run the lab on multiple regions due integration restrictions. It is NOT the best implementation of a DR scenario, so we are using it here for illustrative purposes.

If you don't have restrictions, use the Multi-Region DR lab, which leverages DynamoDB Global tables and can give you a more interesting perspective of how to build DR enviroments.

## Preparing the environment
1. Get into the server-less-straming-demo folder.
2. Run the following commands
~~~
npm install
npm audit fix
npm run build
cdk bootstrap aws://$(eval "aws sts get-caller-identity --query "Account" --output text")/$(eval "aws ec2 describe-availability-zones --output text --query 'AvailabilityZones[0].[RegionName]'") 
~~~

## Deploying the primary environment

1. At the `serverless-streaming-demo` folder, on the terminal type the following command to deploy the primary environment
~~~
cdk deploy TradingStackPrimary
~~~
2. After its deployment, visit CloudFormation, and visit the various elements that were created by it. Pay attention to the resources'  names.
3. Export the API endpoint for the primary environment 
~~~
export API_ENDPOINT_PRIMARY=`<put your API execute endpoint here>`
~~~
Your API endpoint is output by the CDK deployment, and has the form `<api-id>.execute-api.<region>.amazon.com`. Be sure of removing `https://` and `/prod` from it before exporting it.

4. Publish a valid payload to check that everything is ok:
~~~
eval $( echo curl -X POST -H 'content-type:application/json' --data "'"'{  "User" : "theuser@amazon.com", "Client" : "13522bac-89fb-4f14-ac37-92642eec2b06", "Timestamp" : "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "Order" : { "Symbol" : "USDJPY", "Volume" : '$RANDOM', "Price" : 104.987 } }'"'" https://$API_ENDPOINT_PRIMARY/prod/putOrder )
~~~

If you did it correctly, you should receive a response in the form:
~~~
{"EncryptionType":"KMS","SequenceNumber":"<a very big number here>","ShardId":"shardId-000000000000"}
~~~

5. Visit DynamoDB and check that the record is there.

At this point we have our primary environment up and running.


## Deploying the secondary (DR) environment

1. At the `serverless-streaming-demo` folder, on the terminal type the following command to deploy the primary environment
~~~
cdk deploy TradingStackDR
~~~
2. After its deployment, visit CloudFormation, and visit the various elements that were created by it. Pay attention to the resources'  names.
3. Export the API endpoint for the DR environment in the same way that you did before, but now use the `API_ENDPOINT_DR` for the export name.
4. Publish a valid payload to check that everything is ok:

~~~
eval $( echo curl -X POST -H 'content-type:application/json' --data "'"'{  "User" : "theuser@amazon.com", "Client" : "13522bac-89fb-4f14-ac37-92642eec2b06", "Timestamp" : "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "Order" : { "Symbol" : "USDJPY", "Volume" : '$RANDOM', "Price" : 104.987 } }'"'" https://$API_ENDPOINT_DR/prod/putOrder )
~~~

You should have received the proper message.

5. Visit DynamoDB and check that the record is there.

At this point we have our primary and DR environments "running" (remember, with Serverless, things will run only if requested).

## Creating the health-check for your DR environment

### Step 1 - Creating the Lambda function that will perform the health-check

1. Visit the [Lambda Function console](https://console.aws.amazon.com/lambda/), and create a new Lambda function with the following parameters:
    1. Use *Author from scratch*.
    2. For the function name, use *TradingStackDRHealthCheck*.
    3. For *Runtime* , use the *Node.js 14.x* .
    4. Click on *"Create function"* to create the function with the standard parameters.
2. **Updating the code of the Lambda Function**: In the *Code* section, open the file index.js and replace its content with what is in this file: [index.js]().
    - Click on *Deploy* to be sure that it is saved.
    - Explore the code. You don't need to be a programmer to grasp an overall understanding of what is in there.
3. **Updating the time-out**: In the *Configuration* section, in *General configuration* , change the time-out of the function for 5 seconds.
4. **Defining the environment variables:** Still in the Configuration section, visit the *"Environment variables"* section and create the following environment variables:
    - *API_ENDPOINT* with the value that you have in the API_ENDPOINT_DR environment variable (to get its value use the command `echo $API_ENDPOINT_DR` on the terminal)
    - *RECORD_ID*, with the value `HEALTH_CHECK_dr`. 
    - *TABLE*, with the value `TradingOrdersdr`.
5. **Adjusting the permissions:** Still in the Configuration section, visit the *"Permissions"* section, and add the following polices to the Lambda Function role:
    - [DynamoDB policy](./iampolicies/dynamodb.json): When adding this policy, remember to do this small updates:
        - Update it with the ARN of the TradingOrdersdr table.
        - Update the `<key specification>` string within that policy with the following: `HEALTH_CHECK_dr#00000000-0000-0000-0000-00000000000#HEALTH_CHECK#0#0#1970-01-01T00:00:00.000Z` 
            - Quick question: Do you know what is this? Do you understand this policy?
    - [CloudWatch Metrics policy](./iampolicies/cloudwatchmetrics.json). In this one you don't need to apply any changes.
6. **Test your Lambda Function:** Create a test event (any value), and check the output. It must resemble something like this:
~~~
Response
{
  "statusCode": 200,
  "body": "\"success\""
}

Function Logs
START RequestId: c8d65a21-5816-4f77-92a5-dc4096f4e4f9 Version: $LATEST
2021-03-12T19:53:42.086Z	c8d65a21-5816-4f77-92a5-dc4096f4e4f9	INFO	EVENT: {}
2021-03-12T19:53:42.586Z	c8d65a21-5816-4f77-92a5-dc4096f4e4f9	INFO	Querying DynamoDB with this parameter: {"TableName":"TradingOrdersdr","Key":{"TransactionId":"HEALTH_CHECK_dr#00000000-0000-0000-0000-00000000000#HEALTH_CHECK#0#0#1970-01-01T00:00:00.000Z"}}
2021-03-12T19:53:44.410Z	c8d65a21-5816-4f77-92a5-dc4096f4e4f9	INFO	Result from DynamoDB: {"Item":{"Timestamp":"1970-01-01T00:00:00.000Z","User":"HEALTH_CHECK_dr","Client":"00000000-0000-0000-0000-00000000000","TransactionId":"HEALTH_CHECK_dr#00000000-0000-0000-0000-00000000000#HEALTH_CHECK#0#0#1970-01-01T00:00:00.000Z","Order":{"Volume":0,"Price":0,"Symbol":"HEALTH_CHECK"}}}
2021-03-12T19:53:44.518Z	c8d65a21-5816-4f77-92a5-dc4096f4e4f9	INFO	Delete result: {}
2021-03-12T19:53:44.651Z	c8d65a21-5816-4f77-92a5-dc4096f4e4f9	INFO	PUT METRIC RESULT: {"ResponseMetadata":{"RequestId":"93e07574-6c7d-4077-b666-946e22e85aca"}}
2021-03-12T19:53:44.651Z	c8d65a21-5816-4f77-92a5-dc4096f4e4f9	INFO	Response from Lambda {"statusCode":200,"body":"\"success\""}
END RequestId: c8d65a21-5816-4f77-92a5-dc4096f4e4f9
REPORT RequestId: c8d65a21-5816-4f77-92a5-dc4096f4e4f9	Duration: 2623.55 ms	Billed Duration: 2624 ms	Memory Size: 128 MB	Max Memory Used: 82 MB	Init Duration: 273.72 ms

Request ID
c8d65a21-5816-4f77-92a5-dc4096f4e4f9
~~~
7. Visit Cloudwatch Logs for the Lambda function, and also visit the Cloudwatch Metrics to see that the metric was created.

### Step 2 - Configure the Lambda function to run at every minute

1. Visit the [Amazon EventBridge console](console.aws.amazon.com/events/).
2. Go to *Rules*.
3. Create a rule with the following parameters:
    - Name: `TradingStackDRHealthCheck_EveryMinute`.
    - Description: `Runs the health check for TradingStackDRHealthCheck every minute`
    - Define the following *Schedule* pattern: Fixed rate every `1` minute.
    - For the target, select your *TradingStackDRHealthCheck* lambda function.

Wait a minute or two and check that the function is being executed as expected.


### Step 3 - Create an CloudWatch Alarm for the HEALTH_CHECK metric

1. Visit the [Amazon CloudWatch](https://console.aws.amazon.com/cloudwatch/) page, and go *All alarms* under the section *Alarms*.
2. Create a new alarm with the following configuration:
    - For the Metric, select the metric under the custom namespace *TRADING_APP* that is defined by
        - Environment=HEALTH_CHECK_dr ( be sure of selecting the one ending in *_dr* )
        - Region=*your current region*
        - Metric name=HEALTH_CHECK
    - In the *Specify metric and conditions* section:
        - Use the statistic *Average* over a period of 1 minute.
            - *Is this the ideal configuration?*
        - For *Conditions*, use *Static* and *Lower than 1*.
        - Expand the additional configuration, and set the *Datapoints to alarm* to *5 out of 5*.
        - Set *Treat missing data as bad*.
    - In the *Configure actions* section
        - For *Notification*, create the topic *TradingStack_dr* and add your personal e-mail to be s
    - Finish the creation of the alarm by giving it a name and a description:
        - Name: `TradingStackDR_Alarm`
        - Description: `Health-check alarm for the TrandingStack DR environment`
    - Create the alarm.
    - Visit your e-mail and confirm your subscription.


### Step 4 - Creating the Route53 alarm for your DR environment

Visit the [Route 53 console for health checks](https://console.aws.amazon.com/route53/healthchecks) and create a health check using the following configuration:
- Name: `TradingAPI_dr`
- What to monitor: mark the option *State of CloudWatch alarm*
- Select your TradingStackDR_Alarm within the current region.

You don't need to add notifications. Create the health check.

## Double-checking where we are at

At this point you have two environments - Primary/main and DR - properly configured with health-checks. Now we need to use Route 53 to detect an issue with the primary environment and fail it over the DR.

## Implementing the DNS failover

The way you are going to implement this in this lab is via a workaround to avoid you from having to have a public domain at your hands. With this workaround you are going to be able to test the failover process from your Cloud9 enviroment.

### Step 1 - Configuring a private Hosted Zone to provide private access to your APIs

1. On Route 53, create a **private hosted zone** with the following configuration:
    - Domain name: `tradingapi.local`
    - Type: *Private hosted zone*
    - VPCs to associate with the hosted zone:
        - Region: *your current region*
        - VPC ID: *Be sure of selecting the VPC ID associated with your Cloud9 environment. It is easy to check that by visiting your EC2 console and checking the VPC ID associated with the EC2 instance backing your Cloud9 environment*.
2. Get into the provate host zone that you have just created, and create a CNAME record for each of your APIs:
    - For your PRIMARY environment:
        - Click on *"Create record"*
        - For *Record name*, input `api` (so it will be api.tradingapi.local)
        - For *Record type*, select `CNAME`
        - For *Value*, input the execute-api endpoint of the API for the PRIMARY (again, it is the same value that you have in your API_ENDPOINT_PRIMARY enviroment variable).
        - For *TTL (seconds)* select `60`. 
        - For *Routing policy* select `Failover`.
        - For *Failover record type*, select `Primary`.
        - For *Health check* select `TradingAPI_main`.
        - For *Record ID* enter `trading-api-main`.
    - For your DR environment:
        - Click on *"Create record"*
        - For *Record name*, input `api` (yes, the same one you used for your primary)
        - For *Record type*, select `CNAME`
        - For *Value*, input the execute-api endpoint of the API for the DR (again, it is the same value that you have in your API_ENDPOINT_DR nviroment variable).
        - For *TTL (seconds)* select `60`. 
        - For *Routing policy* select `Failover`.
        - For *Failover record type*, select `Secondary`.
        - For *Health check* select `TradingAPI_dr`.
        - For *Record ID* enter `trading-api-dr`.
2. Export the API endpoint 
~~~
export API_ENDPOINT=api.tradingapi.local
~~~
At this point you have 3 exports:
- **API_ENDPOINT_PRIMARY** pointing directly to the primary environment,
- **API_ENDPOINT_DR** pointing directly to the DR environment,
- **API_ENDPOINT** point to the failover DNS record, that will point to the correct environment.

Also, at this point if you try to call the API_ENDPOINT using CURL, even with the `--insecure` parameter, you are going to get either a `{"message":"Forbidden"}` response, or a response from CURL indicating that the certificate is invalid. This is because you doing HTTPS redirections without the proper SSL certificates. 

We need to fix this by doing 2 more steps: 1/ Creating a certificate for our API (which is private due the constraints of this lab), and 2/ Creating a custom domain name and associating them with our APIs.

## Creating the CA (Certificate Authority) to be used with your APIs

Again, to avoid you to have to acquire a public domain, we are going to do these steps using a private certificate. However the steps would be relatively similar for the public case.

1. Visit the [Certificate Manager](https://console.aws.amazon.com/acm/home) home page. If this is the first time accessing it you will likely see an option to create a *"Private certificate authority"*. Select that option.
2. For *"Select the certificate authority (CA) type"*, select `Root CA`.
3. For *"Organization (O)"*, input `TradingAPI`.
    - You do not need to fill in the other fields.
4. Click on `Next` for the next pages, until you get to the last one.
5. In the last page, mark the check-box "Click to confirm you understand..."
6. Click on `"Confirm and create"`
7. You are going to get to a page where you will configure the root CA certificate parameters. Click on `Next` and then confirm the creation.

## Issuing the certificate for your API

1. Get back to the Certificate Manager, and now select the option to `Request a private certificate`. Click to move to the next pages until you are asked to inform the domain name.
2. For *Domain name* input `*.tradingapi.local`.
3. Confirm the next steps until you confirm the request.

Now your certificate is issued and can be associated with your APIs.

## Creating the Custom Domain and associating it with your APIs

1. Visit the home page for [API Gateway](console.aws.amazon.com/apigateway/).
2. Click on *Custom domain names*
3. Click on *Create*, and provide the following details:
    - For *Domain name* input `api.trading.local`
    - For *ACM Certificate* select the certificate that you have just created (*.tradingapi.local)
    - 


2. Test it on your Cloud9 terminal:
~~~
eval $( echo curl -X POST -H 'content-type:application/json' --data "'"'{  "User" : "theuser@amazon.com", "Client" : "13522bac-89fb-4f14-ac37-92642eec2b06", "Timestamp" : "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "Order" : { "Symbol" : "USDJPY", "Volume" : '$RANDOM', "Price" : 104.987 } }'"'" https://$API_ENDPOINT/prod/putOrder )
~~~
At this point you are going to get the following message






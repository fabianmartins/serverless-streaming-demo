import * as cdk from '@aws-cdk/core';
import * as apigateway from "@aws-cdk/aws-apigateway";
import * as lambda from "@aws-cdk/aws-lambda";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as kinesis from "@aws-cdk/aws-kinesis";
import * as iam from "@aws-cdk/aws-iam";
import * as eventSource from "@aws-cdk/aws-lambda-event-sources";
import { TradingStackProps } from './tradingstackprops';

export class TradingStack extends cdk.Stack {

    constructor(scope: cdk.Construct, id: string, props?: TradingStackProps) {
      super(scope, id, props);
      let envname : string = ( (props && props.envname) ? props.envname : "" );
      const tradingStream = this.createTradingStream(envname);
      const ordersTable = this.createTradingOrdersTable(envname);
      this.createTradingAPI(tradingStream, envname);
      this.createLambdaFunction(tradingStream, ordersTable, envname);
    }
  
    createTradingOrdersTable(envname : string): dynamodb.Table {
      return new dynamodb.Table(this, "TradingOrdersTable"+envname, {
        tableName: "TradingOrders"+envname,
        partitionKey: {
          name: "TransactionId",
          type: dynamodb.AttributeType.STRING
        },
        removalPolicy : cdk.RemovalPolicy.DESTROY
      });
    };
  
    createTradingStream(envname : string): kinesis.Stream {
      return new kinesis.Stream(this, "TradingStream"+envname, {
        streamName: "TradingStream"+envname
      });
    }
  
    createTradingAPI(stream: kinesis.Stream, envname : string): apigateway.RestApi {
      const tradingAPI = new apigateway.RestApi(this, "trading-api-"+envname.toLowerCase(),{
        description : "Trading application for study purposes",
        endpointTypes : [ apigateway.EndpointType.REGIONAL ]
      });
      const tradingAPIRole = new iam.Role(this, "APIGatewayRole"+envname, {
        assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonAPIGatewayPushToCloudWatchLogs")
        ],
        inlinePolicies: {
          "KinesisPermissions":
            new iam.PolicyDocument({
              statements: [
                new iam.PolicyStatement({
                  resources: [stream.streamArn],
                  actions: [
                    "kinesis:PutRecord"
                  ]
                })
              ]
            })
        }
      });
      tradingAPI.node.addDependency(stream);
      const putOrderResource = tradingAPI.root.addResource("putOrder");
      putOrderResource.addMethod(
          "POST",
          new apigateway.AwsIntegration({
            service: "kinesis",
            action: "PutRecord",
            integrationHttpMethod: "POST",
            options: {
                credentialsRole: tradingAPIRole
              , passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES
              , requestTemplates: {
                "application/json":
                  `#set($inputPath = $input.path('$'))
                      {
                      "PartitionKey" : "$inputPath.User#$inputPath.Client#$inputPath.Order.Symbol#$inputPath.Order.Volume#$inputPath.Order.Price#$inputPath.Timestamp",
                      "Data" : "$util.base64Encode("$input.json('$')")",
                      "StreamName" : "${stream.streamName}"
                      }`
                }
              , integrationResponses : [
                {
                    statusCode: "200"
                    , responseParameters: {
                        "method.response.header.Access-Control-Allow-Origin": "'*'"
                    }
                }
                ]
                    
            }
          }),
          {
            methodResponses: [
              {
                  statusCode: "200"
                  , responseParameters: {
                      "method.response.header.Access-Control-Allow-Origin": true
                  }
                  , responseModels: {
                    "application/json": apigateway.Model.EMPTY_MODEL
                  }
              }
            ]
          }
      );
      return tradingAPI;
    }
  
    createLambdaFunction(stream: kinesis.Stream, table: dynamodb.Table, envname : string) {
      const storeOrdersFunction = new lambda.Function(this, "StoreOrdersFunction"+envname, {
        runtime: lambda.Runtime.NODEJS_12_X
        , handler: 'index.handler'
        , code: lambda.Code.fromAsset("./lambda/storeOrders")
        , functionName: "StoreOrders"+envname
        , description: "This function puts the order into the DynamoDB table"
        , memorySize: 128
        , timeout: cdk.Duration.seconds(60)
        , role: new iam.Role(this, "StoreOrdersFunctionRole"+envname, {
          roleName: "StoreOrdersFunctionRole"+envname
          , assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
          , managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')]
          , inlinePolicies: {
            'DynamoDBPermissions':
              new iam.PolicyDocument({
                statements: [
                  new iam.PolicyStatement({
                    resources: [table.tableArn]
                    , actions: [
                      "dynamodb:BatchWriteItem"
                    ]
                  })
                ]
              })
          }
        })
      });
      storeOrdersFunction.addEnvironment("TRADING_ORDERS_TABLE",table.tableName);
      storeOrdersFunction.addEventSource(
        new eventSource.KinesisEventSource(stream,
        {
          batchSize: 250,
          startingPosition : lambda.StartingPosition.LATEST,
          maxBatchingWindow : cdk.Duration.seconds(1),
          enabled : true
        } 
        )
      );
      new lambda.Alias(this,"StoreOrdersAlias"+envname,{
        aliasName : "StoreOrdersAlias"+envname,
        version : storeOrdersFunction.latestVersion
      })
    }
}

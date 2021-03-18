import * as cdk from '@aws-cdk/core';
import * as apigateway from "@aws-cdk/aws-apigateway";
import * as lambda from "@aws-cdk/aws-lambda";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as kinesis from "@aws-cdk/aws-kinesis";
import * as iam from "@aws-cdk/aws-iam";
import * as eventSource from "@aws-cdk/aws-lambda-event-sources";

export class TradingStack extends cdk.Stack {

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
      super(scope, id, props);
      const tradingStream = this.createTradingStream();
      const ordersTable = this.createTradingOrdersTable();
      this.createTradingAPI(tradingStream);
      this.createLambdaFunction(tradingStream, ordersTable);
    }
  
    createTradingOrdersTable(): dynamodb.Table {
      return new dynamodb.Table(this, "TradingOrdersTable", {
        tableName: "TradingOrders",
        partitionKey: {
          name: "TransactionId",
          type: dynamodb.AttributeType.STRING
        },
        removalPolicy : cdk.RemovalPolicy.DESTROY
      });
    };
  
    createTradingStream(): kinesis.Stream {
      return new kinesis.Stream(this, "TradingStream", {
        streamName: "TradingStream"
      });
    }
  
    createTradingAPI(stream: kinesis.Stream): apigateway.RestApi {
      const tradingAPI = new apigateway.RestApi(this, "trading-api",{
        description : "Trading application for study purposes"
      });
      const tradingAPIRole = new iam.Role(this, "APIGatewayRole", {
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
  
    createLambdaFunction(stream: kinesis.Stream, table: dynamodb.Table) {
      const storeOrdersFunction = new lambda.Function(this, "StoreOrdersFunction", {
        runtime: lambda.Runtime.NODEJS_12_X
        , handler: 'index.handler'
        , code: lambda.Code.fromAsset("./lambda/storeOrders")
        , functionName: "StoreOrders"
        , description: "This function puts the order into the DynamoDB table"
        , memorySize: 128
        , timeout: cdk.Duration.seconds(60)
        , role: new iam.Role(this, "StoreOrdersFunctionRole", {
          roleName: "StoreOrdersFunctionRole"
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
    }
}

'use strict';
const AWS = require('aws-sdk');
const eventbridge = new AWS.EventBridge();
exports.handler = async (event, context) => {

    const getEventBridgeEntry = (order) => {
        var entry = {
            Time : new Date(),
            EventBusName : "trading", 
            Resources : [ context.invokedFunctionArn ],
            Source : "tradingsystem",
            DetailType : "order",
            Detail : JSON.stringify(order)
        };
        return entry;
    };

    var eventBridgeEntries = [];
    event.Records.forEach((record) => {
        console.log('Stream record: ', JSON.stringify(record, null, 2));
        if (record.eventName == 'INSERT') {
            var orderRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
            record["Total"] = orderRecord.Order.Volume*orderRecord.Order.Price;
            console.log(`order : ${JSON.stringify(orderRecord)}`);
            eventBridgeEntries.push(getEventBridgeEntry(orderRecord));
        }
    });
    var params = { Entries: eventBridgeEntries };
    await eventbridge.putEvents(params).promise();
    const response = {
        statusCode: 200
    };
    return response;
};
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { TradingStack } from '../lib/tradingstack';

const app = new cdk.App();
//
// If one wants to create environments with different names, uncomment the 3 lines below, and comment the lines for the Primary and DR environments
// let environmentName = app.node.tryGetContext("envname");
// environmentName = environmentName ? environmentName : "";
// new TradingStack(app, 'TradingStack'+environmentName, { envname : environmentName });

// Stack to create the main environment
new TradingStack(app, 'TradingStackPrimary', { 
    env: {region: "us-west-1"},
    envname : 'main' 
}
);
 
// Stack to create the DR environment
new TradingStack(app, 'TradingStackDR', { 
    env: {region: "us-west-1"},
    envname : 'dr' 
}
);

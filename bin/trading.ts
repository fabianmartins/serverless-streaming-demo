#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { TradingStack } from '../lib/tradingstack';

const app = new cdk.App();
new TradingStack(app, 'TradingStack');

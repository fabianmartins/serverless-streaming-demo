#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { CICDPipelineStack } from '../lib/cicd-pipeline-stack';

const CODECOMMIT_REPO_NAME : string = "cicd-demo";

const app = new cdk.App();

new CICDPipelineStack(app, 'TradingStackCICD', {
repoName: CODECOMMIT_REPO_NAME
});

app.synth();
#!/bin/bash
npm install
npm audit fix
npm run build
cdk synth > output.yaml
cdk bootstrap aws://$(eval "aws sts get-caller-identity --query "Account" --output text")/$(eval "aws ec2 describe-availability-zones --output text --query 'AvailabilityZones[0].[RegionName]'") 
cdk deploy --require-approval never
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';

export interface CICDPipelineStackProps extends cdk.StackProps {
  readonly repoName: string
}

export class CICDPipelineStack extends cdk.Stack {
  
  constructor(app: cdk.App, id: string, props: CICDPipelineStackProps) {
    super(app, id, props);
    
    // Create a reference to the CodeCommit repository using its name.
    const repositorySource =  codecommit.Repository.fromRepositoryName(this, 'TradingStackRepo', props.repoName);
    
    const pipeline = new codepipeline.Pipeline(this,"TradingStackPipeline",{
      pipelineName : "TradingStack",
      restartExecutionOnUpdate : true,
      // we are not going to do cross-account deployments now, so saving $1/month
      // best practices recommend separating the CI/CD accounts from the Service accounts
      // do it at least per region
      crossAccountKeys: false
    });
    
    //----- Gathering the source code
    const sourceOutput = new codepipeline.Artifact();
    const sourceStage = pipeline.addStage({
      stageName : "Source",
      actions : [
        new codepipeline_actions.CodeCommitSourceAction({
            actionName: 'CodeCommit_Source',
            repository: repositorySource,
            branch : "main",
            output: sourceOutput,
        }),
      ],
    });
    
    //----- Building
    // build project
    const cdkBuild = new codebuild.PipelineProject(this, 'CdkBuild', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: 'npm install',
          },
          build: {
            commands: [
              'npm run build',
              'npm run cdk synth -- -o dist'
            ],
          },
        },
        artifacts: {
          'discard-paths' : 'no',
          'base-directory': 'dist',
          files: [
            '**/*',
          ],
        }
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_2_0
      },
    });    
    const buildOutput = new codepipeline.Artifact();
    const buildAndTestStage = pipeline.addStage({
      stageName : "BuildAndTest",
      placement : {
        justAfter : sourceStage
      },
      actions : [
          new codepipeline_actions.CodeBuildAction({
            actionName: 'CDK_Build',
            project: cdkBuild,
            input: sourceOutput,
            outputs: [buildOutput],
        }),
      ]
    });
    //----- Deploying
    // deploy project
  
   var cdkDeploy = new codebuild.PipelineProject(this, 'CdkDeploy', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [
             'npm install -g typescript@3.9.7',
             'npm install -g aws-cdk@1.87.1'
            ]
          },
          pre_build : {
            commands : [
              'cdk --version',
              'npm install'
            ]
          },
          build: {
            commands: [
              'npm run build'
            ]
          },
          post_build : {
            commands: [
              "cdk deploy --require-approval never"
            ]
          }
        }
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_2_0
      },
    });   
    // Giving admin access to the project
    // The project requires Admin powers because of the overall dependencies
    cdkDeploy.addToRolePolicy(new iam.PolicyStatement({
      sid : "AdminPermissions",
      actions : [
        '*'
      ],
      resources : [
        '*'
      ]
    }));
      
    pipeline.addStage({
      stageName : "Deploy",
      placement : {
        justAfter : buildAndTestStage
      },
      actions : [
          new codepipeline_actions.CodeBuildAction({
            actionName: 'CDK_Deploy',
            project: cdkDeploy,
            input: sourceOutput
        }),
      ]
    });
  }
};
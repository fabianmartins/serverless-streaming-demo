# Implementing a pipeline for a CDK project

This lab considers that:
- You are working from a Cloud9 environment.
- `IMPORTANT`: You need to have a clean enviroment. If you have deployed  
        - Use `cdk destroy` or delete the stack from CloudFormation. 
        - Also, delete any resources that are not automatically deleted because they were changed by hand. That happens a lot with IAM roles, and if you left an IAM role behind, the deployment will break (and it may be a good learning exercise to understand and fix the error).
- If this is the first time that you are deploying a CDK project in your account, run the following command on the terminal, replacing the account id and region.
    - How to know if your account is bootstrapped? 
        - Take a look at the Cloudformation console. If you see “CDKToolkit”, your account/region is bootstrapped.
    - The command below is going to bootstrap CDK in your account/region
~~~
cdk bootstrap aws://$(eval "aws sts get-caller-identity --query "Account" --output text")/$(eval "aws ec2 describe-availability-zones --output text --query 'AvailabilityZones[0].[RegionName]'")  
~~~

***

1. Clone this resposity inside your Cloud9 enviroment:

~~~
git clone https://github.com/fabianmartins/serverless-streaming-demo
~~~

2.	Create a CodeCommit repository for this application

~~~
aws codecommit create-repository --repository-name cicd-demo
~~~  

You are going to receive a response like the one below

~~~
{
    "repositoryMetadata": {
        "repositoryName": "cicd-demo", 
        "cloneUrlSsh": "ssh://git-codecommit.<region>.amazonaws.com/v1/repos/cicd-demo", 
        "lastModifiedDate": 1617037209.286, 
        "repositoryId": "<uuid>", 
        "cloneUrlHttp": "https://git-codecommit.<region>.amazonaws.com/v1/repos/cicd-demo", 
        "creationDate": 1617037209.286, 
        "Arn": "arn:aws:codecommit:<region>:<account>:cicd-demo", 
        "accountId": "<account>"
    }
}
~~~

Take note of the cloneUrlHttp, and visit CodeCommit in your account and see that the repository is created, and it's empty.  

3. Get into the serverless-streaming-demo folder.

~~~
cd serverless-streaming-demo
~~~

4.	Check the status of the local repository using

~~~
git remote -v
~~~

You should get

~~~
origin  https://github.com/fabianmartins/serverless-streaming-demo (fetch)
origin  https://github.com/fabianmartins/serverless-streaming-demo (push)
~~~


5. Let’s redirect the remote repository pointer to CodeCommit. Replace cloneUrlHttp with what you got earlier
~~~
git remote set-url origin << cloneUrlHttp>>
~~~

9.	Let’s check the change

~~~
git remote -v
~~~

You should get

~~~
origin  https://git-codecommit.<region>.amazonaws.com/v1/repos/cicd-demo (fetch)
origin  https://git-codecommit.<region>.amazonaws.com/v1/repos/cicd-demo (push)
~~~

10.	Publish the code on CodeCommit with 

~~~
git push origin main
~~~

11.	Visit the CodeCommit console and check that the code is there.

12.	 Getting back to your Cloud 9 environment, and being sure that you are in the folder `Admin:~/environment/`, create a new folder for the pipeline

~~~
mkdir cicd-pipeline && cd cicd-pipeline
~~~

13.	Create a new CDK project so we can start configuring our pipeline

~~~
cdk init --language typescript
~~~

14.	 Create a new repository for the pipeline, and save its output.

~~~
aws codecommit create-repository --repository-name cicd-pipeline
~~~

15.	Being sure that you are at ‘~/environment/cicd-pipeline’, check the status of the remote repository

~~~
git remote -v
~~~

You should get no answer.

16.	Now add the CodeCommit repository that we just created as a remote for the current project (be sure of using the cloneUrlHttp for the pipeline project:

~~~
git remote add origin <<cloneUrlHttp>>
~~~

17.	Use `git remote -v` again to check that everything is ok.

18.	Open the file under the bin folder, in the cicd-pipeline project, and replace its content with the content of the following file: [cicd-pipeline.ts](./code/cicd-pipeline.ts)

    Don't worry if some error messages show up at this moment. They will disappear soon.

19.	Open the file under the lib folder (cicd-pipeline project again; its name should finish with -stack.ts) and replace its content of the following file: [cicd-pipeline-stack.ts](./code/cicd-pipeline-stack.ts)

20.	Save all files.

21.	 Being at the folder ~/environment/cicd-pipeline, run the following command to install the required libraries:

~~~
npm install @aws-cdk/aws-codecommit @aws-cdk/aws-codebuild @aws-cdk/aws-codepipeline @aws-cdk/aws-codepipeline-actions @aws-cdk/aws-iam
~~~

22.	Delete the test folder. It will only create additional complexity at this moment.

~~~
rm -rf test
~~~

23.	At this point, be sure of reviewing the code and in undertanding what is in there. Ask questions if necessary.

24.	Commit the code to the repository

~~~
git commit -a -m "First commit"
~~~

25.	Push it to the repository, then visit CodeCommit to see what's in there.

~~~
git push --set-upstream origin master
~~~

26.	Build the project:

~~~
npm run build
~~~

If you got no error message, then you are good to move forward.

27.	Deploy the project. Answer with "y" to any questions.

~~~
cdk deploy 
~~~

28.	When you see it finishing deploying, visit the CodePipeline page at the AWS Console and visit the created pipeline.

29.	When that Pipeline finishes (it will take a few minutes), open CloudFormation. Take a look to what is happening there. You can clieck on the `Details` label of each action inside a stage to follow its steps while it is deploying.

30. Check Cloudformation, and what was created. If you want, you can test the microservice architecture that was created.

31.	If you want to see the pipeline being automatically triggered, open the source code of the Lambda Function (in the serverless-streaming-demo project), and right before of the line with “const response = {“ insert the following line:

~~~
console.log("Finishing");
~~~

31.	Get back to the terminal, and go to the streaming-demo project

~~~
cd ~/environment/serverless-streaming-demo
~~~

32. Input the following commands to publish the change to CodeCommit

~~~
git commit -a -m "Inserting a log comment in the Lambda Function"
git push
~~~

33.	Visit the CodePipeline page. See that the pipeline was triggered. After having it finished, visit the code of your Lambda function to check that your comment is in there.

34.	Ah, of course! Test your microservice.

35.	To get rid of everything, destroy your CI/CD  (the pipeline) project (cdk destroy) , and then delete the Cloudformation template for the TradingStack.

***
Additional references:

- https://aws.amazon.com/blogs/developer/cdk-pipelines-continuous-delivery-for-aws-cdk-applications/
- https://docs.aws.amazon.com/cdk/api/latest/docs/pipelines-readme.html 
- https://docs.aws.amazon.com/cdk/latest/guide/cdk_pipeline.html 
- https://docs.aws.amazon.com/cdk/latest/guide/codepipeline_example.html 
- https://aws.amazon.com/blogs/devops/developing-application-patterns-cdk/ 
- https://docs.aws.amazon.com/cdk/latest/guide/cdk_pipeline.html 
- https://aws.amazon.com/blogs/devops/building-apps-with-aws-cdk/ 

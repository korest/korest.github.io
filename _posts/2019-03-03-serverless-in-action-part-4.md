---
layout: post
title:  "Serverless in action. Part 4: CI/CD"
date:   2019-03-03 23:00:00
tags: [serverless, aws, codebuild, codepipeline, lambda]
categories: [Programming]
comments: true
---

> [Part 0: Intro](/serverless-in-action-part-0), [Part 1: Auth](/serverless-in-action-part-1) and [Part 2: CRUD](/serverless-in-action-part-2) and [Part 3: Notification](/serverless-in-action-part-3)

Introduction
----
In this part, we would create a CI/CD process using AWS tools.
There are a few AWS services for that:
* [CodeBuild](https://aws.amazon.com/codebuild) - continuous integration service.
* [CodeDeploy](https://aws.amazon.com/codedeploy) - deployment service.
* [CodePipeline](https://aws.amazon.com/codepipeline) - continuous delivery service.

<!--more-->

To remind you about `Waitlist` application we have multiple lambda functions:
* [Auth](/serverless-in-action-part-1) - Authentication, Authorization and Registration.
* [CRUD](/serverless-in-action-part-2) - Waitlist and Waitee.
* [Notification](/serverless-in-action-part-3) - Producer and Consumer.

In total 7 lambda functions that ideally should be built, deployed and tested together.

Pipeline[0]
----
We start with creating a pipeline for our application.
Open AWS console then go to `CodePipeline` tool and press on `Create pipeline` button.
There are multiple steps to do, and I will try to provide the most important details.
#### Step 1: Choose pipeline settings
* Pipeline name => Enter `WaitlistApp`.
* Service role => We would create a new service role with `WaitlistAppPipelineRole` name, but there is also an option to use an existing role.
* Artifact store => Choose `Default location`. Also, we have an option to an use existing S3 bucket.

#### Step 2: Add source stage
A few options are available as a source: GitHub, S3, CodeCommit, ECR. We could also add multiple sources to our pipeline.
  * Source provider => Select `Github`.
    After we would connect to our Github account with OAuth then select Repository => `WaitlistAppAuthLambdas` and branch => `master`.
  * Change detection options => Choose `GitHub webhooks (recommended)`.
    Different approach is to set CodePipeline to periodically check our repository.

#### Step 3: Add build stage
* Build provider => Select `AWS CodeBuild`.
* Region => Select your region, almost all are available.
* Project name => Press on `Create project` button.

Build
----
A separate window is opened to create `AWS CodeBuild` project for our pipeline build stage.
There are multiple sections with a few properties each that we should specify.

#### Project configuration
* Project name => Enter `WaitlistAppAuthLambdas`.

#### Environment
For the `Environment image` we have 2 options:
  * Managed images - a few predefined `Windows` and `Ubuntu` based with `Golang`, `Java`, `Node.js` and other languages and things.
  * Custom images - also, `Windows` and `Linux` based from `Amazon ECR` (Image registry from Amazon) and Other registries.

As we're using [Serverless Framework](https://serverless.com/) to build an application and `Golang` for the lambda function
we need docker container with `Go tools` and `Node.js` which has `npm` to install the serverless framework.

Unfortunately, there is no image like this, so we should create a custom one and upload it to `Amazon ECR`.
The easiest way to create custom image is to combine existing `dockerfile`s from both `Golang` and `Node.js` images in [aws-codebuild-docker-images](https://github.com/aws/aws-codebuild-docker-images) repository on Github.
After we push over image to `ECR` we should set a few permissions for `CodeBuild` to be able to access our image.
Set of permissions is specified in user guide for `ECR` sample in [documentation - Step 3](https://docs.aws.amazon.com/codebuild/latest/userguide/sample-ecr.html).

Now we're ready to fill this section:
* Environment image => Select `Custom image`.
* Environment type => Choose `Linux`.
* Image registry => Select `Amazon ECR`.
* ECR account => Select `My ECR account`.
* Amazon ECR image => Choose `latest` or your version.
* Image pull credentials => Select `Project service role`.
* Service role => Select `New service role`
* Role name => Enter `codebuild-WaitlistApp-service-role`

#### Buildspec
We have 2 options here:
  * `Use a buildspec file` - file should be located in our source (Github repo).
  * `Insert build commands` - write content of the `buildspec` command in editor.
  
I would suggest to write it in the editor first to make sure it works and after commit to the repository.

We have next `buildspec.yml` for our project:
```yaml
version: 0.2

phases:
  install:
    commands:
    - npm install --silent --progress=false -g npm
    - npm install --silent --progress=false -g serverless
    - npm install --silent --progress-false
    - npm --version
  pre_build:
    commands:
    - mkdir -p ../github.com/korest/WaitlistAppAuthLambdas
    - mv * ../github.com/korest/WaitlistAppAuthLambdas
    - mv ../github.com .
    - cd github.com/korest/WaitlistAppAuthLambdas
  build:
    commands:
    - make deploy
  post_build:
    commands:
    - echo Build completed on `date`
```
  * `install` phase has the serverless framework install commands.
  * `pre_build` phase has the [workaround](https://github.com/aws/aws-codebuild-docker-images/issues/41) to make `go dep` work because of this [issue](https://github.com/golang/dep/issues/417).
  * `build` phase has command from `make` file which does build, test and deploys with serverless framework.
  * `post_build` just prints the date when the build completes.

#### Logs
* CloudWatch logs => Check it.
Optionally we could define `CloudWatch` group and stream names.

Pipeline[1]
----

#### Step 4: Add deploy stage
After we press `Create project` in `CodeBuild` we are redirected back to our pipeline creation process.
Skip deploy part as we're using the serverless framework for the build process and it deploys our lambda functions.

#### Create pipeline
Let's proceed with creating pipeline.
![](assets/images/serverless-in-action/code_pipeline.jpg)
We can see configured `Source` and `Build` parts for Auth lambdas.

If we press on `AWS CodeBuild` from the pipeline we would see `CodeBuild` project details page.
There we have `Build History` with details for each build like `Status`, `Project`, `Duration` etc.
If we press on one of `Build run`s we would see details about it like `Build status`, `Build configuration` and `Logs`.
Also, we could see logs in real time when the build is being ran.

I'm not going to provide configuration details for `CRUD` and `Notification` lambda functions as it similar to this one, but finally, our pipeline would look like:
![](assets/images/serverless-in-action/code_pipeline_final.jpg)

Conclusion
----
We created a simple pipeline for our `WatilistApp` which deploys everything in a single account.
In a real use-case scenario, we would probably want to deploy to multiple stages/accounts.
There a few blog posts and documentation articles that could help us with this:
* [Building a Secure Cross-Account Continuous Delivery Pipeline](https://aws.amazon.com/blogs/devops/aws-building-a-secure-cross-account-continuous-delivery-pipeline).
* [Using AWS CodePipeline to Perform Multi-Region Deployments](https://aws.amazon.com/blogs/devops/using-aws-codepipeline-to-perform-multi-region-deployments).
* [Four stage pipeline](https://docs.aws.amazon.com/codepipeline/latest/userguide/tutorials-four-stage-pipeline.html).

Also, there is a possibility to define pipeline in [JSON format](https://docs.aws.amazon.com/datapipeline/latest/DeveloperGuide/dp-copydata-redshift-define-pipeline-cli.html) which makes move to other accounts/regions very simple.
Using Git repository we can control deploy to different stages with Git branches and have separate pipeline per account.
For example, dev account pipeline has `dev` branch as a source and as final step commits changes to `gamma` branch with executing AWS lambda, after a pipeline from gamma account runs and as final step commits changes to `prod` branch.

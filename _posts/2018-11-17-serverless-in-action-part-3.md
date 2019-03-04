---
layout: post
title:  "Serverless in action. Part 3: Notification"
date:   2018-11-17 23:00:00
tags: [serverless, typescript, nodejs, aws, lambda]
categories: [Programming]
comments: true
---

> [Part 0: Intro](https://orestkyrylchuk.com/serverless-in-action-part-0), [Part 1: Auth](https://orestkyrylchuk.com/serverless-in-action-part-1) and [Part 2: CRUD](https://orestkyrylchuk.com/serverless-in-action-part-2)

Introduction
----
Here we would implement the last, but not the least part of our application - notifying customers that they should come to the place that they waited for:
![](assets/images/serverless-in-action/notification.jpg)
It has two lambda functions:
* Product - sends waitees that should be notified into the SQS. 
* Consumer - processes SQS and sends notifications to the waitees.
<!--more-->

Probably your first thoughts are that we could send notifications directly from the producer function itself.
The problem here is that `notify` operation is heavy and it could take too much time to send the notification to all waitees (maximum lambda execution time per request is [15 minutes](https://docs.aws.amazon.com/lambda/latest/dg/limits.html)).
This approach is not scalable and it would be a bottleneck. 
Moving process notification functionality to separate function would be much more [scalable](https://docs.aws.amazon.com/lambda/latest/dg/scaling.html). 

For these two lambda functions, I have chosen [NodeJs](https://nodejs.org/en/blog/release/v8.11.3/) runtime with [typescript](https://www.typescriptlang.org/) which is more comfortable for engineers who got used to static typed languages.
NodeJs runtime gives us better cold start comparing to `java` and much smaller package to deploy.
Initial project was generated using serverless framework: `serverless create --template aws-nodejs-typescript`.
The same as before we have common `serverless.yaml` for both lambda functions:
```yaml
service: WaitlistAppNotificationLambdas

provider:
  name: aws
  runtime: nodejs8.10

  stage: dev
  region: us-west-2
  memorySize: 128
```
* Runtime is set to `nodejs8.10` as it the [latest version](https://aws.amazon.com/blogs/compute/node-js-8-10-runtime-now-available-in-aws-lambda/) supported by AWS.
* Memory size is set to minimum 128 which is enough for us.

Custom section:
```yaml
custom:
  notifyAtIndexName: NotifyAtIndex
  notificationQueueName: NotificationQueue
  waiteesTableName: Waitees
  waiteesTableArn: WaitlistAppCrudLambdas-${self:provider.stage}.WaiteesTable
``` 

Let's define SQS for our notifications:
```yaml
NotificationQueue:
  Type: AWS::SQS::Queue
  Properties:
    QueueName: ${self:custom.notificationQueueName}
    RedrivePolicy:
      deadLetterTargetArn:
        Fn::GetAtt:
        - DeadNotificationQueue
        - Arn
      maxReceiveCount: 3

DeadNotificationQueue:
  Type: AWS::SQS::Queue
```
* `RedrivePolicy` is specified with defined DLQ and [receiveCount](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-sqs-queues-redrivepolicy.html#aws-sqs-queue-redrivepolicy-maxcount) set to 3.

First we define `Waitee` domain model:
```typescript
interface Waitee extends AttributeMap {
    id: string
    waitlistId: string
    name: string
    phoneNumber: string
}
```
* It extends `AttributeMap` and with that we are able to convert DynamoDb query output to waitees objects array.

After logic of the `producer` lambda function:
```typescript
const notifyAt = new Date();
notifyAt.setMinutes(notifyAt.getMinutes() + 15, 0, 0);

const queryWaiteesParams: QueryInput = {
    TableName: waiteesTableName,
    IndexName: notifyAtIndexName,
    KeyConditionExpression: "notifyAt = :notifyAt",
    ProjectionExpression: "id, waitlistId, #name, phoneNumber",
    ExpressionAttributeNames: {
        "#name": "name"
    },
    ExpressionAttributeValues: {
        ":notifyAt": notifyAt.getTime()
    }
};

const waiteesQuery = await documentClient.query(queryWaiteesParams).promise();
const waiteesCount = waiteesQuery.Count || 0;
```
It gets all the waitees from the database who should be near the waiting place in 15 minutes. 

Then these waitees are sent into the notification queue by batches:
```typescript
const waitees = waiteesQuery.Items as Waitee[] || [];
let batchEntries = [];
for (let i = 0; i < waiteesCount; i++) {
    const waitee = waitees[i];
    const batchEntry: SendMessageBatchRequestEntry = {
        Id: waitee.id,
        MessageBody: JSON.stringify({
            "id": waitee.id,
            "waitlistId": waitee.waitlistId,
            "name": waitee.name,
            "phoneNumber": waitee.phoneNumber
        })
    };

    batchEntries.push(batchEntry);

    if (batchEntries.length == 10 || i == waiteesCount - 1) {
        const batchRequest: SendMessageBatchRequest = {
            QueueUrl: queueUrl,
            Entries: batchEntries
        };
        const response = await sqs.sendMessageBatch(batchRequest).promise();
        if (response.$response.httpResponse.statusCode != 200) {
            console.log("Failed to send batch: ", response.$response.error);
        } else {
            console.log("Sent batch at ", notifyAt);
        }

        batchEntries = [];
    }
}
```

Now let's switch to `consumer` lambda function with the next logic:
```typescript
for (const record of event.Records) {
    const message: WaiteeMessage = JSON.parse(record.body);
    const updateWaiteeParams: UpdateItemInput = {
        TableName: waiteesTableName,
        Key: {
            "id": message.id,
            "waitlistId": message.waitlistId
        },
        UpdateExpression: "set notifiedAt = :notifiedAt",
        ExpressionAttributeValues: {
            ":notifiedAt": new Date().getTime()
        },
        ReturnValues: "NONE"
    };

    const updateResult = await documentClient.update(updateWaiteeParams).promise()
    if (updateResult.$response.httpResponse.statusCode != 200) {
        console.log("Error occurred while updating waitee ", message.id);
    }

    console.log("Updated waitee ", message.id);
}
```
What it does is just processes messages from the notification queue and marks them as sent.

Now definition of both lambda functions which is the most interesting thing here:
```yaml
functions:
  NotificationProducerHandler:
    handler: src/NotificationProducerHandler.producer
    role: NotificationLambdaRole
    events:
    - schedule:
        rate: rate(1 minute)
        enabled: true
    environment:
      waiteesTableName: ${self:custom.waiteesTableName}
      notifyAtIndexName: ${self:custom.notifyAtIndexName}
      notificationQueueName: ${self:custom.notificationQueueName}
  NotificationConsumerHandler:
    handler: src/NotificationConsumerHandler.consumer
    role: NotificationLambdaRole
    events:
    - sqs:
        batchSize: 10
        arn:
          Fn::GetAtt:
          - NotificationQueue
          - Arn
    environment:
      waiteesTableName: ${self:custom.waiteesTableName}
```
* Producer function runs periodically every minute `rate(1 minute)`.
* Consumer function is triggered by notification queue and processes batches with size 10 (maximum allowed).

Build & Deploy
----
To deploy our lambda functions we execute `sls deploy --verbose` and see next output:
![](assets/images/serverless-in-action/notification_deploy.jpg)
* Size of the .zip file was 1.75 Mb
* Two separated lambda function were deployed.

From the logs we see that `producer` function is triggered approximately every minute.  
~~~
06:51:34 2018-11-18T06:51:34.005Z	61f18166-eafe-11e8-8f6c-41b5dd9c4be5	Started process at 2018-11-18T06:51:33.969Z
06:52:33 2018-11-18T06:52:33.260Z	8620818a-eafe-11e8-aa97-b3b240d06d20	Started process at 2018-11-18T06:52:33.260Z
06:53:33 2018-11-18T06:53:33.184Z	a9e881e8-eafe-11e8-8017-070a571e89fc	Started process at 2018-11-18T06:53:33.184Z
06:54:32 2018-11-18T06:54:32.846Z	cd905140-eafe-11e8-8f8f-f1027bf247f0	Started process at 2018-11-18T06:54:32.846Z
06:55:32 2018-11-18T06:55:32.586Z	f131b742-eafe-11e8-9455-bdfb0a1eaa74	Started process at 2018-11-18T06:55:32.586Z
06:56:32 2018-11-18T06:56:32.146Z	14b24f4c-eaff-11e8-b00d-a9ecf69c78b9	Started process at 2018-11-18T06:56:32.146Z
~~~

When we found waitees in the database we sent them to SQS.
~~~
06:54:32 START RequestId: cd905140-eafe-11e8-8f8f-f1027bf247f0 Version: $LATEST
06:54:32 2018-11-18T06:54:32.846Z	cd905140-eafe-11e8-8f8f-f1027bf247f0	Started process at 2018-11-18T06:54:32.846Z
06:54:32 2018-11-18T06:54:32.927Z	cd905140-eafe-11e8-8f8f-f1027bf247f0	Received 1 waitees from db at 2018-11-18T07:09:00.000Z
06:54:33 2018-11-18T06:54:33.086Z	cd905140-eafe-11e8-8f8f-f1027bf247f0	Sent batch at 2018-11-18T07:09:00.000Z
06:54:33 2018-11-18T06:54:33.086Z	cd905140-eafe-11e8-8f8f-f1027bf247f0	Finished process at 2018-11-18T06:54:33.086Z
06:54:33 END RequestId: cd905140-eafe-11e8-8f8f-f1027bf247f0
06:54:33 REPORT RequestId: cd905140-eafe-11e8-8f8f-f1027bf247f0	Duration: 391.48 ms	Billed Duration: 400 ms Memory Size: 128 MB
~~~

Then we processed them almost instantly by `consumer` function.
~~~
06:54:33 START RequestId: 025736f4-ec2e-59f9-a07a-629fe2f03760 Version: $LATEST
06:54:33 2018-11-18T06:54:33.726Z	025736f4-ec2e-59f9-a07a-629fe2f03760	Started process at 2018-11-18T06:54:33.726Z
06:54:34 2018-11-18T06:54:34.709Z	025736f4-ec2e-59f9-a07a-629fe2f03760	Updated waitee cccff429
06:54:34 2018-11-18T06:54:34.709Z	025736f4-ec2e-59f9-a07a-629fe2f03760	Finished process at 2018-11-18T06:54:34.709Z
06:54:34 END RequestId: 025736f4-ec2e-59f9-a07a-629fe2f03760
06:54:34 REPORT RequestId: 025736f4-ec2e-59f9-a07a-629fe2f03760	Duration: 1218.38 ms	Billed Duration: 1300 ms Memory Size: 128 MB
~~~

Conclusion
----
Using `typescript` was easy and fun for me. I got the knowledge at least to build similar lambda function in future.
There are always a few possible solutions and you should always analyze your needs before making any decisions.
Everything could be found on my [github repository](https://github.com/korest/WaitlistAppNotificationLambdas).
---
layout: post
title:  "Serverless in action. Part 2: CRUD"
date:   2018-11-06 23:00:00
tags: [serverless, kotlin, aws, lambda]
categories: [Programming]
comments: true
---

> [Part 0: Intro](https://orestkyrylchuk.com/serverless-in-action-part-0) and [Part 1: Auth](https://orestkyrylchuk.com/serverless-in-action-part-1)

Introduction
----
This section is about the core of our application - CRUD lambda functions. Remind you the architecture:
![](assets/images/serverless-in-action/crud.png)
On the design above we have:
* CRUD Waitlist - lambda function to handle all the operations on the waitlist.
* CRUD Waitee - lambda function to handle all the operations on the waitee from specific waitlist.
<!--more-->

For these two lambda functions, I have chosen a relatively new language from Java world which becomes more popular from day to day.
Greetings to [Kotlin](https://kotlinlang.org/). I'm not experienced in it, so it's a good chance to improve my knowledge.
Comparing to Go, Kotlin has bigger binary file and slower cold start. There are solutions for each of these problems, but I won't talk about them.

We have the same `serverless.yaml` file for both lambda functions.
```yaml
service: WaitlistAppCrudLambdas

provider:
  name: aws
  runtime: java8

  stage: dev
  region: us-west-2
  memorySize: 512
```
It starts with almost the same definition as for Auth lambda functions however, there are two differences:
* Runtime is set to `java8`, as there is no `kotlin` native support from AWS lambda, but it compiles to the same bytecode as Java, so it's possible to run it on Java's runtime.
* Memory size is set to `512`, because if we set less than that, unfortunately, it fails with `OutOfMemoryException` during the start,
  I believe some tricks could be done to decrease the memory, but it requires time for investigation/analysis.

In custom section we have a few items:
```yaml
custom:
  authorizationLambdaName: AuthLambdas-${self:provider.stage}-Authorization
  authorizationLambdaArn: AuthLambdas-${self:provider.stage}.AuthorizationLambdaFunctionQualifiedArn
  accountIdIndexName: AccountIdIndex
  waitlistIdIndexName: WaitlistIdIndex
```
I will show the usage of each later.

Let's define our DynamoDb table for waitlist:
```yaml
WaitlistsTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: Waitlists
    AttributeDefinitions:
    - AttributeName: id
      AttributeType: S
    - AttributeName: accountId
      AttributeType: S
    KeySchema:
    - AttributeName: id
      KeyType: HASH
    - AttributeName: accountId
      KeyType: RANGE
    ProvisionedThroughput:
      ReadCapacityUnits: 1
      WriteCapacityUnits: 1
    GlobalSecondaryIndexes:
    - IndexName: ${self:custom.accountIdIndexName}
      KeySchema:
      - AttributeName: accountId
        KeyType: HASH
      Projection:
        ProjectionType: ALL
      ProvisionedThroughput:
        ReadCapacityUnits: 1
        WriteCapacityUnits: 1
```
* It has two key attributes HASH = `id` and RANGE = `accountId`.
* It has GSI with the name `${self:custom.accountIdIndexName}` from the custom keys section.
  This index is used to get all waitlists for the account.
* It has RCUs and WCUs set to `1` just for development purpose.

Kotlin entity for our `Waitlists` table:
```kotlin
data class Waitlist(@JsonProperty(ID) val id: String,
                    @JsonProperty(ACCOUNT_ID) val accountId: String,
                    @JsonProperty(NAME) val name: String,
                    @JsonProperty(DESCRIPTION) val description: String = "") {
    companion object {
        const val ID = "id"
        const val ACCOUNT_ID = "accountId"
        const val NAME = "name"
        const val DESCRIPTION = "description"
    }
}
```
It's the classic `data class` with the default value for `description` which is not required.

To handle our requests from API Gateway we have abstract `CrudHandler`:
```kotlin
abstract class CrudHandler : RequestHandler<AwsProxyRequest, ApiGatewayResponse> {
    override fun handleRequest(input: AwsProxyRequest, context: Context): ApiGatewayResponse {
        LOG.info("Request received body: ${input.body} " +
                "path: ${input.pathParameters} query: ${input.queryStringParameters}")

        return getHttpHandlers()[input.httpMethod]?.handle(input.requestContext.authorizer.principalId, input)
                ?: ApiGatewayResponse.build {
                    statusCode = 405
                    objectBody = MessageResponse("Method not supported")
                }
    }

    abstract fun getHttpHandlers(): Map<String, HttpHandler>
}
```
* It gets the `HttpHandler` from the defined map of `httpHandlers` based on `httpMethod` from the request.
* `input.requestContext.authorizer.principalId` is an `accountId` which is being set in custom authorizer function.
* There are two implementations of `CrudHandler` for `Waitlist` and `Waitee`.
* You might have noticed that there is `AwsProxyRequest` as an input. I copied it from [awslabs](https://github.com/awslabs/aws-serverless-java-container/blob/master/aws-serverless-java-container-core/src/main/java/com/amazonaws/serverless/proxy/model/AwsProxyRequest.java)
  repository as it was not present in the current version of `aws-lambda-java` sdk. It gives us the right structure to get `input.requestContext.authorizer.principalId` from the request.

Now let's continue with the implementation of `handlers`. The first one would be `GetHandler`.
It returns all waitlists of the account and has two steps:
* Get waitlists from the database by `accountId` with the next query:
```kotlin
val querySpec = QuerySpec()
        .withKeyConditionExpression("${Waitlist.ACCOUNT_ID} = :accId")
        .withProjectionExpression("${Waitlist.ID}, #name, ${Waitlist.DESCRIPTION}")
        .withNameMap(
                NameMap()
                        .with("#name", Waitlist.NAME)
        )
        .withValueMap(
                ValueMap()
                        .withString(":accId", accountId)
        )
```
* Return the result:
```kotlin
val waitlistsJson = waitlistsAccountIdIndex.query(querySpec)
        .joinToString(prefix = "[", postfix = "]") {
            it.toJSON()
        }
return ApiGatewayResponse.build {
    statusCode = 200
    rawBody = waitlistsJson
}
```
As it's already stored in JSON format we would just return it as array.

Then we have `PostHandler` which creates a new waitlist for the account:
```kotlin
val waitlistRequest = OBJECT_MAPPER.readValue(event.body, WaitlistRequest::class.java)
val waitlistId = UUID.randomUUID().toString().substring(0, 8) // eight characters ID

val putSpec = Item().withPrimaryKey(Waitlist.ID, waitlistId, Waitlist.ACCOUNT_ID, accountId)
        .withString(Waitlist.NAME, waitlistRequest.name)
        .withString(Waitlist.DESCRIPTION, waitlistRequest.description)
waitlistsTable.putItem(putSpec)

return ApiGatewayResponse.build {
    statusCode = 201
    objectBody = MessageResponse("Waitlist with id: '$waitlistId' was created")
}
```
It reads new waitlist data, then generates an `ID` for it and saves into database.

`PutHandler` updates existing waitlist in the database:
```kotlin
val waitlistId = event.pathParameters?.get(PATH_WAITLIST_ID)
        ?: throw IllegalArgumentException("Waitlist id is null")
val waitlistRequest = OBJECT_MAPPER.readValue(event.body, WaitlistRequest::class.java)

val updateSpec = UpdateItemSpec()
        .withPrimaryKey(Waitlist.ID, waitlistId, Waitlist.ACCOUNT_ID, accountId)
        .withUpdateExpression("set #name = :name, ${Waitlist.DESCRIPTION} = :desc")
        .withNameMap(
                NameMap()
                        .with("#name", Waitlist.NAME)
        )
        .withValueMap(
                ValueMap()
                        .withString(":name", waitlistRequest.name)
                        .withString(":desc", waitlistRequest.description)
        )
        .withReturnValues(ReturnValue.NONE)

waitlistsTable.updateItem(updateSpec)

return ApiGatewayResponse.build {
    statusCode = 204
    objectBody = MessageResponse("Waitlist with id: '$waitlistId' was updated")
}
```
* Request body is parsed into `WaitlistRequest` entity.
* `waitlistId` is retrieved from the path.
* `description` is updated using `UpdateItemSpec` query.

The last, but not the least is `DeleteHandler` which just deletes the waitlist by id:
```kotlin
val waitlistId = event.pathParameters?.get(PATH_WAITLIST_ID)
        ?: throw IllegalArgumentException("Waitlist id is null")
val deleteSpec = DeleteItemSpec()
        .withPrimaryKey(Waitlist.ID, waitlistId, Waitlist.ACCOUNT_ID, accountId)

waitlistsTable.deleteItem(deleteSpec)

return ApiGatewayResponse.build {
    statusCode = 204
    objectBody = MessageResponse("Waitlist with id: $waitlistId was deleted")
}
```

That's basically it, the simplest CRUD API. We can find similar code for Waitee CRUD operations.
I will only show `POST` handler as it creates the Waitee.

Entity for `Waitee` table:
```kotlin
data class Waitee(@JsonProperty(ID) val id: String,
                  @JsonProperty(WAITLIST_ID) val waitlistId: String,
                  @JsonProperty(NAME) val name: String,
                  @JsonProperty(PHONE_NUMBER) val phoneNumber: String,
                  @JsonProperty(NOTIFY_AT) val notifyAt: Long,
                  @JsonProperty(NOTIFIED_AT) val notifiedAt: Long,
                  @JsonProperty(TIME_TO_LIVE) val timeToLive: Long) {
    companion object {
        const val ID = "id"
        const val WAITLIST_ID = "waitlistId"
        const val NAME = "name"
        const val PHONE_NUMBER = "phoneNumber"
        const val NOTIFY_AT = "notifyAt"
        const val NOTIFIED_AT = "notifiedAt"
        const val TIME_TO_LIVE = "timeToLive"
    }
}
```

And here is `POST` itself:
```kotlin
val waiteeRequest = OBJECT_MAPPER.readValue(event.body, WaiteePostRequest::class.java)
val waiteeId = UUID.randomUUID().toString().substring(0, 8) // eight characters ID

val notifyAtEpochMillis = ZonedDateTime.now(ZoneOffset.UTC)
        .plusMinutes(waiteeRequest.notifyIn)
        .truncatedTo(ChronoUnit.MINUTES)
        .toInstant()
        .toEpochMilli()

val timeToLive = ZonedDateTime.now(ZoneOffset.UTC)
        .plusHours(24)
        .toInstant()
        .epochSecond

val putSpec = Item().withPrimaryKey(Waitee.ID, waiteeId, Waitee.WAITLIST_ID, waitlistId)
        .withString(Waitee.NAME, waiteeRequest.name)
        .withString(Waitee.PHONE_NUMBER, waiteeRequest.phoneNumber)
        .withLong(Waitee.NOTIFY_AT, notifyAtEpochMillis)
        .withLong(Waitee.TIME_TO_LIVE, timeToLive)

waiteesTable.putItem(putSpec)

return ApiGatewayResponse.build {
    statusCode = 201
    objectBody = MessageResponse("Waitee with id: '$waiteeId' was created")
}
```
* `notifyAtEpochMillis` is set with the time when the waitee should be notified.
* `timeToLive` is set to 24 hours, to clean up old waitees.

IAM Role for both lambda functions has next permissions:
```yaml
CrudLambdaRole:
  Type: AWS::IAM::Role
  Properties:
    RoleName: CrudLambdaRole
    AssumeRolePolicyDocument:
      Version: "2012-10-17"
      Statement:
      - Effect: Allow
        Principal:
          Service:
          - lambda.amazonaws.com
        Action: sts:AssumeRole
    Policies:
    - PolicyName: MyDefaultPolicy
      PolicyDocument:
        Version: "2012-10-17"
        Statement:
        - Effect: Allow
          Action:
          - dynamodb:Query
          - dynamodb:GetItem
          - dynamodb:PutItem
          - dynamodb:UpdateItem
          - dynamodb:DeleteItem
          Resource:
            Fn::GetAtt:
            - WaitlistsTable
            - Arn
        - Effect: Allow
          Action:
          - dynamodb:Query
          Resource:
            Fn::Join:
            - "/"
            - - Fn::GetAtt:
                - WaitlistsTable
                - Arn
              - "index"
              - "*"
        - Effect: Allow
          Action:
          - lambda:InvokeFunction
          Resource:
            Fn::Join:
            - ":"
            - - "arn:aws:lambda"
              - Ref: AWS::Region
              - Ref: AWS::AccountId
              - "function"
              - ${self:custom.authorizationLambdaName}
        - Effect: Allow
          Action:
          - logs:CreateLogGroup
          - logs:CreateLogStream
          - logs:PutLogEvents
          Resource:
            Fn::Join:
            - ":"
            - - "arn:aws:logs"
              - Ref: AWS::Region
              - Ref: AWS::AccountId
              - "log-group:/aws/lambda/*:*:*"
```
1. Access to DynamoDb operations with table and index.
2. Access to custom authorizer lambda function.
3. Access to CloudWatch operations.

Finally both lambda functions definition:
```yaml
functions:
  WaitlistCrudHandler:
    handler: com.korest.lambda.WaitlistCrudHandler
    role: CrudLambdaRole
    events:
    - http:
        path: /waitlists
        method: get
        cors: true
        authorizer: ${cf:${self:custom.authorizationLambdaArn}}
    - http:
        path: /waitlists
        method: post
        cors: true
        authorizer: ${cf:${self:custom.authorizationLambdaArn}}
    - http:
        path: /waitlists/{waitlistId}
        method: put
        cors: true
        authorizer: ${cf:${self:custom.authorizationLambdaArn}}
    - http:
        path: /waitlists/{waitlistId}
        method: delete
        cors: true
        authorizer: ${cf:${self:custom.authorizationLambdaArn}}
    environment:
      region: ${self:provider.region}
      waitlistsTableName:
        Ref: WaitlistsTable
      accountIdIndexName: ${self:custom.accountIdIndexName}
  WaiteeCrudHandler:
      handler: com.korest.lambda.WaiteeCrudHandler
      role: CrudLambdaRole
      events:
      - http:
          path: /waitlists/{waitlistId}/waitees
          method: get
          cors: true
          authorizer: ${cf:${self:custom.authorizationLambdaArn}}
      - http:
          path: /waitlists/{waitlistId}/waitees
          method: post
          cors: true
          authorizer: ${cf:${self:custom.authorizationLambdaArn}}
      - http:
          path: /waitlists/{waitlistId}/waitees/{waiteeId}
          method: put
          cors: true
          authorizer: ${cf:${self:custom.authorizationLambdaArn}}
      - http:
          path: /waitlists/{waitlistId}/waitees/{waiteeId}
          method: delete
          cors: true
          authorizer: ${cf:${self:custom.authorizationLambdaArn}}
      environment:
        region: ${self:provider.region}
        waitlistsTableName:
          Ref: WaitlistsTable
        waiteesTableName:
          Ref: WaiteesTable
        waitlistIdIndexName: ${self:custom.waitlistIdIndexName}
```
All the operations `GET/POST/PUT/DELETE` are defined with a custom authorizer and a few environment variables.

Build & Deploy
----
To build our functions we execute `./gradlew shadowJar` which generates an artifact build/libs/WaitlistAppCrudLambdas-dev-all.jar
We reference it in `serverless.yaml` as following:
```yaml
package:
  artifact: build/libs/WaitlistAppCrudLambdas-dev-all.jar
```
After we execute `sls deploy --verbose` we see next output:
![](assets/images/serverless-in-action/crud_deploy.png)
* Size of the .zip file was 11.06 Mb
* Eight endpoints were generated for `Waitlist` and `Waitee` lambda functions.
* Outputs from the stack such as lambda functions arns and s3 bucket name created by serverless framework.

Conclusion
----
It was relatively easy to build CRUD API with the lambda function. 
In the real-world conditions, we would probably split operations to different lambda function as the load is not even.
Using `kotlin` was fun, somehow the same as `java` with some syntax sugar. It's very easy to get used to the new syntax.
Everything could be found on my [github repository](https://github.com/korest/WaitlistAppCrudLambdas).

What's next?
* [Part 3: Notifications]()
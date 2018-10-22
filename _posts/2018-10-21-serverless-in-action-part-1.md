---
layout: post
title:  "Serverless in action. Part 1: Auth"
date:   2018-10-21 15:00:00
tags: [serverless, go, aws, lambda]
categories: [Programming]
comments: true
---

> Part 0: Intro could be found [here](https://orestkyrylchuk.com/serverless-in-action-part-0).

Introduction
----
We start our `dive deep` into the architecture from `Auth` section.
To remind you from the previous part it has the next design:
![](assets/images/serverless-in-action/auth.png)
<!--more-->
It has 3 separate lambda functions:
* Registration - which has the functionality to register new account.
* Authentication - which generates JWT token for the valid credentials.
* Authorization - which validates JWT token and returns policy. 

For me it doesn't matter what language to use to implement those functions,  but to get some experience I selected Golang.
It works great for lambda functions as binary file is pretty small and the cold start problem is very minor.
For deploying to AWS we will use [CloudFormation](https://aws.amazon.com/cloudformation/) and [serverless](https://serverless.com/) framework which is really awesome. 

We have the same `serverless.yaml` file for all 3 lambda functions which starts with:
~~~ yaml
service: AuthLambdas

provider:
  name: aws
  runtime: go1.x

  stage: dev
  region: us-west-2
  memorySize: 128
~~~
Note that memory is set to `128 MB` which is minimum possible.

Then custom key/value pairs section with pairs that are used more than once:
~~~ yaml
custom:
  signingKey: "my signing key"
  emailIndexName: "EmailIndex"
~~~
I will show usage of these pairs later.

Registration
----
`registration` lambda logic is divided into a few steps:
1. Check if account with the provided email already exists.
2. Encrypt account's password.
3. Save account with provided email/name and encrypted password to DynamoDb.

We start with `Accounts` table in DynamoDb:
~~~ yaml
AccountsTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: Accounts
    AttributeDefinitions:
    - AttributeName: email
      AttributeType: S
    - AttributeName: id
      AttributeType: S
    KeySchema:
    - AttributeName: id
      KeyType: HASH
    - AttributeName: email
      KeyType: RANGE
    ProvisionedThroughput:
      ReadCapacityUnits: 1
      WriteCapacityUnits: 1
    GlobalSecondaryIndexes:
    - IndexName: ${self:custom.emailIndexName}
      KeySchema:
      - AttributeName: email
        KeyType: HASH
      Projection:
        ProjectionType: ALL
      ProvisionedThroughput:
        ReadCapacityUnits: 1
        WriteCapacityUnits: 1
~~~
* It has two key attributes HASH = `id` and RANGE = `email`.
* It has GSI with the name `${self:custom.emailIndexName}` from the custom keys section.
  This index is used to check if account with the provided `email` exists.
* It has RCUs and WCUs set to `1` just for development purpose.
  
Based on DynamoDb table we define `Account` structure as following:
~~~ go
type Account struct {
	Id       string `json:"id"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}
~~~
`Password` and `Name` are non key attributes, but we need them.

To check if account with provided `email` exists we have next query:
~~~ go
input := &dynamodb.QueryInput{
    TableName: aws.String(os.Getenv(TABLE_NAME)),
    IndexName: aws.String(os.Getenv(INDEX_NAME)),
    KeyConditions: map[string]*dynamodb.Condition{
        "email": {
            ComparisonOperator: aws.String("EQ"),
            AttributeValueList: []*dynamodb.AttributeValue{
                {
                    S: aws.String(email),
                },
            },
        },
    },
}
~~~
Table and index names are passed to lambda function through environment variables and then retrieved with `os.Getenv(TABLE_NAME)` and `os.Getenv(INDEX_NAME)`.

To store password in database it's encrypted with the key from [AWS Key Managment Service (KMS)](https://aws.amazon.com/kms/).
Definition of it in our `serverless.yaml`:
~~~ yaml
DefaultKMSKey:
  Type: AWS::KMS::Key
  Properties:
    Description:
      Fn::Sub: "Default KMS key"
    KeyPolicy:
      Version: "2012-10-17"
      Id: "default-kms-key"
      Statement:
      - Sid: Allow account-level IAM policies to apply to the key
        Effect: Allow
        Principal:
          AWS:
            Fn::Join:
            - ""
            - - "arn:aws:iam::"
              - Ref: AWS::AccountId
              - ":root"
        Action: "kms:*"
        Resource: "*"
DefaultKMSKeyAlias:
  Type: AWS::KMS::Alias
  Properties:
    AliasName: "alias/DefaultKMSKey"
    TargetKeyId:
      Ref: DefaultKMSKey
~~~
Note that `KeyPolicy` could be improved with the specific account instead of root.
Also, we can see `AWS::KMS::Alias` for the key as it doesn't work without alias.

Encryption logic is simple enough using the above key:
~~~ go
passwordInput := &kms.EncryptInput{
    KeyId:     aws.String(os.Getenv(KMS_KEY)),
    Plaintext: []byte(password),
}

encryptedPassword, err := kmsClient.Encrypt(passwordInput)
~~~
Where the `os.Getenv(KMS_KEY)` is the KMS key arn from environment variables.

The last but not least is the query to create account in DynamoDb:
~~~ go
id := uuid.NewV4().String()[0:8]
input := &dynamodb.PutItemInput{
    TableName: aws.String(os.Getenv(TABLE_NAME)),
    Item: map[string]*dynamodb.AttributeValue{
        "id": {
            S: aws.String(id),
        },
        "email": {
            S: aws.String(account.Email),
        },
        "password": {
            B: encryptedPassword,
        },
        "name": {
            S: aws.String(account.Name),
        },
    },
}
~~~
New account's id is generated with [go.uuid](https://github.com/satori/go.uuid) library.

Also, our lambda function has a role with next permissions:
~~~ yaml
DefaultLambdaRole:
  Type: AWS::IAM::Role
  Properties:
    RoleName: DefaultLambdaRole
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
          - dynamodb:PutItem
          Resource:
            Fn::GetAtt:
            - AccountsTable
            - Arn
        - Effect: Allow
          Action:
          - dynamodb:Query
          Resource:
            Fn::Join:
            - "/"
            - - Fn::GetAtt:
                - AccountsTable
                - Arn
              - "index"
              - "*"
        - Effect: Allow
          Action:
          - kms:Encrypt
          - kms:Decrypt
          Resource:
            Fn::GetAtt:
            - DefaultKMSKey
            - Arn
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
~~~
* Access to DynamoDb `Query` and `PutItem` operations plus access to `Query` for GSI.
* Access to `Encrypt` and `Decrypt` for KMS (actually, for security reasons, it's better to split into two different roles).
* Access to CloudWatch operations to be able to see logs from our lambda function.

Our lambda function defined in `serverless.yaml` as:
~~~ yaml
  Registration:
    handler: bin/registration
    events:
    - http:
        path: /register
        method: post
        cors: true
    role: DefaultLambdaRole
    environment:
      region: ${self:provider.region}
      accountsTableName:
        Ref: AccountsTable
      emailIndexName: ${self:custom.emailIndexName}
      kmsKey:
        Fn::GetAtt:
        - DefaultKMSKey
        - Arn
~~~
* Triggered by HTTP `POST` method on `/register` path.
* Role as defined above.
* Environment variables for DynamoDb table and index, KMS key.

Authentication
----
`authentication` lambda function logic has a few steps:
1. Get account from DynamoDb by email.
2. Decrypt and check if password is correct.
3. Generate JWT token.

To get account from DynamoDb the same quest is used as in `registration` lambda function to check if account exists.
We might think that it could be done vice-versa first encrypt the provided password and then check if it's the same as in DynamoDb, but KMS uses envelope encryption and the encryption key changes each time request is made for a key, so it wouldn't work.
The code is pretty straightforward and looks the same as encryption:
~~~ go
passwordInput := &kms.DecryptInput{
    CiphertextBlob: account.Password,
}

decryptedPassword, err := kmsClient.Decrypt(passwordInput)
~~~

For JWT token [jwt-go](https://github.com/dgrijalva/jwt-go) library is used:
~~~ go
mySigningKey := []byte(os.Getenv(SIGNING_KEY))

expiryTime := time.Now().Add(EXPIRE_TIME).UnixNano() / int64(time.Millisecond)
claims := &jwt.StandardClaims{
    ExpiresAt: expiryTime,
    Issuer:    ISSUER,
    Subject:   account.Id,
}

jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
signedJwtToken, err := jwtToken.SignedString(mySigningKey)
~~~
* `SIGNING_KEY` is the key from custom section of `serverless.yaml`.
* Expiration time 24 hours ahead, hardcoded issuer and subject as `accountId` is stored in claims.

Definition of `authentication` lambda function is similar to `registration` function:
~~~ yaml
Authentication:
  handler: bin/authentication
  events:
  - http:
      path: /auth/get-token
      method: post
      cors: true
  role: DefaultLambdaRole
  environment:
    region: ${self:provider.region}
    accountsTableName:
      Ref: AccountsTable
    emailIndexName: ${self:custom.emailIndexName}
    kmsKey:
      Fn::GetAtt:
      - DefaultKMSKey
      - Arn
    signingKey: ${self:custom.signingKey}
~~~
* Triggered by HTTP `POST` method on `/auth/get-token` path.
* Role the same as for `registration` function.
* Environment variables for DynamoDb table and index, KMS key and JWT signing key.

Authorization
----
The last but not least lambda function is `authorization`.
It is implemented as API Gateway custom `authorizer`.
It validates the provided token and returns generated policy to allow or deny access to the resource, but for simplicity, we won't have different scopes and it always either `allow` or `401`.

JWT token is parsed at first with the same [jwt-go](https://github.com/dgrijalva/jwt-go) library as above:
~~~ go
tokenStr := strings.TrimPrefix(event.AuthorizationToken, "Bearer ")

token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
    // Don't forget to validate the alg is what you expect:
    if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
        return nil, fmt.Errorf("wrong signing method")
    }

    signingKey := []byte(os.Getenv(SIGNING_KEY))
    return signingKey, nil
})
~~~
The same `SIGNING_KEY` that is specified in custom section is used here.

Then token claims are validated and policy is generated:
~~~ go
if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
    log.Println("token claims: ", claims)
    accountId := claims["sub"].(string)
    err = claims.Valid()
    if err == nil {
        return createPolicy(accountId, ALLOW, event.MethodArn), nil
    }
}
~~~

`createPolicy` should generated specific policy, example in [AWS docs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html):
~~~ go
func createPolicy(accountId, effect, resource string) events.APIGatewayCustomAuthorizerResponse {
	return events.APIGatewayCustomAuthorizerResponse{
		PrincipalID: accountId,
		PolicyDocument: events.APIGatewayCustomAuthorizerPolicy{
			Version: "2012-10-17",
			Statement: []events.IAMPolicyStatement{
				{
					Action:   []string{"execute-api:Invoke"},
					Effect:   effect,
					Resource: []string{resource},
				},
			},
		},
	}
}
~~~

Finally, the definition of `authorization` lambda function:
~~~ yaml
Authorization:
  handler: bin/authorization
  environment:
    signingKey: ${self:custom.signingKey}
~~~
* It is triggered by API Gateway, so we there is no `events` section.
* JWT signing key is passed with environment variables.

### Conclusion
Using Golang for lambda functions is pretty smooth. It's pretty easy to find some help and needed libraries on the Internet.
In the beginning, it was a bit hard to get used to syntax after Java world, but after some time development is fast enough.
All the logic is covered with unit tests. Everything could be found in my [github repository](https://github.com/korest/AuthLambdas).

What's next?
* [Part 2: CRUD]()
* [Part 3: Notifications]()
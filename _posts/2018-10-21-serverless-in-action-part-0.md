---
layout: post
title:  "Serverless in action. Part 0: Intro"
date:   2018-10-21 15:00:00
tags: [serverless, go, kotlin, aws, lambda]
categories: [Programming]
comments: true
---

Introduction
----
Nowadays serverless architecture became a thing in application design.
The main advantage it gives to us is that we don't need to manage servers anymore, however, technically it still runs on the servers.
Serverless architecture became popular after release of [AWS Lambda](https://aws.amazon.com/lambda/) which gave us the possibility to deploy a single function(peace of code) to AWS environment and then execute it.
This article consists of 3 parts which describe how to build a serverless application step by step.
<!--more-->

Architecture
----
To build an architecture first let's define the idea.
Probably most of us had the situation in our lives when we wanted to visit some famous restaurant, but unfortunately, it was full at that moment of time.
Sometimes the staff offered to sign up in the waiting list with name/contact information and come back in N hours.
However, in some cases, it didn't work for example when we came back the restaurant was still full or it was already too late.
Our idea is to automate this process and build the waitlist application which would help customers to get into the restaurant during the busy days:
* Sign up/Sign in
* Create/Update/Delete waitlist
* Add/Remove waitee(customer) to/from the waitlist
* Notify customers

Using [draw.io](https://www.draw.io/) we created the next architecture for our application:
![](assets/images/serverless-in-action/app-architecture.jpg)

We have 3 parts on the schema above:
1. Auth:
  * Authentication - to generate JWT token for the user with valid credentials.
  * Authorization - to validate JWT token, basically if it's valid and not expired.
  * Registration - to register new customer with email/password.
2. CRUD:
  * Waitlist - to get/create/edit/delete waitlists for the restaurant owner.
  * Waitee - to get/create/edit/delete waitees(customers) for the waitlist.
3. Notification lambda functions:
  * Producer - to enqueue waitees that should be notified.
  * Consumer - to dequeue waitees and send notifications to them.
  
* Registration and Authentication lambda would be triggered from API Gateway.
* Authorization lambda would be triggered by API Gateway as an authorizer function.
* CRUD lambda functions would be triggered from API Gateway.
* Notification producer lambda would run periodically(every minute) and would be triggered by cloud watch event.
* Notification consumer lambda would be triggered by notification queue.

All the data would be stored in DynamoDb.

Let's begin with [Part 1: Auth](https://orestkyrylchuk.com/serverless-in-action-part-0).

Other parts:
* [Part 2: CRUD]()
* [Part 3: Notifications]()
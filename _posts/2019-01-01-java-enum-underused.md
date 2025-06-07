---
layout: post
title:  "Is Java enum underused?"
date:   2019-01-01 09:00:00
tags: [java]
categories: [Programming]
comments: true
---

Introduction
----
An enum type is a special data type that holds a list of constants. 
An enum type variable must be equal to one of those constants.
Java Enum is a type of class that is defined with the `enum` keyword and was introduced in Java 5. 
As mentioned, it's used to define a list of constants, but is not limited to that and can also contain methods and fields.

More specific information could be found in [Java enum's documentation](https://docs.oracle.com/javase/tutorial/java/javaOO/enum.html).

<!--more-->

Example[0]
----
From the definition, enum sounds like a very powerful type, but how often have you seen code like:
```java
public enum Operation {
    ADD,
    SUBTRACT,
    MULTIPLY,
    DIVIDE
}
```
and then `Operation`s are used as poor constants:
```java
public class OperationProcessor implements Processor {
    @Override
    public int process(final Operation operation, final int a, final int b) {
        switch (operation) {
            case ADD:
                return a + b;
            case SUBTRACT:
                return a - b;
            case MULTIPLY:
                return a * b;
            case DIVIDE:
                return a / b;
    
            default:
                throw new IllegalArgumentException("Operation: " + operation + " is not recognized");
        }
    }
}
```

What if each operation that calculates numbers is moved to the specific `Operation` enum:
```java
public enum Operation {
    ADD((a, b) -> a + b),
    SUBTRACT((a, b) -> a - b),
    MULTIPLY((a, b) -> a * b),
    DIVIDE((a, b) -> a / b);

    private final BiFunction<Integer, Integer, Integer> function;

    Operation(final BiFunction<Integer, Integer, Integer> function) {
        this.function = function;
    }

    public int apply(int a, int b) {
        return function.apply(a, b);
    }
}
```
`BiFunction` is representing an operation on two numbers.
From an object-oriented perspective, it looks pretty natural to have this logic inside. 

Now to execute the operation on two numbers, the `apply` method is called:
```java
public class OperationProcessor {
    @Override
    public int process(final Operation operation, final int a, final int b) {
        return operation.apply(a, b);
    }
}
```

Example[1]
----
Let's check another example. There is a functionality to group people by age into different groups.
`AgeGroup` enum is defined per specific age group:
```java
public enum AgeGroup {
    CHILD, // [0 - 13)
    TEENAGER, // [13 - 18)
    ADULT, // [18 - 65)
    SENIOR // [65;∞)
}
```
and then grouping logic:
```java
public class PersonService {
    public Map<AgeGroup, List<Person>> groupPeopleByAge(final List<Person> people) {
        return people.stream()
                .collect(Collectors.groupingBy((Person person) -> {
                    if (person.getAge() <= 12) {
                        return AgeGroup.CHILD;
                    } else if (person.getAge() >= 13 && person.getAge() < 18) {
                        return AgeGroup.TEENAGER;
                    } else if (person.getAge() >= 18 && person.getAge() < 65) {
                        return AgeGroup.ADULT;
                    } else {
                        return AgeGroup.SENIOR;
                    }
                }, Collectors.toList()));
    }
}
```
It has the same problem as before - statements to check age that are specific to each group are outside of `AgeGroup` itself.
If these statements are moved inside of `AgeGroup` enum would change to:
```java
public enum AgeGroup {
    CHILD(person -> person.getAge() < 13), // [0 - 13)
    TEENAGER(person -> person.getAge() >= 13 && person.getAge() < 18), // [13 - 18)
    ADULT(person -> person.getAge() >= 18 && person.getAge() < 65), // [18 - 65)
    SENIOR(person -> person.getAge() >= 65); // [65;∞)

    private final Predicate<Person> predicate;

    AgeGroup(final Predicate<Person> predicate) {
        this.predicate = predicate;
    }

    public static AgeGroup findGroup(final Person person) {
        return Arrays.stream(values())
                .filter(ageGroup -> ageGroup.predicate.test(person))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Person with age: " + person.getAge() + " could not be mapped to any group"));
    }
}
```
Now all the logic is encapsulated inside of `AgeGroup` which is good. 
Grouping logic is changed to:
```java
public class PersonService {
    public Map<AgeGroup, List<Person>> groupPeopleByAge(final List<Person> people) {
        return people.stream()
                .collect(Collectors.groupingBy(AgeGroup::findGroup, Collectors.toList()));
    }
}
```
Isn't it beautiful? Simple, short, clean code plus if a new age group is added this peace remains the same
as everything would be already defined in a new group.

Example[2]. Spring
----
Finally, let's see an example which involves [`Spring Framework`](https://en.wikipedia.org/wiki/Spring_Framework).
There is an enum with different payment types:
```java
public enum PaymentType {
    CASH,
    CREDIT_CARD
}
```
and payment object which contains specific payment type:
```java
public class Payment {
    private final BigDecimal amount;
    private final PaymentType paymentType;
    // constructor
}
```

Also, there is a payment service with `pay` logic which works differently depending on the payment type:
```java
@Service
public class PaymentService {
    private final PaymentProcessor cashProcessor;
    private final PaymentProcessor creditCardProcessor;
    // constructor
    public void pay(final Payment payment) {
        switch (payment.getPaymentType()) {
            case CASH:
                cashProcessor.process(payment.getAmount());
                break;
            case CREDIT_CARD:
                creditCardProcessor.process(payment.getAmount());
                break;
            default:
                throw new IllegalArgumentException(
                        "Payment type " + payment.getPaymentType() + " is not supported");
        }
    }
    public void pay2(final Payment payment) {
        payment.getPaymentType().process(payment.getAmount());
    }
}
```
Probably it looks fine, however, if a new payment type is added then `pay` method should also be updated.


There are a few options how to improve it for example `Map<PaymentType, PaymentProcessor>` to store `payment type -> processor` pairs, 
or adding `supports(paymentType)` method to the processor and traversing through the list of processors.

What if processors would be kept inside payment type? `PaymentType` enum would change to:
```java
public enum PaymentType {
    CASH(amount -> Injector.cashProcessor.process(amount)),
    CREDIT_CARD(amount -> Injector.creditCardProcessor.process(amount));

    private final Consumer<BigDecimal> consumer;

    PaymentType(final Consumer<BigDecimal> consumer) {
        this.consumer = consumer;
    }

    public void process(final BigDecimal amount) {
        consumer.accept(amount);
    }

    @Component
    private static class Injector {
        private static PaymentProcessor cashProcessor;
        private static PaymentProcessor creditCardProcessor;

        public Injector(final PaymentProcessor cashProcessor,
                        final PaymentProcessor creditCardProcessor) {
            Injector.cashProcessor = cashProcessor;
            Injector.creditCardProcessor = creditCardProcessor;
        }
    }
}
```
The implementation is a bit tricky(even ugly)? Probably yes.
 
It's not possible to inject something into enum as enum is already instantiated when spring container is creating beans.
To overcome it a separate static class `Injector` is created with injected processor beans and then those are used in consumers.

`PaymentService` would change to:
```java
@Service
public class PaymentService {
    public void pay(final Payment payment) {
        payment.getPaymentType().process(payment.getAmount());
    }
}
```
and it is simple and clean without any logic for payment processors.
In case new payment type is added, adding `consumer` is forced by the compiler.

Conclusion
----
In the examples above logic that is naturally belongs to enum was moved into it.
It worked well and simplified a few places in code.
For sure there are some cases where it's not easy to do or not even possible, however, possibility of encapsulating logic in enum should be always kept in mind.
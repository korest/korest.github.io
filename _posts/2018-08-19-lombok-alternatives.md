---
layout: post
title:  "Is there an alternative to Lombok?"
date:   2018-08-29 21:00:00
tags: [lombok, autovalue, immutables, tools]
categories: [Programming]
comments: true
---

<br>For the last few years [Lombok](https://projectlombok.org/) became one of the most used java libraries.
<br>Unfortunately with the latest releases of Java it has some problems [Java 9](https://github.com/rzwitserloot/lombok/issues/985), [Java 10](https://github.com/rzwitserloot/lombok/issues/1572).
<br>I won't list all the advantages and disadvantages of it, but rather show some alternative libraries:
* [Immutables](https://immutables.github.io/)
* [AutoValue](https://github.com/google/auto/blob/master/value/userguide/index.md) 
<!--more-->

### I. Lombok

<br>Let's start with already known `Lombok` and create some basic classes with simple functionality.
<br>Then we will try to do the same using other two libraries.

<br>For example, we have our first class `User`.
~~~ java
@Value
@Builder
public class User {

    String name;
    String surname;
    int age;
    List<String> cars;

}
~~~

<br>We added `@Value` annotation to make this class immutable and `@Builder` annotation to create an instance via builder pattern.
<br>To verify the immutability of the `User` we created a simple unit test.
~~~ java
@Test(expected = UnsupportedOperationException.class)
public void whenUserBuilderThenUserIsCreated() {
    final User user = User.builder()
                          .name("User")
                          .surname("Lombok")
                          .age(27)
                          .cars(Arrays.asList("VW"))
                          .build();

    assertEquals("User", user.getName());
    assertEquals("Lombok", user.getSurname());
    assertEquals(27, user.getAge());
    assertEquals(Arrays.asList("VW"), user.getCars());
    // UnsupportedOperationException should be thrown
    user.getCars().add("Ford");
}
~~~

<br>Now we want to create a slightly modified user instance.
<br>We should copy all the properties from the current one and for that, we have a special method called `toBuilder` which converts the user to builder object with all the fields set from itself.
<br>By default, this method is not available, but we can get it by simply adding property `toBuilder = true` to the `@Builder` annotation.
~~~ java    
@Test
public void whenUserModifiedThenNewUserIsCreated() {
    final User user = createUser();
    final User modifiedUser = user.toBuilder()
            .name("Modified User")
            .build();

    assertNotSame(user, modifiedUser);
    assertNotEquals(user.getName(), modifiedUser.getName());
    assertEquals(user.getSurname(), modifiedUser.getSurname());
    assertEquals(user.getAge(), modifiedUser.getAge());
    assertEquals(user.getCars(), modifiedUser.getCars());
}
~~~

<br>One more commonly used thing is serialization/deserialization of our instance to/from JSON using `Jackson` library.
<br>By default serialization works, but deserialization doesn't and we can see it on the next unit test.
~~~ java  
@Test(expected = InvalidDefinitionException.class)
public void whenUserBuilderSerializeDeserializeThenException() throws IOException {
    final User user = User.builder()
                            .name("User")
                            .surname("Lombok")
                            .age(27)
                            .cars(Arrays.asList("VW"))
                            .build();

    final String userJson = objectMapper.writeValueAsString(user);
    // InvalidDefinitionException should be thrown
    objectMapper.readValue(userJson, User.class);
}
~~~
`InvalidDefinitionException` is thrown when we tried to deserialize our instance.

<br>To make it work we should add additional annotation `@JsonDeserialize` with the `builder` property which points to the specific builder class that we should also add.
<br>We can see it in our second entity `Work`.
~~~ java  
@Value
@Builder
@JsonDeserialize(builder = Work.WorkBuilder.class)
public class Work {

    String name;
    BigDecimal salary;

    @JsonPOJOBuilder(withPrefix = "")
    public static final class WorkBuilder {
    }
}
~~~

<br>Now we can verify that deserialization works.
~~~ java  
@Test
public void whenUserJsonBuilderSerializeDeserializeThenUser() throws IOException {
    final Work work = Work.builder()
            .name("Work")
            .salary(BigDecimal.valueOf(2000))
            .build();

    final String workJson = objectMapper.writeValueAsString(work);
    final Work workFromJson =
            objectMapper.readValue(workJson, Work.class);

    assertEquals(work, workFromJson);
}
~~~

### II. Immutables
<br>Let's try to duplicate the same logic using `Immutables` library.
<br>We will start with classes and here it is done in a different way, we should create an abstract class or interface which provides the contract for our class.
~~~ java
@Value.Immutable
public abstract class User {

    public abstract String getName();
    public abstract String getSurname();
    public abstract int getAge();
    public abstract List<String> getCars();

}
~~~

<br>Library generates for us class called `ImmutableUser` which has all the fields described in the contract and much more.
<br>Here is a simple test that proves the immutability of our `User` entity.
~~~ java
@Test(expected = UnsupportedOperationException.class)
public void whenUserBuilderThenImmutableUserIsCreated() {
    final ImmutableUser immutableUser = ImmutableUser.builder()
                                                   .name("User")
                                                   .surname("Immutables")
                                                   .age(31)
                                                   .cars(Arrays.asList("BMW", "Audi"))
                                                   .build();

    assertEquals("User", immutableUser.getName());
    assertEquals("Immutables", immutableUser.getSurname());
    assertEquals(31, immutableUser.getAge());
    assertEquals(Arrays.asList("BMW", "Audi"), immutableUser.getCars());
    // UnsupportedOperationException should be thrown
    immutableUser.getCars().add("Ford");
}
~~~

<br>Now we want to modify our instance and for that there is already a method generated for us called `ImmutableUser.copyOf()`.
~~~ java
@Test
public void whenUserModifiedThenNewUserIsCreated() {
    final ImmutableUser user = ImmutableUser.builder()
                                           .name("User")
                                           .surname("Immutables")
                                           .age(31)
                                           .cars(Arrays.asList("BMW", "Audi"))
                                           .build();
    final User modifiedUser = ImmutableUser.copyOf(user)
            .withName("Modified User");

    assertNotSame(user, modifiedUser);
    assertNotEquals(user.getName(), modifiedUser.getName());
    assertEquals(user.getSurname(), modifiedUser.getSurname());
    assertEquals(user.getAge(), modifiedUser.getAge());
    assertEquals(user.getCars(), modifiedUser.getCars());
}
~~~

<br>The same story with serialization/deserialization to JSON. Serialization works OOTB, deserialization doesn't.
~~~ java
@Test(expected = InvalidDefinitionException.class)
public void whenUserBuilderSerializeDeserializeThenException() throws IOException {
    final ImmutableUser immutableUser = ImmutableUser.builder()
            .name("User")
            .surname("Immutables")
            .age(31)
            .cars(Arrays.asList("BMW", "Audi"))
            .build();

    final String immutableUserJson = objectMapper.writeValueAsString(immutableUser);
    // InvalidDefinitionException should be thrown
    objectMapper.readValue(immutableUserJson, ImmutableUser.class);
}
~~~

<br>Deserialize would work after we add a specific annotation `@JsonDeserialize` with a builder parameter that points to the generated class `ImmutableWork` builder.
~~~ java
@Value.Immutable
@JsonDeserialize(builder = ImmutableWork.Builder.class)
public abstract class Work {

    public abstract String name();
    public abstract BigDecimal salary();

}
~~~

<br>Passing test for it.
~~~ java
@Test
public void whenUserImmutablesJsonBuilderSerializeDeserializeThenUserJson() throws IOException {
    final ImmutableWork work = ImmutableWork.builder()
            .name("Work")
            .salary(BigDecimal.valueOf(2500))
            .build();

    final String workJson = objectMapper.writeValueAsString(work);
    final ImmutableWork workFromJson =
            objectMapper.readValue(workJson, ImmutableWork.class);

    assertEquals(work, workFromJson);
}
~~~

### III. AutoValue
<br>The last but not least library that I want to show is `AutoValue`.
<br>It works in the same way as `Immutables` we should provide a contract as an abstract class.
~~~ java
@AutoValue
public abstract class User {

    public abstract String getName();
    public abstract String getSurname();
    public abstract int getAge();
    public abstract List<String> getCars();
    
}
~~~

<br>Actually, there is no easy way to create an instance via builder pattern. 
<br>To do it we have to add a static nested builder class with the same contract as in abstract class.
<br>Also, we should add a method `builder()` which returns generated builder class.
~~~ java
@AutoValue
public abstract class User {

    ...

    public static Builder builder() {
        return new AutoValue_User.Builder();
    }

    @AutoValue.Builder
    public abstract static class Builder {
        public abstract Builder setName(String name);
        public abstract Builder setSurname(String surname);
        public abstract Builder setAge(int age);
        public abstract Builder setCars(List<String> cars);
        public abstract User build();
    }   
}
~~~

<br>If you didn't like it one more way is to have static `create` method that returns an instance of the generated class (constructor is not accessible outside).
~~~ java
public static User create(final String name, final String surname, final int age, final List<String> cars) {
    return new AutoValue_User(name, surname, age, cars);
}
~~~

<br>To check if everything works we have a unit test.
~~~ java
@Test(expected = UnsupportedOperationException.class)
public void whenUserBuilderThenUserIsCreated() {
    final User user = User.builder()
                          .setName("User")
                          .setSurname("AutoValue")
                          .setAge(24)
                          .setCars(Arrays.asList("Dodge"))
                          .build();

    assertEquals("User", user.getName());
    assertEquals("AutoValue", user.getSurname());
    assertEquals(24, user.getAge());
    assertEquals(Arrays.asList("Dodge"), user.getCars());
    // UnsupportedOperationException should be thrown
    user.getCars().add("Ford");
}
~~~

<br>Modification of the existing instance is done via `toBuilder` method of `User` class implementation of which is generated by the library.
~~~ java
public abstract Builder toBuilder();
~~~
~~~ java
@Test
public void whenUserModifiedThenNewUserIsCreated() {
    final User user = User.builder()
                        .setName("User")
                        .setSurname("AutoValue")
                        .setAge(24)
                        .setCars(Arrays.asList("Dodge"))
                        .build();
    final User modifiedUser = user.toBuilder()
            .setName("Modified User")
            .build();

    assertNotSame(user, modifiedUser);
    assertNotEquals(user.getName(), modifiedUser.getName());
    assertEquals(user.getSurname(), modifiedUser.getSurname());
    assertEquals(user.getAge(), modifiedUser.getAge());
    assertEquals(user.getCars(), modifiedUser.getCars());
}
~~~

<br>Again serialization and deserialization and again only first one work OOTB.
~~~ java
@Test(expected = InvalidDefinitionException.class)
public void whenUserBuilderSerializeDeserializeThenException() throws IOException {
    final User user = User.builder()
            .setName("User")
            .setSurname("AutoValue")
            .setAge(24)
            .setCars(Arrays.asList("Dodge"))
            .build();

    final String userJson = objectMapper.writeValueAsString(user);

    // InvalidDefinitionException should be thrown as default implementation is not deserializable
    objectMapper.readValue(userJson, User.class);
}
~~~

<br>To make it work with `AutoValue` we should add `@JsonDeserialize` annotation then add static nested `Builder` class and finally add `@JsonProperty` annotations for each field.
~~~ java
@AutoValue
@JsonDeserialize(builder = AutoValue_Work.Builder.class)
public abstract class Work {

    @JsonProperty("name")
    public abstract String getName();

    @JsonProperty("salary")
    public abstract BigDecimal getSalary();

    public static Builder builder() {
        return new AutoValue_Work.Builder();
    }

    @AutoValue.Builder
    public static abstract class Builder {

        @JsonProperty("name")
        public abstract Builder setName(String name);

        @JsonProperty("salary")
        public abstract Builder setSalary(BigDecimal salary);

        public abstract Work build();
    }
}
~~~

<br>This approach looks a bit redundant for me, but also it has more flexibility in case you need some customizations.
~~~ java
@Test
public void whenWorkBuilderSerializeDeserializeThenWork() throws IOException {
    final Work work = Work.builder()
            .setName("Work")
            .setSalary(BigDecimal.valueOf(1000))
            .build();

    final String workJson = objectMapper.writeValueAsString(work);
    final Work workFromJson =
            objectMapper.readValue(workJson, Work.class);

    assertEquals(work, workFromJson);
}
~~~

## Conclusion
<br>As we can all the examples that we implemented using `Lombok` could be done using two other libraries.
<br>I don't say that we could cover all `Lombok`'s functionality and for sure there are some features that wouldn't work.
<br>Anyway, I would definitely recommend to try those libraries.

<br>Project sources on github: [LombokAlternatives](https://github.com/korest/LombokAlternatives)
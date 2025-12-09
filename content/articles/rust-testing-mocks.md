+++
title = "Rust Testing: A Short Guide to Mocking"
date = 2025-11-23
draft = false
slug = "rust-testing-mocks"
description = "Different approaches to mocking in Rust - static dispatch, dynamic dispatch, and conditional compilation"
tags = ["rust"]
author = "Orest Kyrylchuk"
+++

So you need to mock something in Rust? There are a few different approaches you can take, and the best one depends on your needs. You can either roll your own mocking implementation or use an existing crate.

<!--more-->

Let's walk through the options!

## The Setup

Say we have a `Systemd` trait with methods to start and stop services, plus a default implementation:

```rust
trait Systemd {
    fn start_service(&self) -> anyhow::Result<()>;
    fn stop_service(&self) -> anyhow::Result<()>;
}

struct DefaultSystemd {}

impl Systemd for DefaultSystemd {
    fn start_service(&self) -> anyhow::Result<()> {
        Ok(())
    }
    fn stop_service(&self) -> anyhow::Result<()> {
        Ok(())
    }
}
```

## Option 1: Static Dispatch

With static dispatch, you use generics to specify the type at compile time:

```rust
struct SystemInstance<S: Systemd> {
    systemd: S
}

impl<S: Systemd> SystemInstance<S> {
    fn new(systemd: S) -> Self {
        SystemInstance { systemd }
    }
}

// Usage
let systemd = DefaultSystemd {};
let system_instance = SystemInstance::new(systemd);
```

The downside? You need to thread that generic parameter `<S: Systemd>` through everywhere you use `SystemInstance`. The upside? Zero runtime overhead—the compiler knows exactly which implementation to call.

## Option 2: Dynamic Dispatch

With dynamic dispatch, you use trait objects to determine the implementation at runtime:

```rust
struct SystemInstance {
    systemd: Box<dyn Systemd>
}

impl SystemInstance {
    fn new(systemd: Box<dyn Systemd>) -> Self {
        SystemInstance { systemd }
    }
}

// Usage
let systemd = DefaultSystemd {};
let system_instance = SystemInstance::new(Box::new(systemd));
```

This is cleaner—no generics to worry about. But there's a small runtime cost for the virtual function call lookup.

## Option 3: Conditional Compilation

What if you want to avoid generic parameters but keep static dispatch performance? You can use conditional compilation with `#[cfg(test)]` and `#[cfg(not(test))]` attributes to swap implementations at compile time:

```rust
#[cfg(not(test))]
type SystemdClient = DefaultSystemd;

#[cfg(test)]
type SystemdClient = mocks::MockSystemd;

struct SystemInstance {
    systemd: SystemdClient,
}

impl SystemInstance {
    fn new() -> Self {
        let systemd = SystemdClient {};
        SystemInstance { systemd }
    }
}

#[cfg(test)]
mod mocks {
    use super::*;

    pub struct MockSystemd {
        // Add fields to track calls, return values, etc.
    }

    impl MockSystemd {
        pub fn new() -> Self {
            Self {}
        }
    }

    impl Systemd for MockSystemd {
        fn start_service(&self) -> anyhow::Result<()> {
            // mock implementation
            Ok(())
        }
        fn stop_service(&self) -> anyhow::Result<()> {
            // mock implementation
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_systemd() {
        let systemd = SystemdClient {};
        let system_instance = SystemInstance { systemd };
        // ...
    }
}
```

This gives you static dispatch (zero runtime overhead) without generic parameters everywhere. The type alias `SystemdClient` resolves to the appropriate concrete type at compile time.

**The catch:** This only works when you need exactly one implementation per build (like swapping production vs test code). If you need multiple implementations in the same binary—say, different database backends or multiple mocks in one test—stick with generics or trait objects instead.

## Option 4: Use a Crate

Not interested in writing all that boilerplate? The [mockall](https://docs.rs/mockall/latest/mockall/) crate might be exactly what you need. It auto-generates mocks for your traits and works with both static and dynamic dispatch, plus conditional compilation. On top of that, you get powerful testing features like expectation matching and call verification out of the box.

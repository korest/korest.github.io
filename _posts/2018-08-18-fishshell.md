---
layout: post
title:  "Why I started using fishshell"
date:   2018-08-18 21:00:00
tags: [fishshell, tools]
categories: [Programming]
comments: true
---
To be honest before using fishshell I didn't use any other shell except bash and it was totally fine for me. 
Around ~6 months ago my friend suggested me to switch and it was totally worth it. 
Below I will list some pros and cons that work for me (some of them are pretty obvious). 
This article is more like a list of notes than structured material.

#### Pros
* The best feature is auto suggestions. They are based on your history and previous completions. 
Also statistics on used commands are taken into consideration so fishshell makes the best choice.
![](assets/images/fishshell/fish-1.png)
* Completions - you just press Tab and in case it has a few options for you, you'll see a list
* Configuring `$PATH`  is smooth. Just write `set -U fish_user_paths /usr/local/bin $fish_user_paths` to append path
* Documentation is perfect for [fishshell](https://fishshell.com/docs/current/index.html)
* Everything is configured OOTB

#### Cons
* There is no way to disable auto suggestions

#### Conclusion

I would definitely recommend fishshell to try.
Start with `brew install fish` and visit [fishshell](https://fishshell.com/docs/current/index.html) to get more info.
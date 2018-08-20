---
layout: post
title:  "Why I started using fishshell"
date:   2018-08-18 21:00:00
tags: [fishshell, tools]
categories: [Programming]
comments: true
---
> Disclaimer: This post is more like a list of notes than structured material.

To be honest, before using `fishshell` I only used `bash` and it satisfied my needs, but around ~6 months ago my friend suggested me to try `fishshell` instead and it was totally worth it. 
Below I'm going to list some pros and cons that I found for myself (some of them are pretty straightforward and obvious).

#### Pros
* [Autosuggestions](https://fishshell.com/docs/current/tutorial.html#tut_autosuggestions): they are based on your history and previous completions. 
Statistics on used commands is taken into consideration and `fishshell` makes the best choice.
![](assets/images/fishshell/fish-1.png)
* [Completions](https://fishshell.com/docs/current/tutorial.html#tut_tab_completions): press Tab and it will either complete single option or display a list
* [$PATH](https://fishshell.com/docs/current/tutorial.html#tut_path): enter `set -U fish_user_paths /usr/local/bin $fish_user_paths` to append `/usr/local/bin`.
It will affect current and all future sessions
* [Documentation](https://fishshell.com/docs/current/index.html): anything can be found here
* Configuration: everything is OOTB

#### Cons
* [Autosuggestions](https://fishshell.com/docs/current/tutorial.html#tut_autosuggestions): No way to disable them and rarely they migh be annoying

#### Conclusion

I would recommend to give it a try.
Start with `brew install fish` and visit [fishshell](https://fishshell.com/docs/current/tutorial.html#tut_learning_Fish) to learn more.
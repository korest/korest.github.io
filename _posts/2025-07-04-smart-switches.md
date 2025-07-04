---
layout: post
title:  "Onboarding Home Assistant: Solving Smart Switch Issues"
date:   2025-07-04 10:00:00
tags: [home-assitant]
categories: [SmartHome]
comments: true
---

I recently had problems with smart dimmer switches that led me down a path to Home Assistant. What started as a simple switch replacement ended up being a full automation setup.

## Problems with Kasa Smart Switches

I started with TP-Link Kasa smart dimmer switches. They seemed like a good choice - popular and reasonably priced. But I hit two problems.

**Couldn't get the 3-way dimmer switch to work.** I tried the Kasa Smart Dimmer Switch (KS230) following all documentation and instructions. Looked through forums for hours. Either my house wiring setup was incompatible or I missed something, but no success. Eventually gave up and installed one smart dimmer with a regular dummy switch on the other side that stays on all the time.

**Alexa integration sometimes failed.** Rarely but annoyingly, I'd tell Alexa to turn on a light and it would show as "on" in the app but the physical light stayed off. Had to tell Alexa to turn it off and on again to actually work.

## Switching to Lutron Diva

After researching alternatives, I went with Lutron Diva smart dimmer switches. Big improvement.

**3-way setup worked on first try.** Unlike the Kasa switches, Lutron's implementation just worked OOTB. No configuration headaches or troubleshooting. Both switches could control the lights independently right away. Response time was instant - no more sync issues between the app and physical lights.

**Better build quality.** The switches feel more solid with smooth dimming. Lutron's commercial lighting background shows in their residential products. 

After installing the Lutron switches, everything worked perfectly. Problem solved, right? Not quite.

## New Problem: Alexa Brightness Control

With Kasa switches, Alexa would turn lights on to my preferred 20% brightness - perfect for evening use. With Lutron, Alexa always turned lights to 100% brightness regardless of the preset.

I contacted Lutron support. This isn't a bug - it's how their Alexa integration works. No way to set default brightness levels. My workaround was asking Alexa to "adjust brightness to 20%" after turning lights on. Clunky and defeats the purpose of voice automation.

## Solution: Home Assistant Setup

To get the brightness control I wanted, I needed something else. Home Assistant kept coming up in my research so I decided to give it a shot. It's a local automation platform that could bridge Lutron hardware with custom logic.

Home Assistant needs dedicated hardware. I had two options:
- Home Assistant Green/Yellow (Raspberry Pi based)
- Mini PC running virtualization

I chose the mini PC route for several reasons. Better performance, room to run other services, and more flexibility if I wanted to expand my home automation setup later.

## Technical Implementation

**Hardware:** Beelink S13 mini PC - compact, low power, good performance for multiple VMs. The S13 has 16GB RAM and an Intel N150 processor, plenty for Home Assistant and other services.

**Software setup:**
- Proxmox VE 8.4 virtualization platform
- Home Assistant OS VM (2GB RAM, 32GB storage, 2vCPU)
- Lutron Caséta bridge integration via Home Assistant

I followed this tutorial to [install Home Assistant over proxmox](https://www.derekseaman.com/2023/10/home-assistant-proxmox-ve-8-0-quick-start-guide-2.html).
The installation was surprisingly straightforward. Proxmox installed cleanly, and the Home Assistant VM was running within a few hours.

**Lutron integration steps:**
1. Connected Caséta bridge to network
2. Added Lutron integration in Home Assistant
3. All switches automatically discovered and imported
4. Created automation rule in Home Assistant to set brigtness when switch is turned on

## Results

The final setup gives me everything I originally wanted:

* Reliable 3-way switch operation that works every time
* Instant response times with no sync issues
* Custom brightness automation through Alexa
* Room for future automation expansion
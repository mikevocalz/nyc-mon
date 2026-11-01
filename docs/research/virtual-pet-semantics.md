# Virtual pet semantics: what the classic devices meant

Research lane 1 of 3 for the NYC-Mon Mon screen (`/mon/:id`). Scope is device semantics: what each stat, icon, sound and rule meant to the person holding the toy, and how it behaved in real time. Visual direction and modern UI patterns belong to the other lanes.

Every factual claim carries a source URL. Lines tagged **(unverified)** are my inference or a gap I could not close with a source. Fan wikis and fan care guides (Thaao's Tamas, Tamagotchi Wiki, FileIsland, Humulos, Bulbapedia) are the best available record for timings, because Bandai's manuals rarely give numbers. Where two sources disagree, both are given.

Abbreviations: **P1** is the 1996 Generation 1 Tamagotchi, **P2** the 1997 Generation 2, **V-Pet** the 1997 Digimon Digital Monster.

---

## 1. Stats and meters

### Tamagotchi P1/P2 (1996-97)

The METER icon opens four pages, cycled with A or B: age and weight, discipline, Hungry, Happy. https://www.thaao.net/tama/p1/

| Stat | Shape on screen | Range | Fills from | Drains from |
|---|---|---|---|---|
| Hungry | row of 4 hearts, filled = full | 0-4 | Meal, +1 heart | time |
| Happy | row of 4 hearts | 0-4 | Snack (+1) or a won game (+1) | time |
| Discipline | horizontal bar | 0, 25, 50, 75, 100% | correct scold, +25% each | can drop at evolution |
| Weight | number (oz in English units, g in Japanese) | max 99 | Meal +1, Snack +2 | any finished game, -1 |
| Age | number ("years") | | +1 each time it wakes, naps included | never |

Sources for the table: https://www.thaao.net/tama/p1/ ; the discipline drop at evolution (a Marutchi at 100% starts the teen stage at 50%) is from https://tamagotchi.fandom.com/wiki/Training

- One Earth day equals "about one year" for the pet, per the Bandai US manual. https://www.bandai.com/amfile/file/download/file/167/product/1276865/
- The Bandai manual says hearts "start out empty", so a newborn calls for food almost at once. https://www.bandai.com/amfile/file/download/file/167/product/1276865/
- Drain speeds up with age. On the originals the old-adult cap is 1 Hungry heart every 6 minutes and 1 Happy heart every 7 minutes; the 2017-18 replicas slow that cap to about 1 of each every 16 minutes. https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)
- Drain rates for baby, child and teen are character-specific and slower. I found no source with exact numbers. **(unverified beyond "slower")** https://github.com/siegerts/tama96/blob/main/plan.md
- The game counts only when finished. Five rounds of "Left or Right"; 3+ wins adds a Happy heart; weight drops by 1 win or lose; quitting with C mid-game changes nothing. https://www.thaao.net/tama/p1/

### Tamagotchi Connection (2004) and later

- Connection V1 keeps Hungry/Happy hearts and renames Discipline to Training, with two actions: Scold (Time-Out) and Praise. https://buy-tamagotchis.com/tamagotchi-connection-v1-guide/ ; https://meepingblog.com/tamagotchi/tamagotchi-connectionv1-guide/
- The meter adds Gotchi Points, generation number, gender and nickname. https://www.bandai.com/amfile/file/download/file/242/product/1297919/
- Tamagotchi Paradise (2025) shows the care record directly in a "Tama Cell" view. Care mistakes appear as scribbles (max 6), and full Hunger and Happy meters appear as rice-ball and sun icons; perfect-care adults need 5+ of each. Paradise is the first release where users can count their care mistakes without hacking. https://tamagotchi.fandom.com/wiki/Tamagotchi_Paradise/Character_list ; https://tamagotchi.fandom.com/wiki/Tamagotchi_Paradise

### Digimon V-Pet (1997) and Ver.20th (2017)

- Status pages: age/weight, Hunger hearts, Strength hearts, win ratio, and a DP (energy) gauge. https://lcd.withthewill.net/VpetIntro
- Weight in gigabytes (G): Meat +1G, Protein +2G, Training -2G, Battle -4G. https://lcd.withthewill.net/VpetIntro
- The DP gauge refills after "a full 8 hours' sleep" on the original. https://lcd.withthewill.net/VpetIntro The Ver.20th refills DP after at least 3 hours of sleep or with Protein, and Max DP grows by 14 per stage up to 70. https://humulos.com/digimon/dm20/manual/
- The energy meter is drawn as 14 bars, rounded down, so it can look empty when it is not. https://withthewill.net/threads/original-v-pet-perfect-evolution.11646/
- **Effort** (Ver.20th): every 4 training sessions fill 1 Effort heart, pass or fail. Different Effort counts route to different evolution lines. https://humulos.com/digimon/dm20/manual/
- Hidden counters on the original: every 4 Protein raises "Pre-Enhancement"; each care mistake lowers it, range -4 to +4. The battle value is the average of that and current Strength hearts. https://dmcomm.github.io/vpet/
- Strength hearts matter in battle. On Ver.20th each heart adds 4 power, and 99G weight or empty Hunger cancels the bonus. https://humulos.com/digimon/dm20/manual/

### Digimon Vital Bracelet / Vital Hero (2021-)

- The pet runs on **Vital Values**, earned from your heart rate (checked every 5 minutes against your resting rate) and steps ("Miles", checked every 3 minutes, 50 Miles per value). Happy pets earn double, upset or injured pets half. Taking the band off for 5 minutes while the Digimon is awake costs 50 Vital Values. https://humulos.com/digimon/vbdm/manual/
- Later models (Digivice -V-, Vital Hero) give 4 values per 50 Miles and lose 20 when unworn. https://humulos.com/digimon/vbdm/differences/

### Pocket Pikachu (1998) and Pokéwalker (2010)

- Pocket Pikachu has no hunger meter. One stat matters: friendship, in 4 levels. You walk; every 20 steps earns 1 watt; you give watts to Pikachu. Friendship decays over time, and big gifts raise it faster. https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Pikachu
- Friendship is shown by staging, not a bar. A disliked owner sees Pikachu's back; at "loves you" Pikachu faces you and fills most of the screen. https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Pikachu
- Pokéwalker steps become watts, which pay for the Poké Radar (10 W) and Dowsing (3 W). https://bulbapedia.bulbagarden.net/wiki/Watt ; 1 watt per 20 steps per https://pokemon.neoseeker.com/wiki/Pok%C3%A9walker

### Giga Pets, Nano, Neopets, Nintendogs

- Giga Pets used numeric indexes for Happiness, Hunger and Discipline. https://www.virtualpet.com/vp/farm/gigapet/gigapet.htm Compu Kitty scores run 0-100 and start at 80 (Hunger at 0). Health cannot be raised directly; it falls when Hunger and Happiness sit at 0, the pet lies down below 50, and it dies at 0. https://tamapetchi.wordpress.com/2017/06/15/giga-pets-compu-kitty-guidemanualinstructions/
- Nano Baby used Tamagotchi-style hearts for Discipline, Happiness and Hunger, plus age and weight. https://cdn-cms.f-static.net/uploads/4368466/normal_5f88ce6750f2f.pdf
- Neopets hunger is a word ladder, not a number: Dying, Starving, Famished, Very Hungry, Hungry, Not Hungry, Fine, Satiated, Full Up, Very Full, Bloated, Very Bloated. https://www.neopets.com/ntimes/index.phtml?section=374946&week=320
- Nintendogs also shows hunger, thirst and cleanliness as text, which a 2005 preview called out as a problem for players who can't read it. http://www.nintendoworldreport.com/hands-on-preview/3276/nintendogs-nintendo-ds

---

## 2. The icon bar

### Tamagotchi P1: 7 selectable icons + 1 indicator

The LCD sits between two printed rows of icons. A cycles left to right across the top row, then the bottom row. https://www.thaao.net/tama/p1/ ; https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)

| # | Icon (picture) | Action |
|---|---|---|
| 1 | FEED (knife and fork) | submenu: Meal / Snack |
| 2 | LIGHT (bulb) | submenu: On / Off |
| 3 | PLAY (bat and ball) | Left-or-Right game |
| 4 | MEDICINE (syringe) | one dose per press |
| 5 | DUCK (rubber duck) | flushes every poop on screen |
| 6 | METER | 4 status pages |
| 7 | DISCIPLINE | scold |
| 8 | ATTENTION | not selectable; lights when the pet calls |

Picture descriptions: knife and fork, bulb, bat and ball, duck are from the Bandai manual https://www.bandai.com/amfile/file/download/file/167/product/1276865/ ; syringe from https://jennystroom.nl/powerup/2020/06/20/tamagotchi-gen1-virtual-pet/

- The icons are fixed LCD segments, not pixels. The P1 hardware is a 32x16 dot matrix "+ 8 custom segments". https://github.com/mamedev/mame/blob/master/src/mame/handheld/hh_e0c6200.cpp
- The Attention icon lives bottom-right on almost every release. https://tamagotchi.fandom.com/wiki/User_blog:Osumesu21/Sandbox:_Attention
- The duck works on an empty screen too and does nothing. Scolding a pet that isn't misbehaving does nothing on the P1. https://www.thaao.net/tama/p1/ On most later releases, a scold without cause costs a Happy heart. https://tamagotchi.fandom.com/wiki/Training

### Tamagotchi Connection V1: 10 icons

It keeps the 8 functions and adds Connection (a heart with waves) and a Friend List (an open book). Training holds both Scold and Praise. https://buy-tamagotchis.com/tamagotchi-connection-v1-guide/

### Digimon V-Pet: 8 icons, battle-flavoured

Scale (status), Meat (meat or Protein), Training, Fight (battle another V-Pet), Toilet, Lights, Bandage (heal), and the Call indicator. https://lcd.withthewill.net/VpetIntro Pendulum models later named the connect icon with arrows and the training icon with a weight-lifter. https://humulos.com/digimon/pen/manual/

### Pattern across devices

Every device in the 1996-98 wave used a fixed ring of pictograms with one non-selectable alarm light. Giga Pets also had "a beep sound and alert icon". https://en.wikipedia.org/wiki/Giga_Pets Nano Baby had an attention icon with a beep. https://cdn-cms.f-static.net/uploads/4368466/normal_5f88ce6750f2f.pdf

---

## 3. Care calls and care mistakes

### Tamagotchi P1

The pet calls (beeps and lights ATTENTION) for exactly four reasons:

1. Hungry hits 0 (fix: Meal).
2. Happy hits 0 (fix: Snack or a won game).
3. It falls asleep with the light on (fix: light off).
4. It wants attention it doesn't need, called misbehaving (fix: scold).

The light stays lit for 15 minutes or until fixed. Missing 1-3 inside 15 minutes is a **care mistake**. Each care mistake shortens lifespan, and the count per stage decides the next evolution. Setting the clock back cannot undo one. https://www.thaao.net/tama/p1/

- **The attention sound** on the classic is "nine two-tone beeps in quick succession". https://tamagotchi.fandom.com/wiki/User_blog:Osumesu21/Sandbox:_Attention
- **Silent mode doesn't stop calls.** The icon still lights with sound off, so players learned to glance at it. https://www.thaao.net/tama/p1/
- **Poop and sickness don't call.** The pet never beeps to say it pooped or got sick. https://www.thaao.net/tama/p1/ ; https://jennystroom.nl/powerup/2020/06/20/tamagotchi-gen1-virtual-pet/
- **False calls.** A misbehaving pet calls with Hungry > 0, Happy > 0 and awake, then refuses meals and games for 15 minutes. Scolding adds 25% discipline. On the P1, ignoring a false call is not a care mistake; it only withholds the discipline gain. The 1996-97 units misbehave exactly enough times to fill the bar; the 2017-18 replicas call more often, and each missed false call is a "discipline mistake" that feeds evolution. https://www.thaao.net/tama/p1/
- Bandai's own definition of when to discipline: it "beeps even though it is full and happy", "won't eat when it is hungry", or "won't play games when it is not very happy". https://www.bandai.com/amfile/file/download/file/167/product/1276865/

### Tamagotchi Connection

- Five call reasons: empty Hungry, empty Happy, praise or scold needed, lights (an hour to answer, not 15 minutes), sickness. https://tamagotchi.fandom.com/wiki/User_blog:NightBladeSequel/Tamagotchi_Connection_2024_FAQ
- Mistakes split into **physical** (missed hunger call, missed scold, untreated sickness) and **mental** (missed happy call, missed praise, light left on). https://tamagotchi.fandom.com/wiki/Care
- Using the wrong discipline action is not a mistake; only ignoring the call is. https://tamagotchi.fandom.com/wiki/User_blog:NightBladeSequel/Tamagotchi_Connection_2024_FAQ
- On V1, a missed training call counts as a care mistake. https://buy-tamagotchis.com/tamagotchi-connection-v1-guide/

### Digimon

- Original V-Pet: the call light gives you **20 minutes** for empty Hunger, empty Strength, or lights. Both meters empty together counts once, and hours of ignored re-beeps still count once. https://lcd.withthewill.net/VpetEvo1
- Ver.20th: the call light goes out after **10 minutes**, and an unfilled meter will not call again until the pet is tired. https://humulos.com/digimon/dm20/manual/
- Sleep disturbances are their own counter. Waking the pet by opening Food, Training or Battle increments it. https://lcd.withthewill.net/VpetEvo1

### Others

- Giga Pets: "A beep sound and alert icon notify the owner"; sometimes the pet refuses an activity and you must try another. https://en.wikipedia.org/wiki/Giga_Pets
- Pocket Pikachu has no calls. Shaking it while Pikachu eats, washes or sleeps lowers friendship. https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Pikachu

---

## 4. Life cycle

### Tamagotchi P1

| Stage | Entry | Length | Notes |
|---|---|---|---|
| Egg | after clock is set | about 5 min | egg pulses |
| Baby (Babytchi) | hatch | 65 min | one character; naps briefly |
| Child (Marutchi) | 65 min | to age 3 | one character |
| Teen | age 3 | to age 6 | Tamatchi or Kuchitamatchi |
| Adult | age 6 | character-specific | 6 adults |
| Secret adult | age 8-12 | | from one specific adult |

Sources: https://www.thaao.net/tama/p1/ ; https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet) ; egg "pulsating" and "about 5 minutes" from the Bandai manual https://www.bandai.com/amfile/file/download/file/167/product/1276865/

- **Branching.** Child to teen: 0-1 care mistakes gives Tamatchi, 2+ gives Kuchitamatchi, and discipline at evolution picks the variant. https://www.thaao.net/tama/p1/?p=chara Teen to adult adds discipline mistakes and leads to Mametchi at the top (0-2 care, 0 discipline mistakes, 15-16 days) down to Nyorotchi (3+ care, 2-3 days). https://github.com/siegerts/tama96/blob/main/plan.md (a fan reimplementation's spec; cross-check against Thaao before using exact numbers)
- **Weight** sets a floor per stage (Marutchi minimum 10). https://www.thaao.net/tama/p1/?p=chara Snacks over games keep weight up; games are the "good care" route. https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)
- **Lifespan.** Average about 12 days; low around age 7, high around 25. https://tamagotchi.fandom.com/wiki/Death Bandai's manual: "Tamagotchi character will always return to its home planet. How well you care for it helps determine how long Tamagotchi character will stay on Earth." https://www.bandai.com/amfile/file/download/file/167/product/1276865/
- **Death.** A dying pet cries with many long beeps while looking sick. Then the Japanese unit shows a ghost (Obaketchi) beside a grave; the English P1 shows an angel among stars; the English P2 shows a UFO. https://www.thaao.net/tama/p1/ ; https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)
- **The egg at the end.** A well-cared-for adult lays an egg just before passing. The egg never hatches. https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)
- **The memorial screen.** C scrolls to the final age; A+C together starts a new egg. https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)
- Region framing: Newsweek in 1997 noted the Japanese headstone versus American pets that "sprout wings and return to their 'home planets'". https://www.newsweek.com/new-pet-rock-digital-generation-173530 The Tamagotchi Wiki attributes the English changes to removing religious imagery such as ghosts. https://tamagotchi.fandom.com/wiki/Death

### Generations (Connection onward)

Two pets marry over infrared, or a Matchmaker appears for an unmarried adult. The parent raises the baby for 24 hours, needing only medicine from you, then leaves, and you name generation N+1. A pet that never finds a partner grows old and dies. https://www.bandai.com/amfile/file/download/file/242/product/1297919/ ; https://www.mimitchi.com/tamaplus/manual.shtml The Connection death screen is a winged egg; Japan's Plus shows a ghost and grave. https://buy-tamagotchis.com/tamagotchi-connection-v1-guide/ Marriage started with Osutchi and Mesutchi. https://en.wikipedia.org/wiki/Tamagotchi

### Digimon V-Pet

- Botamon (Baby I) to Koromon (Baby II) in about 60 minutes. Koromon becomes Agumon at 0-3 care mistakes, Betamon at 4+. Adults are decided by care mistakes, training count, overfeeds and sleep disturbances. Numemon is the fallback when nothing else matches. https://wikimon.net/Digital_Monster_Ver._1
- Counters reset at each evolution (except battles), so the newborn's care never affects growth. https://lcd.withthewill.net/VpetEvo1
- Perfect stage: Bandai said "15+ battles with a victory ratio 80% or more"; players found it partly random. https://originaldigimonvirtualpets.wordpress.com/2010/01/04/how-to-get-the-digimon-that-you-like/
- Death on Ver.20th: 20 injuries in one form, 20 care mistakes in one form, 5 mistakes after 48 hours in a stage, 6 hours injured, or 12 hours with empty Hunger or Strength. A dying song plays, then a grave. https://humulos.com/digimon/dm20/manual/
- US softening: the "Megalithic Mainframe" was added so Digimon "cannot die, but instead return to a fictional world". https://en.wikipedia.org/wiki/Digital_Monster_(virtual_pet)
- Digimon Color (2023) hatches in about 8 seconds where the original took about 5 minutes; Bandai cut the wait to save battery. Baby I to II takes about 10 minutes, Baby II to Child about 12 hours, Child to Adult about 24 hours. https://digimon.net/topic/detail.php?id=1262

### Vital Bracelet

Stage timers: 1 h, 3 h, 16 h, 24 h, 24 h, 3 h. Sleep and backup time don't count on the original model. https://humulos.com/digimon/vbdm/ Death comes from 4 injuries in a day, or 24 hours unworn while awake. https://humulos.com/digimon/vbdm/manual/

### Others

- Giga Pets: one growth outcome; average life 2 weeks; dead pets grow angel wings. https://www.virtualpet.com/vp/farm/gigapet/gigapet.htm ; https://en.wikipedia.org/wiki/Giga_Pets
- Nano Baby: at age 3 (about 12 days) the parents appear and a second baby is born; 12 more good days gives a "happy family" ending. https://cdn-cms.f-static.net/uploads/4368466/normal_5f88ce6750f2f.pdf
- Talking Nano: Infant days 1-3, Toddler 4-7, Pre-Teen 8-10, a birthday song at each stage, and an ending that just prints a sentence such as "Your Nano grows up an gets own couch." https://www.virtualpet.com/vp/farm/nano/talkn/talkn.htm
- Neopets can't die. https://classic.support.neopets.com/hc/en-us/articles/17705625404301-Can-my-Neopet-die-if-I-don-t-feed-it
- Nintendogs "never grow up, don't die". http://www.nintendoworldreport.com/review/4394/nintendogs-nintendo-ds

---

## 5. Daily rhythm

### Sleep and the light

- P1 bedtimes run 8 PM to 11 PM and wake times 9 AM to 11 AM, by character (Marutchi 8 PM-9 AM; Maskutchi 11 PM-11 AM). Age goes up on each wake. https://www.thaao.net/tama/p1/
- The pet falls asleep on its own and calls once. You have 15 minutes to turn the light off. **You can't turn it off early.** It must be during that window. The pet turns the light back on itself at wake and doesn't call to announce waking. https://www.thaao.net/tama/p1/
- Turning the light off inverts the screen. https://jennystroom.nl/powerup/2020/06/20/tamagotchi-gen1-virtual-pet/ Bandai's wording: with the light left on, "it might get restless!" https://www.bandai.com/amfile/file/download/file/167/product/1276865/
- A P1 can't be woken except by changing the clock. https://www.thaao.net/tama/p1/ A Digimon can be woken by opening Food, Training or Battle, and each wake counts as a sleep disturbance. https://lcd.withthewill.net/VpetEvo1
- Connection gives an hour for the light call. https://tamagotchi.fandom.com/wiki/User_blog:NightBladeSequel/Tamagotchi_Connection_2024_FAQ The Uni puts itself to bed, so there is no bed call (owner review). https://www.tamatalk.com/threads/my-first-modern-tama-an-honest-review-of-the-tamagotchi-uni.202169/
- Paradise lets you choose: wake any time 6:00-9:59 AM, put to bed 7:00-9:59 PM, after which it does so itself. https://tamagotchi.fandom.com/wiki/Tamagotchi_Paradise/Character_list
- Pocket Pikachu keeps a routine near 8 PM: shower, teeth, bed. https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Pikachu

### Poop

- P1 baby poops at 15 and 45 minutes after hatching; the child 5 minutes after evolving and then every 3 hours. https://jennystroom.nl/powerup/2020/06/20/tamagotchi-gen1-virtual-pet/ Adults poop about every 3 hours; up to 4 piles stack on the right side; one duck press clears all; leaving them causes illness. https://www.thaao.net/tama/p1/
- Connection-era pets show a face and stink lines before pooping. Pressing the toilet icon during that animation makes the pet use a toilet, and repeating it potty-trains the pet. https://en.wikipedia.org/wiki/Tamagotchi
- Digimon V-Pet poops about every 2 hours and gets sick after 8 uncleaned poops. https://lcd.withthewill.net/VpetIntro A different fan record says up to 4 piles had no effect. https://lcd.withthewill.net/VpetEvo1 On Ver.20th, 4 piles cause an injury. https://humulos.com/digimon/dm20/manual/
- Paradise turns poop into fuel. Collecting enough launches a rocket to other Tamagotchi planets. https://www.engadget.com/gaming/tamagotchi-paradise-trades-stressful-virtual-pet-parenting-for-nature-and-tranquility-130049511.html

### Sickness and medicine

- A skull appears beside the pet. "Sometimes 2 or 3 doses are needed." https://www.bandai.com/amfile/file/download/file/167/product/1276865/ A sick pet sits still at the bottom of the screen and refuses to play or eat. https://en.wikipedia.org/wiki/Tamagotchi
- Causes: too many snacks, uncleaned poop, old age, before evolution and before death. https://jennystroom.nl/powerup/2020/06/20/tamagotchi-gen1-virtual-pet/
- Nano Baby's medicine has a cadence. A second dose is needed 2 hours after the first, and giving it early slows recovery. https://cdn-cms.f-static.net/uploads/4368466/normal_5f88ce6750f2f.pdf
- Digimon injuries also show a skull and are treated with the Bandage; the pet may refuse treatment and need repeat presses. https://humulos.com/digimon/dm20/manual/ ; https://lcd.withthewill.net/VpetIntro
- Paradise moves the cure inside the body. You zoom down to the cell level and fight pathogens. Five sicknesses in one stage kill the pet. https://www.notebookcheck.net/Tamagotchi-Paradise-zooms-from-space-to-microscopic-cells-with-digital-crown-and-costs-45.1022846.0.html ; https://tamagotchi.fandom.com/wiki/Tamagotchi_Paradise/Character_list

### Meals versus snacks

| | Meal | Snack |
|---|---|---|
| Fills | 1 Hungry heart | 1 Happy heart |
| Weight | +1 | +2 |
| Refused when | Hungry is full, or misbehaving | never |
| Risk | none | sickness; the only way to kill a P1 baby; on replicas, enough to kill a child or teen |

Sources: https://www.thaao.net/tama/p1/ ; https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)

The meal was a bowl of rice in Japan and a loaf of bread in English units; the snack was wrapped candy everywhere. https://www.thaao.net/tama/p1/ Both are eaten in 3 frames. https://jennystroom.nl/powerup/2020/06/20/tamagotchi-gen1-virtual-pet/ Digimon swaps the snack for Protein, which fills Strength and adds 2G. https://lcd.withthewill.net/VpetIntro

---

## 6. The input model

- Three face buttons below the screen: **A select** (cycle), **B execute/confirm**, **C cancel**. A fourth recessed Reset sits on the back and needs a pen tip. https://www.thaao.net/tama/p1/ ; the manual labels them "A SELECT, B EXECUTE, C CANCEL". https://www.bandai.com/amfile/file/download/file/167/product/1276865/
- The loop: A walks a highlight around the icon ring; B opens or runs; inside a submenu A moves the arrow and B confirms; C drops back to the idle pet with no icon highlighted. With nothing highlighted, B shows the clock. https://www.thaao.net/tama/p1/
- Chords: A+C toggles sound (with a confirmation chime), A+C on the clock enters set mode, A+C on the death screen lays a new egg. https://www.thaao.net/tama/p1/
- C is a reliable "home" press. A 2020 accessibility review notes you can always press C to get back to a known state, even playing blind. https://jennystroom.nl/powerup/2020/06/20/tamagotchi-gen1-virtual-pet/
- Digimon put the same three buttons in a vertical column to the right of the screen (A top, B middle, C bottom). https://en.wikipedia.org/wiki/Digital_Monster_(virtual_pet)
- The game turns the buttons into a binary guess: A for left, B for right. https://www.thaao.net/tama/p1/
- Pendulum training replaces button-mashing with shaking. A physical clacker counts vertical shakes; a perfect count gives a "MEGAHIT" that fills Strength. https://humulos.com/digimon/pen/manual/
- What happens when the click goes away: Tamagotchi Pix (2021) replaced the buttons with flat touch pads. Inverse found they failed "about one-third of the time". https://www.inverse.com/input/reviews/tamagotchi-pix-compared-to-tamagotchi-on-review Engadget's hands-on was titled "My Tamagotchi Pix is drowning in poop and it's not my fault". https://www.engadget.com/tamagotchi-pix-hands-on-133027822.html MobileSyrup's ideal Pix would put the colour screen "onto an older/slimmer model with physical buttons". https://mobilesyrup.com/2021/06/27/tamagotchi-pix-review-hands-on/
- Paradise (2025) adds a side dial. Engadget, after the Pix: "it was just a relief to find that it doesn't suck." The dial also allows scrolling backwards, which three buttons never did. https://www.engadget.com/gaming/tamagotchi-paradise-trades-stressful-virtual-pet-parenting-for-nature-and-tranquility-130049511.html
- Typing codes on three buttons is slow. T3 complained about entering long alphanumeric strings on the Uni. https://www.t3.com/news/i-tried-the-tamagotchi-uni-and-it-makes-my-pet-free-existence-less-sad

Why it feels tactile is a judgment, not a sourced fact **(unverified)**: one thumb, three physical clicks, each press answered by a short beep (confirmed for scroll, accept and cancel at https://jennystroom.nl/powerup/2020/06/20/tamagotchi-gen1-virtual-pet/), and a menu small enough to learn by muscle memory.

---

## 7. Sensory signature

### Screen

- P1/P2: **32x16** monochrome dot-matrix LCD, plus 8 icon segments. Seiko Epson E0C6S46 4-bit MCU at 32.768 kHz, 1-bit sound. https://github.com/mamedev/mame/blob/master/src/mame/handheld/hh_e0c6200.cpp ; https://github.com/jcrona/tamalib
- No backlight; you tilt it toward light. https://jennystroom.nl/powerup/2020/06/20/tamagotchi-gen1-virtual-pet/
- A printed card behind the LCD gives the background: blue and pink checkerboard on Gen 1, yellow and blue ripples on Gen 2, framed by a "cracked eggshell" pattern. https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)
- Wikipedia describes the original display as "8-bit (256 shades) grayscale", which conflicts with the 1-bit dot matrix in the MAME and TamaLIB sources. Treat the hardware sources as correct. https://en.wikipedia.org/wiki/Tamagotchi
- Tamagotchi Connection 2024: no backlight, a "32 by 30" LCD per Gizmodo. https://gizmodo.com/tamagotchi-connection-review-2000377097

### Shell and carry

- About 5 cm tall, egg-shaped, three buttons, keychain hole with a ball chain (English units sometimes used a chain and ring). https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)
- Name: tamago (egg) + uotchi (watch). The first concept was a wristwatch; the egg may echo a pocket watch. https://en.wikipedia.org/wiki/Tamagotchi
- Powered by 2x LR44 originally, 1x CR2032 on replicas. A pull tab on the side insulates the battery until first use. https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)
- Bandai's manual frames the pull tab as waking the pet "from its million light year sleep". https://www.bandai.com/amfile/file/download/file/167/product/1276865/

### Sounds

| Moment | Sound | Source |
|---|---|---|
| Attention | nine two-tone beeps in quick succession | https://tamagotchi.fandom.com/wiki/User_blog:Osumesu21/Sandbox:_Attention |
| Discipline call (Osutchi/Mesutchi) | three loud prolonged beeps, distinct from the normal call | same |
| Menu | confirmation beep on scroll, accept, cancel | https://jennystroom.nl/powerup/2020/06/20/tamagotchi-gen1-virtual-pet/ |
| Game | win jingle, fail jingle | same |
| Feeding, cleaning | silent | same |
| Evolution | a jingle as the appearance changes | https://en.wikipedia.org/wiki/Tamagotchi |
| Successful scold | a special sound; the attention icon turns off | https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet) |
| Dying | many long beeps | https://www.thaao.net/tama/p1/ ; "heart monitor-like sounds" at https://tamagotchi.fandom.com/wiki/Death |
| Digimon death | a dying song, then a grave | https://humulos.com/digimon/dm20/manual/ |
| Nano stage change | a birthday song | https://www.virtualpet.com/vp/farm/nano/talkn/talkn.htm |

I could not find a written description of the hatch melody. A recording of all P1 sound effects exists at https://www.youtube.com/watch?v=aoVaAutNJPM **(not transcribed; unverified as a description)**.

### Animations

- Egg idles by flipping between two sprites; the hatch runs three frames, then the baby appears. https://www.reddit.com/r/tamagotchi/comments/15016nf/help_with_understanding_original_tamagotchi/ (fan sprite analysis)
- Eating takes 3 frames. https://jennystroom.nl/powerup/2020/06/20/tamagotchi-gen1-virtual-pet/
- Sleeping: in the middle of the screen with Z's rising, sometimes under a blanket. https://www.thaao.net/tama/p1/
- Cleaning: "a large flush animation". https://jennystroom.nl/powerup/2020/06/20/tamagotchi-gen1-virtual-pet/
- A baby's death skips the sequence; the screen fades "similar to the evolution screen". https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)
- Replicas run animations "quicker and smoother", noticeable when clearing poo. https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)
- Digimon Color (2023) colours the evolution banner by growth stage. https://digimon.net/topic/detail.php?id=1262
- The idle walk left and right is widely remembered, but I found no written source that describes it for the P1. **(unverified)**

### Pause

- The P1 has no pause button. Leaving the clock in set mode freezes everything: no aging, evolving, pooping, sleeping, calls or drain. https://www.thaao.net/tama/p1/
- Digimon players used the same clock trick, and a sleeping Digimon left on SET kept aging and evolving. https://lcd.withthewill.net/VpetIntro
- Giga Pets could be paused the same way, in clock mode. https://www.virtualpet.com/vp/farm/gigapet/gigapet.htm
- Later Tamagotchis added a pause, then replaced it with paid babysitting. https://en.wikipedia.org/wiki/Tamagotchi

---

## 8. Social

- **Contact battle (Digimon, 1997).** A metal contact on the edge; two devices battle when the contacts touch. Battling was the selling point for boys. https://en.wikipedia.org/wiki/Digital_Monster_(virtual_pet) It started as a "male-oriented Tamagotchi" with the working name "Otokotchi". https://en.wikipedia.org/wiki/Digital_Monster_(virtual_pet) Bandai marketed the first Tamagotchi to teenage girls. https://en.wikipedia.org/wiki/Tamagotchi
- **Win ratio** as a public score; battles drop 4G and can injure the winner too. https://lcd.withthewill.net/VpetIntro
- **Jogress (Pendulum, 1998).** Two Adult-or-higher Digimon at full DP combine on contact, and both evolve by attribute pairing. https://humulos.com/digimon/pen/manual/ ; https://en.wikipedia.org/wiki/Digital_Monster_(virtual_pet)
- **Prongs (Osutchi/Mesutchi).** Physical prongs joined a "male" and "female" device, the first Tamagotchi connection. Paradise returned to physical dock ports in 2025. https://en.wikipedia.org/wiki/Tamagotchi
- **Infrared (Connection, 2004).** Friendship, games, gifts, playdates and marriage. A friendship meter climbs with each visit until the pair can have a baby. https://en.wikipedia.org/wiki/Tamagotchi ; https://gizmodo.com/tamagotchi-connection-review-2000377097
- **Prank gifts.** On Connection V2 onward, a pet might send a prank gift instead of the one you chose, which counts as a scold call. https://tamagotchi.fandom.com/wiki/Training
- **Pokéwalker.** Two Pokéwalkers 5 cm apart over infrared each receive a gift item. https://www.nintendo.com/en-gb/News/2010/New-Pokewalker-accessory-brings-Pokemon-training-to-the-real-world-252312.html ; https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9walker
- **Codes as a bridge.** TamaTown linked device and web with alphanumeric codes; the device paused until you entered a logout code. https://en.wikipedia.org/wiki/Tamagotchi
- **Online (Uni, 2023).** Wi-Fi and the Tamaverse: parties, marriage, holidays, Tama Arena events. Marriage ends your current pet and replaces it with an egg inspired by both parents. https://www.t3.com/news/i-tried-the-tamagotchi-uni-and-it-makes-my-pet-free-existence-less-sad
- **Vital Bracelet.** Battles start by touching the band to any powered NFC source, including a phone. https://humulos.com/digimon/vbdm/

---

## 9. Why it stuck

- **Real time that doesn't stop.** A 9-year-old in Newsweek, 1997: "If you don't do something every four or five hours, it dies." https://www.newsweek.com/new-pet-rock-digital-generation-173530 The New York Times reported a pet "expires if left unattended for more than five or six hours during the day". https://www.nytimes.com/library/cyber/week/052297gadget.html
- **Grief.** The same Times piece quotes a parent whose son "cried hysterically and went crazy" when his Tamagotchi died, and a Dalton School psychologist: "The toy creates a real sense of loss and a mourning process." https://www.nytimes.com/library/cyber/week/052297gadget.html ; https://www.smithsonianmag.com/innovation/keeping-tamagotchi-alive-180979264/
- **Reset as a moral problem.** A psychologist in Newsweek: "I don't like the dying and resetting. That doesn't represent the finality of death." https://www.newsweek.com/new-pet-rock-digital-generation-173530
- **School bans.** Newsweek reported bans "in a number of elementary schools" within weeks of the US launch. https://www.newsweek.com/new-pet-rock-digital-generation-173530 CBC reported Vancouver-area schools considering bans in 1997, and a former owner's memory: "It had a certain urgency to it." https://www.cbc.ca/news/canada/british-columbia/tamagotchi-2017-1.4165606
- **Guilt as a design lever.** Bandai's manual warns that a neglected pet "will grow into an unattractive alien" and an undisciplined one into "an unattractive, bad mannered alien". https://www.bandai.com/amfile/file/download/file/167/product/1276865/ The visible result of your care is the adult you get.
- **The Tamagotchi effect** is the name for emotional attachment to machines. Wikipedia's entry ties the school bans to the pet dying within half a day of neglect, and says the pause feature later "negated" that problem. https://en.m.wikipedia.org/wiki/Tamagotchi_effect
- **Scale.** About 40 million original units sold, 12 million of them in the US and Canada; over 98 million Tamagotchis by 2025. https://en.wikipedia.org/wiki/Tamagotchi Digimon sold 14 million originals by March 2004. https://en.wikipedia.org/wiki/Digital_Monster_(virtual_pet)

### What later versions softened

| Change | Device | Source |
|---|---|---|
| Death framed as departure (angel, home planet, Megalithic Mainframe) | English Tamagotchi, US Digimon | https://www.newsweek.com/new-pet-rock-digital-generation-173530 ; https://en.wikipedia.org/wiki/Digital_Monster_(virtual_pet) |
| Pause discussed for US units so kids could attend class (1997) | Tamagotchi | https://www.educationworld.com/a_admin/admin/admin010.shtml |
| Pause added, then replaced by paid babysitting | later Tamagotchis | https://en.wikipedia.org/wiki/Tamagotchi |
| Lights window stretched from 15 min to 1 hour | Connection | https://tamagotchi.fandom.com/wiki/User_blog:NightBladeSequel/Tamagotchi_Connection_2024_FAQ |
| No old-age death; adults live while cared for, age caps at 99 | modern releases | https://tamagotchi.fandom.com/wiki/Death |
| Can't die at all | Pocket Pikachu, Neopets, Nintendogs | https://buy-tamagotchis.com/pocket-pikachu-guide/ ; https://classic.support.neopets.com/hc/en-us/articles/17705625404301-Can-my-Neopet-die-if-I-don-t-feed-it ; http://www.nintendoworldreport.com/review/4394/nintendogs-nintendo-ds |
| Neglect makes the pet leave or sulk, not die | Nintendogs (runs away, comes back), Pocket Pikachu (turns its back, shocks you) | https://strategywiki.org/wiki/Nintendogs/Pet_care ; https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Pikachu |
| Death saved by a past pet: a Tama Star from a pet that lived to 30+ chases the reaper off once | Paradise | https://tamagotchi.fandom.com/wiki/Tamagotchi_Paradise |
| An ambulance button when the Grim Gotchi appears | Uni | https://tamagotchi-official.com/manual/toy/uni/manual_02/Uni_WEB_IS_EN.pdf |
| Sleep any time, no drain while asleep | Vital Hero | https://thetoyinsider.com/vital-hero-review/ |

Why the softening happened, from the sources: parents' distress and the school-distraction problem (NYT, Newsweek, Education World, Tamagotchi effect entry above). Bandai's own reason for any specific change is not on record in what I found. **(unverified as Bandai's stated rationale)**

Not everyone wanted it softened. A 2020s fan who runs a P1 alongside a Uni called the Uni "a fairly undemanding Tama" and missed praise and scold. https://www.tamatalk.com/threads/my-first-modern-tama-an-honest-review-of-the-tamagotchi-uni.202169/ The 2024 Connection re-release shipped without a pause; Gizmodo: "once you get a Tama going, you've got to stay on it!" https://gizmodo.com/tamagotchi-connection-review-2000377097

---

## 10. Modern revivals (2017-2025)

### Kept

- Three buttons, still: on the Uni https://www.goodhousekeeping.com/childrens-products/toy-reviews/a62334708/tamagotchi-uni-review/ and Paradise https://www.notebookcheck.net/Tamagotchi-Paradise-zooms-from-space-to-microscopic-cells-with-digital-crown-and-costs-45.1022846.0.html
- The egg shell. https://www.goodhousekeeping.com/childrens-products/toy-reviews/a62334708/tamagotchi-uni-review/
- Exact replicas of the P1/P2 since 2017-18, with harsher snack rules and more discipline calls. https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)
- Death (Uni, Paradise both have it). https://tamagotchi-official.com/us/series/uni/faq/?mobile-app=true&theme=wiki ; https://tamagotchi.fandom.com/wiki/Tamagotchi_Paradise
- Pixel art and 8-bit beeps on a colour screen. T3 on the Uni: "the basic 8-bit beeps and pixel-heavy visuals kept things rooted in the charm of bygone days." https://www.t3.com/news/i-tried-the-tamagotchi-uni-and-it-makes-my-pet-free-existence-less-sad

### Changed

| Device | Year | What changed | Source |
|---|---|---|---|
| Tamagotchi On | 2019 | first international colour screen; Bluetooth to a phone | https://en.wikipedia.org/wiki/Tamagotchi |
| Tamagotchi Pix | 2021 | camera, touch pads, colour sampling from photos; careers, cooking | https://www.theverge.com/2021/4/21/22386339/tamagotchi-pix-pet-egg-camera-toy-ar |
| Tamagotchi Smart | 2021 | first smartwatch form, Japan only | https://en.wikipedia.org/wiki/Tamagotchi |
| Vital Bracelet | 2021 | heart rate and steps as food; DiM cards carry the monsters; ~18 h battery | https://www.inverse.com/input/reviews/digimon-vital-bracelet-review-fitness-meets-digital-monsters ; https://www.gamerbraves.com/digimon-vital-bracelet-review-the-future-of-virtual-pets/ |
| Tamagotchi Uni | 2023 | first Wi-Fi Tamagotchi; watch strap; USB-C; Tamaverse; DLC over Wi-Fi from 2024; about 72 h per charge at an hour a day | https://en.wikipedia.org/wiki/Tamagotchi ; https://www.goodhousekeeping.com/childrens-products/toy-reviews/a62334708/tamagotchi-uni-review/ ; https://tamagotchi-official.com/gb/series/uni/faq/ |
| Uni pause | 2024 | an official pause via a hidden reset menu after a software update | https://www.tamatalk.com/threads/a-new-official-uni-pause-method-has-been-added-through-a-software-update.201991/ |
| Digimon Color | 2023 | colour; hatch in 8 s instead of 5 min; screen sleeps to save charge | https://digimon.net/topic/detail.php?id=1262 |
| Tamagotchi Paradise | 2025 | zoom dial (planet, field, pet, cell); back to AAA batteries; physical dock ports; release adults into fields; gene mixing; ungendered characters; visible care record | https://www.theverge.com/news/672451/tamagotchi-paradise-virtual-pet ; https://www.engadget.com/gaming/tamagotchi-paradise-trades-stressful-virtual-pet-parenting-for-nature-and-tranquility-130049511.html ; https://tamagotchi.fandom.com/wiki/Tamagotchi_Paradise |

### Reception

- **Wi-Fi underdelivered at launch.** T3: Wi-Fi "seems like a missed trick", doing "little more than checking for updates and clunkily sending low-res pictures to your phone". https://www.t3.com/news/i-tried-the-tamagotchi-uni-and-it-makes-my-pet-free-existence-less-sad A Reddit owner: Tamaverse works without Wi-Fi "so it feels like it doesn't matter". https://www.reddit.com/r/tamagotchi/comments/156ktbz/what_are_your_opinions_on_the_uni_so_i_can_decide/ Engadget, a year on: the Uni "finally feels complete after its biggest update yet". https://www.engadget.com/tamagotchi-uni-finally-feels-complete-after-its-biggest-update-yet-140041168.html
- **Server risk.** A TamaTalk reviewer worried Bandai will pull online support, citing Digimon ReArise. https://www.tamatalk.com/threads/my-first-modern-tama-an-honest-review-of-the-tamagotchi-uni.202169/ The Vital Bracelet Lab app has already shut down. https://humulos.com/digimon/vbdm/differences/
- **Pet versus child.** The same reviewer wanted the Uni to "feel more like a digital pet and less like a digital child" and missed the "unique, less gendered artstyle" of the 90s. https://www.tamatalk.com/threads/my-first-modern-tama-an-honest-review-of-the-tamagotchi-uni.202169/ Wikipedia records that Paradise "reverted to a little pet of sorts, much to the delight of fans". https://en.wikipedia.org/wiki/Tamagotchi
- **Missed the chain.** "I wish they would have kept the iconic ball chain." https://www.tamatalk.com/threads/my-first-modern-tama-an-honest-review-of-the-tamagotchi-uni.202169/
- **Lower stakes, framed as a plus.** Engadget on Paradise: it "reimagines the classic toy not as a pet-keeping experience, but something more akin to wildlife conservation", and expects it to be "polarizing". https://www.engadget.com/gaming/tamagotchi-paradise-trades-stressful-virtual-pet-parenting-for-nature-and-tranquility-130049511.html Good Housekeeping pitched the Uni as a "self-care gift for adults". https://www.goodhousekeeping.com/childrens-products/toy-reviews/a62334708/tamagotchi-uni-review/
- **Fitness as care.** Inverse called the Vital Bracelet "a brilliant way to gamify exercise" for kids. https://www.inverse.com/input/reviews/digimon-vital-bracelet-review-fitness-meets-digital-monsters GamerBraves found it "one-dimensional" because care is only missions and fights. https://www.gamerbraves.com/digimon-vital-bracelet-review-the-future-of-virtual-pets/
- **Battery life is a care burden.** Pix: batteries gone after four days. https://www.inverse.com/input/reviews/tamagotchi-pix-compared-to-tamagotchi-on-review A Japanese Paradise review praised AAA power at close to a month per set, and noted you can pull batteries before a trip. https://niningame.blog.jp/archives/33090345.html

---

## Comparison table

| Device | Year | Screen | Inputs | Core stats | Call window | Death | Social | Pause |
|---|---|---|---|---|---|---|---|---|
| Tamagotchi P1/P2 | 1996-97 | 32x16 mono + 8 icons | A/B/C, reset | Hungry, Happy (4 hearts), Discipline bar, weight, age | 15 min | yes; ghost+grave (JP), angel (EN P1), UFO (EN P2) | none | clock-set trick |
| Digimon V-Pet | 1997 | mono LCD, 8 icons | A/B/C vertical | Hunger, Strength (hearts), DP, win %, weight | 20 min (orig), 10 min (Ver.20th) | yes; grave (US: returns to Mainframe) | contact battle | clock-set trick |
| Giga Pets | 1997 | mono LCD | buttons + alert icon | Happiness, Hunger, Discipline, Health (0-100) | unverified | yes, ~2 weeks, angel wings | none | clock mode |
| Nano Baby | 1997 | mono LCD | 4 buttons | Discipline, Happy, Hungry hearts | unverified | game ends; happy-family ending at ~24 days | none | time-mode trick |
| Digimon Pendulum | 1998 | mono LCD | buttons + shake clacker | as V-Pet | as V-Pet (unverified) | yes | contact battle, Jogress | unverified |
| Pocket Pikachu | 1998 | mono LCD | Game Boy-style buttons, pedometer | friendship (4 levels), watts | no calls | no; sulks, shocks you | none | none needed |
| Digivice | 1999 | mono LCD | 3 buttons, pedometer | steps to boss, D-Power | n/a | no | contact battle | n/a |
| Tamagotchi Connection | 2004 (re-release 2024) | mono, "32 by 30" per Gizmodo | A/B/C | Hungry, Happy, Training (scold+praise), Gotchi Points | 15 min; lights 1 h | yes; winged egg (EN) | infrared visits, gifts, marriage, generations | 2024 re-release has none |
| Nintendogs | 2005 | DS colour | touch, mic | hunger, thirst, dirt (text) | n/a | no; runs away, returns | none | console off |
| Pokéwalker | 2010 | mono LCD | 3 buttons, pedometer | watts, steps | n/a | no | infrared gift swap | n/a |
| Tamagotchi Pix | 2021 | colour | touch pads + camera | hearts, careers | unverified | unverified | QR codes | unverified |
| Vital Bracelet / Vital Hero | 2021 / 2022 | mono LCD band | 2 buttons, HR sensor, NFC | Vital Values, trophies/PP | n/a | yes; 4 injuries/day, 24 h unworn | NFC battles | sleep mode |
| Tamagotchi Uni | 2023 | colour, watch strap | A/B/C, Wi-Fi | Hunger, Happy | unverified | yes; Grim Gotchi, ambulance button | Tamaverse online | hidden menu since 2024 |
| Tamagotchi Paradise | 2025 | colour | A/B/C + zoom dial | Hunger, Happy, visible care cells | 15 min | yes; 5 sicknesses/stage; Tama Stars | dock ports, gene mixing | babysitter (300 GP, until 7 PM) |
| Neopets | 1999 web | browser | mouse | hunger ladder, mood | n/a | no | site-wide | n/a |

Neopets' 1999 launch year is from general knowledge, not a source fetched here. **(unverified)**

---

## Semantics worth keeping

Ranked by nostalgia value for a "nostalgic, futuristic" Mon screen. Each line says what to carry over and what it meant on the device.

1. **The attention light plus beep, with a deadline.** One non-selectable icon lights up, the device beeps (nine two-tone beeps on the P1), and you have 15 minutes. Missing it is recorded, not punished on the spot. This single mechanic carries most of the guilt and most of the memory. (§3)
2. **Four-heart rows for Hungry and Happy.** Discrete, countable, filled-or-empty. Players read them as "how many do I owe it". Paradise kept the idea and made the record itself visible. (§1)
3. **Care mistakes decide who your pet becomes.** The adult form is the report card: Mametchi for good care, an "unattractive alien" for neglect, Numemon for Digimon misfits. The outcome is visible and permanent. (§4)
4. **Real time that keeps running.** Age counted in days ("1 day = 1 year"), aging on each wake, bedtimes by character. No catch-up mechanic. (§4, §5)
5. **Lights out inside a window.** The pet falls asleep on its own and calls once; you must answer during the window and can't pre-empt it; the screen inverts. A tiny nightly ritual. (§5)
6. **Poop that piles up, and one flush that clears it.** Up to four piles, no call, a single duck press with a big flush animation. Low effort, high satisfaction, and it rewards glancing at the pet. (§5)
7. **The skull and repeat doses.** Sickness appears as a skull, the pet sits still and refuses things, and medicine takes 2-3 presses. Repeated pressing reads as effort. (§5)
8. **False calls and discipline.** The pet sometimes cries for nothing and refuses food until scolded. It gives the pet a will of its own. Connection added praise, so the ritual can be warm instead of only stern. (§3)
9. **A/B/C with C as home.** Cycle, confirm, cancel; C always gets you back to the idle pet. Three physical clicks, each with a beep. The Pix's touch pads show what happens when that feedback goes. (§6)
10. **Meal versus snack.** Two foods with opposite trade-offs: meals fill hunger, snacks buy happiness at the cost of weight and health. A choice a child understands in one try. (§5)
11. **The departure screen.** Ghost and grave, angel among stars, UFO, "returned to its home planet", a good-care pet laying a final egg, then A+C for a new egg and the final age on the memorial. Paradise's Tama Stars, where a long-lived past pet saves the next one once, are the best modern refinement. (§4, §9)
12. **Hatch from an egg after a short wait.** A pulsing egg, about five minutes, then a jingle and a baby that calls immediately. Digimon Color cut it to 8 seconds; the wait is part of the ritual. (§4)
13. **Evolution jingle and transformation.** A sound, a screen change, a new character. Bandai documents a jingle on every stage change. (§4, §7)
14. **Two devices touching.** Metal contacts for Digimon battles, prongs for Osutchi and Mesutchi, infrared for Connection, dock ports again on Paradise. The physical act of connecting is part of the memory. (§8)
15. **Steps and heartbeat as care (the modern addition worth keeping).** Pocket Pikachu's 20 steps per watt and the Vital Bracelet's heart-rate food turn the owner's own day into the pet's resource. This is the futuristic half of the brief. (§1, §10)

Lower on the list, deliberately left out: Wi-Fi social spaces (reviewers found them thin at launch and server shutdowns are a recorded risk, §10), and touch-only controls (§6).

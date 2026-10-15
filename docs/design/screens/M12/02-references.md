# M12 Hatch: references

Mobbin queries (iOS, 2026-10-08): flows "egg hatching reveal of a new pet companion after waiting"; screens "AI companion character revealed for the first time, standing full-screen and looking at the user, with one continue button". Hierarchy and pacing only, never pixels.

| Ref | Take | Reject |
|---|---|---|
| Finch "Hatching an egg" flow — https://mobbin.com/flows/4e10997a-d97d-4629-b26b-96d3e32ff4a3 | The beat count: cracked egg alone on screen, then the creature alone on screen, then one action. Three beats, nothing competing | Radial sunburst rays, confetti on the step before, "Woohoo!" copy, and the pet named for you before you meet it |
| Finch cracked egg — https://mobbin.com/screens/faf2358e-e734-4830-b339-d3c9f618a25d | The egg centred and still while the crack does the work; no UI on the screen during the crack | Cartoon zig-zag cracks on a flat egg; our crack is driven by `hatchProgress`, not two stamps |
| Finch hatched — https://mobbin.com/screens/76412348-e085-4d6e-9198-c1f6bd9c5a00 | Name + one line + one button after the reveal, button at the bottom | "hatched from the egg!" exclamation; the button "Meet Pumpkin!" names a pet the Caller has not named. We say "Name Squeaklet" and go to M09 |
| Tolan character reveal — https://mobbin.com/screens/c27de871-fd66-4bb3-afc2-13e93d66cb7c | The companion full-height, body turned to the viewer, eye contact as the hook | The upsell framing ("Unlock…", PLUS badge); no paywall near the hatch, ever |
| Abode pet, incubating → pet home — https://mobbin.com/screens/32967fba-5950-4b50-a68d-fdd6183d8d8c and https://mobbin.com/screens/3622fdb7-713f-48ed-aad1-8e4cf3b546b5 | The egg screen and the pet's home share one frame and background, so the hatch changes the occupant, not the place. That is our continuity transition into M13 | The pet appearing with meters already on screen; M13's rings fade in after the hatch, not during it |

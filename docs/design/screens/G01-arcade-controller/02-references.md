# G01 Arcade controller overlay: references

Mobbin queries (iOS, 2026-10-15): "on-screen game controller settings with virtual joystick size, opacity and position customization"; "game controller companion app showing gamepad button mapping"; "in-game screen with virtual joystick on the left and action buttons cluster on the right"; "paused game overlay with resume and quit buttons". Full audit with strengths and weaknesses: `docs/design/research/arcade-controller-mobbin.md`. Physical cabinet geometry: `docs/design/research/arcade-ergonomics.md`. References inform hierarchy, states and feel, never pixels.

| Ref | Take | Reject |
|---|---|---|
| SmartThings remote ring — https://mobbin.com/screens/6b67cece-f35e-460b-a6d9-dfef313f46db | A recessed dark well, a lighter rim, an inset pad; the pressed cap turns white, a value change not a glow | Centred, two-handed size; a game stick sits under one thumb |
| Google TV swipe / D-pad modes — https://mobbin.com/screens/7088a28e-ebad-46ed-9caa-ef55e6054924 | One surface, two input modes, the control redraws to match | The mode buried in an overflow menu |
| Xbox companion — https://mobbin.com/screens/f29dc23d-69a0-4f4f-8914-fc4f6e2a4806 | No fake gamepad art; letters identify buttons | Colour-plus-letter as the only cue; no visible target size or pressed state |
| Roku remote — https://mobbin.com/screens/a770c85a-4929-4906-92d5-a79390d3c182 | One tooltip, one control, everything else dimmed | Fourteen same-shaped keys; nothing says which matter in play |
| Google Arts & Culture game D-pad — https://mobbin.com/screens/b5b37ed7-9bfd-4f8a-a2ac-a12084d7491a | HUD stays at the top; the control is the one bright object | Bottom-centre placement (a two-thumb dead zone); control over content with no scrim |
| Runna "Hold to Finish" — https://mobbin.com/screens/db8ce392-a5fa-4b82-a894-30b637f4a11e | The terminal action is a hold and its label says so | A flat full-width paused band; no hold progress shown |
| Oura pause sheet — https://mobbin.com/screens/a9a0536b-e933-41d5-9215-05c9ead0b4fb | The timer dims while paused; safe and terminal actions differ in shape | A filled coral destructive button beside Resume |
| Peloton Strength+ paused — https://mobbin.com/screens/c52d049e-9b0d-4bd4-a8f1-bf715f44cfec | Resume large and bright, End small and dark, both labelled | A generic card over the scene; the controls leave the thumbs |

Cabinet sources (full numbers in `arcade-ergonomics.md`): slagcoin layout page https://www.slagcoin.com/joystick/layout.html (36 mm pitch, 39 mm rows, 59 mm stick offset, the Sega and Vewlix descriptions); JasensCustoms FightStickLayoutProject https://github.com/JasensCustoms/FightStickLayoutProject (per-hole mm centres traced from slagcoin); Sanwa OBSF-30 https://www.sanwa-d.shop/shopdetail/000000000109/ (φ30 ± 0.1 hole); Hoober 2013 https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php (49% one-handed, 67% right thumb; reach drawings retracted by the author).

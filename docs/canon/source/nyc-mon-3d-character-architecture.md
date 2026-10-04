# NYC‑Mon 3D Character Architecture

## Overview

For **NYC‑Mon**, the MetaHuman DNA / OpenRigLogic idea is especially useful, but the system should be **species-agnostic**.

NYC‑Mon needs to support:

- Humanoids
- Rats and other rodents
- Hawks / avian Mons
- Quadrupeds
- Serpentine creatures
- Monsters with unusual anatomy
- Eggs
- Baby forms
- Multiple evolution stages

The architecture should therefore define a **semantic creature/body model** rather than assuming a human skeleton.

---

# Core Architecture

```text
NYC-Mon DNA
    │
    ├── Identity
    ├── Anatomy
    ├── Rig Definition
    ├── Face / Speech
    ├── Hands / Paws / Wings / Claws
    ├── Deformation
    ├── Materials / Fur / Feathers / Goo
    ├── Abilities
    ├── Evolution Forms
    └── Runtime Behavior
             │
             ▼
       MonRigLogic @ 60fps
```

The key difference from MetaHuman is that **MonDNA cannot assume a humanoid skeleton**.

---

# MonDNA

`MonDNA` is the persistent physical definition of an NYC‑Mon.

```ts
type MonDNA = {
  identity: MonIdentity

  anatomy: {
    topology:
      | "humanoid"
      | "quadruped"
      | "avian"
      | "serpentine"
      | "custom"

    limbs: LimbDefinition[]

    wings?: WingDefinition[]
    tail?: TailDefinition

    jaw?: JawDefinition
    tongue?: TongueDefinition

    horns?: AppendageDefinition[]
  }

  rig: MonRigDefinition

  face?: MonFaceDefinition

  locomotion: {
    walk?: LocomotionProfile
    run?: LocomotionProfile
    crawl?: LocomotionProfile
    fly?: LocomotionProfile
    swim?: LocomotionProfile
  }

  interaction: {
    grasp?: GraspDefinition
    bite?: BiteDefinition
    carry?: CarryDefinition
    throw?: ThrowDefinition
    catch?: CatchDefinition
  }

  evolution: EvolutionDefinition[]

  materials: MaterialStateDefinition[]

  abilities: AbilityDefinition[]
}
```

---

# Semantic Mon Rig

Every NYC‑Mon should map its native Blender / Meshy / custom rig into a shared semantic vocabulary.

```text
MON SEMANTIC RIG

root

body
├── pelvis
├── spine
├── chest
├── neck
├── head
│   ├── jaw
│   ├── eyes
│   ├── ears
│   └── face
│
├── limb.front.left
├── limb.front.right
├── limb.rear.left
├── limb.rear.right
│
├── tail.*
├── wing.left.*
├── wing.right.*
└── digits.*
```

The semantic rig describes **what a body part does**, not what an artist happened to name the bone.

---

# Humanoid Mapping

A humanoid Mon can map the semantic limbs like this:

```text
limb.front.left  → leftArm
limb.front.right → rightArm
limb.rear.left   → leftLeg
limb.rear.right  → rightLeg
```

---

# Avian Mapping

A hawk-like Mon could expose:

```text
wing.left
wing.right

leg.left
leg.right

talons.left.*
talons.right.*

beak

tailFeathers.*
```

Custom creatures can extend the semantic channels without breaking the common runtime.

---

# MonRigLogic

`MonRigLogic` is the NYC‑Mon equivalent of **OpenRigLogic**.

Gameplay and AI systems should not directly manipulate arbitrary bones.

Instead, they issue high-level performance commands.

```ts
mon.perform({
  action: "threaten",
  target: enemy,

  emotion: {
    aggression: 0.75,
    confidence: 0.9
  },

  gaze: enemy,

  body: {
    stance: "combat"
  }
})
```

`MonRigLogic` then resolves that intent into anatomy-specific performance.

```text
eyes      → opponent
head      → slight downward tilt
ears      → rearward
jaw       → partially open
shoulders → raised
spine     → forward
claws     → spread
tail      → aggressive motion
voice     → growl layer
```

The same command can produce radically different animation depending on the Mon.

This prevents characters such as Ratti from feeling like **reskinned humanoids**.

---

# Google GNM Integration

Google GNM should be treated as an optional **high-fidelity head / facial representation**, not as the required topology for every Mon.

```text
                  MonDNA

          ┌─────────┼──────────┐
          │         │          │
          ▼         ▼          ▼
       GNM Head   Mon Body    Appendages
       optional      │       tail/wings/etc.
          │          │          │
          └──────────┼──────────┘
                     ▼
                MonRigLogic
```

Humanoid Mons can potentially use richer GNM-driven facial performance.

Non-human creatures can implement the same semantic expressions using their own anatomy.

---

# Semantic Facial Controls

For example:

```text
lookLeft
lookRight

blink
squint

snarl
smile

jawOpen
lipRaise
noseWrinkle

earForward
earBack
```

The gameplay layer should address these semantic controls instead of raw blendshape indices.

---

# Cross-Species Emotion

The same emotional intent should translate differently for each species.

```text
semantic expression
        ↓

"annoyed"

        ↓
```

### Ratti

```text
eyes.squint       .45
ear.left.back     .65
ear.right.back    .65
nose.wrinkle      .30
jaw.open          .12
```

### Humanoid Vampire

```text
GNM brow values
GNM eyelid values
GNM mouth values

head tilt
gaze adjustment
```

Same emotion.

Different anatomy.

---

# Evolution as Part of MonDNA

Evolution should not be implemented as swapping to a totally unrelated game asset.

An evolved Mon should remain the **same persistent entity**.

```text
Ratti DNA

Species: Ratti

Forms
├── Egg
├── Baby
├── Form I
├── Form II
├── Form III
└── Apex
```

Each transition can contain anatomical mappings.

```ts
type EvolutionDefinition = {
  from: FormID
  to: FormID

  skeletonMapping: BoneMap

  anatomicalChanges: AnatomyMutation[]

  retainedTraits: TraitID[]

  gainedTraits: TraitID[]

  transitionAnimation: EvolutionSequence
}
```

---

# State Preserved Through Evolution

These should remain attached to the Mon:

```text
personality
voice identity
memories
relationship with Caller

damage
status effects

learned abilities
favorite foods
behavior traits
```

Physical properties can change:

```text
mesh
skeleton proportions

fur
feathers
horns
wings

voice processing

abilities

movement style

face

size
```

The Mon evolves physically while remaining the same individual.

---

# Egg as Form 0

The egg should not be treated as a menu animation.

It should be **Form 0 of the Mon**.

```text
Mon Entity
│
├── Egg
│    ├── shell state
│    ├── movement
│    ├── internal creature motion
│    ├── cracks
│    ├── goo
│    └── hatch progression
│
├── Baby
│
└── Evolutions...
```

This allows the incubation timer to control a real creature state.

For example:

```text
incubating
   ↓
movement inside shell
   ↓
shell pulse
   ↓
first crack
   ↓
multiple cracks
   ↓
goo leak
   ↓
shell separates
   ↓
Mon struggles out
   ↓
first breath
   ↓
looks for Caller
```

Avoid:

```text
egg disappears
→ baby model appears
```

The hatch should be a real physical sequence.

---

# Interaction Effectors

NYC‑Mons need to:

- Eat
- Run
- Talk
- Hold objects
- Throw objects
- Catch objects
- Move objects
- Point
- Move fingers
- Use paws
- Use talons
- Bite
- Carry things
- Use tails or wings when appropriate

`MonDNA` should therefore expose **effectors**.

```text
effectors
├── mouth
├── leftHand
├── rightHand
├── leftFoot
├── rightFoot
├── tailTip
├── leftWing
├── rightWing
└── custom
```

The game can issue a generic interaction:

```ts
mon.interact({
  verb: "pickUp",
  object: pizzaSlice
})
```

The runtime resolves the appropriate effector.

```text
Humanoid → right hand

Ratti → front paws
      → or mouth

Hawk → talons

Serpent → mouth
        → or tail
```

The gameplay API stays the same while anatomy determines execution.

---

# Runtime Stack

The proposed NYC‑Mon character stack:

```text
MonDNA
Persistent creature / anatomy definition


MonRigDefinition
Semantic body vocabulary


MonRigLogic
60fps runtime deformation + motion evaluator


MonPerformance
Transient behavioral / animation state


MonRetarget
Foreign rig → Mon semantic rig mapping


MonEvolution
Cross-form anatomy + transition system


MonBehavior
AI / gameplay intent → performance commands
```

---

# Asset Pipeline

```text
Meshy
   │
Custom Sculpt
   │
Blender
   │
   ▼
auto-rig
   │
   ▼
MonRetarget
   │
   ▼
MonDNA
   │
   ▼
MonRigLogic @ 60fps
   │
   ├──────────────┬───────────────┐
   ▼              ▼               ▼

 Web            Mobile            XR

Three.js        React Native      Quest
                                Pico
                                Vision Pro
```

---

# Mon Mind vs Mon Body

The Mon's AI/personality state should stay separate from its physical character definition.

```text
Mon Mind                      Mon Body
────────                      ────────

memories                      skeleton

Caller relationship           mesh

personality                    face

needs                          fur

hunger                         feathers

mood                           animation

learned behaviors              physics

conversation                   abilities

                               evolution forms

        │                         │
        └──────── MonPerformance ─┘
```

`MonPerformance` is the bridge between **what the Mon thinks / intends** and **what the player sees and hears**.

---

# Example: Caller Recognition

Suppose someone other than the bonded Caller gives Ratti an order.

The mind layer determines:

```text
speaker = familiar person

speaker != Caller

authorization = denied

attitude = annoyed
```

The behavior layer can generate:

```text
"You ain't my Callah.
I'm not listening to you."
```

And `MonPerformance` can simultaneously produce:

```text
eyes → speaker

ears → back

head → slight turn away

body → closed posture

tail → irritated motion

voice → dismissive prosody
```

If the actual Caller speaks immediately afterward:

```text
Caller recognized
      ↓
attention changes
      ↓
ears forward
      ↓
body turns
      ↓
eye contact
      ↓
command accepted
```

Voice AI and physical animation therefore become one coherent character system rather than two disconnected systems.

---

# Design Principle

The main architectural rule is:

> **Gameplay and AI should describe intent. MonRigLogic should decide how each anatomy performs that intent.**

Do not build NYC‑Mon around hundreds of hard-coded calls such as:

```ts
playAnimation("ratti_point_left_03.fbx")
```

Prefer:

```ts
mon.perform({
  gesture: "point",
  target: object,
  urgency: 0.6
})
```

The runtime then uses:

- MonDNA
- MonRigDefinition
- Current evolution form
- Anatomy
- Available effectors
- Procedural animation
- Existing animation clips
- IK
- Facial controls
- Gaze
- Voice timing

to construct the final performance.

---

# Long-Term Goal

The resulting system should allow a new creature to enter the NYC‑Mon ecosystem like this:

```text
NEW 3D MODEL
    ↓
Rig / Auto-rig
    ↓
Map anatomy once
    ↓
Generate MonDNA
    ↓
NYC-Mon runtime understands it
```

After mapping, the creature can inherit common capabilities such as:

```text
walk
run
look
listen
talk
blink

eat
grab
hold
throw
catch

fight
react
sleep
wake

express emotion

interact with Caller

hatch

evolve
```

without implementing an entirely separate character engine for every species.

---

# Proposed Package Layout

```text
packages/
└── mon-runtime/
    ├── dna/
    │   ├── MonDNA.ts
    │   ├── anatomy.ts
    │   ├── evolution.ts
    │   └── materials.ts
    │
    ├── rig/
    │   ├── MonRigDefinition.ts
    │   ├── MonRigLogic.ts
    │   ├── semantic-bones.ts
    │   └── effectors.ts
    │
    ├── retarget/
    │   ├── MonRetarget.ts
    │   ├── meshy.ts
    │   ├── blender.ts
    │   ├── gnm.ts
    │   └── metahuman.ts
    │
    ├── performance/
    │   ├── MonPerformance.ts
    │   ├── emotion.ts
    │   ├── gaze.ts
    │   ├── interaction.ts
    │   └── locomotion.ts
    │
    ├── evolution/
    │   ├── MonEvolution.ts
    │   ├── morph.ts
    │   └── transitions.ts
    │
    └── behavior/
        ├── MonBehavior.ts
        ├── caller.ts
        ├── needs.ts
        └── intent.ts
```

---

# Summary

NYC‑Mon should use the architectural ideas behind **MetaHuman DNA + OpenRigLogic**, but generalize them into a creature system.

The proposed stack is:

```text
MonDNA
      +
MonRigDefinition
      +
MonRigLogic
      +
MonPerformance
      +
MonRetarget
      +
MonEvolution
      +
MonBehavior
```

This gives NYC‑Mon one common runtime for humanoids, animals, monsters, eggs, babies, and evolved forms while still allowing every species to move and express itself according to its own anatomy.

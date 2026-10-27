// Import first in a test that pins the classic (pre-Slop) look: the physical
// and future flags default on, so a classic-path test turns them off before
// any world module reads them. Static imports run in order.
process.env.EXPO_PUBLIC_WORLD_PHYSICAL = '0';
process.env.EXPO_PUBLIC_WORLD_FUTURE = '0';

# Squeaklet Specs — food models

Three original procedural polygon meshes, with a shared Wavefront material library:

| Food | Model | Material | Lens registry ID |
| --- | --- | --- | --- |
| Apple | apple.obj | apple_red | food/apple |
| Orange | orange.obj | orange_peel | food/orange |
| Grapes | grapes.obj | grape_purple | food/grapes |

Import each OBJ together with fruit.mtl into Lens Studio, convert to a Lens ObjectPrefab, and register the ID shown above in ViroSpecsAssetRegistry. The assets are source meshes, **not** pre-imported Lens prefabs. Dimensions are approximate scene units, centered near the origin; scale and collision volumes must be tuned in Lens Studio.

## Feeding interaction target (not yet implemented)

1. Show the three foods on a floating tray near Squeaklet.
2. Grab a fruit with hand tracking; move it as a 3D object, not as a UI button.
3. On release inside a calibrated mouth trigger volume, call the authenticated feed_mon tool exactly once.
4. Only after a successful care response, play Squeaklet's jaw_chomp clip, animate the fruit bite/disappearance, and update the server-authoritative Fullness meter.
5. If the food misses, is dropped, or the request fails, do not modify Fullness or consume the model.

The native hand grab, mouth collision, rig animation, and on-device verification remain pending.

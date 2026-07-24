# Hand-Painting for Three.js — presentation copy

This file is an editing draft only. It is not imported by the website yet, so you can rewrite the text freely without affecting scene timing or layout.

## Intro

**Title**  
Hand-Painting for Three.js

**Subtitle**  
A production texturing pipeline

**Credit**  
by edclub

**Duck speech**  
Quack!

**Scroll cue**  
Scroll

## 01 · Model Preparation

Create balanced geometry with clean topology for good UV unwrapping. Remove hidden polygons.

## 02 · Apply Gradient Palette

Place each part of the model on a shared gradient palette. Geometry and colors remain editable before anything is baked.

### Hint — Position UVs

Move each model part onto the required gradient color.

## 03 · Test in the scene

Check the asset inside the scene next to the other objects. Review its scale, silhouette and palette balance.

### Scale feedback

- Wrong scale
- Correct scale

## 04 · Baking

Create seams on the model, UV-unwrap it, and bake the gradient colors on the new texture.

### Hint — Create seams

Make cuts to form simple-shaped islands.

### Hint — Bake

Transfer the gradient colors into the baked texture.

## 05 · Hand painting

The baked texture becomes the main working file. The artist repaints it in Photoshop.

### Hint — Moving to Photoshop

Or use any comfortable software for painting.

## 06 · Test in the scene

We prepare the interface for the artist, so it is easy to drag and drop textures directly in the scene without any code interactions. Such testing avoids any color mismatch.

### Texture panel

- Texture
- Paint · Base
- Paint · Pastel
- Paint · Red
- Paint · Aberration
- …or drop any PNG on the page

## 07 · Textures Optimization

Avoid having too many separated textures. Combine multiple textures into one square texture, then compress it to KTX2.

### Hint — Combine the textures

Merge four square sheets into one square atlas.

### Hint — Compress the atlas

Keep one square texture and prepare it for GPU delivery.

### Format label

KTX2

## 08 · Batched mesh

Reuse the batch color attribute as compact per-instance data. The red channel identifies each geometry and retrieves its UV transform from the atlas.

### Hint — Match geometry to atlas

Use each geometry ID to retrieve its UV scale and offset from the atlas.

### Hint — Reserve G, B and A

Use the remaining channels for more textures, animation, state or interaction.

### Hint — One draw call

Display multiple geometries and materials with one draw call.

### Object data labels

- Barrel — R0, G–, B–, A–
- Duck — R1, G–, B–, A–
- Book — R2, G–, B–, A–
- Meat — R3, G–, B–, A–

### Performance monitor

- Perf monitor
- Draw call
- Triangles
- FPS

## Final

**Title**  
edclub was here

**Subtitle**  
Hand-Painting for Three.js

**Duck speech**  
Quack!

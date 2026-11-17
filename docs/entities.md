# Entity, World, NPC

## World

`app.world` is the root of everything in a level.

| Method | Description |
|---|---|
| `setStatic(root, colliders?, surface?)` | Attaches a static world that the game has already built |
| `add(entity)` | Adds an entity; computes its `Box3` automatically if `autoCollider` |
| `remove(entity)` | Removes it from the scene and from the colliders |
| `query(tag?)` | Filters living entities by tag |
| `update(dt, ctx)` | Calls `updateStatic`, then `entity.update` |
| `surfaceAt(x, z)` | Queries the surface at a point |
| `colliders` | Array of `Box3` shared by the player and NPCs |
| `entities` | Array of `Entity` |

## Entity

```js
new Entity({ mesh, tags: ['prop'], autoCollider: true, collider: null, data: { hp: 100 } })
```

| Property | Description |
|---|---|
| `mesh` | `Object3D` |
| `tags` | `Set<string>`: `entity.has('prop')` |
| `collider` | `Box3` (computed automatically if `autoCollider`) |
| `data` | Any gameplay data |
| `alive` | `false` after `dispose()` |
| `update(dt, ctx)` | Override when needed |

## Prefab

```js
import { box, cylinder, decor, material } from 'risejs-core';

app.add(box({ size: [4, 3, 4], position: [0, 1.5, -10], color: 0x555c64, tags: ['cover'] }));
app.add(cylinder({ radius: 0.6, height: 2, position: [6, 1, -4], color: 0x6b3a22 }));
app.add(decor(new THREE.Mesh(geo, mat), { tags: ['fx'] }));   // no collider, no shadow
```

`material(color, { roughness, metalness, emissive, emissiveIntensity })` is cached. Reuse
materials between entities of the same color.

## Collider

- A box is computed from `Box3().setFromObject(mesh)` **after** the mesh has world coordinates.
- An object rotated 45° still uses an AABB (slightly oversized). This is enough for boxes; there is no OBB yet.
- For a manual collider: `new Entity({ mesh, autoCollider: false, collider: new THREE.Box3(min, max) })`.

## NPC

NPCs come from the `npc` pack:

```js
import { npcPlugin } from 'risejs-core/packs/npc';

app.use(npcPlugin);
const npc = app.spawnNpc({
  path: [[8, 0, 2], [26, 0, 2], [26, 0, 12]],  // patrol points
  speed: 1.5,
  pause: 1.6,        // pause at each point (seconds)
  color: 0x2f4b6b,
  name: 'patrol-street',
});

npc.mesh.position;      // position
app.world.remove(npc);  // remove
```

An NPC uses `Character` (a procedural humanoid body) and animates itself from its speed. By default it has **no**
collider, so it does not block the player. To make it block, add a collider to `world.colliders` by hand.

## Example: an openable door

```js
const door = box({ size: [2, 2.4, 0.2], position: [0, 1.2, -6], color: 0x7a4a2a, tags: ['door'] });
app.add(door);

app.events.on('interact', () => {
  door.mesh.rotation.y += Math.PI / 2;   // rotate
  door.collider.setFromObject(door.mesh); // update the collision
});
```

Because the collider is the entity's data, after rotating or moving you only need to update the `Box3` again.

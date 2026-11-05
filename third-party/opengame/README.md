# OpenGame attribution

This project includes code adapted from https://github.com/leigest519/OpenGame
(Apache-2.0, see LICENSE in this directory).
Source revision: `c9bea37786af524bf3bbe802f2b67d23816fa5c0`.

Copied sources:
- `agent-test/templates/modules/platformer/src/behaviors/IBehavior.ts`
- `agent-test/templates/modules/platformer/src/behaviors/PlatformerMovement.ts`

Local destination: `web/src/experiments/dino-rescue/opengame/`.

Changes to PlatformerMovement: type-only Phaser import; prevent repeated grounded
jumps between physics ticks; initialise and clear jump timestamps safely;
ground checks include moving platforms; reset all transient jump state on retry.

The preloading lifecycle and design-first/template-capability workflow are
informed by OpenGame's core template and GDD documents. The React shell, rescue
scene, three levels, contract, API and tests were written for this project.
No demo game art, film characters or model weights were copied.

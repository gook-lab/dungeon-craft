#!/usr/bin/env node
/**
 * Empire region map v3 migration script
 * Applies ground id remapping for empire maps: 0→8, 1→1, 2→8, 3→3, 4→9
 */

const fs = require('fs');
const path = require('path');

const REMAP = {
  empire: { 0: 8, 1: 1, 2: 8, 3: 3, 4: 9 },
};

function remapGround(ground, mapType = 'empire') {
  const map = REMAP[mapType] || {};
  return ground.map(id => map[id] !== undefined ? map[id] : id);
}

function migrateEmpireMap(exportPath, targetPath, mapType = 'empire') {
  try {
    const exportModule = require(path.resolve(exportPath));
    const current = require(path.resolve(targetPath)).default;

    console.log(`Migrating: ${exportPath}`);

    // Remap ground ids
    const remappedGround = remapGround(exportModule.ground, mapType);

    console.log(`  - Remapped ground: ${exportModule.ground.length} cells`);
    console.log(`  - Collision: ${exportModule.collision.length} cells`);

    // Template for target file
    const result = {
      ...current,
      ...exportModule,
      ground: remappedGround,
    };

    return result;
  } catch (e) {
    console.error(`ERROR: ${exportPath} - ${e.message}`);
    return null;
  }
}

// Quick test
console.log('🔧 Empire map migration helper ready');
console.log('Usage: Call remapGround(array, "empire") to remap ground ids');
console.log('Remap: 0→8, 1→1, 2→8, 3→3, 4→9');

module.exports = { remapGround, migrateEmpireMap, REMAP };

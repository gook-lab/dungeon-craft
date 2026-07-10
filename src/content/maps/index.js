import town from './town.js';
import wild from './wild.js';
import darkforest from './darkforest.js';
import dungeon from './dungeon.js';
import frost from './frost.js';
import swamp from './swamp.js';
import empire_gate from './empire/empire_gate.js';
import empire_camp from './empire/empire_camp.js';
import empire_city from './empire/empire_city.js';
import empire_throne from './empire/empire_throne.js';
import empire_bridge from './empire/empire_bridge.js';
import ruins_below from './ruins_below.js';
import starfall from './starfall.js';
import starfall_crater from './starfall_crater.js';
import lava_gate from './lava/lava_gate.js';
import lava_core from './lava/lava_core.js';
import void_gate from './void/void_gate.js';
import void_core from './void/void_core.js';

export const MAPS = { town, wild, darkforest, dungeon, frost, swamp, empire_gate, empire_camp, empire_city, empire_throne, empire_bridge, ruins_below, starfall, starfall_crater, lava_gate, lava_core, void_gate, void_core };
export function getMap(id) { return MAPS[id] || null; }

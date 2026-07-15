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
import lake_town from './lake_town.js';
import waterway from './waterway.js';
import switchback from './switchback.js';
import overworld from './overworld.js';
import port_city from './port_city.js';
import grand_citadel from './grand_citadel.js';
import lava_keep from './lava_keep.js';
import wild_cave from './wild_cave.js';

export const MAPS = { town, wild, wild_cave, darkforest, dungeon, frost, swamp, empire_gate, empire_camp, empire_city, empire_throne, empire_bridge, ruins_below, starfall, starfall_crater, lava_gate, lava_core, void_gate, void_core, lake_town, waterway, switchback, overworld, port_city, grand_citadel, lava_keep };
export function getMap(id) { return MAPS[id] || null; }

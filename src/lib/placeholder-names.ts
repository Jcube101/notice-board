/**
 * Generates friendly placeholder display names for anonymous authors, e.g.
 * "Brave Otter". Used when a note is created without an explicit `author_name`.
 */

const ADJECTIVES = [
  'Brave',
  'Curious',
  'Witty',
  'Gentle',
  'Bold',
  'Cosmic',
  'Mellow',
  'Nimble',
  'Quirky',
  'Sunny',
  'Clever',
  'Jolly',
  'Plucky',
  'Swift',
  'Dapper',
  'Wise',
  'Zesty',
  'Breezy',
  'Fuzzy',
  'Lucky',
  'Spry',
  'Snazzy',
  'Cheerful',
  'Radiant',
] as const;

const ANIMALS = [
  'Otter',
  'Fox',
  'Panda',
  'Heron',
  'Lynx',
  'Badger',
  'Falcon',
  'Koala',
  'Marmot',
  'Octopus',
  'Penguin',
  'Raccoon',
  'Sparrow',
  'Tapir',
  'Walrus',
  'Yak',
  'Gecko',
  'Hedgehog',
  'Ibex',
  'Newt',
  'Quokka',
  'Wombat',
  'Pangolin',
  'Capybara',
] as const;

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Return a random "Adjective Animal" name. With {@link ADJECTIVES} and
 * {@link ANIMALS} each ≥ 20 long, there are 500+ combinations.
 */
export function generatePlaceholderName(): string {
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
}

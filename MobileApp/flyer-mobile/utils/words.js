// Word bank — same 100 words as the web version.
// 50 that fly, 50 that don't.

const FLY = [
  'Bird', 'Crow', 'Sparrow', 'Pigeon', 'Parrot', 'Eagle', 'Owl', 'Hawk',
  'Falcon', 'Vulture', 'Seagull', 'Swan', 'Duck', 'Stork', 'Flamingo',
  'Woodpecker', 'Kingfisher', 'Hummingbird', 'Cuckoo', 'Dove', 'Pelican',
  'Robin', 'Magpie', 'Goose', 'Heron',
  'Butterfly', 'Bee', 'Bumblebee', 'Wasp', 'Hornet', 'Mosquito', 'Housefly',
  'Moth', 'Dragonfly', 'Firefly', 'Bat',
  'Airplane', 'Helicopter', 'Jet', 'Rocket', 'Drone', 'Hot Air Balloon',
  'Spaceship', 'UFO', 'Glider', 'Kite', 'Balloon',
  'Fairy', 'Dragon', 'Angel',
];

const GROUND = [
  'Elephant', 'Lion', 'Tiger', 'Cow', 'Dog', 'Cat', 'Horse', 'Goat',
  'Sheep', 'Buffalo', 'Monkey', 'Donkey', 'Pig', 'Rabbit', 'Deer', 'Bear',
  'Fox', 'Wolf', 'Camel', 'Giraffe', 'Zebra', 'Hippo', 'Rhino', 'Kangaroo',
  'Squirrel',
  'Snake', 'Crocodile', 'Tortoise', 'Fish', 'Frog', 'Lizard', 'Earthworm',
  'Rat', 'Snail', 'Crab',
  'Car', 'Bus', 'Truck', 'Train', 'Bicycle', 'Boat', 'Tractor',
  'Table', 'Chair', 'House', 'Tree', 'Stone', 'Book', 'Shoe', 'Fridge',
];

export const WORDS = [
  ...FLY.map((text) => ({ text, flies: true })),
  ...GROUND.map((text) => ({ text, flies: false })),
];

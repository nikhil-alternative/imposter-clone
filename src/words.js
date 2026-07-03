export const categories = {
  Animals: [
    'Elephant', 'Giraffe', 'Penguin', 'Dolphin', 'Kangaroo',
    'Octopus', 'Flamingo', 'Cheetah', 'Panda', 'Chameleon',
    'Peacock', 'Hamster', 'Jaguar', 'Koala', 'Lobster',
    'Chimpanzee', 'Walrus', 'Parrot', 'Scorpion', 'Toucan',
    'Hedgehog', 'Platypus', 'Raccoon', 'Seahorse', 'Sloth',
    'Meerkat', 'Narwhal', 'Otter', 'Puffin', 'Armadillo'
  ],
  'Food & Drink': [
    'Pizza', 'Sushi', 'Tacos', 'Pasta', 'Burger',
    'Croissant', 'Paella', 'Ramen', 'Dim Sum', 'Falafel',
    'Brownie', 'Mango', 'Avocado', 'Bacon', 'Cinnamon',
    'Wasabi', 'Saffron', 'Kimchi', 'Mozzarella', 'Gumbo',
    'Churro', 'Baguette', 'Cannoli', 'Hummus', 'Matcha',
    'Lasagna', 'Bagel', 'Kebab', 'Cupcake', 'Pancake'
  ],
  Countries: [
    'Japan', 'Brazil', 'Iceland', 'Egypt', 'Thailand',
    'Peru', 'Norway', 'Kenya', 'Cuba', 'Nepal',
    'Vietnam', 'Greece', 'Morocco', 'Chile', 'Finland',
    'Indonesia', 'Jamaica', 'Madagascar', 'Mongolia', 'Portugal',
    'Scotland', 'Sri Lanka', 'Tanzania', 'Uruguay', 'Cambodia',
    'Ethiopia', 'Hungary', 'Ireland', 'Myanmar', 'Sweden'
  ],
  Movies: [
    'Titanic', 'Avatar', 'Jaws', 'Frozen', 'Gladiator',
    'Inception', 'Casablanca', 'Rocky', 'Alien', 'Braveheart',
    'Amelie', 'Vertigo', 'Jumanji', 'Ratatouille', 'Shrek',
    'Memento', 'Coco', 'Fargo', 'Scream', 'Twister',
    'Bambi', 'Gremlins', 'Chocolat', 'Babe', 'Signs',
    'Prestige', 'Crash', 'Slumdog', 'Up', 'WALL-E'
  ],
  Sports: [
    'Soccer', 'Basketball', 'Tennis', 'Boxing', 'Surfing',
    'Cricket', 'Fencing', 'Curling', 'Karate', 'Rugby',
    'Badminton', 'Skiing', 'Volleyball', 'Archery', 'Cycling',
    'Snooker', 'Judo', 'Lacrosse', 'Rowing', 'Dodgeball',
    'Triathlon', 'Polo', 'Bowling', 'Parkour', 'Snowboarding',
    'Taekwondo', 'Handball', 'Mountain', 'Kayaking', 'Bouldering'
  ],
  Hobbies: [
    'Gardening', 'Knitting', 'Origami', 'Calligraphy', 'Pottery',
    'Geocaching', 'Scrapbook', 'Birdwatch', 'Astronomy', 'Woodwork',
    'Sudoku', 'Chess', 'Photography', 'Baking', 'Camping',
    'Fishing', 'Yoga', 'Brewing', 'Sewing', 'Drawing',
    'Meditation', 'Tattoo', 'Magic', 'Karaoke', 'Collecting',
    'Hiking', 'Painting', 'Dancing', 'Running', 'Reading'
  ],
  Objects: [
    'Umbrella', 'Lantern', 'Compass', 'Binoculars', 'Hammock',
    'Backpack', 'Candle', 'Funnel', 'Telescope', 'Whistle',
    'Thermos', 'Magnifying', 'Suitcase', 'Barometer', 'Harmonica',
    'Pendulum', 'Trowel', 'Tweezers', 'Spigot', 'Flippers',
    'Mannequin', 'Stethoscope', 'Treadmill', 'Metronome', 'Papyrus',
    'Megaphone', 'Pegboard', 'Pipette', 'Spatula', 'Tongs'
  ],
  Nature: [
    'Waterfall', 'Volcano', 'Glacier', 'Rainbow', 'Thunder',
    'Mushroom', 'Coral', 'Fossil', 'Lagoon', 'Blizzard',
    'Meadow', 'Monsoon', 'Tornado', 'Canyon', 'Eclipse',
    'Geyser', 'Oasis', 'Aurora', 'Savanna', 'Typhoon',
    'Mangrove', 'Tundra', 'Magma', 'Dewdrop', 'Summit',
    'Cactus', 'Taiga', 'Delta', 'Grove', 'Prairie'
  ],
  'Famous People': [
    'Einstein', 'Mozart', 'Cleopatra', 'Picasso', 'Shakespeare',
    'Da Vinci', 'Napoleon', 'Frida', 'Tesla', 'Gandhi',
    'Buddha', 'Nefertiti', 'Marco Polo', 'Caesar', 'Newton',
    'Darwin', 'Amelia', 'Gutenberg', 'Tutankhamun', 'Socrates'
  ]
}

export function getRandomWord(category) {
  const list = category === 'mixed'
    ? Object.values(categories).flat()
    : categories[category] || Object.values(categories).flat()
  return list[Math.floor(Math.random() * list.length)]
}

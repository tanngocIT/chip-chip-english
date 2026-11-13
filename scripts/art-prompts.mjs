// Writes art-inbox/PROMPTS.md: one prompt per sheet of nine pictures, for an image model.
// The owner pastes each prompt, saves the picture under the file name given, and
// scripts/cut-art.py cuts it up. Usage: node scripts/art-prompts.mjs
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('src/data/words.json', 'utf8'));

// Topics drawn anew, worst first. Colours, numbers, shapes, feelings and letters keep their pictures.
const TOPICS = ['food', 'animals', 'fruits', 'nature', 'toys'];
// Topics full of green things are drawn on magenta, so the cutter never mistakes them for background.
const MAGENTA = new Set(['animals', 'fruits', 'nature']);
// Already drawn on the first trial sheet.
const DONE = new Set(data.words.filter((w) => w.art).map((w) => w.id));

/** What to draw when the word alone is not enough, or when two words of a topic look alike. */
const HINT = {
  // people (head and shoulders, like the first sheet)
  teacher: 'teacher: woman with glasses and a bun, holding a book, small dark chalkboard behind her',
  'police officer': 'police officer: blue uniform, blue police cap with a gold badge',
  firefighter: 'firefighter: red helmet, red and yellow jacket',
  farmer: 'farmer: straw hat, green overalls, holding a carrot',
  cook: 'cook: tall white chef hat, white jacket, holding a wooden spoon',
  pilot: 'pilot: dark navy uniform, pilot cap with golden wings',
  astronaut: 'astronaut: white space suit with a round glass helmet',
  artist: 'artist: black beret, holding a paint palette and a brush',
  singer: 'singer: holding a microphone to the mouth, mouth open, music notes beside',
  student: 'student: child with a backpack, holding a pencil',
  builder: 'builder: yellow hard hat, orange safety vest, holding a hammer',
  mechanic: 'mechanic: blue cap, blue overalls, holding a wrench',
  prince: 'prince: young boy with a small gold crown, blue royal jacket',
  princess: 'princess: young girl with a tiara, long hair, pink dress',
  superhero: 'superhero: red mask over the eyes, red cape, fist up',
  // vehicles
  car: 'car: small red family car, side view',
  taxi: 'taxi: yellow car with a black checker stripe and a TAXI roof light (no letters)',
  'police car': 'police car: black and white car with blue and red lights on the roof',
  'race car': 'race car: low red racing car with big wheels and a rear wing',
  bus: 'bus: long yellow school bus, side view',
  van: 'van: white delivery van with no side windows at the back',
  trolleybus: 'trolleybus: green bus with two long poles on its roof reaching up to overhead wires',
  truck: 'truck: big truck with a blue cab and a long closed cargo box',
  'pickup truck': 'pickup truck: small red truck with an open empty back',
  'fire truck': 'fire truck: red truck with a ladder on top',
  train: 'train: old steam locomotive with a chimney and a puff of smoke',
  'fast train': 'fast train: sleek white bullet train with a long pointed nose',
  tram: 'tram: short orange city tram on rails, seen from the side, with a pole to an overhead wire',
  subway: 'subway: silver metro train coming out of a dark round tunnel, front view',
  'cable car': 'cable car: cabin hanging from a cable in the air',
  ship: 'ship: huge cruise ship with many windows and chimneys',
  boat: 'boat: small sailboat with one white triangular sail',
  canoe: 'canoe: narrow wooden canoe with one paddle, no sail',
  speedboat: 'speedboat: fast motor boat with a white splash behind it',
  motorbike: 'motorbike: motorcycle, side view',
  scooter: 'scooter: child kick scooter with two small wheels and a handlebar',
  bicycle: 'bicycle: side view',
  ufo: 'ufo: flying saucer with a glass dome',
  sled: 'sled: wooden snow sled',
  'roller skate': 'roller skate: one boot with four wheels',
  // food
  'chicken leg': 'chicken leg: one golden fried drumstick with the bone sticking out',
  meat: 'meat: a flat red raw steak with a white T-shaped bone',
  cake: 'cake: big round birthday cake with three lit candles',
  cupcake: 'cupcake: one small cupcake in a paper cup with pink swirl frosting and a cherry',
  pie: 'pie: round pie with a lattice crust, one slice cut out',
  pancakes: 'pancakes: a tall stack of pancakes with syrup dripping and butter on top',
  waffle: 'waffle: one square waffle with a clear grid pattern',
  donut: 'donut: ring donut with pink icing and sprinkles',
  cookie: 'cookie: round chocolate chip cookie',
  bread: 'bread: loaf of sliced bread',
  rice: 'rice: bowl of white rice with chopsticks',
  noodles: 'noodles: bowl of noodles lifted by chopsticks',
  spaghetti: 'spaghetti: plate of spaghetti with red sauce and a fork',
  soup: 'soup: bowl of orange soup with a spoon and steam',
  salad: 'salad: bowl of green salad with tomato',
  milk: 'milk: glass of white milk',
  juice: 'juice: glass of orange juice with a straw and an orange slice',
  tea: 'tea: cup of tea on a saucer with a tea bag string and steam',
  'bubble tea': 'bubble tea: clear plastic cup with brown tea, black pearls and a wide straw',
  honey: 'honey: jar of golden honey with a wooden honey dipper',
  butter: 'butter: yellow block of butter on a dish with a knife',
  salt: 'salt: salt shaker',
  candy: 'candy: one wrapped candy and one lollipop',
  cheese: 'cheese: yellow wedge of cheese with holes',
  chocolate: 'chocolate: chocolate bar, partly unwrapped',
  sushi: 'sushi: two pieces of sushi',
  dumpling: 'dumpling: three steamed dumplings in a bamboo basket',
  egg: 'egg: fried egg, sunny side up',
  'ice cream': 'ice cream: cone with two scoops',
  // nature
  tree: 'tree: round leafy tree with a brown trunk and red apples',
  'pine tree': 'pine tree: tall dark green triangular fir tree',
  'palm tree': 'palm tree: tall thin curved trunk with long leaves and coconuts',
  island: 'island: tiny sand island in blue sea with a small hut',
  beach: 'beach: sand with a striped beach umbrella, a bucket and a spade',
  desert: 'desert: yellow sand dunes with a camel far away under a hot sun',
  flower: 'flower: one daisy with white petals and a yellow centre',
  rose: 'rose: one red rose with thorns on the stem',
  sunflower: 'sunflower: tall sunflower with a big brown centre',
  leaf: 'leaf: one single green leaf',
  plant: 'plant: small green plant in a brown pot',
  clover: 'clover: four-leaf clover',
  cactus: 'cactus: green cactus with spines',
  wind: 'wind: curly blue wind lines blowing leaves and bending a small tree',
  tornado: 'tornado: grey spinning funnel',
  wave: 'wave: one big curling blue ocean wave',
  water: 'water: one blue water drop',
  ice: 'ice: three clear blue ice cubes',
  snow: 'snow: one big snowflake',
  rain: 'rain: grey cloud with rain drops falling',
  cloud: 'cloud: one white fluffy cloud',
  lightning: 'lightning: dark cloud with a yellow lightning bolt',
  fire: 'fire: campfire with logs and flames',
  rock: 'rock: one grey stone',
  mountain: 'mountain: tall mountain with snow on top',
  volcano: 'volcano: mountain with red lava coming out',
  earth: 'earth: planet Earth, blue and green globe',
  planet: 'planet: orange planet with a ring, like Saturn',
  sun: 'sun: yellow sun with rays and a smiling face',
  moon: 'moon: yellow crescent moon',
  star: 'star: one yellow five-pointed star',
  bee: 'bee: striped bee with wings',
  // actions: a whole child doing it
  run: 'run: child running fast, body leaning forward, arms pumping, speed lines behind',
  walk: 'walk: child walking calmly upright with a backpack, holding a balloon',
  swim: 'swim: child swimming in blue water with goggles',
  dance: 'dance: child dancing with arms up, music notes around',
  sleep: 'sleep: child asleep in bed under a blanket, Zzz above',
  climb: 'climb: child climbing a ladder',
  ride: 'ride: child riding a bicycle with a helmet',
  surf: 'surf: child standing on a surfboard on a wave',
  ski: 'ski: child skiing down snow with two poles',
  row: 'row: child in a small boat pulling two oars',
  sit: 'sit: child sitting on a chair',
  stand: 'stand: child standing straight with arms at the sides, large in the frame',
  juggle: 'juggle: child juggling three coloured balls',
  clap: 'clap: child clapping two hands together, small spark lines at the hands',
  hug: 'hug: two children hugging',
  // body: one part each, large
  eye: 'eye: one open eye with eyelashes',
  ear: 'ear: one human ear',
  nose: 'nose: one human nose',
  mouth: 'mouth: smiling lips',
  hand: 'hand: one open hand, five fingers spread',
  foot: 'foot: one bare foot seen from the side with five toes',
  tooth: 'tooth: one white tooth',
  leg: 'leg: one bare leg from hip to foot, slightly bent, in shorts',
  arm: 'arm: one straight bare arm from shoulder to hand, relaxed',
  tongue: 'tongue: open mouth with the tongue sticking out',
  brain: 'brain: pink brain',
  bone: 'bone: one white bone',
  heart: 'heart: red heart organ, simple and friendly',
  lungs: 'lungs: pair of pink lungs',
  finger: 'finger: hand pointing up with one index finger',
  thumb: 'thumb: thumbs-up hand',
  // animals: whole animal, not only the head
  chicken: 'chicken: white hen with a red comb',
  bird: 'bird: small blue songbird on a twig',
  parrot: 'parrot: red parrot with a big curved beak and a long tail',
  owl: 'owl: brown owl with big round eyes',
  duck: 'duck: yellow duck',
  penguin: 'penguin: black and white penguin',
  mouse: 'mouse: small grey mouse with big round ears and a long tail',
  rabbit: 'rabbit: white rabbit with long ears',
  fox: 'fox: orange fox with a bushy tail, whole body',
  cat: 'cat: orange cat sitting, whole body',
  dog: 'dog: brown dog sitting, whole body, tongue out',
  lion: 'lion: lion with a big mane',
  tiger: 'tiger: orange tiger with black stripes, no mane',
  bear: 'bear: big brown bear',
  panda: 'panda: black and white panda eating bamboo',
  horse: 'horse: brown horse, whole body',
  zebra: 'zebra: black and white striped zebra, whole body',
  deer: 'deer: brown deer with antlers',
  goat: 'goat: white goat with a small beard and short horns',
  sheep: 'sheep: fluffy white woolly sheep',
  cow: 'cow: black and white cow',
  pig: 'pig: pink pig',
  camel: 'camel: camel with two humps',
  giraffe: 'giraffe: giraffe with a long neck',
  hippo: 'hippo: grey hippo with a big open mouth',
  crocodile: 'crocodile: green crocodile with teeth',
  dinosaur: 'dinosaur: friendly green long-necked dinosaur',
  snake: 'snake: green coiled snake',
  turtle: 'turtle: green turtle with a shell',
  frog: 'frog: green frog',
  fish: 'fish: small orange fish',
  dolphin: 'dolphin: light grey dolphin jumping, long beak, smiling',
  whale: 'whale: huge dark blue whale with a water spout on top',
  shark: 'shark: grey shark with sharp teeth and a tall back fin',
  octopus: 'octopus: pink octopus with eight arms',
  crab: 'crab: red crab with two claws',
  ant: 'ant: one black ant',
  // fruits and vegetables
  orange: 'orange: one whole orange fruit and one half',
  apple: 'apple: red apple with a leaf',
  'green apple': 'green apple: bright green apple with a leaf',
  peach: 'peach: pink-orange peach with a leaf',
  mango: 'mango: yellow-red oval mango',
  lemon: 'lemon: yellow lemon',
  melon: 'melon: light green honeydew melon with one slice',
  watermelon: 'watermelon: slice of watermelon, red with black seeds',
  pepper: 'pepper: red bell pepper',
  chili: 'chili: thin long red chili pepper',
  corn: 'corn: corn cob with yellow kernels and green husk',
  potato: 'potato: brown potato',
  'sweet potato': 'sweet potato: long purple-red sweet potato, cut to show orange inside',
  onion: 'onion: brown round onion',
  garlic: 'garlic: white garlic bulb',
  ginger: 'ginger: knobbly beige ginger root',
  peas: 'peas: open green pea pod with round peas',
  peanuts: 'peanuts: two peanuts in their shells',
  olive: 'olive: green olives on a twig',
  lettuce: 'lettuce: green head of lettuce',
  cucumber: 'cucumber: long green cucumber with slices',
  blueberries: 'blueberries: small bunch of blueberries',
  cherries: 'cherries: two red cherries on stems',
  grapes: 'grapes: bunch of purple grapes',
  // toys and home
  ball: 'ball: black and white soccer ball',
  'teddy bear': 'teddy bear: soft brown toy bear with a bow, sitting',
  robot: 'robot: toy robot',
  'yo-yo': 'yo-yo: yo-yo with its string',
  puzzle: 'puzzle: four jigsaw puzzle pieces',
  gift: 'gift: wrapped present with a bow',
  kite: 'kite: diamond kite with a tail',
  pencil: 'pencil: yellow pencil',
  crayon: 'crayon: three wax crayons',
  key: 'key: one golden key',
  clock: 'clock: round wall clock',
  phone: 'phone: smartphone',
  tv: 'tv: flat television on a stand',
  computer: 'computer: laptop computer',
  glasses: 'glasses: pair of eyeglasses',
  hat: 'hat: wide-brimmed sun hat',
  shoe: 'shoe: one sneaker',
  socks: 'socks: pair of striped socks',
  dress: 'dress: girl\'s dress',
  't-shirt': 't-shirt: plain blue t-shirt',
  soap: 'soap: bar of soap with bubbles',
  toothbrush: 'toothbrush: toothbrush with toothpaste',
  bathtub: 'bathtub: bathtub with bubbles',
  window: 'window: house window with curtains',
  door: 'door: closed wooden door',
  house: 'house: small house with a red roof',
  basket: 'basket: woven basket with a handle',
  spoon: 'spoon: one metal spoon',
  drum: 'drum: toy drum with two sticks',
  scissors: 'scissors: pair of child scissors',
  backpack: 'backpack: school backpack',
  book: 'book: closed red book',
};

const STYLE = {
  family: 'Each cell shows ONE person, head and shoulders, in exactly the same style as the people in the reference image. Same skin tone as the reference.',
  actions: 'Each cell shows ONE whole child (head to feet) doing the action, large in its cell. Same face style and skin tone as the reference image.',
  body: 'Each cell shows ONE body part alone, large, same skin tone as the reference image.',
  animals: 'Each cell shows ONE whole friendly animal, large in its cell.',
};

const lines = [
  '# Prompt vẽ hình cho Chip Chip English',
  '',
  'Cách làm với mỗi tấm:',
  '',
  '1. Trong **cùng một cuộc trò chuyện** với Gemini (để giữ phong cách), đính kèm tấm hình gia đình đầu tiên làm mẫu rồi dán prompt.',
  '2. Lưu hình vào thư mục `art-inbox/`. Đặt tên file như ghi ở đầu mỗi prompt thì tốt nhất; nếu để tên Gemini tự đặt thì cũng được, miễn là tải về **đúng thứ tự** các prompt.',
  '3. Xem nhanh: đủ số hình, các hình không chạm nhau, không có chữ. Sai thì bảo Gemini vẽ lại tấm đó.',
  '',
  'Thứ tự dưới đây là từ chủ đề cần sửa nhất. Có thể dừng ở bất kỳ chủ đề nào, nhưng nên vẽ trọn từng chủ đề để các hình trong một chủ đề cùng một phong cách.',
  '',
];
let sheets = 0;

/** One prompt for one sheet of up to nine pictures. */
function sheet(file, items, style, magenta) {
  sheets++;
  lines.push(
    `### Tên file: \`${file}.png\``,
    '',
    '```',
    `Using the attached image as the exact style reference (flat vector sticker art, thick white sticker border around every picture, soft simple shapes, no text, no letters, no numbers), draw a new sheet of ${items.length} stickers for a toddler's English learning app.`,
    '',
    style,
    'Every picture must be easy to tell apart from the others at a glance.',
    'Each picture is ONE single connected sticker: everything that belongs to it (small details like notes, sparks, smoke or Zzz) sits inside the same white border, never floating apart.',
    '',
    `Layout: a 3x3 grid, in reading order (left to right, top to bottom)${items.length < 9 ? `; draw only these ${items.length} pictures; leave the remaining cells as plain background and do NOT copy any picture from the reference image` : ''}:`,
    '',
    items.map((t, k) => `${k + 1}. ${t}`).join('\n'),
    '',
    `Background: solid pure ${magenta ? 'magenta (#FF00FF)' : 'green (#00FF00)'}, flat, no shadows, no grid lines. Leave clear empty space between the pictures so they never touch each other, and keep every picture well away from the edges and corners of the image. Square image, highest resolution.`,
    '```',
    '',
  );
}

function section(title, prefix, items, style, magenta) {
  if (!items.length) return;
  lines.push(`## ${title} (${items.length} hình)`, '');
  for (let i = 0; i < items.length; i += 9) sheet(`${prefix}-${i / 9 + 1}`, items.slice(i, i + 9), style, magenta);
}

const ONE_OBJECT = 'Each cell shows ONE object alone, large in its cell, with no background scenery beyond what is described.';
for (const id of TOPICS) {
  const topic = data.topics.find((t) => t.id === id);
  const words = data.words.filter((w) => w.topic === id && !DONE.has(w.id));
  section(topic.vi, id, words.map((w) => HINT[w.id] ?? (w.word ?? w.id)), STYLE[id] ?? ONE_OBJECT, MAGENTA.has(id));
}

// ---- not words: the faces of the Feelings topic, the reward stickers, Chip and his things ----

const FEELINGS = [
  'happy: big open smile, eyes curved with joy',
  'sad: mouth turned down, one big tear on the cheek',
  'angry: red face, eyebrows pulled down hard, gritted teeth',
  'scared: wide round eyes, open mouth, hands on the cheeks, face a little blue',
  'sleepy: eyes closed, big yawn, Zzz attached above the head',
  'surprised: raised eyebrows, wide eyes, small round "o" mouth',
  'sick: thermometer in the mouth, pale green face, ice pack on the head',
  'hot: red sweaty face, tongue out, sun rays attached above',
  'cold: blue face, shivering, wearing a scarf and a woolly hat with snow on it',
  'silly: one eye winking, tongue stuck out to the side',
  'hungry: licking lips, holding a fork and a spoon',
  'excited: party hat, huge grin, both fists up, confetti attached around the head',
];
if (!data.words.some((w) => w.topic === 'feelings' && w.art)) {
  section(
    'Cảm xúc',
    'feelings',
    FEELINGS,
    'Each cell shows the SAME child (the boy with spiky brown hair and a green t-shirt from the reference image), head and shoulders, showing one feeling. Only the face and the small props change, so the feeling is what tells the pictures apart.',
    false,
  );
}

// reward stickers, in the order of src/data/stickers.json (their ids must not change)
const STICKER_ART = [
  'unicorn: white unicorn head with a rainbow mane and a golden horn',
  'T-rex: friendly green T-rex standing on two legs, tiny arms, big smile',
  'long-neck dinosaur: blue long-necked dinosaur (sauropod), whole body',
  'octopus: purple octopus wearing a tiny party hat',
  'dolphin: blue dolphin jumping through a gold ring',
  'whale: happy blue whale with a big water spout',
  'crab: orange crab waving both claws, wearing sunglasses',
  'fox: orange fox head, winking',
  'koala: grey koala hugging a branch',
  'kangaroo: kangaroo jumping, with boxing gloves',
  'hamster: chubby hamster with full cheeks holding a seed',
  'snail: snail with a spiral rainbow shell',
  'ladybug: red ladybug with black dots',
  'penguin: penguin wearing a red scarf, sliding on its belly',
  'owl: owl wearing a graduation cap',
  'giraffe: giraffe head and long neck with a flower in its mouth',
  'zebra: zebra head with a colourful mane',
  'chick: baby chick hatching out of a cracked egg',
  'party popper: party popper cone with confetti and streamers attached',
  'trophy: golden trophy cup with a star on it',
  'donut: donut with rainbow icing and a bite taken out',
  'cake: slice of strawberry shortcake',
  'flower: big pink hibiscus flower',
  'clover: four-leaf clover with a smiling face',
  'crown: golden crown with red and blue jewels',
  'tea: green tea in a small cup without a handle, steam attached',
  'carousel: carousel horse on a golden pole',
  'ferris wheel: colourful ferris wheel',
  'sparkles: three big golden four-pointed sparkle stars joined together as one sticker',
  'rocket: rocket flying up with a trail of stars attached',
  'rainbow: rainbow with a small cloud at each end',
];
const stickerDone = JSON.parse(fs.readFileSync('src/data/sticker-art.json', 'utf8')).length;
if (stickerDone < STICKER_ART.length) {
  // the first sheets are in the app already: only what is left
  section(
    'Sticker thưởng trong album',
    'stickers-rest',
    STICKER_ART.slice(stickerDone),
    'These are reward stickers a child collects: each cell shows ONE extra cute, joyful picture, large in its cell.',
    true,
  );
}

const CHIP_ART = [
  'Chip the mascot: a round yellow baby chick seen from the front, standing, small orange beak, two orange feet, little wings at its sides, friendly black eyes, pink cheeks, NO hat and nothing on its head',
  'the same chick asleep: eyes closed, head tilted, Zzz attached above',
  'a red ribbon bow (hair bow) alone',
  'a blue baseball cap alone, seen from the front, slightly from above',
  'a pair of round red glasses alone, seen from the front',
  'a black top hat with a red band alone, seen from the front',
  'a golden crown with jewels alone, seen from the front',
  'a wrapped gift box with a big bow, closed',
  'a friendly orange flame (for a streak of days)',
];
if (!fs.existsSync('public/img/art/chip')) {
  section(
    'Bạn gà Chip và đồ của Chip',
    'chip',
    CHIP_ART,
    'Each cell shows ONE thing alone, large in its cell. The hat, cap, crown, glasses and bow will later be placed on the chick by the app, so draw each of them alone, straight and upright, with nothing else.',
    true,
  );
}
lines.splice(8, 0, `Tổng cộng ${sheets} tấm.`, '');
fs.mkdirSync('art-inbox', { recursive: true });
fs.writeFileSync('art-inbox/PROMPTS.md', lines.join('\n'));
console.log(sheets, 'sheets');
// words drawn with only their name: worth a look
const plain = data.words.filter((w) => TOPICS.includes(w.topic) && !DONE.has(w.id) && !HINT[w.id]).map((w) => w.id);
console.log('no hint:', plain.join(', '));

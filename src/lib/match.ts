// Lenient matching of what speech recognition heard against the target word.
// Little children's speech is hard to recognise, so we accept close sounds.

const SOUNDS_LIKE: Record<string, string[]> = {
  one: ['1', 'won', 'wan', 'juan'],
  two: ['2', 'to', 'too', 'tu', 'do'],
  three: ['3', 'tree', 'free', 'sree'],
  four: ['4', 'for', 'fore', 'pho', 'far'],
  five: ['5', 'fight', 'fife'],
  six: ['6', 'sex', 'sticks', 'sick'],
  seven: ['7', 'heaven'],
  eight: ['8', 'ate', 'aight', 'hate'],
  nine: ['9', 'night', 'mine', 'nein'],
  ten: ['10', 'then', 'tan', 'den'],
  pear: ['pair', 'pare', 'bear', 'pier'],
  bear: ['bare', 'bair', 'pear', 'beer'],
  sun: ['son', 'some', 'sunny'],
  bee: ['be', 'b', 'bea', 'v'],
  eye: ['i', 'aye', 'ai', 'hi'],
  ear: ['here', 'year', 'hear', 'era', 'ia'],
  red: ['read', 'rad', 'wed', 'bread'],
  blue: ['blew', 'bloo', 'glue'],
  car: ['card', 'call', 'kar', 'ca'],
  cat: ['cut', 'kat', 'cap', 'cad', 'cats'],
  dog: ['dock', 'doug', 'dug', 'dogs', 'dawg'],
  pig: ['big', 'pick', 'peg'],
  duck: ['doc', 'dark', 'duke'],
  fish: ['fishy', 'fresh'],
  egg: ['ag', 'ack', 'eggs'],
  mom: ['mum', 'mama', 'mommy', 'mummy', 'mam', 'ma'],
  dad: ['daddy', 'dada', 'ted', 'that'],
  milk: ['melk', 'mook'],
  rice: ['rise', 'ice', 'nice', 'race'],
  ball: ['bowl', 'ball', 'bol', 'paul', 'fall'],
  bed: ['bad', 'bet', 'bird'],
  book: ['look', 'books', 'bug'],
  door: ['dora', 'dorm', 'dough'],
  tree: ['three', 'free', 'trees'],
  moon: ['noon', 'mood'],
  star: ['stars', 'start', 'store'],
  rain: ['ran', 'rainy', 'reign', 'lane'],
  snow: ['know', 'no', 'slow'],
  hand: ['and', 'end', 'han'],
  foot: ['food', 'put', 'fruit'],
  nose: ['knows', 'no', 'nos'],
  mouth: ['mouse', 'mount'],
  tooth: ['truth', 'two'],
  bus: ['bass', 'boss', 'buzz'],
  ship: ['sheep', 'chip', 'sip'],
  boat: ['vote', 'both', 'boot'],
  train: ['trains', 'chain', 'drain'],
  kite: ['cat', 'kites', 'right'],
  cake: ['kick', 'take', 'cape'],
  lion: ['line', 'ryan', 'brian'],
  frog: ['frock', 'fog', 'frogs'],
  cow: ['how', 'cal', 'ciao'],
  cookie: ['cooky', 'kookie', 'cookies'],
  candy: ['can i', 'andy', 'kandi'],
  pink: ['bank', 'pig', 'think'],
  white: ['wide', 'right', 'why'],
  black: ['back', 'block', 'plaque'],
  green: ['grin', 'clean', 'queen'],
  brown: ['round', 'brain', 'frown'],
  run: ['one', 'ron', 'rum', 'runs'],
  walk: ['work', 'woke', 'wok', 'walks'],
  swim: ['swing', 'sim', 'swims'],
  dance: ['dads', 'dense', 'dancing', 'dan'],
  sleep: ['slip', 'sleeps', 'sleepy'],
  climb: ['climbed', 'clime', 'time'],
  ride: ['right', 'rides', 'wide', 'rise'],
  surf: ['serve', 'surfs', 'sir'],
  ski: ['sky', 'skee', 'key'],
  row: ['roe', 'ro', 'road', 'raw', 'low'],
  sit: ['seat', 'set', 'sid', 'sits'],
  stand: ['stan', 'stands', 'sand'],
  clap: ['clip', 'cap', 'club', 'claps'],
  hug: ['hog', 'hugs', 'hook', 'hub'],
  juggle: ['jungle', 'jiggle', 'jugo'],
  sad: ['said', 'sat', 'set'],
  hot: ['hat', 'hut', 'heart'],
  cold: ['called', 'code', 'gold', 'coal'],
  sick: ['six', 'thick', 'sik'],
  happy: ['happen', 'hobby', 'heavy'],
  scared: ['scare', 'skirt', 'scary'],
  silly: ['sally', 'sili', 'seely'],
  sleepy: ['sleep', 'slippy'],
  oval: ['over', 'opal', 'ovo'],
  square: ['squares', 'swear', 'where'],
  circle: ['cycle', 'circles', 'sircle'],
  ring: ['rink', 'wing', 'rain', 'rings'],
  cross: ['crossed', 'across', 'gross'],
  arrow: ['aero', 'error', 'arrows', 'arro'],
  spiral: ['spyro', 'spirals', 'viral'],
  diamond: ['diamonds', 'dimond'],
};

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

/**
 * Score 0..1 for how well one heard phrase matches the target.
 * 1 = exact word heard, ~0.8 = known sound-alike, otherwise spelling similarity.
 */
export function scoreHeard(target: string, heard: string): number {
  const t = normalize(target);
  const h = normalize(heard);
  if (!h) return 0;
  const tokens = h.split(' ');
  // The child may say "a cat" or "it's a cat"
  if (` ${h} `.includes(` ${t} `)) return 1;
  // plural / possessive forms
  if (tokens.some((x) => x === `${t}s` || x === `${t}es`)) return 0.95;
  const alikes = SOUNDS_LIKE[t] ?? [];
  if (alikes.some((a) => ` ${h} `.includes(` ${a} `))) return 0.8;
  // compare against every single token and every pair of tokens (for "teddy bear")
  const grams = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) grams.push(`${tokens[i]} ${tokens[i + 1]}`);
  let best = 0;
  for (const g of grams) best = Math.max(best, similarity(t.replace(/ /g, ''), g.replace(/ /g, '')));
  return best * 0.9;
}

/** Best score across every alternative the recogniser returned. */
export function bestScore(target: string, alternatives: string[]): number {
  return alternatives.reduce((m, a) => Math.max(m, scoreHeard(target, a)), 0);
}

/** Pass threshold. Short words get a little more slack. */
export function passes(target: string, alternatives: string[]): boolean {
  const thr = target.length <= 3 ? 0.6 : 0.65;
  return bestScore(target, alternatives) >= thr;
}

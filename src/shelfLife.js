// Typical shelf lives, in days, from purchase.
// Figures are conservative rounded values based on common food-safety guidance
// (e.g. USDA FoodKeeper). They are estimates: the date on the package always wins.
//
// Row format:
//   [keywords, emoji, category, default location, fridge, pantry, freezer]
// A null shelf life means "not normally stored there".

const ROWS = [
  // Dairy & eggs
  [['milk', 'oat milk', 'almond milk', 'soy milk'], '🥛', 'dairy', 'fridge', 7, null, 90],
  [['cream', 'heavy cream', 'whipping cream', 'half and half'], '🥛', 'dairy', 'fridge', 7, null, 120],
  [['sour cream', 'creme fraiche'], '🥣', 'dairy', 'fridge', 14, null, null],
  [['yogurt', 'yoghurt', 'greek yogurt', 'skyr'], '🥣', 'dairy', 'fridge', 14, null, 60],
  [['butter'], '🧈', 'dairy', 'fridge', 60, null, 270],
  [['egg', 'eggs'], '🥚', 'dairy', 'fridge', 28, null, 365],
  [['cheddar', 'parmesan', 'hard cheese', 'gouda', 'gruyere', 'cheese'], '🧀', 'dairy', 'fridge', 28, null, 180],
  [['mozzarella', 'ricotta', 'feta', 'cottage cheese', 'cream cheese', 'brie', 'goat cheese', 'burrata', 'halloumi', 'paneer'], '🧀', 'dairy', 'fridge', 7, null, 60],
  [['tofu'], '🧊', 'protein', 'fridge', 5, null, 150],

  // Meat & fish (raw)
  [['chicken', 'chicken breast', 'chicken thighs', 'turkey', 'poultry'], '🍗', 'meat', 'fridge', 2, null, 270],
  [['ground beef', 'mince', 'ground pork', 'ground turkey', 'ground chicken', 'ground meat'], '🥩', 'meat', 'fridge', 2, null, 120],
  [['steak', 'beef', 'pork', 'pork chop', 'lamb', 'roast', 'veal'], '🥩', 'meat', 'fridge', 4, null, 180],
  [['sausage', 'sausages', 'bratwurst', 'chorizo'], '🌭', 'meat', 'fridge', 2, null, 60],
  [['bacon'], '🥓', 'meat', 'fridge', 7, null, 30],
  [['ham', 'deli meat', 'turkey slices', 'salami', 'prosciutto', 'cold cuts'], '🥪', 'meat', 'fridge', 5, null, 60],
  [['salmon', 'fish', 'cod', 'tilapia', 'trout', 'tuna steak', 'halibut', 'haddock'], '🐟', 'seafood', 'fridge', 2, null, 90],
  [['shrimp', 'prawns', 'scallops', 'mussels', 'clams'], '🦐', 'seafood', 'fridge', 2, null, 120],

  // Vegetables
  [['spinach', 'lettuce', 'arugula', 'rocket', 'salad', 'mixed greens', 'kale', 'chard', 'romaine'], '🥬', 'vegetable', 'fridge', 5, null, 240],
  [['herbs', 'cilantro', 'coriander', 'parsley', 'basil', 'dill', 'mint', 'chives'], '🌿', 'vegetable', 'fridge', 7, null, 120],
  [['broccoli', 'cauliflower', 'brussels sprouts'], '🥦', 'vegetable', 'fridge', 5, null, 300],
  [['carrot', 'carrots'], '🥕', 'vegetable', 'fridge', 21, null, 300],
  [['celery'], '🥬', 'vegetable', 'fridge', 14, null, 300],
  [['bell pepper', 'pepper', 'peppers', 'capsicum', 'jalapeno', 'chili'], '🫑', 'vegetable', 'fridge', 7, null, 240],
  [['cucumber'], '🥒', 'vegetable', 'fridge', 7, null, null],
  [['zucchini', 'courgette', 'squash'], '🥒', 'vegetable', 'fridge', 5, null, 300],
  [['tomato', 'tomatoes', 'cherry tomatoes'], '🍅', 'vegetable', 'pantry', 7, 5, 60],
  [['mushroom', 'mushrooms'], '🍄', 'vegetable', 'fridge', 5, null, 240],
  [['green beans', 'asparagus', 'snap peas', 'snow peas'], '🫛', 'vegetable', 'fridge', 4, null, 240],
  [['corn', 'corn on the cob'], '🌽', 'vegetable', 'fridge', 3, null, 240],
  [['cabbage', 'red cabbage', 'bok choy'], '🥬', 'vegetable', 'fridge', 21, null, 240],
  [['eggplant', 'aubergine'], '🍆', 'vegetable', 'fridge', 5, null, 240],
  [['avocado', 'avocados'], '🥑', 'fruit', 'pantry', 5, 4, 120],
  [['potato', 'potatoes', 'sweet potato', 'sweet potatoes', 'yam'], '🥔', 'vegetable', 'pantry', null, 30, null],
  [['onion', 'onions', 'shallot', 'shallots', 'red onion'], '🧅', 'vegetable', 'pantry', null, 30, 240],
  [['green onion', 'scallion', 'scallions', 'spring onion', 'leek', 'leeks'], '🧅', 'vegetable', 'fridge', 7, null, 240],
  [['garlic'], '🧄', 'vegetable', 'pantry', null, 90, 300],
  [['ginger'], '🫚', 'vegetable', 'fridge', 21, null, 180],

  // Fruit
  [['banana', 'bananas'], '🍌', 'fruit', 'pantry', null, 5, 90],
  [['apple', 'apples', 'pear', 'pears'], '🍎', 'fruit', 'fridge', 30, 7, 240],
  [['orange', 'oranges', 'mandarin', 'clementine', 'grapefruit'], '🍊', 'fruit', 'fridge', 21, 7, 120],
  [['lemon', 'lemons', 'lime', 'limes'], '🍋', 'fruit', 'fridge', 21, 7, 120],
  [['berries', 'strawberries', 'strawberry', 'raspberries', 'blackberries'], '🍓', 'fruit', 'fridge', 4, null, 240],
  [['blueberries', 'blueberry'], '🫐', 'fruit', 'fridge', 7, null, 240],
  [['grapes', 'grape'], '🍇', 'fruit', 'fridge', 7, null, 300],
  [['peach', 'peaches', 'nectarine', 'plum', 'plums', 'mango', 'mangoes', 'kiwi'], '🍑', 'fruit', 'pantry', 5, 3, 240],
  [['pineapple', 'melon', 'watermelon', 'cantaloupe'], '🍍', 'fruit', 'pantry', 5, 4, 240],
  [['cherries', 'cherry'], '🍒', 'fruit', 'fridge', 5, null, 240],

  // Bakery
  [['bread', 'loaf', 'sourdough', 'baguette', 'buns', 'rolls', 'bagels', 'bagel', 'pita', 'naan'], '🍞', 'bakery', 'pantry', 10, 5, 90],
  [['tortillas', 'tortilla', 'wraps'], '🫓', 'bakery', 'pantry', 21, 7, 180],

  // Cooked & prepared
  [['leftovers', 'leftover', 'cooked rice', 'soup', 'stew', 'curry', 'chili con carne'], '🍲', 'prepared', 'fridge', 4, null, 90],
  [['hummus', 'guacamole', 'salsa', 'pesto', 'dip'], '🥣', 'prepared', 'fridge', 7, null, 60],
  [['fresh pasta', 'gnocchi', 'dumplings'], '🥟', 'prepared', 'fridge', 4, null, 60],

  // Pantry staples
  [['rice', 'pasta', 'spaghetti', 'noodles', 'quinoa', 'couscous', 'oats', 'flour', 'lentils', 'beans', 'chickpeas', 'cereal'], '🍚', 'pantry', 'pantry', null, 365, null],
  [['canned', 'can of', 'tinned', 'tomato sauce', 'coconut milk', 'stock', 'broth'], '🥫', 'pantry', 'pantry', null, 365, null],
  [['nuts', 'almonds', 'walnuts', 'peanut butter', 'seeds'], '🥜', 'pantry', 'pantry', null, 180, 365],
  [['jam', 'jelly', 'mayo', 'mayonnaise', 'ketchup', 'mustard', 'soy sauce', 'hot sauce', 'sauce', 'dressing'], '🫙', 'condiment', 'fridge', 90, null, null],
  [['juice', 'orange juice'], '🧃', 'drink', 'fridge', 7, null, 240],

  // Frozen goods
  [['frozen peas', 'frozen veg', 'frozen vegetables', 'frozen berries', 'frozen fruit', 'ice cream', 'frozen pizza', 'frozen'], '🧊', 'frozen', 'freezer', null, null, 240],
];

// Fallbacks when nothing matches, by location.
const FALLBACK = {
  fridge: { emoji: '🫙', category: 'other', days: 7 },
  pantry: { emoji: '🫙', category: 'other', days: 30 },
  freezer: { emoji: '🧊', category: 'other', days: 90 },
};

// How long things keep in the fridge after thawing.
const THAW_DAYS = { meat: 1, seafood: 1, prepared: 3, dairy: 4, bakery: 3 };
const DEFAULT_THAW_DAYS = 3;

export const LOCATIONS = ['fridge', 'pantry', 'freezer'];

function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ENTRIES = ROWS.map(([keywords, emoji, category, defaultLocation, fridge, pantry, freezer]) => ({
  keywords: keywords.map(normalize),
  emoji,
  category,
  defaultLocation,
  days: { fridge, pantry, freezer },
}));

/**
 * Find the shelf-life entry for a free-text item name.
 * The longest keyword that appears as whole words wins, so "ground beef"
 * beats "beef" and "sour cream" beats "cream".
 * @param {string} name
 * @returns {object|null}
 */
export function lookup(name) {
  const text = ` ${normalize(name)} `;
  if (!text.trim()) return null;
  let best = null;
  let bestLength = 0;
  for (const entry of ENTRIES) {
    for (const keyword of entry.keywords) {
      if (keyword.length > bestLength && text.includes(` ${keyword} `)) {
        best = entry;
        bestLength = keyword.length;
      }
    }
  }
  return best;
}

/**
 * Everything the UI needs to know about a typed item name.
 * @param {string} name
 * @param {string} [location] force a location; otherwise the item's usual one
 */
export function guess(name, location) {
  const entry = lookup(name);
  const where = location || entry?.defaultLocation || 'fridge';
  let days = entry?.days[where] ?? null;
  let matched = Boolean(entry);
  if (days == null) {
    // Not usually stored there: fall back to the nearest sensible value.
    days = entry
      ? entry.days.fridge ?? entry.days.pantry ?? FALLBACK[where].days
      : FALLBACK[where].days;
    if (where === 'freezer') days = Math.max(days, FALLBACK.freezer.days);
    matched = matched && entry.days[where] != null;
  }
  return {
    emoji: entry?.emoji ?? FALLBACK[where].emoji,
    category: entry?.category ?? FALLBACK[where].category,
    location: where,
    days,
    known: matched,
  };
}

/** Days an item keeps in the fridge once thawed. */
export function thawDays(category) {
  return THAW_DAYS[category] ?? DEFAULT_THAW_DAYS;
}

/** Freezer shelf life for an item, used when it is moved to the freezer. */
export function freezerDays(name) {
  return guess(name, 'freezer').days;
}

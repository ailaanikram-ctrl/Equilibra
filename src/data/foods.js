// DEV DATA: synthetic demo values per medium serving. NOT verified nutrition data.
// Allergen tags (`al`) are also demo tags; verify against real recipes before any real-world use.
// k=kcal p=protein g c=carbs g f=fat g fi=fibre g; ef=effort (none|low|mid)
export const FOODS = [
  { id: 'nl', n: 'Nasi lemak (with egg, sambal)', k: 644, p: 17, c: 80, f: 28, fi: 4, al: ['egg', 'peanut', 'seafood'], ef: 'low' },
  { id: 'na', n: 'Nasi ayam (rice, chicken)', k: 560, p: 28, c: 70, f: 18, fi: 2, al: ['soy'], ef: 'low' },
  { id: 'rc', n: 'Roti canai (2 pcs) + dhal', k: 520, p: 11, c: 62, f: 24, fi: 5, al: ['dairy'], ef: 'low' },
  { id: 'cg', n: 'Char kuey teow', k: 740, p: 22, c: 85, f: 34, fi: 4, al: ['egg', 'seafood', 'soy'], ef: 'low' },
  { id: 'sl', n: 'Sarawak laksa', k: 600, p: 26, c: 68, f: 24, fi: 4, al: ['egg', 'seafood', 'peanut'], ef: 'low' },
  { id: 'ik', n: 'Ikan bakar + ulam + rice', k: 480, p: 34, c: 55, f: 12, fi: 6, al: ['seafood'], ef: 'mid' },
  { id: 'nc', n: 'Nasi campur (veg, chicken, rice)', k: 610, p: 30, c: 72, f: 20, fi: 7, al: [], ef: 'low' },
  { id: 'sa', n: 'Satay (6 sticks) + ketupat', k: 420, p: 28, c: 38, f: 18, fi: 3, al: ['peanut'], ef: 'low' },
  { id: 'hv', n: 'Hinava (Sabah fish salad) + rice', k: 380, p: 26, c: 50, f: 6, fi: 3, al: ['seafood'], ef: 'mid' },
  { id: 'ms', n: 'Midin belacan + rice + egg', k: 430, p: 15, c: 60, f: 14, fi: 6, al: ['egg', 'seafood'], ef: 'mid' },
  { id: 'ft', n: 'Fruit (papaya/banana) bowl', k: 140, p: 2, c: 34, f: 0, fi: 5, al: [], ef: 'none' },
  { id: 'yg', n: 'Plain yoghurt + banana', k: 210, p: 10, c: 38, f: 3, fi: 3, al: ['dairy'], ef: 'none' },
  { id: 'es', n: 'Egg sandwich + fruit', k: 380, p: 18, c: 46, f: 14, fi: 5, al: ['egg'], ef: 'low' },
  { id: 'tm', n: 'Tempeh + tofu + veg stir-fry + rice', k: 470, p: 26, c: 56, f: 16, fi: 8, al: ['soy'], ef: 'mid' },
  { id: 'cb', n: 'Chicken breast + ulam + brown rice', k: 450, p: 38, c: 50, f: 8, fi: 6, al: [], ef: 'mid' },
  { id: 'dl', n: 'Dhal + chapati + cucumber salad', k: 430, p: 18, c: 64, f: 10, fi: 9, al: [], ef: 'low' }
];
export const ALLERGENS = ['egg', 'peanut', 'seafood', 'dairy', 'soy'];
export const PORTIONS = { S: 0.75, M: 1, L: 1.3 };
export const DEFAULT_TARGETS = { protein: 60, fibre: 25, water: 2000, kcal: 2000 };

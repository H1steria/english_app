// ── Constants ──────────────────────────────────────────
const PAST_PREFIX = "su pasado es";
const RECENT_LIMIT = 20;
const WORDS_URL = 'https://raw.githubusercontent.com/H1steria/english_app/refs/heads/master/words.json';
const PHRASAL_VERBS_URL = 'https://raw.githubusercontent.com/H1steria/english_app/refs/heads/master/phrasal_verbs.json';
const SENTENCES_URL = 'https://raw.githubusercontent.com/H1steria/english_app/refs/heads/master/sentences.json';
const MAIN_WORDS_STORAGE_KEY = 'cached_words';
const MAIN_PHRASALS_STORAGE_KEY = 'cached_phrasal_verbs';
const MAIN_SENTENCES_STORAGE_KEY = 'cached_sentences';
const COMPLETED_STORAGE_KEY = 'completed_words';
const CUSTOM_STORAGE_KEY = 'custom_words';
const WEIGHTS_STORAGE_KEY = 'englishup_word_weights';
const MODE_WEIGHT_STORAGE_KEY = 'englishup_mode_weight_es_en';
const DEFAULT_ES_EN_WEIGHT = 6;
const SORT_LABELS = { weight: '⚖️', az: 'A→Z', za: 'Z→A' };
const SORT_CYCLE = ['weight', 'az', 'za'];

// ── State ──────────────────────────────────────────────
// `words` is a UNIFIED list: vocabulary words + phrasal verbs + full-sentence
// translation items. Each entry carries `type: 'word' | 'phrasal_verb' | 'sentence'`
// and stores its text in `.word` regardless of source, so the rest of the app
// (modes, scoring, weights, hints) doesn't need to know the difference.
let words = [];
let current = null;
let streak = 0;
let usedIndices = [];
let wordCountTrigger = 0;
let recentlySeen = [];
let currentMode = 'en-es';
let currentSentence = null;
let groupSize = parseInt(localStorage.getItem('group_size') || '20', 10);
let selectedGroups = JSON.parse(localStorage.getItem('selected_groups') || '[]');
let useGroupMode = localStorage.getItem('use_group_mode') === 'true';
let revealCount = 0;
let panelTab = 'all';
let panelSearchQuery = '';
let panelSortMode = localStorage.getItem('panel_sort_mode') || 'weight'; // 'weight' | 'az' | 'za'
let completedWords = loadCompletedWords();
let customWords = loadCustomWords();
let esEnWeight = loadModeWeight();

// ── Persistence helpers ─────────────────────────────────
function loadCompletedWords() {
  const saved = localStorage.getItem(COMPLETED_STORAGE_KEY);
  if (!saved) return [];
  try { return JSON.parse(saved); } catch (e) { return []; }
}
function saveCompletedWords() {
  localStorage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify(completedWords));
}
function loadCustomWords() {
  const saved = localStorage.getItem(CUSTOM_STORAGE_KEY);
  if (!saved) return [];
  try { return JSON.parse(saved); } catch (e) { return []; }
}
function saveCustomWords() {
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(customWords));
}
function loadSavedWeights() {
  const saved = localStorage.getItem(WEIGHTS_STORAGE_KEY);
  if (!saved) return {};
  try { return JSON.parse(saved); } catch (e) { return {}; }
}
function syncWeightsWithStorage() {
  const savedWeights = loadSavedWeights();
  words.forEach(w => { savedWeights[w.word] = w.weight; });
  localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(savedWeights));
}
function loadModeWeight() {
  const saved = parseFloat(localStorage.getItem(MODE_WEIGHT_STORAGE_KEY));
  return (!isNaN(saved) && saved >= 1) ? saved : DEFAULT_ES_EN_WEIGHT;
}
function saveModeWeight(value) {
  esEnWeight = value;
  localStorage.setItem(MODE_WEIGHT_STORAGE_KEY, String(value));
}
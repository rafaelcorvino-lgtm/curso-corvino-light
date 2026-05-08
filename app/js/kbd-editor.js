// Editor de teclas do PC — permite ao aluno re-mapear quais teclas do
// teclado tocam quais notas/baixos. Útil pra quem prefere outra disposição
// (canhoto, layout não-ABNT, dor no dedo etc).
//
// Comportamento:
//   1. Aluno aperta "✏️ Editar teclas" (kbd-edit-toggle).
//   2. App força modo ACORDEON (mostra teclas do piano + 40 baixos).
//      Banner aparece com instruções no topo.
//   3. Aluno CLICA em qualquer tecla/baixo → fica destacado.
//   4. Aluno aperta uma tecla DO PC → essa tecla passa a tocar a nota/baixo.
//      Tecla pode ser QUALQUER UMA (mesmo as sem default no KEY_MAP).
//      Se essa tecla já estava em uso, a função antiga fica vaga.
//   5. Os hints (kbd-hint) das teclas/baixos atualizam mostrando a NOVA
//      letra. Aluno também vê no PC keyboard view (modo PC) as customizações
//      das teclas que existem no SVG (pretas Y/U/O/P, Backslash, etc).
//   6. Aluno clica "✓ Concluído" → app volta pro modo PC mostrando o
//      teclado QWERTY com as customizações aplicadas.
//
// Persistência: localStorage, chave 'corvino:kbdMap'. Formato:
//   { "midi:64,bass:0,row:0": "KeyZ", ... }
//   = "Mi MD agora tá na tecla Z"

const STORAGE_KEY = 'corvino:kbdMap';

// State
let editing = false;
let selectedEl = null;     // .key ou .bass-btn DOM element selecionado
let selectedTarget = null; // { midi, isBass, row } da seleção
let appEl = null;
let bannerEl = null;
let stepEl = null;
let editBtn = null;
let resetBtn = null;
let doneBtn = null;
let modeBeforeEdit = null; // 'acordeon' ou 'pc' — pra restaurar ao sair

// Imports lazy (evita ciclo no init)
let _keyboardInput = null;
let _appMode = null;

// Helpers de target ↔ string
function targetKey({ midi, isBass, row = 0 }) {
  return `midi:${midi},bass:${isBass ? 1 : 0},row:${row}`;
}
function parseTargetKey(s) {
  const m = s.match(/^midi:(-?\d+),bass:([01]),row:(\d+)$/);
  if (!m) return null;
  return { midi: +m[1], isBass: !!+m[2], row: +m[3] };
}

// Carrega/salva customizações do localStorage
function loadUserCustomMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (_) { return {}; }
}
function saveUserCustomMap(map) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch (_) {}
}

// Aplica TODAS as customizações: reseta tudo e re-atribui na ordem.
async function applyCustomMap(customMap) {
  if (_keyboardInput && _keyboardInput.resetEffectiveMap) {
    _keyboardInput.resetEffectiveMap();
  }
  const pcKeyboard = await import('./pc-keyboard.js');
  pcKeyboard.resetCodes();

  for (const [tk, newCode] of Object.entries(customMap)) {
    if (!newCode) continue;
    const target = parseTargetKey(tk);
    if (!target) continue;

    // Atribui no keyboard-input (mapa lógico)
    if (_keyboardInput && _keyboardInput.assignToCode) {
      _keyboardInput.assignToCode(target, newCode);
    }

    // Atualiza visual do pc-keyboard:
    // - BASS: usa remapByTarget (cobre as 32 teclas, default + as novas
    //   colunas Fá#/Si/Mi/Lá que não têm default code)
    // - MD: usa remapCode via findOriginalCode (lookup por KEY_MAP default)
    if (target.isBass && pcKeyboard.remapByTarget) {
      pcKeyboard.remapByTarget(target, newCode);
    } else {
      const originalCode = _keyboardInput?.findOriginalCode?.(target);
      if (originalCode) {
        pcKeyboard.remapCode(originalCode, newCode);
      }
    }
  }
}

// ===== Modo edição =====

async function enterEditMode() {
  if (editing) return;
  editing = true;
  if (_appMode) {
    modeBeforeEdit = _appMode.getMode();
    if (modeBeforeEdit !== 'acordeon') _appMode.setMode('acordeon');
  }
  appEl?.classList.add('kbd-editing');
  bannerEl?.classList.remove('hidden');
  editBtn?.classList.add('on');
  setStep('Clique numa tecla do piano ou num baixo pra escolher.');
  selectedEl = null;
  selectedTarget = null;
}

function exitEditMode() {
  editing = false;
  appEl?.classList.remove('kbd-editing');
  bannerEl?.classList.add('hidden');
  editBtn?.classList.remove('on');
  if (selectedEl) selectedEl.classList.remove('kbd-edit-selected');
  selectedEl = null;
  selectedTarget = null;
  if (_appMode && modeBeforeEdit && _appMode.getMode() !== modeBeforeEdit) {
    _appMode.setMode(modeBeforeEdit);
  }
  modeBeforeEdit = null;
}

function setStep(text) {
  if (stepEl) stepEl.textContent = text;
}

// Seleciona uma tecla/baixo pra reatribuir.
function selectKey(el) {
  if (!editing) return;
  if (selectedEl) selectedEl.classList.remove('kbd-edit-selected');
  selectedEl = el;
  el.classList.add('kbd-edit-selected');

  const midi = parseInt(el.dataset.midi, 10);
  const isBass = el.classList.contains('bass-btn');
  const row = isBass ? parseInt(el.dataset.row, 10) : 0;
  selectedTarget = { midi, isBass, row };

  const label = el.textContent?.trim() || `MIDI ${midi}`;
  setStep(`Selecionado: "${label}". Aperte uma tecla do PC pra atribuir.`);
}

// Aluno apertou uma tecla do PC.
async function handleKeyAssign(eventCode) {
  if (!editing || !selectedTarget) return false;

  const customMap = loadUserCustomMap();
  const tk = targetKey(selectedTarget);

  // Libera qualquer tecla que estivesse em eventCode (vira vaga)
  for (const k of Object.keys(customMap)) {
    if (customMap[k] === eventCode) delete customMap[k];
  }

  // Atribui
  customMap[tk] = eventCode;
  saveUserCustomMap(customMap);

  await applyCustomMap(customMap);

  setStep('Atribuído! Selecione outra, ou clique ✓ Concluído.');
  if (selectedEl) selectedEl.classList.remove('kbd-edit-selected');
  selectedEl = null;
  selectedTarget = null;
  return true;
}

async function resetToDefault() {
  if (!confirm('Restaurar todas as teclas pro padrão original? Isso apaga suas customizações.')) return;
  localStorage.removeItem(STORAGE_KEY);
  await applyCustomMap({});
  setStep('Padrão restaurado.');
}

// ===== Init =====

export async function init({ keyboardInput } = {}) {
  _keyboardInput = keyboardInput;
  _appMode = await import('./app-mode.js');

  appEl = document.getElementById('app');
  bannerEl = document.getElementById('kbd-edit-banner');
  stepEl = document.getElementById('kbd-edit-step');
  editBtn = document.getElementById('kbd-edit-toggle');
  resetBtn = document.getElementById('kbd-edit-reset');
  doneBtn = document.getElementById('kbd-edit-done');

  // Carrega customizações e aplica
  const customMap = loadUserCustomMap();
  if (Object.keys(customMap).length > 0) {
    await applyCustomMap(customMap);
  }

  editBtn?.addEventListener('click', () => {
    if (editing) exitEditMode();
    else enterEditMode();
  });
  resetBtn?.addEventListener('click', resetToDefault);
  doneBtn?.addEventListener('click', exitEditMode);

  // Click nas teclas/baixos do app — CAPTURE phase pra rodar antes
  // dos handlers que tocam som.
  document.addEventListener('pointerdown', (e) => {
    if (!editing) return;
    const el = e.target.closest('.key[data-midi], .bass-btn[data-midi], .pc-key[data-code]');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    selectKey(el);
  }, true);

  // Keydown: se editing E tem tecla selecionada, atribui.
  document.addEventListener('keydown', (e) => {
    if (!editing) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      if (selectedEl) {
        selectedEl.classList.remove('kbd-edit-selected');
        selectedEl = null;
        selectedTarget = null;
        setStep('Cancelado. Clique numa tecla pra escolher.');
      } else {
        exitEditMode();
      }
      return;
    }
    if (!selectedTarget) return;
    if (e.repeat) { e.preventDefault(); return; }
    if (['ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight','Tab','Enter','Space'].includes(e.code)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    handleKeyAssign(e.code);
  }, true);
}

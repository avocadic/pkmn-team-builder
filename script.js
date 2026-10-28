import typeData from './type.js';
import comboData from './combo.js';
import abilityData from './ability.js';

const TYPES = [
    'normal', 'fire', 'water', 'electric', 'grass', 'ice',
    'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
    'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
];

const TYPE_COLORS = {
    normal: '#9fa19f', fire: '#e62829', water: '#2980ef', electric: '#fac000',
    grass: '#3fa129', ice: '#3dcef3', fighting: '#ff8000', poison: '#9141cb',
    ground: '#915121', flying: '#81b9ef', psychic: '#ef4179', bug: '#91a119',
    rock: '#afa981', ghost: '#704170', dragon: '#5060e1', dark: '#624d4e',
    steel: '#60a1b8', fairy: '#ef70ef'
};

// Single-type silhouettes fade into a darker, cooler shade of their type color
const SHADE_DARKEN = 12;        // lightness drop, in HSL percentage points
const SHADE_HUE_SHIFT = 8;     // degrees the hue moves toward SHADE_TARGET_HUE
const SHADE_TARGET_HUE = 220;   // blue

const TEAM_SIZE = 6;
const RESULT_COUNT = 10;
const typeDataMap = typeData[0].type_data;

// Track type and ability selections per slot
let slots = Array.from({ length: TEAM_SIZE }, () => ({ types: [null, null], ability: 'nil' }));
let tallyMap = {};
let lastMode = null;
let rankedScores = [];   // every combo from the last calculation, in ranked order
let resultPage = 0;      // which RESULT_COUNT-sized page of rankedScores is shown

// Slot types with duplicates and blanks removed (e.g. [null, 'fire'] -> ['fire'])
function slotTypes(slot) {
    return [...new Set(slot.types.filter(Boolean))];
}

function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// Darker, cooler variant of a hex color (hue nudged toward SHADE_TARGET_HUE along the shorter way round)
function coolerShade(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const lightness = (max + min) / 2;
    let hue = 0;
    let saturation = 0;
    if (delta) {
        saturation = delta / (1 - Math.abs(2 * lightness - 1));
        hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
        hue = (hue * 60 + 360) % 360;
    }
    const hueGap = ((SHADE_TARGET_HUE - hue + 540) % 360) - 180;
    hue += Math.sign(hueGap) * Math.min(Math.abs(hueGap), SHADE_HUE_SHIFT);
    return `hsl(${hue.toFixed(1)} ${(saturation * 100).toFixed(1)}% ${Math.max(0, lightness * 100 - SHADE_DARKEN).toFixed(1)}%)`;
}

// Sprite for a type combo: img/pkmn/primary_secondary.png, then the reversed order, then unknown.png
const SPRITE_DIR = 'img/pkmn';
const spriteCache = new Map();

function imageExists(path) {
    return new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = path;
    });
}

function resolveSprite(types) {
    const key = types.join('_');
    if (!spriteCache.has(key)) {
        const candidates = [key];
        if (types.length > 1) candidates.push([...types].reverse().join('_'));
        spriteCache.set(key, (async () => {
            for (const name of candidates) {
                const path = `${SPRITE_DIR}/${name}.png`;
                if (await imageExists(path)) return path;
            }
            return `${SPRITE_DIR}/unknown.png`;
        })());
    }
    return spriteCache.get(key);
}

// Inner markup for a type pill or menu option: cropped type icon + name
function pillMarkup(type) {
    return `<span class="type-icon" style="background-image:url('img/type/${type}.png')"></span><span class="type-name">${type}</span>`;
}

function setTypeColors(element, type) {
    element.style.setProperty('--type-color', TYPE_COLORS[type]);
    element.style.setProperty('--type-shade', coolerShade(TYPE_COLORS[type]));
}

// ---------- Team slots ----------

function buildTeam() {
    const team = document.getElementById('team');
    for (let index = 0; index < TEAM_SIZE; index++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.innerHTML = `
            <div class="stage">
                <div class="silhouette-outline"><div class="silhouette"></div></div>
            </div>
            <button class="type-pill" data-slot="${index}" data-which="0" aria-haspopup="listbox"></button>
            <button class="type-pill" data-slot="${index}" data-which="1" aria-haspopup="listbox"></button>
            <div class="abil-wrap"><select class="abil" aria-label="Ability for slot ${index + 1}"></select></div>
        `;
        const abilSelect = slot.querySelector('.abil');
        for (const abilityKey in abilityData) {
            const option = document.createElement('option');
            option.value = abilityKey;
            option.textContent = abilityKey === 'nil' ? '--' : abilityData[abilityKey].name;
            abilSelect.appendChild(option);
        }
        abilSelect.addEventListener('change', () => {
            slots[index].ability = abilSelect.value;
            onTeamChange();
        });
        slot.querySelectorAll('.type-pill').forEach(pill => {
            pill.addEventListener('click', event => {
                event.stopPropagation();
                openTypeMenu(pill);
            });
        });
        team.appendChild(slot);
    }
    renderTeam();
}

function renderPill(pill, type) {
    pill.style.removeProperty('--type-color');
    pill.style.removeProperty('--type-shade');
    pill.classList.toggle('empty', !type);
    if (type) {
        setTypeColors(pill, type);
        pill.innerHTML = pillMarkup(type);
        pill.setAttribute('aria-label', `Type ${Number(pill.dataset.which) + 1}: ${capitalize(type)}`);
    } else {
        pill.innerHTML = '<span class="type-name">--</span>';
        pill.setAttribute('aria-label', `Type ${Number(pill.dataset.which) + 1}: none`);
    }
}

function renderTeam() {
    document.querySelectorAll('.slot').forEach((slotElement, index) => {
        const slot = slots[index];
        slotElement.querySelectorAll('.type-pill').forEach((pill, which) => renderPill(pill, slot.types[which]));
        slotElement.querySelector('.abil').value = slot.ability;

        const types = slotTypes(slot);
        const stage = slotElement.querySelector('.stage');
        const silhouette = slotElement.querySelector('.silhouette');
        const spriteKey = types.join('_');
        stage.dataset.sprite = spriteKey;
        stage.classList.toggle('empty', types.length === 0);
        if (types.length) {
            const [first, second = coolerShade(first)] = types.map(type => TYPE_COLORS[type]);
            silhouette.style.setProperty('--c1', first);
            silhouette.style.setProperty('--c2', second);
            resolveSprite(types).then(path => {
                // Skip if the slot changed while the image lookup was in flight
                if (stage.dataset.sprite === spriteKey) {
                    silhouette.style.setProperty('--sprite', `url('${path}')`);
                }
            });
        }
    });
}

// ---------- Type picker menu ----------

const typeMenu = document.createElement('div');
typeMenu.className = 'type-menu';
typeMenu.setAttribute('role', 'listbox');
typeMenu.hidden = true;
typeMenu.innerHTML = '<button class="type-option none" data-type="">-- None --</button>' +
    TYPES.map(type => `<button class="type-option" data-type="${type}" aria-label="${capitalize(type)}">${pillMarkup(type)}</button>`).join('');
typeMenu.querySelectorAll('.type-option[data-type]:not(.none)').forEach(option => setTypeColors(option, option.dataset.type));
document.body.appendChild(typeMenu);
let activePill = null;

function openTypeMenu(pill) {
    if (activePill === pill) {
        closeTypeMenu();
        return;
    }
    activePill = pill;
    const slot = slots[pill.dataset.slot];
    typeMenu.querySelectorAll('.type-option').forEach(option => {
        option.classList.toggle('selected', (option.dataset.type || null) === slot.types[pill.dataset.which]);
    });
    typeMenu.hidden = false;
    positionTypeMenu();
    (typeMenu.querySelector('.selected') || typeMenu.querySelector('.type-option')).focus();
}

// Center the menu under the active pill, kept inside the viewport
function positionTypeMenu() {
    const pillRect = activePill.getBoundingClientRect();
    const menuWidth = typeMenu.offsetWidth;
    const left = Math.min(Math.max(8, pillRect.left + pillRect.width / 2 - menuWidth / 2), document.documentElement.clientWidth - menuWidth - 8);
    typeMenu.style.left = `${left + window.scrollX}px`;
    typeMenu.style.top = `${pillRect.bottom + window.scrollY + 6}px`;
}

function closeTypeMenu() {
    typeMenu.hidden = true;
    if (activePill) activePill.focus();
    activePill = null;
}

typeMenu.addEventListener('click', event => {
    const option = event.target.closest('.type-option');
    if (!option || !activePill) return;
    const slot = slots[activePill.dataset.slot];
    const which = Number(activePill.dataset.which);
    const type = option.dataset.type || null;
    // Picking the type already in the other box is the same as picking "None"
    slot.types[which] = type === slot.types[1 - which] ? null : type;
    // A lone secondary type moves up into the primary box
    if (!slot.types[0]) {
        slot.types = [slot.types[1], null];
    }
    closeTypeMenu();
    onTeamChange();
});
document.addEventListener('click', event => {
    if (activePill && !typeMenu.contains(event.target)) closeTypeMenu();
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activePill) closeTypeMenu();
});
window.addEventListener('resize', () => { if (activePill) positionTypeMenu(); });

// ---------- Reset / random ----------

function resetSelections() {
    slots = Array.from({ length: TEAM_SIZE }, () => ({ types: [null, null], ability: 'nil' }));
    lastMode = null;
    rankedScores = [];
    resultPage = 0;
    onTeamChange();
}

function randomSelections() {
    slots = slots.map(() => {
        const combo = comboData[Math.floor(Math.random() * comboData.length)];
        return { types: [combo.pokemon_type[0], combo.pokemon_type[1] || null], ability: 'nil' };
    });
    onTeamChange();
}

document.getElementById('reset').addEventListener('click', resetSelections);
document.getElementById('random').addEventListener('click', randomSelections);

// ---------- Tallies ----------

function buildTallies() {
    const grid = document.getElementById('tallies');
    grid.innerHTML = TYPES.map(type => `
        <div class="tally" data-type="${type}">
            <img src="img/type/${type}.png" alt="${capitalize(type)}">
            <p class="tally-value">0</p>
        </div>`).join('');
}

// Weighted value of a single tally: capped at 3 when positive, punished harder the more negative it is
function weightTally(tallyValue) {
    if (tallyValue > 3) {
        return 3;
    } else if (tallyValue >= 0) {
        return tallyValue;
    }
    const absValue = Math.abs(tallyValue);
    return -(absValue * (absValue + 1));
}

// Immunities, resistances and weaknesses for a list of types (plus optional ability modifiers)
function getMatchups(pokemon_type, abilityModifiers = {}) {
    let immune2 = new Set();
    let resist2 = new Set();
    let weak2 = new Set();
    let resist4 = new Set();
    let weak4 = new Set();
    // Apply type effects from abilities and type
    if (abilityModifiers.weak2) {
        abilityModifiers.weak2.forEach(type => weak2.add(type));
    }
    if (abilityModifiers.resist2) {
        abilityModifiers.resist2.forEach(type => resist2.add(type));
    }
    pokemon_type.forEach(type => {
        const typeInfo = typeDataMap[type];
        if (typeInfo.immune2) {
            typeInfo.immune2.forEach(t => immune2.add(t));
        }
        if (typeInfo.resists) {
            typeInfo.resists.forEach(t => resist2.has(t) ? resist4.add(t) : resist2.add(t));
        }
        if (typeInfo.weak2) {
            typeInfo.weak2.forEach(t => weak2.has(t) ? weak4.add(t) : weak2.add(t));
        }
    });
    // Override any types with ability immunities
    if (abilityModifiers.immune2) {
        abilityModifiers.immune2.forEach(type => immune2.add(type));
    }
    // Remove resist2/weak2 that are now counted in resist4/weak4
    resist4.forEach(t => resist2.delete(t));
    weak4.forEach(t => weak2.delete(t));
    // Remove weak/resist types that are also in immune2
    immune2.forEach(t => weak4.delete(t));
    immune2.forEach(t => weak2.delete(t));
    immune2.forEach(t => resist2.delete(t));
    immune2.forEach(t => resist4.delete(t));
    // Remove types that are in both resist2 and weak2
    resist2.forEach(t => {
        if (weak2.has(t)) {
            resist2.delete(t);
            weak2.delete(t);
        }
    });
    // Determine neutral types (those that are not in any other set)
    let neutral = new Set(TYPES.filter(type =>
        !immune2.has(type) && !resist2.has(type) && !resist4.has(type) && !weak2.has(type) && !weak4.has(type)
    ));
    return { immune2, resist2, weak2, resist4, weak4, neutral };
}

// Updated tallies based on current selections and abilities
function updateTallies() {
    tallyMap = Object.fromEntries(TYPES.map(type => [type, 0]));
    slots.forEach(slot => {
        const pokemon_type = slotTypes(slot);
        if (!pokemon_type.length) return;
        const abilityModifiers = abilityData[slot.ability]?.modifiers || {};
        const abilityFlags = abilityData[slot.ability]?.flags || '';
        const { immune2, resist2, weak2, resist4, weak4, neutral } = getMatchups(pokemon_type, abilityModifiers);
        // Accumulate tally values
        immune2.forEach(t => tallyMap[t] += 2);
        resist4.forEach(t => tallyMap[t] += 2);
        if (abilityFlags.includes('wg')) {
            resist2.forEach(t => tallyMap[t] += 2);
            neutral.forEach(t => tallyMap[t] += 2);
        } else {
            resist2.forEach(t => tallyMap[t] += 1);
        }
        if (abilityFlags.includes('df')) {
            // Filter-like abilities soften super effective hits
            weak2.forEach(t => tallyMap[t] -= 0.5);
            weak4.forEach(t => tallyMap[t] -= 1.5);
        } else if (abilityFlags.includes('wg')) {
            // Wonder Guard: everything that isn't super effective is blocked
            weak2.forEach(t => tallyMap[t] -= 2);
            weak4.forEach(t => tallyMap[t] -= 2);
        } else {
            weak2.forEach(t => tallyMap[t] -= 1);
            weak4.forEach(t => tallyMap[t] -= 2);
        }
    });
    // Update tally boxes
    let totalScore = 0;
    let weightedScore = 0;
    document.querySelectorAll('.tally').forEach(tally => {
        const tallyValue = tallyMap[tally.dataset.type];
        const valueElement = tally.querySelector('.tally-value');
        valueElement.textContent = tallyValue;
        valueElement.className = `tally-value ${tallyClass(tallyValue)}`;
        totalScore += tallyValue;
        weightedScore += weightTally(tallyValue);
    });
    // Update total and weighted scores
    document.getElementById('total-score').textContent = `Total score: ${totalScore}`;
    document.getElementById('weighted-score').textContent = `Weighted score: ${weightedScore}`;
}

function tallyClass(tallyValue) {
    if (tallyValue >= 3) return 'pos-3';
    if (tallyValue >= 1.5) return 'pos-2';
    if (tallyValue > 0) return 'pos-1';
    if (tallyValue <= -3) return 'neg-3';
    if (tallyValue <= -1.5) return 'neg-2';
    if (tallyValue < 0) return 'neg-1';
    return '';
}

// ---------- Ideal teammate calculation ----------

// Score every type combo as a hypothetical next teammate, ranked best first (worst first in reverse mode)
function calculateCombinations(mode) {
    if (mode !== lastMode) resultPage = 0;
    lastMode = mode;
    const excludeUsedTypes = mode === 'exclusion';
    const reverseTypes = mode === 'reverse';
    const scores = [];
    let usedTypes = new Set();
    if (excludeUsedTypes) {
        slots.forEach(slot => slotTypes(slot).forEach(type => usedTypes.add(type)));
    }
    comboData.forEach(combo => {
        const { pokemon_type, combo_id } = combo;
        if (excludeUsedTypes && pokemon_type.some(type => usedTypes.has(type))) {
            return;  // Skip this combo as it uses a type already in use
        }
        const tempTallyMap = { ...tallyMap };  // Clone the current tally state
        const { immune2, resist2, weak2, resist4, weak4 } = getMatchups(pokemon_type);
        immune2.forEach(t => tempTallyMap[t] += 2);
        resist4.forEach(t => tempTallyMap[t] += 2);
        resist2.forEach(t => tempTallyMap[t] += 1);
        weak2.forEach(t => tempTallyMap[t] -= 1);
        weak4.forEach(t => tempTallyMap[t] -= 2);
        // Calculate the theoretical weighted score
        const weightedScore = Object.values(tempTallyMap).reduce((sum, tallyValue) => sum + weightTally(tallyValue), 0);
        scores.push({ combo_id, pokemon_type, weightedScore });
    });
    // Sort scores from largest to smallest (smallest to largest in reverse mode)
    scores.sort((a, b) => reverseTypes ? a.weightedScore - b.weightedScore : b.weightedScore - a.weightedScore);
    rankedScores = scores;
    renderResults();
}

// Show one page of RESULT_COUNT ranked combos
function renderResults() {
    const pageCount = Math.max(1, Math.ceil(rankedScores.length / RESULT_COUNT));
    resultPage = Math.min(resultPage, pageCount - 1);
    const start = resultPage * RESULT_COUNT;
    const shownScores = rankedScores.slice(start, start + RESULT_COUNT);
    document.querySelectorAll('.calc').forEach(button => {
        button.classList.toggle('active', button.dataset.mode === lastMode);
    });
    document.getElementById('results-hint').hidden = lastMode !== null;
    document.getElementById('results').innerHTML = shownScores.map((score, index) => `
        <div class="result">
            ${score.pokemon_type.map(type => `<img src="img/type/${type}.png" alt="${capitalize(type)}">`).join('')}
            <p class="result-score"><span class="result-rank">#${start + index + 1}</span>${score.weightedScore}</p>
        </div>`).join('');
    document.getElementById('results-pager').hidden = lastMode === null;
    document.getElementById('page-range').textContent = shownScores.length
        ? `${start + 1}–${start + shownScores.length} of ${rankedScores.length}`
        : 'No combos';
    document.getElementById('page-prev').disabled = resultPage === 0;
    document.getElementById('page-next').disabled = resultPage >= pageCount - 1;
}

document.querySelectorAll('.calc').forEach(button => {
    button.addEventListener('click', () => calculateCombinations(button.dataset.mode));
});
document.getElementById('page-prev').addEventListener('click', () => {
    resultPage--;
    renderResults();
});
document.getElementById('page-next').addEventListener('click', () => {
    resultPage++;
    renderResults();
});

// Re-render everything whenever the team changes, re-running the last calculation if one was chosen
function onTeamChange() {
    renderTeam();
    updateTallies();
    if (lastMode) {
        calculateCombinations(lastMode);
    } else {
        renderResults();
    }
}

buildTeam();
buildTallies();
onTeamChange();

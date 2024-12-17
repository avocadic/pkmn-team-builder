import pokemonData from './pokemon.js';
import typeData from './type.js';
import comboData from './combo.js';
import abilityData from './ability.js';

// Track PKMN selections
let currentSelections = Array.from({ length: 6 }, () => null);

// Dropdown menus
function populatePKMNDropdowns() {
    const pkmnSelects = document.querySelectorAll('.pkmn');
    const sortedPokemon = Object.values(pokemonData).sort((a, b) => a.base_id - b.base_id);
    pkmnSelects.forEach((select, index) => {
        sortedPokemon.forEach(pokemon => {
            const option = document.createElement('option');
            option.value = `${pokemon.base_id}_${pokemon.form_id}`;
            option.textContent = pokemon.form_name || pokemon.name;
            select.appendChild(option);
        });
        select.addEventListener('change', (event) => {
            const [baseId, formId] = event.target.value.split('_');
            const selectedPokemon = sortedPokemon.find(pokemon => pokemon.base_id == baseId && pokemon.form_id == formId);
            currentSelections[index] = selectedPokemon;
            updateImage(select, selectedPokemon);
            updateTypes(select, selectedPokemon.pokemon_type);
            updateTallies();
        });
    });
}

function populateABILDropdowns() {
    const abilSelects = document.querySelectorAll('.abil');
    abilSelects.forEach(select => {
        for (const abilityKey in abilityData) {
            const option = document.createElement('option');
            option.value = abilityKey;
            option.textContent = abilityData[abilityKey].name;
            select.appendChild(option);
        }
        select.addEventListener('change', () => {
            updateTallies(); // Recalculate tallies when an ability is selected
        });
    });
}

function populateDropdowns(pokemonData, abilityData) {
    populatePKMNDropdowns(pokemonData);
    populateABILDropdowns(abilityData);
}

// Reset button functionality
function resetSelections() {
    const selects = document.querySelectorAll('select');
    selects.forEach(select => {
        select.selectedIndex = 0;
    });
    const imagePlaceholders = document.querySelectorAll('.image-placeholder.large, .image-placeholder.small');
    imagePlaceholders.forEach(placeholder => {
        placeholder.style.backgroundImage = 'none';
    });
    currentSelections = Array.from({ length: 6 }, () => null);
    updateTallies();
    const scoreboxes = document.querySelectorAll('.scorebox');
    scoreboxes.forEach(scorebox => {
        const scoreElement = scorebox.querySelector('p.inline');
        if (scoreElement) {
            scoreElement.textContent = '0';
        }
    });
}

// Random button functionality
function randomSelections() {
    const selects = document.querySelectorAll('.pkmn');
    const sortedPokemon = Object.values(pokemonData).sort((a, b) => a.base_id - b.base_id);
    selects.forEach((select, index) => {
        const randomIndex = Math.floor(Math.random() * sortedPokemon.length) - 1;
        select.selectedIndex = randomIndex;
        const selectedValue = select.options[randomIndex].value;
        const [baseId, formId] = selectedValue.split('_');
        const selectedPokemon = sortedPokemon.find(pokemon => pokemon.base_id == baseId && pokemon.form_id == formId);
        currentSelections[index] = selectedPokemon;
        updateImage(select, selectedPokemon);
        updateTypes(select, selectedPokemon.pokemon_type);
    });
    updateTallies();
}

// Selection button calls
document.getElementById('reset').addEventListener('click', resetSelections);
document.getElementById('random').addEventListener('click', randomSelections);

// Main image updater
function updateImage(select, selectedPokemon) {
    const baseIdFormatted = selectedPokemon.base_id.toString().padStart(4, '0');
    const formIdFormatted = selectedPokemon.form_id ? `_${selectedPokemon.form_id.toString().padStart(2, '0')}` : '';
    const imagePath = `img/pkmn/${baseIdFormatted}${formIdFormatted}.png`;
    const box = select.closest('.box');
    const imagePlaceholder = box.querySelector('.image-placeholder.large');
    imagePlaceholder.style.backgroundImage = `url('${imagePath}')`;
    imagePlaceholder.style.backgroundSize = 'cover';
    imagePlaceholder.style.backgroundPosition = 'center';
}

// Type image(s) updater
function updateTypes(select, pokemonTypes) {
    const box = select.closest('.box');
    const typePlaceholders = box.querySelectorAll('.image-placeholder.small');
    typePlaceholders.forEach((placeholder, index) => {
        if (pokemonTypes[index]) {
            const typeImagePath = `img/type/${pokemonTypes[index]}.png`;
            placeholder.style.backgroundImage = `url('${typeImagePath}')`;
            placeholder.style.backgroundSize = 'cover';
            placeholder.style.backgroundPosition = 'center';
        } else {
            placeholder.style.backgroundImage = 'none';
        }
    });
}

function handleAbility(selectedAbility) {
    if (selectedAbility === 'Filter') {
        weak2.forEach(t => tallyMap[t] = (tallyMap[t] || 0) - 0.5);
        weak4.forEach(t => tallyMap[t] = (tallyMap[t] || 0) - 1.5);
    }
}

// Updated tallies based on current selections and abilities
function updateTallies() {
    const tallies = document.querySelectorAll('.tally p');
    tallies.forEach(tally => {
        tally.textContent = '0';
        tally.style.color = '';
    });
    let tallyMap = {};
    let totalScore = 0;
    let weightedScore = 0;
    currentSelections.forEach((selection, index) => {
        if (selection) {
            const { pokemon_type } = selection;
            const abilitySelect = document.querySelectorAll('.abil')[index];
            const selectedAbility = abilitySelect.value;
            const abilityModifiers = abilityData[selectedAbility]?.modifiers || {};
            const abilityFlags = abilityData[selectedAbility]?.flags || '';
            const typeDataMap = typeData[0].type_data;
            let immune2 = new Set();
            let resist2 = new Set();
            let weak2 = new Set();
            let resist4 = new Set();
            let weak4 = new Set();
            let neutral = new Set();
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
            // Remove weak2/resist2 types that are also in immune2
            immune2.forEach(t => weak4.delete(t));
            immune2.forEach(t => weak2.delete(t));
            immune2.forEach(t => resist2.delete(t));
            // Remove types that are in both resist2 and weak2
            resist2.forEach(t => {
                if (weak2.has(t)) {
                    resist2.delete(t);
                    weak2.delete(t);
                }
            });
            // Determine neutral types (those that are not in immune2, resist2, or weak2)
            Object.keys(typeDataMap).forEach(type => {
                if (
                    !immune2.has(type) &&
                    !resist2.has(type) &&
                    !resist4.has(type) &&
                    !weak4.has(type) &&
                    !weak2.has(type)
                ) {
                    neutral.add(type);
                }
            });
            // Accumulate tally values
            immune2.forEach(t => tallyMap[t] = (tallyMap[t] || 0) + 2);
            resist4.forEach(t => tallyMap[t] = (tallyMap[t] || 0) + 2);
            if (abilityFlags.includes('wg')) {
                resist2.forEach(t => tallyMap[t] = (tallyMap[t] || 0) + 2);
                neutral.forEach(t => tallyMap[t] = (tallyMap[t] || 0) + 2);
            } else {
                resist2.forEach(t => tallyMap[t] = (tallyMap[t] || 0) + 1);
            }
            if (abilityFlags.includes('df')) {
                // Modify weak2 and weak4 values as described when "df" flag is present
                weak2.forEach(t => tallyMap[t] = (tallyMap[t] || 0) - 0.5);
                weak4.forEach(t => tallyMap[t] = (tallyMap[t] || 0) - 1.5);
            } else if (abilityFlags.includes('wg')) {
                // Modify weak2 and weak4 values as described when "wg" flag is present
                weak2.forEach(t => tallyMap[t] = (tallyMap[t] || 0) - 2);
                weak4.forEach(t => tallyMap[t] = (tallyMap[t] || 0) - 2);
            } else {
                // Default behavior (when "df" flag is not present)
                weak2.forEach(t => tallyMap[t] = (tallyMap[t] || 0) - 1);
                weak4.forEach(t => tallyMap[t] = (tallyMap[t] || 0) - 2);
            }
        }
    });
    // Update tally boxes
    const typeImages = document.querySelectorAll('.tally img');
    typeImages.forEach(img => {
        const type = img.src.split('/').pop().split('.')[0];
        const tally = document.querySelector(`.tally img[src$="${type}.png"]`).nextElementSibling;
        const tallyValue = tallyMap[type] || 0;
        tally.textContent = tallyValue;
        totalScore += tallyValue;
        // Calculate weighted score and update tally colors
        let weightedValue = 0;
        if (tallyValue > 3) {
            weightedValue = 3;
        } else if (tallyValue >= 0 && tallyValue <= 3) {
            weightedValue = tallyValue;
        } else {
            const absValue = Math.abs(tallyValue);
            weightedValue = -(absValue * (absValue + 1));
        }
        weightedScore += weightedValue;
        if (tallyValue >= 3) {
            tally.style.color = '#0C0';
        } else if (tallyValue >= 1.5 && tallyValue < 3) {
            tally.style.color = '#090';
        } else if (tallyValue > 0 && tallyValue < 1.5) {
            tally.style.color = '#060';
        } else if (tallyValue <= -3) {
            tally.style.color = '#C00';
        } else if (tallyValue <= -1.5 && tallyValue > -3) {
            tally.style.color = '#900';
        } else if (tallyValue < 0 && tallyValue > -1.5) {
            tally.style.color = '#600';
        }
    });
    // Update total and weighted scores
    document.querySelector('.score p.inline').textContent = `Total score: ${totalScore}`;
    const weightedScoreElement = document.querySelectorAll('.score p.inline')[1];
    weightedScoreElement.textContent = `Weighted score: ${weightedScore}`;
}

// Function to calculate and log weighted scores for each combination
function calculateCombinations(excludeUsedTypes = False, reverseTypes = False) {
    const currentTallyMap = getCurrentTallyMap();  // Get current tally state
    const scores = [];
    let usedTypes = new Set();
    if (excludeUsedTypes) {
        currentSelections.forEach(selection => {
            if (selection) {
                selection.pokemon_type.forEach(type => usedTypes.add(type));
            }
        });
    }
    comboData.forEach(combo => {
        const tempTallyMap = { ...currentTallyMap };  // Clone the current tally state
        const { pokemon_type, combo_id } = combo;
        if (excludeUsedTypes && pokemon_type.some(type => usedTypes.has(type))) {
            return;  // Skip this combo as it uses a type already in use
        }
        let immune2 = new Set();
        let resist2 = new Set();
        let weak2 = new Set();
        let resist4 = new Set();
        let weak4 = new Set();
        // Process the pokemon_type of the combo
        pokemon_type.forEach(type => {
            const typeInfo = typeData[0].type_data[type];
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

        // Remove resist2/weak2 that are now counted in resist4/weak4
        resist4.forEach(t => resist2.delete(t));
        weak4.forEach(t => weak2.delete(t));
        // Remove weak2/resist2 types that are also in immune2
        immune2.forEach(t => weak2.delete(t));
        immune2.forEach(t => resist2.delete(t));
        // Remove types that are in both resist2 and weak2
        resist2.forEach(t => {
            if (weak2.has(t)) {
                resist2.delete(t);
                weak2.delete(t);
            }
        });

        // Accumulate temporary tally values for the combo
        immune2.forEach(t => tempTallyMap[t] = (tempTallyMap[t] || 0) + 2);
        resist4.forEach(t => tempTallyMap[t] = (tempTallyMap[t] || 0) + 2);
        resist2.forEach(t => tempTallyMap[t] = (tempTallyMap[t] || 0) + 1);
        weak2.forEach(t => tempTallyMap[t] = (tempTallyMap[t] || 0) - 1);
        weak4.forEach(t => tempTallyMap[t] = (tempTallyMap[t] || 0) - 2);

        // Calculate the theoretical weighted score
        let totalScore = 0;
        let weightedScore = 0;
        for (let tallyValue of Object.values(tempTallyMap)) {
            totalScore += tallyValue;
            let weightedValue = 0;
            if (tallyValue > 3) {
                weightedValue = 3; // Cap at 3
            } else if (tallyValue >= 0 && tallyValue <= 3) {
                weightedValue = tallyValue; // Same value as tally
            } else {
                // Calculate triangular number for negative tally values
                const absValue = Math.abs(tallyValue);
                weightedValue = -(absValue * (absValue + 1));
            }
            weightedScore += weightedValue;
        }
        scores.push({ combo_id, weightedScore });
        // Print the combo_id and its corresponding weighted score
        // console.log(`Combo ID: ${combo_id}, Weighted Score: ${weightedScore}`);
    });
    // Sort scores from largest to smallest and get the top 10
    scores.sort((a, b) => b.weightedScore - a.weightedScore);
    const top10Scores = reverseTypes ? scores.slice(161, 172).reverse() : scores.slice(0, 10);
    const scoreboxes = document.querySelectorAll('.scorebox');
    top10Scores.forEach((score, index) => {
        if (index < scoreboxes.length) {
            const scorebox = scoreboxes[index];
            const imagePlaceholders = scorebox.querySelectorAll('.image-placeholder.small');
            // Assuming combo_id can be used to fetch an image or relevant details
            const combo = comboData.find(combo => combo.combo_id === score.combo_id);
            const types = combo.pokemon_type;
            imagePlaceholders.forEach((placeholder, i) => {
                if (types[i]) {
                    const typeImagePath = `img/type/${types[i]}.png`;
                    placeholder.style.backgroundImage = `url('${typeImagePath}')`;
                    placeholder.style.backgroundSize = 'cover';
                    placeholder.style.backgroundPosition = 'center';
                } else {
                    // Clear the placeholder if no type is available for that slot
                    placeholder.style.backgroundImage = 'none';
                }
            });
            const scoreElement = scorebox.querySelector('p.inline');
            scoreElement.textContent = score.weightedScore;
        }
    });
}

// Helper function to get the current tally map
function getCurrentTallyMap() {
    let tallyMap = {};
    const typeImages = document.querySelectorAll('.tally img');
    typeImages.forEach(img => {
        const type = img.src.split('/').pop().split('.')[0];
        const tally = img.nextElementSibling;
        const tallyValue = parseInt(tally.textContent, 10);
        if (!isNaN(tallyValue)) {
            tallyMap[type] = tallyValue;
        }
    });
    return tallyMap;
}

// Button call to calculate the next combo
document.getElementById('combocalc').addEventListener('click', () => calculateCombinations(false, false));
document.getElementById('combocalc-ex').addEventListener('click', () => calculateCombinations(true, false));
document.getElementById('combocalc-rv').addEventListener('click', () => calculateCombinations(false, true));

// Call the function to populate the dropdowns once the document is loaded
document.addEventListener('DOMContentLoaded', populateDropdowns);
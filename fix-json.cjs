const fs = require('fs');
const path = require('path');

// ===== P1 + P6: Конвертация spells.json =====
const spellsRaw = JSON.parse(fs.readFileSync('public/assets/data/spells.json', 'utf8'));
const spellsArray = Object.values(spellsRaw);

// P6: Удаляем 5 выдуманных заклинаний
const fakeSpells = ['rubber_band', 'accident', 'chaining', 'shield_wall', 'precision_shot'];
const filteredSpells = spellsArray.filter(s => !fakeSpells.includes(s.id));

const spellsOutput = { spells: filteredSpells };
fs.writeFileSync('public/assets/data/spells.json', JSON.stringify(spellsOutput, null, 2), 'utf8');
console.log(`spells.json: ${spellsArray.length} -> ${filteredSpells.length} заклинаний (удалено ${spellsArray.length - filteredSpells.length})`);

// ===== P2: Конвертация artifacts.json =====
const artifactsRaw = JSON.parse(fs.readFileSync('public/assets/data/artifacts.json', 'utf8'));
const artifactsArray = Object.values(artifactsRaw);
const artifactsOutput = { artifacts: artifactsArray };
fs.writeFileSync('public/assets/data/artifacts.json', JSON.stringify(artifactsOutput, null, 2), 'utf8');
console.log(`artifacts.json: ${artifactsArray.length} артефактов`);

// ===== P7: Добавить нейтральных существ в creatures.json =====
const creaturesRaw = JSON.parse(fs.readFileSync('public/assets/data/creatures.json', 'utf8'));
let creaturesArray;
if (Array.isArray(creaturesRaw)) {
  creaturesArray = creaturesRaw;
} else if (creaturesRaw.creatures) {
  creaturesArray = creaturesRaw.creatures;
} else {
  creaturesArray = Object.values(creaturesRaw);
}

// Проверяем, есть ли уже нейтральные
const hasNeutrals = creaturesArray.some(c => c.faction === 'neutral');
if (!hasNeutrals) {
  const neutralCreatures = [
    {
      "id": "peasant",
      "name": "Крестьянин",
      "nameEn": "Peasant",
      "faction": "neutral",
      "level": 1,
      "attack": 1,
      "defense": 1,
      "damageMin": 1,
      "damageMax": 2,
      "hp": 5,
      "speed": 3,
      "initiative": 10,
      "cost": 30,
      "growth": 20,
      "abilities": []
    },
    {
      "id": "rogue",
      "name": "Разбойник",
      "nameEn": "Rogue",
      "faction": "neutral",
      "level": 2,
      "attack": 5,
      "defense": 3,
      "damageMin": 2,
      "damageMax": 4,
      "hp": 15,
      "speed": 5,
      "initiative": 12,
      "cost": 100,
      "growth": 12,
      "abilities": []
    },
    {
      "id": "wolf",
      "name": "Волк",
      "nameEn": "Wolf",
      "faction": "neutral",
      "level": 2,
      "attack": 6,
      "defense": 2,
      "damageMin": 3,
      "damageMax": 5,
      "hp": 12,
      "speed": 6,
      "initiative": 14,
      "cost": 80,
      "growth": 14,
      "abilities": ["no_retaliation"]
    },
    {
      "id": "ghost",
      "name": "Призрак",
      "nameEn": "Ghost",
      "faction": "neutral",
      "level": 3,
      "attack": 7,
      "defense": 5,
      "damageMin": 4,
      "damageMax": 7,
      "hp": 25,
      "speed": 5,
      "initiative": 11,
      "cost": 200,
      "growth": 8,
      "abilities": ["ethereal", "fear"]
    },
    {
      "id": "mummy",
      "name": "Мумия",
      "nameEn": "Mummy",
      "faction": "neutral",
      "level": 3,
      "attack": 6,
      "defense": 7,
      "damageMin": 3,
      "damageMax": 6,
      "hp": 30,
      "speed": 3,
      "initiative": 8,
      "cost": 175,
      "growth": 9,
      "abilities": ["disease"]
    },
    {
      "id": "naga",
      "name": "Нага",
      "nameEn": "Naga",
      "faction": "neutral",
      "level": 5,
      "attack": 12,
      "defense": 10,
      "damageMin": 10,
      "damageMax": 15,
      "hp": 60,
      "speed": 5,
      "initiative": 11,
      "cost": 600,
      "growth": 4,
      "abilities": ["no_retaliation"]
    },
    {
      "id": "titan",
      "name": "Титан",
      "nameEn": "Titan",
      "faction": "neutral",
      "level": 6,
      "attack": 18,
      "defense": 16,
      "damageMin": 25,
      "damageMax": 35,
      "hp": 150,
      "speed": 6,
      "initiative": 10,
      "cost": 3000,
      "growth": 1,
      "abilities": ["ranged", "lightning_immunity"]
    },
    {
      "id": "faerie_dragon",
      "name": "Фейный дракон",
      "nameEn": "Faerie Dragon",
      "faction": "neutral",
      "level": 4,
      "attack": 9,
      "defense": 8,
      "damageMin": 6,
      "damageMax": 10,
      "hp": 40,
      "speed": 7,
      "initiative": 15,
      "cost": 400,
      "growth": 5,
      "abilities": ["magic_resistance", "spell_caster"]
    },
    {
      "id": "firebird",
      "name": "Жар-птица",
      "nameEn": "Firebird",
      "faction": "neutral",
      "level": 5,
      "attack": 14,
      "defense": 12,
      "damageMin": 12,
      "damageMax": 18,
      "hp": 70,
      "speed": 8,
      "initiative": 16,
      "cost": 800,
      "growth": 3,
      "abilities": ["fire_breath", "flying"]
    },
    {
      "id": "gold_dragon",
      "name": "Золотой дракон",
      "nameEn": "Gold Dragon",
      "faction": "neutral",
      "level": 6,
      "attack": 20,
      "defense": 18,
      "damageMin": 30,
      "damageMax": 40,
      "hp": 180,
      "speed": 7,
      "initiative": 12,
      "cost": 4000,
      "growth": 1,
      "abilities": ["magic_immunity", "flying", "dragon"]
    }
  ];
  creaturesArray.push(...neutralCreatures);
  console.log(`creatures.json: добавлено ${neutralCreatures.length} нейтральных существ`);
}

const creaturesOutput = { creatures: creaturesArray };
fs.writeFileSync('public/assets/data/creatures.json', JSON.stringify(creaturesOutput, null, 2), 'utf8');
console.log(`creatures.json: всего ${creaturesArray.length} существ`);

console.log('\n✅ Все JSON файлы сконвертированы!');

// ============================================
// ANIME FIGHT ARENA
// Motor de combate 2D feito com JavaScript
// ============================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const $ = (id) => document.getElementById(id);

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const FLOOR = 440;

// Sprites recortados da folha de movimentos do Asta.
const astaSprites = Array.from({ length: 14 }, (_, index) => {
    const sprite = new Image();
    sprite.src = `assets/asta/pose-${index}.png`;
    return sprite;
});

const yunoSprite = new Image();
yunoSprite.src = "assets/yuno/yuno.png";

const yamiSpriteSheet = new Image();
yamiSpriteSheet.src = "Ficha de Personagem Yami Sukehiro.png";
const yamiSprites = {
    idle: [],
    run: [],
    jump: [],
    attack: []
};

const YAMI_SPRITE_RECTS = {
    idle: [
        [25, 515, 65, 162],
        [110, 515, 65, 162],
        [201, 515, 68, 162],
        [298, 515, 72, 162]
    ],
    run: [
        [421, 515, 112, 162],
        [566, 515, 127, 162],
        [710, 515, 110, 162]
    ],
    jump: [
        [844, 515, 64, 162],
        [915, 515, 80, 162],
        [1015, 515, 80, 162],
        [1118, 515, 100, 162]
    ],
    attack: [
        [20, 700, 100, 177],
        [117, 700, 86, 177],
        [199, 700, 93, 177],
        [288, 700, 95, 177],
        [380, 700, 100, 177],
        [475, 700, 180, 177]
    ]
};

yamiSpriteSheet.addEventListener("load", () => {
    for (const [animation, rectangles] of Object.entries(YAMI_SPRITE_RECTS)) {
        yamiSprites[animation] = rectangles.map((rectangle) => createYamiSprite(rectangle));
    }

    render();
});

const CHARACTER_ORDER = ["ASTA", "YUNO", "YAMI", "NOELLE"];
const CHARACTER_DATA = {
    ASTA: {
        color: "#242536",
        accent: "#ff294b",
        abilities: [
            { key: "u", type: "astaSwordWave", label: "Onda cortante" },
            { key: "i", type: "astaMeteor", label: "Meteoro negro" }
        ]
    },
    YUNO: {
        color: "#152b48",
        accent: "#39aaff",
        abilities: [
            { key: "o", type: "yunoTornado", label: "Tornado de vento" },
            { key: "p", type: "yunoStarStorm", label: "Tempestade estelar" }
        ]
    },
    YAMI: {
        color: "#252326",
        accent: "#c9a56a",
        abilities: [
            { key: "u", type: "yamiDimensionSlash", label: "Corte dimensional" }
        ]
    },
    NOELLE: {
        color: "#d9edf5",
        accent: "#63cde9",
        abilities: [
            { key: "u", type: "noelleSeaDragon", label: "Dragão do mar" }
        ]
    }
};

const SPECIAL_MOVES = {
    astaSwordWave: { energy: 30, duration: 0.48, cooldown: 0.7, color: "#ff4b66", size: 150, effect: "antiMagicWave" },
    astaMeteor: { energy: 55, duration: 0.75, cooldown: 1.05, color: "#ffb347", size: 175, effect: "meteor" },
    yunoTornado: { energy: 35, duration: 0.58, cooldown: 0.82, color: "#4edcff", size: 150, effect: "windTornado" },
    yunoStarStorm: { energy: 60, duration: 0.8, cooldown: 1.15, color: "#7a8cff", size: 175, effect: "starStorm" },
    yamiDimensionSlash: { energy: 40, duration: 0.62, cooldown: 0.9, color: "#8742b8", secondaryColor: "#c9a56a", size: 190, effect: "dimensionSlash" },
    noelleSeaDragon: { energy: 40, duration: 0.65, cooldown: 0.95, color: "#63d9f3", size: 190, effect: "waterDragon" }
};

const keys = {};

let gameRunning = false;
let gameOver = false;
let lastTime = 0;
let elapsed = 0;
let timeLeft = 99;

let particles = [];
let effects = [];
let shake = 0;

let combo = 0;
let comboTimer = 0;
let selectedCharacter = "ASTA";

// ============================================
// PERSONAGENS
// ============================================

function createFighter(name, x, facing) {
    const character = CHARACTER_DATA[name];

    return {
        name,
        x,
        y: FLOOR,
        vx: 0,
        movementTarget: 0,
        vy: 0,

        width: 48,
        height: 100,

        color: character.color,
        accent: character.accent,
        facing,

        health: 100,
        energy: 0,

        grounded: true,
        blocking: false,

        attacking: false,
        attackType: "",
        attackTimer: 0,
        attackCooldown: 0,
        hasHit: false,

        hurtTimer: 0,
        invulnerable: 0,

        flash: 0,
        animation: 0,

        jumps: 0
    };
}

function createYamiSprite([x, y, width, height]) {
    const sprite = document.createElement("canvas");
    sprite.width = width;
    sprite.height = height;

    const spriteContext = sprite.getContext("2d", { willReadFrequently: true });
    spriteContext.drawImage(yamiSpriteSheet, x, y, width, height, 0, 0, width, height);

    const imageData = spriteContext.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    for (let index = 0; index < pixels.length; index += 4) {
        const distance = Math.hypot(
            pixels[index] - 14,
            pixels[index + 1] - 20,
            pixels[index + 2] - 27
        );

        if (distance < 12) {
            pixels[index + 3] = 0;
        } else if (distance < 22) {
            pixels[index + 3] *= (distance - 12) / 10;
        }
    }

    spriteContext.putImageData(imageData, 0, 0);
    return sprite;
}

let player;
let enemy;

function resetGame() {
    const rivalName = getOpponentCharacterName(selectedCharacter);
    player = createFighter(selectedCharacter, 240, 1);
    enemy = createFighter(rivalName, 720, -1);

    player.energy = 20;
    enemy.energy = 20;

    particles = [];
    effects = [];

    shake = 0;
    combo = 0;
    comboTimer = 0;

    elapsed = 0;
    timeLeft = 99;

    gameOver = false;
    gameRunning = false;

    updateHUD();
    $("timer").textContent = "99";
    $("comboDisplay").textContent = "";

    $("selectionScreen").hidden = false;
    $("resultScreen").hidden = true;
    $("overlay").classList.remove("hidden");
    updateSelectionUI();

    render();
}

function getOpponentCharacterName(name) {
    const index = CHARACTER_ORDER.indexOf(name);
    return CHARACTER_ORDER[(index + 1) % CHARACTER_ORDER.length];
}

function updateSelectionUI() {
    const rivalName = getOpponentCharacterName(selectedCharacter);
    const abilities = CHARACTER_DATA[selectedCharacter].abilities;

    document.querySelectorAll(".character-option").forEach((option) => {
        const isSelected = option.dataset.character === selectedCharacter;
        option.classList.toggle("is-selected", isSelected);
        option.setAttribute("aria-pressed", String(isSelected));
    });

    $("matchupText").textContent = `${selectedCharacter} VS. ${rivalName}`;

    for (let index = 0; index < 2; index++) {
        const ability = abilities[index];
        const control = $(index === 0 ? "abilityControlOne" : "abilityControlTwo");

        control.hidden = !ability;

        if (ability) {
            $(index === 0 ? "abilityKeyOne" : "abilityKeyTwo").textContent = ability.key.toUpperCase();
            $(index === 0 ? "abilityNameOne" : "abilityNameTwo").textContent = ability.label;
        }
    }
}

// ============================================
// CONTROLES
// ============================================

window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (
        ["a", "d", "w", "s", "j", "k", "l", "u", "i", "o", "p", " "]
        .includes(key)
    ) {
        event.preventDefault();
    }

    if (!keys[key] && gameRunning) {
        if (key === "j") attack(player, "light");
        if (key === "k") attack(player, "heavy");
        if (key === "l") attack(player, "special");
        const ability = CHARACTER_DATA[player.name].abilities.find(
            (move) => move.key === key
        );

        if (ability) attack(player, ability.type);

        if (key === "w" && player.grounded) {
            player.vy = -520;
            player.grounded = false;
            player.jumps = 1;

            spawnParticles(
                player.x,
                FLOOR,
                "#aab8ff",
                7
            );
        }
    }

    keys[key] = true;
});

window.addEventListener("keyup", (event) => {
    keys[event.key.toLowerCase()] = false;
});

document.querySelectorAll(".character-option").forEach((option) => {
    option.addEventListener("click", () => {
        selectedCharacter = option.dataset.character;
        updateSelectionUI();
    });
});

$("startButton").addEventListener("click", () => {
    resetGame();
    gameRunning = true;
    $("overlay").classList.add("hidden");
});

$("restartButton").addEventListener("click", resetGame);
$("chooseAgainButton").addEventListener("click", resetGame);

// ============================================
// ATAQUES
// ============================================

function attack(fighter, type) {
    if (
        fighter.attackCooldown > 0 ||
        fighter.hurtTimer > 0 ||
        fighter.attacking ||
        fighter.health <= 0
    ) {
        return;
    }

    const isNewSpecial = Object.prototype.hasOwnProperty.call(SPECIAL_MOVES, type);

    if (type === "special" || isNewSpecial) {
        const cost = isNewSpecial ? SPECIAL_MOVES[type].energy : 35;
        const hasAbility = CHARACTER_DATA[fighter.name].abilities.some(
            (ability) => ability.type === type
        );

        if (isNewSpecial && !hasAbility) {
            showMessage(`PODER INDISPONIVEL PARA ${fighter.name}`);
            return;
        }

        if (fighter.energy < cost) {
            showMessage("ENERGIA INSUFICIENTE");
            return;
        }

        fighter.energy -= cost;
    }

    fighter.attacking = true;
    fighter.attackType = type;
    fighter.hasHit = false;

    if (type === "light") {
        fighter.attackTimer = 0.22;
        fighter.attackCooldown = 0.32;
    }
    if (type === "heavy") {
        fighter.attackTimer = 0.36;
        fighter.attackCooldown = 0.52;
    }
    if (type === "special") {
        fighter.attackTimer = 0.55;
        fighter.attackCooldown = 0.85;
    }
    if (isNewSpecial) {
        fighter.attackTimer = SPECIAL_MOVES[type].duration;
        fighter.attackCooldown = SPECIAL_MOVES[type].cooldown;
    }

    if (type === "light" || type === "heavy") {
        const heavy = type === "heavy";

        effects.push({
            type: heavy ? "heavySlash" : "bladeSlash",
            x: fighter.x + fighter.facing * 28,
            y: fighter.y - 74,
            facing: fighter.facing,
            color: fighter.accent,
            life: heavy ? 0.34 : 0.22,
            maxLife: heavy ? 0.34 : 0.22,
            size: heavy ? 100 : 70
        });

        spawnParticles(fighter.x + fighter.facing * 28, fighter.y - 74, fighter.accent, heavy ? 12 : 6);
    }

    if (type === "special" || isNewSpecial) {
        const move = SPECIAL_MOVES[type] || {};
        const color = move.color || fighter.accent;
        const characterEffect = {
            ASTA: "antiMagicWave",
            YUNO: "windTornado",
            YAMI: "dimensionSlash",
            NOELLE: "waterDragon"
        }[fighter.name];

        spawnParticles(fighter.x, fighter.y - 55, color, isNewSpecial ? 28 : 18);

        effects.push({
            type: move.effect || characterEffect,
            x: fighter.x + fighter.facing * 45,
            y: fighter.y - 58,
            facing: fighter.facing,
            color,
            secondaryColor: move.secondaryColor || fighter.accent,
            life: isNewSpecial ? 0.55 : 0.35,
            maxLife: isNewSpecial ? 0.55 : 0.35,
            size: move.size || 125
        });
    }
}

function checkAttack(attacker, target) {
    if (!attacker.attacking || attacker.hasHit) return;

    const durations = {
        light: 0.22,
        heavy: 0.36,
        special: 0.55,
        astaSwordWave: 0.48,
        astaMeteor: 0.75,
        yunoTornado: 0.58,
        yunoStarStorm: 0.8,
        yamiDimensionSlash: 0.62,
        noelleSeaDragon: 0.65
    };

    const duration = durations[attacker.attackType];
    const progress = 1 - attacker.attackTimer / duration;

    if (progress < 0.18 || progress > 0.72) return;

    const ranges = {
        light: 76,
        heavy: 105,
        special: 165,
        astaSwordWave: 210,
        astaMeteor: 235,
        yunoTornado: 190,
        yunoStarStorm: 280,
        yamiDimensionSlash: 220,
        noelleSeaDragon: 220
    };

    const distance = Math.abs(attacker.x - target.x);
    const correctDirection = (target.x - attacker.x) * attacker.facing > 0;

    if (distance < ranges[attacker.attackType] && correctDirection && Math.abs(attacker.y - target.y) < 110) {
        attacker.hasHit = true;

        const damages = {
            light: 7,
            heavy: 13,
            special: 20,
            astaSwordWave: 22,
            astaMeteor: 32,
            yunoTornado: 24,
            yunoStarStorm: 34,
            yamiDimensionSlash: 29,
            noelleSeaDragon: 28
        };

        applyDamage(attacker, target, damages[attacker.attackType]);
    }
}

function applyDamage(attacker, target, damage) {
    if (
        target.invulnerable > 0 ||
        target.health <= 0
    ) {
        return;
    }

    // A defesa reduz o dano recebido.
    const blocked = target.blocking;

    const finalDamage = blocked
        ? Math.ceil(damage * 0.2)
        : damage;

    target.health = Math.max(
        0,
        target.health - finalDamage
    );

    target.flash = 0.12;
    target.invulnerable = 0.24;

    target.vx = blocked
        ? attacker.facing * 90
        : attacker.facing * 230;

    if (!blocked) {
        target.vy = -130;
        target.grounded = false;
        target.hurtTimer = 0.18;
    }

    attacker.energy = Math.min(
        100,
        attacker.energy + 10
    );

    target.energy = Math.min(
        100,
        target.energy + 5
    );

    shake = blocked ? 3 : 7;

    spawnParticles(
        target.x,
        target.y - 55,
        blocked ? "#d7e5ff" : attacker.accent,
        blocked ? 5 : 14
    );

    effects.push({
        type: "impact",
        x: target.x,
        y: target.y - 55,
        color: blocked ? "#ffffff" : attacker.accent,
        life: 0.25,
        maxLife: 0.25,
        size: blocked ? 24 : 40
    });

    if (!blocked && attacker === player) {
        combo++;

        comboTimer = 1.2;

        $("comboDisplay").textContent =
            combo > 1 ? `${combo} HITS!` : "1 HIT!";
    }

    updateHUD();

    if (target.health <= 0) {
        finishGame(
            `${attacker.name} VENCEU!`
        );
    }
}

// ============================================
// ADVERSÁRIO CONTROLADO PELO COMPUTADOR
// ============================================

function updateEnemy(dt) {
    if (enemy.health <= 0) return;

    enemy.blocking = false;

    const distance = player.x - enemy.x;
    const absDistance = Math.abs(distance);

    enemy.facing = distance >= 0 ? 1 : -1;

    // O adversário tenta se aproximar.
    enemy.movementTarget = absDistance > 100
        ? Math.sign(distance) * 125
        : 0;

    // Decide quando atacar.
    enemy.aiCooldown =
        (enemy.aiCooldown || 0) - dt;

    if (
        absDistance < 120 &&
        enemy.aiCooldown <= 0 &&
        !enemy.attacking
    ) {
        if (Math.random() < 0.23 && enemy.energy >= 35) {
            const availableAbilities = CHARACTER_DATA[enemy.name].abilities.filter(
                (ability) => enemy.energy >= SPECIAL_MOVES[ability.type].energy
            );
            const move = availableAbilities.length > 0 && Math.random() < 0.7
                ? availableAbilities[Math.floor(Math.random() * availableAbilities.length)].type
                : "special";

            attack(enemy, move);
        } else if (Math.random() < 0.45) {
            attack(enemy, "heavy");
        } else {
            attack(enemy, "light");
        }

        enemy.aiCooldown = 0.55 + Math.random() * 0.7;
    }

    // Defesa ocasional.
    if (
        absDistance < 110 &&
        player.attacking &&
        Math.random() < 0.025
    ) {
        enemy.blocking = true;
    }
}

// ============================================
// ATUALIZAÇÃO DOS PERSONAGENS
// ============================================

function updateFighter(fighter, opponent, dt) {
    fighter.animation += dt;

    fighter.attackCooldown = Math.max(
        0,
        fighter.attackCooldown - dt
    );

    fighter.hurtTimer = Math.max(
        0,
        fighter.hurtTimer - dt
    );

    fighter.invulnerable = Math.max(
        0,
        fighter.invulnerable - dt
    );

    fighter.flash = Math.max(
        0,
        fighter.flash - dt
    );

    fighter.blocking =
        fighter === player &&
        keys["s"] &&
        fighter.grounded &&
        !fighter.attacking;

    if (fighter === player) {
        const direction = (keys["d"] ? 1 : 0) - (keys["a"] ? 1 : 0);
        fighter.movementTarget = direction * 240;
    }

    if (fighter.hurtTimer <= 0) {
        const movementTarget = fighter.attacking
            ? 0
            : fighter.movementTarget;
        const speedDifference = movementTarget - fighter.vx;
        const accelerating = Math.abs(movementTarget) > 0;
        const acceleration = fighter.grounded
            ? accelerating ? 1500 : 1900
            : accelerating ? 650 : 500;

        fighter.vx += Math.sign(speedDifference) * Math.min(
            Math.abs(speedDifference),
            acceleration * dt
        );
    }

    // Orientação automática em direção ao adversário.
    if (
        !fighter.attacking &&
        fighter.hurtTimer <= 0
    ) {
        fighter.facing =
            opponent.x >= fighter.x ? 1 : -1;
    }

    // Atualiza a animação do ataque.
    if (fighter.attacking) {
        fighter.attackTimer -= dt;

        checkAttack(fighter, opponent);

        if (fighter.attackTimer <= 0) {
            fighter.attacking = false;
            fighter.attackType = "";
        }
    }

    // Física: gravidade e salto.
    fighter.vy += 1250 * dt;

    fighter.x += fighter.vx * dt;
    fighter.y += fighter.vy * dt;

    if (fighter.y >= FLOOR) {
        fighter.y = FLOOR;
        fighter.vy = 0;
        fighter.grounded = true;
        fighter.jumps = 0;
    } else {
        fighter.grounded = false;
    }

    // Limites da arena.
    fighter.x = Math.max(
        35,
        Math.min(WIDTH - 35, fighter.x)
    );

    // Recuperação de energia.
    fighter.energy = Math.min(
        100,
        fighter.energy + 1.8 * dt
    );
}

// ============================================
// EFEITOS VISUAIS
// ============================================

function spawnParticles(x, y, color, amount) {
    for (let i = 0; i < amount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 260;

        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.25 + Math.random() * 0.5,
            maxLife: 0.75,
            size: 2 + Math.random() * 5,
            color
        });
    }
}

function updateEffects(dt) {
    for (const particle of particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        particle.vy += 180 * dt;
        particle.life -= dt;
    }

    particles = particles.filter(
        particle => particle.life > 0
    );

    for (const effect of effects) {
        effect.life -= dt;
    }

    effects = effects.filter(
        effect => effect.life > 0
    );

    shake = Math.max(0, shake - 30 * dt);
}

function drawEffects() {
    for (const effect of effects) {
        const progress =
            1 - effect.life / effect.maxLife;

        const alpha = Math.max(
            0,
            1 - progress
        );

        ctx.save();

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = effect.color;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 4;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 16;

        if (effect.type === "bladeSlash" || effect.type === "heavySlash") {
            const heavy = effect.type === "heavySlash";
            const scale = 0.35 + progress * 0.75;
            ctx.lineWidth = heavy ? 10 : 6;

            for (let trail = 0; trail < (heavy ? 3 : 1); trail++) {
                ctx.beginPath();
                ctx.ellipse(
                    effect.x + effect.facing * progress * 24,
                    effect.y + trail * 7,
                    effect.size * scale,
                    (heavy ? 23 : 16) + progress * 12,
                    -effect.facing * 0.38,
                    -Math.PI * 0.83,
                    Math.PI * 0.68
                );
                ctx.stroke();
            }
        } else if (effect.type === "antiMagicWave") {
            for (let ring = 0; ring < 3; ring++) {
                ctx.globalAlpha = alpha * (1 - ring * 0.22);
                ctx.lineWidth = 7 - ring;
                ctx.beginPath();
                ctx.ellipse(
                    effect.x + effect.facing * progress * 48,
                    effect.y,
                    effect.size * (0.2 + progress * 0.72) - ring * 15,
                    18 + ring * 11,
                    -effect.facing * 0.2,
                    -Math.PI * 0.75,
                    Math.PI * 0.7
                );
                ctx.stroke();
            }
        } else if (effect.type === "meteor") {
            const travel = effect.size * progress * 0.5;
            const meteorX = effect.x + effect.facing * travel;
            const meteorY = effect.y - 90 * progress;
            ctx.save();
            ctx.translate(meteorX, meteorY);
            ctx.rotate(effect.facing * -0.55);
            ctx.lineWidth = 14 * (1 - progress * 0.35);
            ctx.beginPath();
            ctx.moveTo(-effect.facing * effect.size * 0.55, 24);
            ctx.lineTo(-effect.facing * 18, 0);
            ctx.stroke();
            ctx.fillStyle = "#fff0b0";
            ctx.beginPath();
            ctx.arc(0, 0, 13 + progress * 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else if (effect.type === "windTornado") {
            for (let loop = 0; loop < 5; loop++) {
                const rise = loop / 4;
                ctx.globalAlpha = alpha * (0.45 + rise * 0.5);
                ctx.lineWidth = 3 + rise * 2;
                ctx.beginPath();
                ctx.ellipse(
                    effect.x + effect.facing * progress * effect.size * 0.4,
                    effect.y - rise * 86,
                    effect.size * (0.42 - rise * 0.22),
                    9 + rise * 8,
                    effect.facing * (progress + rise) * 0.45,
                    0,
                    Math.PI * 1.8
                );
                ctx.stroke();
            }
        } else if (effect.type === "starStorm") {
            for (let star = 0; star < 6; star++) {
                const offset = star / 5;
                const x = effect.x + effect.facing * (offset - 0.5) * effect.size + effect.facing * progress * 35;
                const y = effect.y - 95 * offset + Math.sin(elapsed * 18 + star) * 7;
                const radius = 4 + (star % 3) * 2;

                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(elapsed * (star % 2 ? 3 : -3));
                ctx.fillStyle = star % 2 ? "#ffffff" : effect.color;
                ctx.beginPath();

                for (let point = 0; point < 10; point++) {
                    const angle = -Math.PI / 2 + point * Math.PI / 5;
                    const pointRadius = point % 2 ? radius * 0.42 : radius;
                    const starX = Math.cos(angle) * pointRadius;
                    const starY = Math.sin(angle) * pointRadius;
                    if (point === 0) ctx.moveTo(starX, starY);
                    else ctx.lineTo(starX, starY);
                }

                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        } else if (effect.type === "dimensionSlash") {
            const riftX = effect.x + effect.facing * progress * 34;

            ctx.save();
            ctx.translate(riftX, effect.y - 5);
            ctx.rotate(effect.facing * -0.22);
            ctx.fillStyle = "rgba(18, 14, 24, 0.92)";
            ctx.beginPath();
            ctx.ellipse(0, 0, 26 + progress * 34, 62 + progress * 18, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = effect.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 0, 33 + progress * 36, 67 + progress * 18, 0, -1.1, 1.15);
            ctx.stroke();
            ctx.restore();

            ctx.strokeStyle = "#17131d";
            ctx.lineWidth = 17;
            for (let cut = -1; cut <= 1; cut++) {
                const x = riftX + effect.facing * cut * 22;
                ctx.globalAlpha = alpha * (cut === 0 ? 1 : 0.7);
                ctx.beginPath();
                ctx.moveTo(x - effect.facing * 13, effect.y + 55);
                ctx.lineTo(x + effect.facing * 9, effect.y + 21);
                ctx.lineTo(x - effect.facing * 7, effect.y - 2);
                ctx.lineTo(x + effect.facing * 16, effect.y - 27);
                ctx.lineTo(x + effect.facing * 8, effect.y - 64);
                ctx.stroke();

                ctx.strokeStyle = effect.color;
                ctx.shadowBlur = 25;
                ctx.lineWidth = cut === 0 ? 5 : 3;
                ctx.beginPath();
                ctx.moveTo(x - effect.facing * 13, effect.y + 55);
                ctx.lineTo(x + effect.facing * 9, effect.y + 21);
                ctx.lineTo(x - effect.facing * 7, effect.y - 2);
                ctx.lineTo(x + effect.facing * 16, effect.y - 27);
                ctx.lineTo(x + effect.facing * 8, effect.y - 64);
                ctx.stroke();

                ctx.strokeStyle = effect.secondaryColor;
                ctx.shadowBlur = 12;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x + effect.facing * 20, effect.y + 31);
                ctx.lineTo(x + effect.facing * 31, effect.y + 11);
                ctx.stroke();
                ctx.strokeStyle = effect.color;
                ctx.shadowBlur = 16;
                ctx.lineWidth = 17;
            }
        } else if (effect.type === "waterDragon") {
            for (let ribbon = 0; ribbon < 3; ribbon++) {
                const offset = ribbon * 12;
                ctx.globalAlpha = alpha * (1 - ribbon * 0.2);
                ctx.lineWidth = 11 - ribbon * 3;
                ctx.beginPath();
                ctx.moveTo(effect.x - effect.facing * effect.size * 0.55, effect.y + offset);
                ctx.bezierCurveTo(
                    effect.x - effect.facing * 25,
                    effect.y - 75 - offset,
                    effect.x + effect.facing * 25,
                    effect.y + 55 + offset,
                    effect.x + effect.facing * effect.size * 0.42,
                    effect.y - 35 - offset
                );
                ctx.stroke();
            }

            ctx.fillStyle = "#e5fbff";
            ctx.beginPath();
            ctx.arc(effect.x + effect.facing * effect.size * 0.42, effect.y - 40, 13, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const radius = effect.size * (0.3 + progress);
            const rays = effect.type === "impact" ? 12 : 8;
            ctx.lineWidth = effect.type === "impact" ? 5 : 4;
            ctx.beginPath();

            for (let ray = 0; ray < rays; ray++) {
                const angle = (ray / rays) * Math.PI * 2;
                const innerRadius = effect.type === "impact" ? radius * 0.38 : radius;
                const x = effect.x + Math.cos(angle) * innerRadius;
                const y = effect.y + Math.sin(angle) * innerRadius;

                if (ray === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }

            ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();
    }

    for (const particle of particles) {
        ctx.save();

        ctx.globalAlpha = Math.max(
            0,
            particle.life / particle.maxLife
        );

        ctx.fillStyle = particle.color;

        ctx.fillRect(
            Math.round(particle.x),
            Math.round(particle.y),
            particle.size,
            particle.size
        );

        ctx.restore();
    }
}

// ============================================
// CENÁRIO 2D
// ============================================

function drawBackground() {
    const gradient = ctx.createLinearGradient(
        0, 0, 0, HEIGHT
    );

    gradient.addColorStop(0, "#09102d");
    gradient.addColorStop(0.45, "#1c2859");
    gradient.addColorStop(0.72, "#303a72");
    gradient.addColorStop(1, "#090d1d");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Céu estrelado e aurora.
    const skyGlow = ctx.createRadialGradient(720, 80, 20, 720, 80, 330);
    skyGlow.addColorStop(0, "rgba(110, 139, 255, 0.20)");
    skyGlow.addColorStop(1, "rgba(110, 139, 255, 0)");
    ctx.fillStyle = skyGlow;
    ctx.fillRect(0, 0, WIDTH, FLOOR);

    ctx.save();
    for (let i = 0; i < 46; i++) {
        const x = (i * 83 + 31) % WIDTH;
        const y = (i * 47 + 18) % 260;
        const pulse = 0.35 + Math.sin(elapsed * 1.8 + i) * 0.2;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = i % 7 === 0 ? "#8ac8ff" : "#eaf0ff";
        ctx.fillRect(x, y, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
    }
    ctx.restore();

    // Lua com brilho e crateras.
    ctx.save();
    ctx.shadowColor = "#879cff";
    ctx.shadowBlur = 35;
    ctx.fillStyle = "#d5dcff";
    ctx.beginPath();
    ctx.arc(770, 100, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(90, 105, 170, 0.22)";
    ctx.beginPath();
    ctx.arc(758, 91, 7, 0, Math.PI * 2);
    ctx.arc(781, 112, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#151d3b";
    ctx.beginPath();
    ctx.moveTo(0, 250);
    ctx.lineTo(100, 160);
    ctx.lineTo(190, 240);
    ctx.lineTo(300, 145);
    ctx.lineTo(430, 245);
    ctx.lineTo(570, 175);
    ctx.lineTo(700, 245);
    ctx.lineTo(820, 160);
    ctx.lineTo(960, 250);
    ctx.lineTo(960, 440);
    ctx.lineTo(0, 440);
    ctx.closePath();
    ctx.fill();

    // Nevasca de magia ao fundo.
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 18; i++) {
        const x = (i * 173 + elapsed * (4 + i % 3)) % (WIDTH + 80) - 40;
        const y = 145 + ((i * 61 + elapsed * 11) % 220);
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = i % 2 ? "#65baff" : "#c984ff";
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + i % 4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // Torres do castelo.
    ctx.fillStyle = "#10172f";

    for (let x = 40; x < WIDTH; x += 180) {
        ctx.fillRect(x, 190, 42, 250);
        ctx.fillRect(x - 12, 180, 66, 12);

        ctx.beginPath();
        ctx.moveTo(x - 8, 180);
        ctx.lineTo(x + 21, 140);
        ctx.lineTo(x + 50, 180);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "rgba(255, 194, 83, 0.55)";
        ctx.fillRect(x + 17, 225, 8, 18);
        ctx.fillStyle = "#10172f";
    }

    // Arcos da arena.
    for (let x = 100; x < WIDTH; x += 250) {
        ctx.strokeStyle = "#39436b";
        ctx.lineWidth = 8;

        ctx.beginPath();
        ctx.arc(x, 405, 68, Math.PI, 0);
        ctx.stroke();

        ctx.fillStyle = "#10172f";
        ctx.fillRect(x - 68, 405, 136, 35);
    }

    // Chão com luz de borda.
    const floorGradient = ctx.createLinearGradient(0, FLOOR, 0, HEIGHT);
    floorGradient.addColorStop(0, "#252c50");
    floorGradient.addColorStop(1, "#101426");
    ctx.fillStyle = floorGradient;
    ctx.fillRect(0, FLOOR, WIDTH, HEIGHT - FLOOR);

    ctx.fillStyle = "#59649a";
    ctx.fillRect(0, FLOOR, WIDTH, 3);
    ctx.fillStyle = "rgba(111, 142, 255, 0.24)";
    ctx.fillRect(0, FLOOR + 3, WIDTH, 5);

    ctx.strokeStyle = "#30395d";
    ctx.lineWidth = 1;

    for (let x = 0; x <= WIDTH; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, FLOOR);
        ctx.lineTo(x - 100, HEIGHT);
        ctx.stroke();
    }

    for (let y = FLOOR + 25; y < HEIGHT; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
    }

    // Vinheta cinematográfica.
    const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 180, WIDTH / 2, HEIGHT / 2, 560);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

// ============================================
// DESENHO DOS LUTADORES
// ============================================

function drawFighter(fighter) {
    const x = Math.round(fighter.x);
    const y = Math.round(fighter.y);

    const facing = fighter.facing;
    const moving =
        Math.abs(fighter.vx) > 30 &&
        fighter.grounded;

    const walk = moving
        ? Math.sin(fighter.animation * 14) * 7
        : Math.sin(fighter.animation * 3) * 2;

    const jumping = !fighter.grounded;

    const attacking = fighter.attacking;
    const special =
        attacking && (
            fighter.attackType === "special" ||
            Object.prototype.hasOwnProperty.call(SPECIAL_MOVES, fighter.attackType)
        );

    const heavy =
        attacking && fighter.attackType === "heavy";

    if (fighter.name === "ASTA") {
        drawAstaSprite(fighter, x, y, moving, jumping, attacking, special, heavy);
        return;
    }

    if (fighter.name === "YUNO") {
        drawYunoSprite(fighter, x, y, jumping, special);
        return;
    }

    if (fighter.name === "YAMI" && yamiSprites.idle.length > 0) {
        drawYamiSprite(fighter, x, y, moving, jumping, attacking, special);
        return;
    }

    ctx.save();
    ctx.translate(x, y);

    // Personagem sempre fica voltado para a direção do combate.
    ctx.scale(facing, 1);

    // Sombra no chão.
    ctx.fillStyle = "#050713";
    ctx.globalAlpha = 0.45;

    ctx.beginPath();
    ctx.ellipse(
        0,
        jumping ? 3 : 0,
        32,
        8,
        0,
        0,
        Math.PI * 2
    );
    ctx.fill();

    ctx.globalAlpha = 1;

    // Efeito de energia durante o poder especial.
    if (special) {
        ctx.shadowColor = fighter.accent;
        ctx.shadowBlur = 25;

        ctx.strokeStyle = fighter.accent;
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.arc(
            0,
            -52,
            40 + Math.sin(elapsed * 30) * 5,
            0,
            Math.PI * 2
        );
        ctx.stroke();

        ctx.shadowBlur = 0;
    }

    // Capa.
    ctx.fillStyle = fighter.color;

    ctx.beginPath();
    ctx.moveTo(-12, -77);
    ctx.lineTo(-29 - walk, -57);
    ctx.lineTo(-23 - walk, -15);
    ctx.lineTo(-7, -29);
    ctx.lineTo(8, -16);
    ctx.lineTo(18, -57);
    ctx.lineTo(11, -77);
    ctx.closePath();
    ctx.fill();

    // Detalhes coloridos da roupa.
    ctx.fillStyle = fighter.accent;
    ctx.fillRect(-17, -67, 7, 33);
    ctx.fillRect(9, -55, 8, 5);

    // Pernas.
    ctx.fillStyle = "#141927";

    ctx.fillRect(-13, -32, 10, 25 + (moving ? walk : 0));
    ctx.fillRect(3, -32, 10, 25 - (moving ? walk : 0));

    // Botas.
    ctx.fillStyle = "#090c17";

    ctx.fillRect(-17, -8 + (moving ? walk : 0), 17, 7);
    ctx.fillRect(2, -8 - (moving ? walk : 0), 17, 7);

    // Tronco.
    ctx.fillStyle = fighter.color;
    ctx.fillRect(-17, -79, 34, 45);

    // Peitoral.
    ctx.fillStyle = fighter.accent;
    ctx.fillRect(-14, -73, 28, 7);
    ctx.fillRect(-5, -66, 10, 21);

    // Ombreiras.
    ctx.fillStyle = "#0b1021";
    ctx.fillRect(-22, -79, 11, 12);
    ctx.fillRect(11, -79, 11, 12);

    // Braço de trás.
    ctx.fillStyle = fighter.color;
    ctx.fillRect(-22, -70, 9, 27);

    // Braço de ataque.
    ctx.save();

    let armAngle = 0;

    if (attacking) {
        const duration = {
            light: 0.22,
            heavy: 0.36,
            special: 0.55,
            astaSwordWave: 0.48,
            astaMeteor: 0.75,
            yunoTornado: 0.58,
            yunoStarStorm: 0.8,
            yamiDimensionSlash: 0.62,
            noelleSeaDragon: 0.65
        }[fighter.attackType];
        const progress = Math.min(0.999, Math.max(0, 1 - fighter.attackTimer / duration));

        armAngle = -Math.sin(progress * Math.PI) * 1.4;
    } else if (fighter.blocking) {
        armAngle = -0.8;
    }

    ctx.translate(15, -68);
    ctx.rotate(armAngle);

    ctx.fillStyle = fighter.color;
    ctx.fillRect(-1, 0, 12, 24);

    ctx.fillStyle = "#f1c5a3";
    ctx.fillRect(0, 19, 10, 8);

    // Espada.
    ctx.translate(5, 25);

    if (fighter.name === "ASTA") {
        ctx.rotate(attacking ? -0.3 : -0.65);

        ctx.fillStyle = "#171723";
        ctx.fillRect(-4, -1, 8, 12);

        ctx.fillStyle = "#a8b1ca";
        ctx.fillRect(-3, -53, 6, 52);

        ctx.fillStyle = "#e6eaff";
        ctx.fillRect(-1, -51, 2, 47);

        ctx.fillStyle = fighter.accent;
        ctx.fillRect(-10, -3, 20, 4);
    } else if (fighter.name === "YAMI") {
        ctx.rotate(attacking ? -0.3 : -0.65);
        ctx.fillStyle = "#211c2b";
        ctx.fillRect(-3, -50, 6, 50);
        ctx.fillStyle = fighter.accent;
        ctx.fillRect(-8, -4, 16, 5);
    } else if (fighter.name === "NOELLE") {
        ctx.rotate(attacking ? -0.12 : -0.4);
        ctx.fillStyle = "#b9f4ff";
        ctx.fillRect(-2, -43, 4, 45);
        ctx.fillStyle = fighter.accent;
        ctx.beginPath();
        ctx.arc(0, -46, 7, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.rotate(attacking ? -0.1 : -0.45);

        ctx.fillStyle = "#d5eaff";
        ctx.fillRect(-2, -42, 4, 43);

        ctx.fillStyle = fighter.accent;
        ctx.fillRect(-5, -44, 10, 8);
    }

    ctx.restore();

    // Cabeça.
    ctx.fillStyle = "#f1c5a3";
    ctx.fillRect(-12, -101, 24, 25);

    // Cabelo.
    const hairColor = fighter.name === "YUNO"
        ? "#e4d5a2"
        : fighter.name === "NOELLE"
            ? "#c6e8f4"
            : "#171923";
    ctx.fillStyle = hairColor;

    ctx.beginPath();

    ctx.moveTo(-14, -91);
    ctx.lineTo(-18, -111);
    ctx.lineTo(-10, -105);
    ctx.lineTo(-8, -117);
    ctx.lineTo(0, -107);
    ctx.lineTo(8, -116);
    ctx.lineTo(11, -103);
    ctx.lineTo(17, -108);
    ctx.lineTo(13, -88);
    ctx.closePath();

    ctx.fill();

    // Faixa na cabeça do Asta.
    if (fighter.name === "ASTA") {
        ctx.fillStyle = "#d51d42";
        ctx.fillRect(-14, -98, 28, 5);
    }

    // Olhos.
    ctx.fillStyle = "#151525";
    ctx.fillRect(2, -92, 5, 3);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(4, -92, 2, 2);

    // Brilho quando recebe dano.
    if (fighter.flash > 0) {
        ctx.globalAlpha = fighter.flash / 0.12;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-22, -112, 44, 108);
        ctx.globalAlpha = 1;
    }

    // Contorno pixelado simples.
    ctx.strokeStyle = "#050711";
    ctx.lineWidth = 2;

    ctx.strokeRect(-17, -79, 34, 45);
    ctx.strokeRect(-12, -101, 24, 25);

    ctx.restore();

    // Nome sobre o personagem.
    ctx.save();

    ctx.font = "bold 12px Orbitron, sans-serif";
    ctx.textAlign = "center";

    ctx.fillStyle = fighter.accent;
    ctx.shadowColor = fighter.accent;
    ctx.shadowBlur = 10;

    ctx.fillText(
        fighter.name,
        x,
        y - 132
    );

    ctx.restore();
}

function drawAstaSprite(fighter, x, y, moving, jumping, attacking, special, heavy) {
    const seconds = fighter.animation;
    let spriteIndex;

    if (attacking) {
        const duration = {
            light: 0.22,
            heavy: 0.36,
            special: 0.55,
            astaSwordWave: 0.48,
            astaMeteor: 0.75
        }[fighter.attackType];
        const progress = Math.min(0.999, Math.max(0, 1 - fighter.attackTimer / duration));

        if (fighter.attackType === "light") {
            const frames = [8, 9, 10];
            spriteIndex = frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))];
        } else if (fighter.attackType === "heavy") {
            const frames = [10, 9, 8];
            spriteIndex = frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))];
        } else {
            const frames = [11, 12, 13, 12];
            spriteIndex = frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))];
        }
    } else if (jumping) {
        spriteIndex = 7;
    } else if (fighter.blocking || fighter.hurtTimer > 0) {
        spriteIndex = 3;
    } else if (moving) {
        spriteIndex = [4, 5, 6, 5][Math.floor(seconds * 10) % 4];
    } else {
        spriteIndex = Math.floor(seconds * 3) % 4;
    }

    const sprite = astaSprites[spriteIndex];
    const loaded = sprite && sprite.complete && sprite.naturalWidth > 0;
    const width = loaded ? sprite.naturalWidth : 1;
    const height = loaded ? sprite.naturalHeight : 1;
    const scale = loaded ? Math.min(188 / height, 270 / width) : 1;
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    const bob = !moving && !jumping && !attacking ? Math.sin(seconds * 3.8) * 2 : 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(fighter.facing, 1);

    ctx.fillStyle = "#050713";
    ctx.globalAlpha = jumping ? 0.22 : 0.42;
    ctx.beginPath();
    ctx.ellipse(0, 0, jumping ? 22 : 36, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (moving) {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = fighter.accent;
        for (let i = 1; i <= 3; i++) {
            ctx.beginPath();
            ctx.ellipse(-fighter.facing * i * 16, -55, 35 - i * 6, 6, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    if (attacking) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = "#ff294b";
        ctx.shadowBlur = 18;
        ctx.strokeStyle = fighter.attackType === "special" ? "#ffb14a" : "#ff3158";
        ctx.lineWidth = fighter.attackType === "heavy" ? 8 : 5;
        ctx.beginPath();
        const trail = fighter.attackType === "special" ? 95 : 64;
        ctx.ellipse(22, -82, trail, 34, -0.18, -1.05, 0.65);
        ctx.stroke();
        ctx.restore();
    }

    if (special) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = fighter.accent;
        ctx.shadowBlur = 28;
        ctx.strokeStyle = fighter.accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -82, 54 + Math.sin(elapsed * 30) * 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, -82, 68 + Math.cos(elapsed * 22) * 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    if (loaded) {
        ctx.globalAlpha = fighter.invulnerable > 0 && fighter.flash > 0 ? 0.55 : 1;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(sprite, -drawWidth / 2, -drawHeight + bob, drawWidth, drawHeight);
        ctx.globalAlpha = 1;
    }

    ctx.restore();

    ctx.save();
    ctx.font = "bold 12px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = fighter.accent;
    ctx.shadowColor = fighter.accent;
    ctx.shadowBlur = 10;
    ctx.fillText(fighter.name, x, y - 198);
    ctx.restore();
}

function drawYunoSprite(fighter, x, y, jumping, special) {
    if (!yunoSprite.complete || yunoSprite.naturalWidth === 0) return;

    const scale = 184 / yunoSprite.naturalHeight;
    const width = yunoSprite.naturalWidth * scale;
    const height = yunoSprite.naturalHeight * scale;
    const moving = Math.abs(fighter.vx) > 30;
    const bob = !moving && !jumping ? Math.sin(fighter.animation * 3.5) * 2 : 0;
    const attackPulse = fighter.attacking ? Math.sin(elapsed * 35) * 8 : 0;

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(fighter.facing, 1);

    ctx.fillStyle = "#050713";
    ctx.globalAlpha = jumping ? 0.22 : 0.42;
    ctx.beginPath();
    ctx.ellipse(0, -bob, jumping ? 22 : 34, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = "#59caff";
    ctx.shadowBlur = special ? 28 : 14;
    ctx.strokeStyle = "rgba(105, 198, 255, 0.78)";
    ctx.lineWidth = special ? 4 : 2;

    const auraHeight = special ? 76 + attackPulse : 58 + Math.sin(elapsed * 8) * 4;
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse((i - 1) * 4, -82, 33 + i * 8 + attackPulse * 0.2, auraHeight - i * 9, 0, Math.PI * 0.15, Math.PI * 1.85);
        ctx.stroke();
    }
    ctx.restore();

    if (moving) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = "#74dfff";
        ctx.lineWidth = 3;
        for (let i = 1; i <= 3; i++) {
            ctx.beginPath();
            ctx.moveTo(-i * 18, -105);
            ctx.quadraticCurveTo(-i * 28, -82, -i * 18, -42);
            ctx.stroke();
        }
        ctx.restore();
    }

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(yunoSprite, -width / 2, -height, width, height);

    if (fighter.attacking) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = "#74dfff";
        ctx.shadowBlur = 20;
        ctx.strokeStyle = fighter.attackType === "special" ? "#dff7ff" : "#69cfff";
        ctx.lineWidth = fighter.attackType === "special" ? 7 : 4;
        ctx.beginPath();
        ctx.ellipse(28, -82, fighter.attackType === "special" ? 100 : 62, 38, -0.22, -1.0, 0.72);
        ctx.stroke();
        ctx.restore();
    }

    if (fighter.flash > 0) {
        ctx.globalCompositeOperation = "source-atop";
        ctx.globalAlpha = fighter.flash / 0.12;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-width / 2, -height, width, height);
        ctx.globalAlpha = 1;
    }

    ctx.restore();

    ctx.save();
    ctx.font = "bold 12px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = fighter.accent;
    ctx.shadowColor = fighter.accent;
    ctx.shadowBlur = 10;
    ctx.fillText(fighter.name, x, y - 194);
    ctx.restore();
}

function drawYamiSprite(fighter, x, y, moving, jumping, attacking, special) {
    const frames = attacking
        ? yamiSprites.attack
        : jumping
            ? yamiSprites.jump
            : moving
                ? yamiSprites.run
                : yamiSprites.idle;

    if (frames.length === 0) return;

    let frameIndex;

    if (attacking) {
        const duration = SPECIAL_MOVES[fighter.attackType]?.duration ||
            ({ light: 0.22, heavy: 0.36, special: 0.55 }[fighter.attackType] || 0.62);
        const progress = Math.min(0.999, Math.max(0, 1 - fighter.attackTimer / duration));
        frameIndex = Math.floor(progress * frames.length);
    } else {
        frameIndex = Math.floor(fighter.animation * (moving ? 11 : 3)) % frames.length;
    }

    const sprite = frames[frameIndex];
    const scale = 188 / sprite.height;
    const width = sprite.width * scale;
    const height = sprite.height * scale;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(fighter.facing, 1);

    ctx.fillStyle = "#050713";
    ctx.globalAlpha = jumping ? 0.22 : 0.42;
    ctx.beginPath();
    ctx.ellipse(0, 0, jumping ? 22 : 35, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (moving) {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = fighter.accent;
        for (let index = 1; index <= 3; index++) {
            ctx.beginPath();
            ctx.ellipse(-index * 15, -72, 32 - index * 5, 6, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    if (special) {
        const auraColor = "#8742b8";
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = auraColor;
        ctx.shadowBlur = 26;
        ctx.strokeStyle = auraColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -88, 52 + Math.sin(elapsed * 30) * 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    if (attacking) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = special ? fighter.accent : "#d8c49b";
        ctx.shadowBlur = special ? 30 : 16;
        ctx.strokeStyle = special ? fighter.accent : "#e4d4b8";
        ctx.lineWidth = special ? 9 : 5;
        ctx.beginPath();
        ctx.ellipse(30, -88, special ? 118 : 76, 35, -0.2, -1.05, 0.68);
        ctx.stroke();
        ctx.restore();
    }

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sprite, -width / 2, -height, width, height);

    if (fighter.flash > 0) {
        ctx.globalCompositeOperation = "source-atop";
        ctx.globalAlpha = fighter.flash / 0.12;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-width / 2, -height, width, height);
        ctx.globalAlpha = 1;
    }

    ctx.restore();

    ctx.save();
    ctx.font = "bold 12px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = fighter.accent;
    ctx.shadowColor = fighter.accent;
    ctx.shadowBlur = 10;
    ctx.fillText(fighter.name, x, y - 198);
    ctx.restore();
}

// ============================================
// INTERFACE
// ============================================

function updateHUD() {
    $("playerName").textContent = player.name;
    $("enemyName").textContent = enemy.name;

    $("playerHealth").style.width =
        player.health + "%";

    $("enemyHealth").style.width =
        enemy.health + "%";

    $("playerEnergy").style.width =
        player.energy + "%";

    $("enemyEnergy").style.width =
        enemy.energy + "%";

    $("playerHealthText").textContent =
        Math.ceil(player.health);

    $("enemyHealthText").textContent =
        Math.ceil(enemy.health);
}

let messageTimer = 0;

function showMessage(message) {
    const display = $("comboDisplay");

    display.textContent = message;

    messageTimer = 1;
}

function finishGame(message) {
    gameRunning = false;
    gameOver = true;

    $("selectionScreen").hidden = true;
    $("resultScreen").hidden = false;
    $("overlay").classList.remove("hidden");

    $("resultTitle").textContent = message;
    $("resultMessage").textContent =
        "Escolha um personagem para iniciar outra luta.";

    $("comboDisplay").textContent = "";

    spawnParticles(
        WIDTH / 2,
        HEIGHT / 2,
        "#ffd44d",
        40
    );
}

// ============================================
// DESENHO COMPLETO
// ============================================

function render() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    ctx.save();

    if (shake > 0) {
        ctx.translate(
            (Math.random() - 0.5) * shake,
            (Math.random() - 0.5) * shake
        );
    }

    drawBackground();

    if (player && enemy) {
        // Desenha primeiro o personagem que está atrás.
        const fighters = [player, enemy].sort(
            (a, b) => a.x - b.x
        );

        for (const fighter of fighters) {
            drawFighter(fighter);
        }
    }

    drawEffects();

    ctx.restore();
}

// ============================================
// LOOP PRINCIPAL
// ============================================

function update(dt) {
    if (!gameRunning || gameOver) return;

    elapsed += dt;

    // Cronômetro.
    timeLeft -= dt;

    if (timeLeft <= 0) {
        timeLeft = 0;

        if (player.health > enemy.health) {
            finishGame(`${player.name} VENCEU!`);
        } else if (enemy.health > player.health) {
            finishGame(`${enemy.name} VENCEU!`);
        } else {
            finishGame("EMPATE!");
        }

        return;
    }

    $("timer").textContent =
        Math.ceil(timeLeft);

    updateEnemy(dt);

    updateFighter(player, enemy, dt);
    updateFighter(enemy, player, dt);

    // Impede que os lutadores se atravessem.
    const distance = enemy.x - player.x;
    const minimumDistance = 38;

    if (Math.abs(distance) < minimumDistance) {
        const overlap =
            minimumDistance - Math.abs(distance);

        const direction = distance >= 0 ? 1 : -1;

        if (player.hurtTimer <= 0) {
            player.x -= direction * overlap / 2;
        }

        if (enemy.hurtTimer <= 0) {
            enemy.x += direction * overlap / 2;
        }
    }

    updateEffects(dt);

    // Recuperação e exibição do combo.
    comboTimer -= dt;

    if (comboTimer <= 0) {
        combo = 0;

        if (messageTimer <= 0) {
            $("comboDisplay").textContent = "";
        }
    }

    messageTimer -= dt;

    if (messageTimer <= 0 && combo <= 1 && comboTimer <= 0) {
        $("comboDisplay").textContent = "";
    }

    updateHUD();
}

function loop(timestamp) {
    const dt = Math.min(
        (timestamp - lastTime) / 1000 || 0,
        0.033
    );

    lastTime = timestamp;

    update(dt);
    render();

    requestAnimationFrame(loop);
}

// ============================================
// INICIALIZAÇÃO
// ============================================

resetGame();
requestAnimationFrame(loop);

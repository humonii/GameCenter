var RobotControl = pc.createScript('robotControl');

RobotControl.prototype.initialize = function () {
    this.WORLD_SIZE = 720;
    this.HALF_WORLD = this.WORLD_SIZE / 2;
    this.GAME_DURATION = 300;
    this.COIN_TOTAL = 90;
    this.MAP_SIZE = 448;
    this.MAP_CELLS = 56;
    this.REVEAL_RADIUS = 38;
    this.PLAYER_RADIUS = 1.25;

    this.wheels = [];
    this.coins = [];
    this.colliders = [];
    this.landmarks = [];
    this.animated = [];
    this.fireflies = [];
    this.keys = Object.create(null);
    this.touch = Object.create(null);
    this.speed = 0;
    this.heading = 0;
    this.wheelSpin = 0;
    this.score = 0;
    this.collected = 0;
    this.timeLeft = this.GAME_DURATION;
    this.finished = false;
    this.frame = 0;
    this.elapsed = 0;
    this.messageTtl = 0;
    this.lastMapCell = '';
    this.lastMapPoint = null;
    this.revealedCells = new Set();
    this.cameraPosition = new pc.Vec3(0, 7, -12);
    this.audioAssets = {};
    this.audioEntity = null;
    this.bgmStarted = false;
    this.waterPlaying = false;
    this.touchingObstacle = false;
    this.obstacleClearTimer = 1;

    this.clearTemplateScene();
    this.createUi();
    this.createAudio();
    this.materials = this.createMaterials();
    this.createCameraAndLights();
    this.createWorld();
    this.createPlayer();
    this.createCoins();
    this.initMap();
    this.setupInput();
    this.showMessage('START');
    this.startBgm();
};

RobotControl.prototype.clearTemplateScene = function () {
    var children = this.app.root.children.slice();
    for (var i = 0; i < children.length; i++) {
        if (children[i] !== this.entity) {
            children[i].destroy();
        }
    }
    if (this.entity && this.entity.children) {
        var entityChildren = this.entity.children.slice();
        for (var j = 0; j < entityChildren.length; j++) {
            entityChildren[j].destroy();
        }
    }
};

RobotControl.prototype.createUi = function () {
    this.ui = {};
    this.createUiFont();

    var screen = new pc.Entity('Robot Wheelchair HUD');
    screen.addComponent('screen', {
        screenSpace: true,
        referenceResolution: new pc.Vec2(1280, 720),
        scaleMode: pc.SCALEMODE_BLEND,
        scaleBlend: .5
    });
    this.app.root.addChild(screen);
    this.uiRoot = screen;

    this.createHudBlock('残り時間', '05:00', 'timer', 18, -18);
    this.createHudBlock('コイン', '0/' + this.COIN_TOTAL, 'coins', 164, -18);
    this.createHudBlock('探索率', '0%', 'mapped', 310, -18);
    this.createMiniMapUi();
    this.createTouchControls();
    this.createMessageUi();
    this.createResultUi();
};

RobotControl.prototype.createAudio = function () {
    if (!this.app.systems || !this.app.systems.sound) return;

    this.audioAssets = {
        bgm: this.getOrCreateAudioAsset('BGM.mp3', 'assets/BGM.mp3'),
        water: this.getOrCreateAudioAsset('water.mp3', 'assets/water.mp3'),
        coin: this.getOrCreateAudioAsset('coin.mp3', 'assets/coin.mp3'),
        finish: this.getOrCreateAudioAsset('game_finish.mp3', 'assets/game_finish.mp3'),
        hit1: this.getOrCreateAudioAsset('打撃1.mp3', 'assets/打撃1.mp3'),
        hit2: this.getOrCreateAudioAsset('打撃2.mp3', 'assets/打撃2.mp3'),
        hit3: this.getOrCreateAudioAsset('打撃3.mp3', 'assets/打撃3.mp3'),
        hit4: this.getOrCreateAudioAsset('打撃4.mp3', 'assets/打撃4.mp3'),
        hit5: this.getOrCreateAudioAsset('打撃5.mp3', 'assets/打撃5.mp3'),
        hit6: this.getOrCreateAudioAsset('打撃6.mp3', 'assets/打撃6.mp3')
    };
    Object.keys(this.audioAssets).forEach(function (key) {
        var asset = this.audioAssets[key];
        if (asset && !asset.loaded && !asset.loading) this.app.assets.load(asset);
    }, this);

    var slots = {
        bgm: {
            name: 'bgm',
            asset: this.audioAssets.bgm && this.audioAssets.bgm.id,
            autoPlay: false,
            loop: true,
            overlap: false,
            volume: .12
        },
        water: {
            name: 'water',
            asset: this.audioAssets.water && this.audioAssets.water.id,
            autoPlay: false,
            loop: true,
            overlap: false,
            volume: .34
        },
        coin: {
            name: 'coin',
            asset: this.audioAssets.coin && this.audioAssets.coin.id,
            autoPlay: false,
            loop: false,
            overlap: true,
            volume: .72
        },
        finish: {
            name: 'finish',
            asset: this.audioAssets.finish && this.audioAssets.finish.id,
            autoPlay: false,
            loop: false,
            overlap: false,
            volume: .82
        }
    };
    for (var i = 1; i <= 6; i++) {
        slots['hit' + i] = {
            name: 'hit' + i,
            asset: this.audioAssets['hit' + i] && this.audioAssets['hit' + i].id,
            autoPlay: false,
            loop: false,
            overlap: true,
            volume: .7
        };
    }

    this.audioEntity = new pc.Entity('Robot Audio');
    this.audioEntity.addComponent('sound', {
        positional: false,
        volume: 1,
        slots: slots
    });
    this.app.root.addChild(this.audioEntity);
};

RobotControl.prototype.getOrCreateAudioAsset = function (name, url) {
    var baseName = name.replace(/\.mp3$/i, '');
    var asset = this.app.assets.find(name, 'audio') || this.app.assets.find(baseName, 'audio');
    if (asset) return asset;

    asset = new pc.Asset(name, 'audio', {
        url: url,
        filename: name
    });
    asset.preload = true;
    this.app.assets.add(asset);
    this.app.assets.load(asset);
    return asset;
};

RobotControl.prototype.unlockAudio = function () {
    var manager = this.app.soundManager || this.app._soundManager;
    if (!manager) return;

    if (manager.resume) manager.resume();
    var context = manager.context || manager._context;
    if (context && context.state === 'suspended' && context.resume) {
        var resume = context.resume();
        if (resume && resume.catch) resume.catch(function () {});
    }
};

RobotControl.prototype.activateAudio = function () {
    this.unlockAudio();
    this.startBgm();
};

RobotControl.prototype.startBgm = function () {
    if (this.bgmStarted) return;
    if (this.playSound('bgm')) this.bgmStarted = true;
};

RobotControl.prototype.getSoundSlot = function (slotName) {
    if (!this.audioEntity || !this.audioEntity.sound || !slotName) return null;
    if (this.audioEntity.sound.slot) return this.audioEntity.sound.slot(slotName);
    var slots = this.audioEntity.sound.slots || this.audioEntity.sound._slots || {};
    return slots[slotName] || null;
};

RobotControl.prototype.playSound = function (slotName, volume) {
    if (!this.audioEntity || !this.audioEntity.sound || !slotName) return false;
    this.unlockAudio();
    try {
        var slot = this.getSoundSlot(slotName);
        var previousVolume = null;
        if (slot && volume !== undefined) {
            previousVolume = slot.volume;
            slot.volume = volume;
        }
        var instance = this.audioEntity.sound.play(slotName);
        if (slot && previousVolume !== null) slot.volume = previousVolume;
        if (instance && volume !== undefined) {
            instance.volume = volume;
            if (instance.setVolume) instance.setVolume(volume);
        }
        return !!instance;
    } catch (error) {
        return false;
    }
};

RobotControl.prototype.stopSound = function (slotName) {
    if (!this.audioEntity || !this.audioEntity.sound || !slotName) return;
    try {
        this.audioEntity.sound.stop(slotName);
    } catch (error) {}
};

RobotControl.prototype.playHitSound = function (impactSpeed) {
    var speedRatio = this.clamp((impactSpeed || 0) / 18.5, 0, 1);
    var volume = this.clamp(.28 + speedRatio * .58, .28, .86);
    this.playSound('hit' + (1 + Math.floor(Math.random() * 6)), volume);
};

RobotControl.prototype.createUiFont = function () {
    if (!pc.CanvasFont) return;
    var chars = [
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
        '0123456789:/%+- ',
        '残り時間コイン探索率全回収終了スアもう一度キーで再開',
        'START'
    ].join('');
    this.uiFont = new pc.CanvasFont(this.app, {
        fontName: '"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,Arial,sans-serif',
        fontWeight: '700',
        fontSize: 48,
        color: new pc.Color(1, 1, 1, 1),
        width: 1024,
        height: 512,
        padding: 4
    });
    this.uiFont.createTextures(chars);
};

RobotControl.prototype.ensureUiChars = function (text) {
    if (this.uiFont && text) this.uiFont.updateTextures(String(text));
};

RobotControl.prototype.createPanel = function (name, x, y, width, height, anchor, pivot, color, opacity, parent) {
    var entity = new pc.Entity(name);
    entity.addComponent('element', {
        type: pc.ELEMENTTYPE_IMAGE,
        width: width,
        height: height,
        anchor: anchor,
        pivot: pivot,
        color: color,
        opacity: opacity
    });
    entity.setLocalPosition(x, y, 0);
    (parent || this.uiRoot).addChild(entity);
    return entity;
};

RobotControl.prototype.createText = function (name, text, x, y, width, height, fontSize, color, parent, alignment) {
    this.ensureUiChars(text);
    var entity = new pc.Entity(name);
    entity.addComponent('element', {
        type: pc.ELEMENTTYPE_TEXT,
        text: String(text),
        width: width,
        height: height,
        fontSize: fontSize,
        lineHeight: fontSize * 1.08,
        anchor: [0, 1, 0, 1],
        pivot: [0, 1],
        alignment: alignment || [0, .5],
        color: color || new pc.Color(1, 1, 1),
        wrapLines: false
    });
    if (this.uiFont) entity.element.font = this.uiFont;
    entity.setLocalPosition(x, y, 0);
    parent.addChild(entity);
    return entity;
};

RobotControl.prototype.setUiText = function (key, text) {
    if (!this.ui[key] || !this.ui[key].element) return;
    this.ensureUiChars(text);
    this.ui[key].element.text = String(text);
};

RobotControl.prototype.createHudBlock = function (label, value, key, x, y) {
    var panel = this.createPanel('HUD ' + label, x, y, 138, 68, [0, 1, 0, 1], [0, 1], new pc.Color(.05, .08, .1), .74);
    this.createText(label + ' Label', label, 12, -9, 118, 18, 14, new pc.Color(.76, .84, .82), panel);
    this.ui[key] = this.createText(label + ' Value', value, 12, -32, 118, 30, 28, new pc.Color(.96, 1, .98), panel);
};

RobotControl.prototype.createMiniMapUi = function () {
    this.createPanel('Mini Map Frame', -18, -18, 240, 240, [1, 1, 1, 1], [1, 1], new pc.Color(.05, .08, .1), .8);

    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.width = this.MAP_SIZE;
    this.mapCanvas.height = this.MAP_SIZE;
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.mapMemory = document.createElement('canvas');
    this.mapMemory.width = this.MAP_SIZE;
    this.mapMemory.height = this.MAP_SIZE;
    this.mapMemoryCtx = this.mapMemory.getContext('2d');

    this.mapTexture = new pc.Texture(this.app.graphicsDevice, {
        name: 'Exploration Map Texture',
        width: this.MAP_SIZE,
        height: this.MAP_SIZE,
        format: pc.PIXELFORMAT_SRGBA8,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });
    this.mapTexture.setSource(this.mapCanvas);

    var map = new pc.Entity('Mini Map');
    map.addComponent('element', {
        type: pc.ELEMENTTYPE_IMAGE,
        width: 218,
        height: 218,
        anchor: [1, 1, 1, 1],
        pivot: [1, 1],
        texture: this.mapTexture
    });
    map.setLocalPosition(-29, -29, 0);
    this.uiRoot.addChild(map);
};

RobotControl.prototype.createTouchButton = function (action, label, x, y, anchor, pivot) {
    var button = this.createPanel('Touch ' + action, x, y, 58, 58, anchor, pivot, new pc.Color(.06, .08, .1), .68);
    button.element.useInput = true;
    this.createText('Touch ' + action + ' Label', label, 20, -13, 24, 26, 26, new pc.Color(.95, 1, .98), button, [.5, .5]);

    var setTouch = function (value) {
        this.touch[action] = value;
        if (value) this.activateAudio();
    }.bind(this);
    button.element.on('mousedown', function () { setTouch(true); });
    button.element.on('mouseup', function () { setTouch(false); });
    button.element.on('mouseleave', function () { setTouch(false); });
    button.element.on('touchstart', function () { setTouch(true); });
    button.element.on('touchend', function () { setTouch(false); });
    button.element.on('touchcancel', function () { setTouch(false); });
    return button;
};

RobotControl.prototype.createTouchControls = function () {
    this.createTouchButton('left', '<', 18, 18, [0, 0, 0, 0], [0, 0]);
    this.createTouchButton('right', '>', 86, 18, [0, 0, 0, 0], [0, 0]);
    this.createTouchButton('forward', '^', -18, 18, [1, 0, 1, 0], [1, 0]);
    this.createTouchButton('backward', 'v', 52, 18, [1, 0, 1, 0], [1, 0]);
};

RobotControl.prototype.createMessageUi = function () {
    this.ui.messagePanel = this.createPanel('Message Panel', 0, 34, 360, 48, [.5, 0, .5, 0], [.5, 0], new pc.Color(.16, .11, .04), .78);
    this.ui.messagePanel.enabled = false;
    this.ui.message = this.createText('Message Text', '', 0, -11, 340, 26, 20, new pc.Color(1, .96, .78), this.ui.messagePanel, [.5, .5]);
};

RobotControl.prototype.createResultUi = function () {
    this.ui.result = this.createPanel('Result Panel', 0, 0, 430, 196, [.5, .5, .5, .5], [.5, .5], new pc.Color(.05, .08, .1), .86);
    this.ui.result.enabled = false;
    this.ui.resultTitle = this.createText('Result Title', '探索終了', 0, 72, 390, 36, 28, new pc.Color(.96, 1, .98), this.ui.result, [.5, .5]);
    this.ui.resultCopy = this.createText('Result Copy', '', 0, 24, 390, 28, 19, new pc.Color(.78, .86, .84), this.ui.result, [.5, .5]);
    this.ui.resultHint = this.createText('Result Hint', 'Rキーでもう一度', 0, -38, 220, 26, 18, new pc.Color(.08, .12, .12), this.ui.result, [.5, .5]);
    var restart = this.createPanel('Restart Button', 0, -64, 220, 44, [.5, 1, .5, 1], [.5, 1], new pc.Color(.86, .73, .34), .96, this.ui.result);
    restart.element.useInput = true;
    restart.element.on('mousedown', function () {
        this.activateAudio();
        this.restartGame();
    }, this);
    restart.element.on('touchstart', function () {
        this.activateAudio();
        this.restartGame();
    }, this);
    this.ui.restartButton = restart;
};

RobotControl.prototype.createMaterials = function () {
    return {
        ground: this.createMaterial('Ground', [.68, .73, .61], { gloss: .1 }),
        grid: this.createMaterial('Grid', [.75, .78, .66], { opacity: .2, depthWrite: false }),
        path: this.createMaterial('Path', [.83, .72, .46], { opacity: .22, depthWrite: false }),
        water: this.createMaterial('Water', [.33, .67, .69], { opacity: .58, depthWrite: false, gloss: .55 }),
        graphite: this.createMaterial('Graphite', [.15, .18, .2], { metalness: .3, gloss: .38 }),
        frame: this.createMaterial('Frame', [.72, .79, .76], { metalness: .65, gloss: .44 }),
        cloth: this.createMaterial('Cloth', [.21, .35, .33], { gloss: .12 }),
        rubber: this.createMaterial('Rubber', [.06, .07, .08], { gloss: .08 }),
        glow: this.createMaterial('Glow', [.45, .9, .82], { emissive: [.2, .9, .78], gloss: .25 }),
        coin: this.createMaterial('Coin', [1, .82, .36], { emissive: [.8, .38, .07], metalness: .5, gloss: .55 }),
        coinGlow: this.createMaterial('Coin Glow', [1, .82, .36], { emissive: [1, .55, .14], opacity: .24, depthWrite: false }),
        trunk: this.createMaterial('Trunk', [.37, .28, .22], { gloss: .08 }),
        leaf: this.createMaterial('Leaf', [.36, .55, .4], { emissive: [.03, .09, .04], gloss: .08 }),
        stone: this.createMaterial('Stone', [.55, .57, .53], { gloss: .08 }),
        arch: this.createMaterial('Arch', [.54, .49, .42], { gloss: .1 }),
        metal: this.createMaterial('Metal', [.2, .27, .29], { metalness: .5, gloss: .38 }),
        lamp: this.createMaterial('Lamp', [1, .82, .36], { emissive: [1, .55, .15], opacity: .84 }),
        firefly: this.createMaterial('Firefly', [1, .94, .64], { emissive: [1, .82, .3], opacity: .78 }),
        crystalA: this.createMaterial('Crystal A', [.45, .9, .82], { emissive: [.18, .75, .68], opacity: .86 }),
        crystalB: this.createMaterial('Crystal B', [.56, .77, 1], { emissive: [.24, .46, .92], opacity: .86 }),
        crystalC: this.createMaterial('Crystal C', [1, .65, .44], { emissive: [.85, .32, .14], opacity: .86 }),
        crystalD: this.createMaterial('Crystal D', [.84, .84, .44], { emissive: [.66, .62, .14], opacity: .86 }),
        crystalE: this.createMaterial('Crystal E', [.88, .65, 1], { emissive: [.56, .28, .86], opacity: .86 })
    };
};

RobotControl.prototype.createMaterial = function (name, color, options) {
    options = options || {};
    var material = new pc.StandardMaterial();
    material.name = name;
    material.diffuse = new pc.Color(color[0], color[1], color[2], color[3] === undefined ? 1 : color[3]);
    material.gloss = options.gloss === undefined ? .22 : options.gloss;
    material.metalness = options.metalness || 0;
    material.useMetalness = true;
    if (options.emissive) material.emissive = new pc.Color(options.emissive[0], options.emissive[1], options.emissive[2]);
    if (options.opacity !== undefined && options.opacity < 1) {
        material.opacity = options.opacity;
        material.blendType = pc.BLEND_NORMAL;
        material.depthWrite = options.depthWrite === undefined ? false : options.depthWrite;
    }
    material.update();
    return material;
};

RobotControl.prototype.addPrimitive = function (name, type, material, position, scale, rotation, parent) {
    var entity = new pc.Entity(name);
    entity.addComponent('render', { type: type });
    if (entity.render) {
        entity.render.meshInstances.forEach(function (meshInstance) {
            meshInstance.material = material;
        });
    }
    entity.setLocalPosition(position[0], position[1], position[2]);
    entity.setLocalScale(scale[0], scale[1], scale[2]);
    if (rotation) entity.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
    (parent || this.app.root).addChild(entity);
    return entity;
};

RobotControl.prototype.createCameraAndLights = function () {
    var camera = new pc.Entity('Rear Camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(.69, .74, .66),
        fov: 66,
        nearClip: .1,
        farClip: 1200
    });
    camera.setPosition(this.cameraPosition);
    this.app.root.addChild(camera);
    this.camera = camera;

    var sun = new pc.Entity('Sun');
    sun.addComponent('light', {
        type: 'directional',
        color: new pc.Color(1, .94, .76),
        intensity: 1.8,
        castShadows: true,
        shadowDistance: 120,
        shadowResolution: 1024
    });
    sun.setLocalEulerAngles(48, -38, 0);
    this.app.root.addChild(sun);

    var rim = new pc.Entity('Rim Light');
    rim.addComponent('light', {
        type: 'directional',
        color: new pc.Color(.55, .86, .82),
        intensity: .42
    });
    rim.setLocalEulerAngles(18, 132, 0);
    this.app.root.addChild(rim);
};

RobotControl.prototype.createWorld = function () {
    var m = this.materials;
    this.addPrimitive('Ground', 'plane', m.ground, [0, 0, 0], [this.WORLD_SIZE, 1, this.WORLD_SIZE]);
    for (var i = -this.HALF_WORLD; i <= this.HALF_WORLD; i += 40) {
        this.addPrimitive('Grid X', 'box', m.grid, [0, .012, i], [this.WORLD_SIZE, .012, .045]);
        this.addPrimitive('Grid Z', 'box', m.grid, [i, .014, 0], [.045, .012, this.WORLD_SIZE]);
    }
    for (var j = 0; j < 14; j++) {
        this.addPrimitive('Pale Path', 'box', m.path, [this.randomRange(-280, 280), .025, this.randomRange(-280, 280)], [this.randomRange(90, 240), .018, this.randomRange(1.8, 4.2)], [0, this.randomRange(0, 180), 0]);
    }
    this.createLake(-120, 105, 96, 64);
    this.createLake(178, -185, 70, 44);
    for (var k = 0; k < 115; k++) {
        var x = this.randomRange(-this.HALF_WORLD + 28, this.HALF_WORLD - 28);
        var z = this.randomRange(-this.HALF_WORLD + 28, this.HALF_WORLD - 28);
        if (Math.hypot(x, z) < 24 || Math.hypot(x + 120, z - 105) < 82) continue;
        if (Math.random() < .62) this.createTree(x, z, this.randomRange(.8, 1.8));
        else this.createStone(x, z, this.randomRange(.7, 2.4));
    }
    var crystalColors = [m.crystalA, m.crystalB, m.crystalC, m.crystalD, m.crystalE];
    [[-260, -214, 13], [245, 210, 16], [-218, 238, 11], [142, -272, 14], [22, 284, 10]].forEach(function (item, index) {
        this.createCrystal(item[0], item[1], item[2], crystalColors[index]);
    }, this);
    [[-48, -132, .15], [222, -32, 1.2], [-238, 42, -.65]].forEach(function (item) {
        this.createArch(item[0], item[1], item[2]);
    }, this);
    for (var l = 0; l < 34; l++) {
        var angle = l * .65;
        var radius = 54 + l * 7.4;
        this.createLantern(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    this.createFireflies();
};

RobotControl.prototype.createLake = function (x, z, width, depth) {
    var lake = this.addPrimitive('Lake', 'cylinder', this.materials.water, [x, .035, z], [width * 1.5, .025, depth * 1.5]);
    this.animated.push({ type: 'water', entity: lake, phase: Math.random() * 10 });
    this.landmarks.push({ kind: 'lake', x: x, z: z, radius: Math.max(width, depth) * 1.5, width: width * 1.5, depth: depth * 1.5 });
};

RobotControl.prototype.createTree = function (x, z, scale) {
    var group = new pc.Entity('Tree');
    group.setLocalPosition(x, 0, z);
    group.setLocalEulerAngles(0, this.randomRange(0, 360), 0);
    group.setLocalScale(scale * 4.0, scale * 4.0, scale * 4.0);
    this.app.root.addChild(group);
    this.addPrimitive('Trunk', 'cylinder', this.materials.trunk, [0, .95, 0], [.16, 1.9, .16], null, group);
    this.addPrimitive('Leaf A', 'cone', this.materials.leaf, [0, 1.7, 0], [1.35, 1.35, 1.35], null, group);
    this.addPrimitive('Leaf B', 'cone', this.materials.leaf, [0, 2.2, 0], [1.05, 1.15, 1.05], [0, 28, 0], group);
    this.addPrimitive('Leaf C', 'cone', this.materials.leaf, [0, 2.62, 0], [.8, .95, .8], [0, -22, 0], group);
    this.addCollider(x, z, 1.05 * scale * 4.0);
    this.landmarks.push({ kind: 'tree', x: x, z: z, radius: 13 * scale * 4.0 });
};

RobotControl.prototype.createStone = function (x, z, scale) {
    var stone = this.addPrimitive('Stone', 'box', this.materials.stone, [x, scale * 1.5 * .34, z], [scale * 1.5 * 1.2, scale * 1.5 * .7, scale * 1.5], [this.randomRange(-8, 8), this.randomRange(0, 180), this.randomRange(-8, 8)]);
    this.animated.push({ type: 'stone', entity: stone, phase: Math.random() * 10 });
    this.addCollider(x, z, Math.max(1, scale * 1.5 * .95));
};

RobotControl.prototype.createCrystal = function (x, z, height, material) {
    var group = new pc.Entity('Crystal');
    group.setLocalPosition(x, 0, z);
    this.app.root.addChild(group);
    var crystal = this.addPrimitive('Crystal Body', 'cone', material, [0, height / 2, 0], [3.6, height * 1.5, 3.6], [0, this.randomRange(0, 360), 0], group);
    this.animated.push({ type: 'crystal', entity: crystal, phase: Math.random() * 10 });
    this.addCollider(x, z, 2.05 * 1.5);
    this.landmarks.push({ kind: 'crystal', x: x, z: z, radius: 22 * 1.5 });
};

RobotControl.prototype.createArch = function (x, z, rotation) {
    var group = new pc.Entity('Arch');
    group.setLocalPosition(x, 0, z);
    group.setLocalEulerAngles(0, rotation * pc.math.RAD_TO_DEG, 0);
    this.app.root.addChild(group);
    [-4.2 * 1.5, 4.2 * 1.5].forEach(function (offset) {
        this.addPrimitive('Arch Post', 'box', this.materials.arch, [offset, 4.25 * 1.5, 0], [1.5 * 1.5, 8.5 * 1.5, 1.25 * 1.5], null, group);
        this.addCollider(x + Math.cos(rotation) * offset, z - Math.sin(rotation) * offset, 1.25 * 1.5);
    }, this);
    this.addPrimitive('Arch Top', 'box', this.materials.arch, [0, 8.65 * 1.5, 0], [10.2 * 1.5, 1.35 * 1.5, 1.45 * 1.5], null, group);
    this.landmarks.push({ kind: 'arch', x: x, z: z, radius: 36 * 1.5 });
};

RobotControl.prototype.createLantern = function (x, z) {
    var group = new pc.Entity('Lantern');
    group.setLocalPosition(x, 0, z);
    this.app.root.addChild(group);
    this.addPrimitive('Lantern Pole', 'cylinder', this.materials.metal, [0, 1.65 * 1.5, 0], [.08 * 1.5, 3.3 * 1.5, .08 * 1.5], null, group);
    var bulb = this.addPrimitive('Lantern Bulb', 'sphere', this.materials.lamp, [0, 3.25 * 1.5, 0], [.52 * 1.5, .52 * 1.5, .52 * 1.5], null, group);
    this.animated.push({ type: 'lantern', entity: bulb, phase: Math.random() * 8 });
    this.addCollider(x, z, .7 * 1.5);
};

RobotControl.prototype.createFireflies = function () {
    for (var i = 0; i < 95; i++) {
        var x = this.randomRange(-this.HALF_WORLD, this.HALF_WORLD);
        var z = this.randomRange(-this.HALF_WORLD, this.HALF_WORLD);
        var entity = this.addPrimitive('Firefly', 'sphere', this.materials.firefly, [x, this.randomRange(2.2, 14), z], [.18, .18, .18]);
        this.fireflies.push({ entity: entity, x: x, z: z, y: entity.getLocalPosition().y, phase: Math.random() * Math.PI * 2 });
    }
};

RobotControl.prototype.createPlayer = function () {
    var m = this.materials;
    var player = new pc.Entity('Robot Wheelchair');
    player.setLocalPosition(0, .42, 0);
    this.app.root.addChild(player);
    this.player = player;
    this.addPrimitive('Base', 'box', m.graphite, [0, .72, .03], [1.45, .34, 1.55], null, player);
    this.addPrimitive('Seat', 'box', m.cloth, [0, .99, .1], [1.22, .22, 1.12], null, player);
    this.addPrimitive('Back', 'box', m.cloth, [0, 1.45, -.62], [1.28, 1.12, .18], [-7, 0, 0], player);
    this.addPrimitive('Sensor', 'box', m.glow, [0, 2.12, -.72], [.56, .18, .16], null, player);
    this.addPrimitive('Front Lamp', 'sphere', m.glow, [0, .88, 1], [.24, .24, .24], null, player);
    [-.82, .82].forEach(function (x) {
        this.addPrimitive('Arm', 'box', m.graphite, [x, 1.22, .12], [.14, .12, .9], null, player);
        this.addPrimitive('Side Rail', 'cylinder', m.frame, [x, .98, .1], [.07, 1.45, .07], [90, 0, 0], player);
    }, this);
    [-.88, .88].forEach(function (x) {
        var wheel = new pc.Entity('Wheel');
        wheel.setLocalPosition(x, .63, .02);
        player.addChild(wheel);
        this.addPrimitive('Tire', 'cylinder', m.rubber, [0, 0, 0], [1.15, .16, 1.15], [0, 0, 90], wheel);
        this.addPrimitive('Hub', 'cylinder', m.frame, [0, 0, 0], [.32, .24, .32], [0, 0, 90], wheel);
        this.wheels.push(wheel);
    }, this);
    [-.52, .52].forEach(function (x) {
        [1, -1].forEach(function (sign) {
            this.addPrimitive('Caster Fork', 'cylinder', m.frame, [x, .38, sign * .72], [.05, .28, .05], null, player);
            this.addPrimitive('Caster', 'cylinder', m.rubber, [x, .2, sign * .72], [.28, .07, .28], [0, 0, 90], player);
        }, this);
    }, this);
};

RobotControl.prototype.createCoins = function () {
    var minDistance = 34;
    var attempts = 0;
    while (this.coins.length < this.COIN_TOTAL && attempts < this.COIN_TOTAL * 80) {
        attempts++;
        var angle = Math.random() * Math.PI * 2;
        var distance = this.randomRange(32, this.HALF_WORLD - 35);
        var x = Math.cos(angle) * distance + this.randomRange(-16, 16);
        var z = Math.sin(angle) * distance + this.randomRange(-16, 16);
        if (Math.abs(x) > this.HALF_WORLD - 18 || Math.abs(z) > this.HALF_WORLD - 18) continue;
        if (Math.hypot(x + 120, z - 105) < 95) continue;
        if (this.touchesCollider(x, z, 6.3)) continue;
        if (this.coins.some(function (coin) { return Math.hypot(coin.x - x, coin.z - z) < minDistance; })) continue;
        var entity = this.addPrimitive('Coin', 'cylinder', this.materials.coin, [x, 1.18, z], [1.6, .14, 1.6], [0, 0, 90]);
        var halo = this.addPrimitive('Coin Glow', 'sphere', this.materials.coinGlow, [0, 0, 0], [1.95, .14, 1.95], null, entity);
        this.coins.push({ entity: entity, halo: halo, x: x, z: z, phase: this.coins.length * .47 });
    }
    this.setUiText('coins', '0/' + this.COIN_TOTAL);
};

RobotControl.prototype.initMap = function () {
    this.mapMemoryCtx.fillStyle = '#081015';
    this.mapMemoryCtx.fillRect(0, 0, this.MAP_SIZE, this.MAP_SIZE);
    this.mapMemoryCtx.strokeStyle = 'rgba(255, 255, 255, .04)';
    this.mapMemoryCtx.lineWidth = 1;
    for (var i = 0; i <= this.MAP_CELLS; i++) {
        var pos = i * (this.MAP_SIZE / this.MAP_CELLS);
        this.mapMemoryCtx.beginPath();
        this.mapMemoryCtx.moveTo(pos, 0);
        this.mapMemoryCtx.lineTo(pos, this.MAP_SIZE);
        this.mapMemoryCtx.stroke();
        this.mapMemoryCtx.beginPath();
        this.mapMemoryCtx.moveTo(0, pos);
        this.mapMemoryCtx.lineTo(this.MAP_SIZE, pos);
        this.mapMemoryCtx.stroke();
    }
    this.drawMiniMap();
};

RobotControl.prototype.setupInput = function () {
    this.keyboard = this.app.keyboard;
    this.gamepadAxes = { x: 0, y: 0 };
};

RobotControl.prototype.updateGamepadInput = function () {
    this.gamepadAxes = { x: 0, y: 0 };
    if (!navigator.getGamepads) return;
    
    var gamepads = navigator.getGamepads();
    for (var i = 0; i < gamepads.length; i++) {
        var pad = gamepads[i];
        if (!pad || !pad.connected) continue;
        // Left stick: axes[0] = X, axes[1] = Y
        if (pad.axes.length >= 2) {
            var x = pad.axes[0] || 0;
            var y = pad.axes[1] || 0;
            this.gamepadAxes.x = x;
            this.gamepadAxes.y = y;
        }
        break; // Use first connected gamepad
    }
};

RobotControl.prototype.update = function (dt) {
    this.elapsed += dt;
    this.frame += 1;
    if (this.finished && this.wasKeyPressed(pc.KEY_R)) {
        this.restartGame();
        return;
    }
    if (!this.finished) {
        this.updateGamepadInput();
        this.updatePlayer(dt);
        this.updateTimer(dt);
        this.revealMap();
        this.updateWaterSound();
    }
    this.updateCamera(dt);
    this.updateCoins(dt, this.elapsed);
    this.updateAnimated(dt, this.elapsed);
    this.updateMessage(dt);
    if (this.frame % 2 === 0) this.drawMiniMap();
};

RobotControl.prototype.updatePlayer = function (dt) {
    var keyboardTurningLeft = this.isKeyPressed(pc.KEY_A) || this.isKeyPressed(pc.KEY_LEFT);
    var keyboardTurningRight = this.isKeyPressed(pc.KEY_D) || this.isKeyPressed(pc.KEY_RIGHT);
    var touchTurningLeft = this.touch.left;
    var touchTurningRight = this.touch.right;
    
    var keyboardForward = this.isKeyPressed(pc.KEY_W) || this.isKeyPressed(pc.KEY_UP);
    var keyboardBackward = this.isKeyPressed(pc.KEY_S) || this.isKeyPressed(pc.KEY_DOWN);
    var touchForward = this.touch.forward;
    var touchBackward = this.touch.backward;
    var gamepadForward = this.gamepadAxes.y < -0.03;
    var gamepadBackward = this.gamepadAxes.y > 0.03;
    var forward = keyboardForward || touchForward || gamepadForward;
    var backward = keyboardBackward || touchBackward || gamepadBackward;

    if (keyboardTurningLeft || keyboardTurningRight || touchTurningLeft || touchTurningRight || forward || backward) this.activateAudio();
    
    // 回転制御：キーボード/タッチはデジタル、ジョイスティックはアナログ
    if (keyboardTurningLeft || touchTurningLeft) {
        // キーボードとタッチは固定の回転速度（108 degrees/sec）
        this.heading += 108 * dt;
    } else if (keyboardTurningRight || touchTurningRight) {
        this.heading -= 108 * dt;
    } else {
        // ジョイスティックの場合は入力強度に基づいて回転
        // X軸: -1.0～0 を左回転、0～1.0 を右回転に正規化
        if (this.gamepadAxes.x < -0.03) {
            var leftStrength = Math.max(0, Math.min(1, (-this.gamepadAxes.x - 0.03) / 0.97));
            var leftRotationSpeed = leftStrength * 162; // 最大162 degrees/sec（キーボードより若干速い）
            this.heading += leftRotationSpeed * dt;
        } else if (this.gamepadAxes.x > 0.03) {
            var rightStrength = Math.max(0, Math.min(1, (this.gamepadAxes.x - 0.03) / 0.97));
            var rightRotationSpeed = rightStrength * 162; // 最大162 degrees/sec（キーボードより若干速い）
            this.heading -= rightRotationSpeed * dt;
        }
    }
    
    if (this.heading > 360 || this.heading < -360) this.heading %= 360;
    this.player.setLocalEulerAngles(0, this.heading, 0);

    // 速度制御：キーボード/タッチはデジタル、ジョイスティックはアナログ
    if (backward) {
        // 後ろ入力：ニュートラルで即座に停止
        this.speed = 0;
    } else if (keyboardForward || touchForward) {
        // キーボードとタッチは最大加速度（18 units/sec²）
        this.speed = this.clamp(this.speed + 18 * dt, 0, 18.5);
    } else if (gamepadForward) {
        // ゲームパッド入力値と速度をリニアに対応
        // Y軸: -1.0～-0.03 を 0～1 に正規化して、即座に速度を設定
        var gamepadStrength = Math.max(0, Math.min(1, (-this.gamepadAxes.y - 0.03) / 0.97));
        this.speed = gamepadStrength * 18.5;  // 入力値に比例した速度を即座に設定
    } else {
        // 入力なし：減速
        this.speed *= Math.pow(.09, dt);
    }

    var speedBeforeCollision = this.speed;
    var headingRad = this.heading * pc.math.DEG_TO_RAD;
    var current = this.player.getLocalPosition();
    var resolved = this.resolveCollisions(
        this.clamp(current.x + Math.sin(headingRad) * this.speed * dt, -this.HALF_WORLD + 8, this.HALF_WORLD - 8),
        this.clamp(current.z + Math.cos(headingRad) * this.speed * dt, -this.HALF_WORLD + 8, this.HALF_WORLD - 8)
    );
    if (resolved.hit) {
        if (!this.touchingObstacle && speedBeforeCollision > .6) this.playHitSound(speedBeforeCollision);
        this.touchingObstacle = true;
        this.obstacleClearTimer = 0;
        this.speed *= .38;
    } else if (this.isObstacleContactClear(resolved.x, resolved.z)) {
        this.obstacleClearTimer += dt;
        if (this.obstacleClearTimer >= .24) this.touchingObstacle = false;
    } else {
        this.obstacleClearTimer = 0;
        if (this.touchingObstacle) this.speed *= .72;
    }
    this.player.setLocalPosition(resolved.x, .42, resolved.z);

    this.wheelSpin += this.speed * dt * 165;
    if (this.wheelSpin > 360 || this.wheelSpin < -360) this.wheelSpin %= 360;
    this.wheels.forEach(function (wheel) {
        wheel.setLocalEulerAngles(this.wheelSpin, 0, 0);
    }, this);
};

RobotControl.prototype.updateCamera = function (dt) {
    var playerPos = this.player.getPosition();
    var headingRad = this.heading * pc.math.DEG_TO_RAD;
    var speedLift = this.clamp(this.speed / 18.5, 0, 1);
    var targetX = playerPos.x - Math.sin(headingRad) * (10 + speedLift * 2.3);
    var targetY = playerPos.y + 6.4 + speedLift * .6;
    var targetZ = playerPos.z - Math.cos(headingRad) * (10 + speedLift * 2.3);
    var follow = 1 - Math.pow(.002, dt);
    this.cameraPosition.x += (targetX - this.cameraPosition.x) * follow;
    this.cameraPosition.y += (targetY - this.cameraPosition.y) * follow;
    this.cameraPosition.z += (targetZ - this.cameraPosition.z) * follow;
    this.camera.setPosition(this.cameraPosition);
    this.camera.lookAt(playerPos.x + Math.sin(headingRad) * 5.5, playerPos.y + 1.35, playerPos.z + Math.cos(headingRad) * 5.5);
};

RobotControl.prototype.updateCoins = function (dt, elapsed) {
    for (var i = this.coins.length - 1; i >= 0; i--) {
        var coin = this.coins[i];
        coin.entity.setLocalPosition(coin.x, 1.18 + Math.sin(elapsed * 2.2 + coin.phase) * .18, coin.z);
        coin.entity.setLocalEulerAngles(0, elapsed * 120 + coin.phase * 30, 90);
        var player = this.player.getPosition();
        if (!this.finished && Math.hypot(coin.x - player.x, coin.z - player.z) < 2.2) this.collectCoin(i);
    }
};

RobotControl.prototype.collectCoin = function (index) {
    var coin = this.coins[index];
    if (!coin) return;
    coin.entity.destroy();
    this.coins.splice(index, 1);
    this.collected += 1;
    this.score += 100;
    this.setUiText('coins', this.collected + '/' + this.COIN_TOTAL);
    this.playSound('coin');
    this.showMessage('コイン +100  ' + this.collected + '/' + this.COIN_TOTAL);
    if (this.collected === this.COIN_TOTAL) this.finishGame(true);
};

RobotControl.prototype.updateAnimated = function (dt, elapsed) {
    this.animated.forEach(function (item) {
        if (item.type === 'crystal') item.entity.rotate(0, dt * 18, 0);
        if (item.type === 'lantern') {
            var pulse = 1 + Math.sin(elapsed * 3 + item.phase) * .08;
            item.entity.setLocalScale(.52 * pulse, .52 * pulse, .52 * pulse);
        }
    });
    this.fireflies.forEach(function (firefly) {
        firefly.entity.setLocalPosition(
            firefly.x + Math.sin(elapsed * .42 + firefly.phase) * 2.2,
            firefly.y + Math.sin(elapsed * .9 + firefly.phase * 1.7) * 1.2,
            firefly.z + Math.cos(elapsed * .37 + firefly.phase) * 2.2
        );
    });
};

RobotControl.prototype.updateTimer = function (dt) {
    if (this.finished) return;
    this.timeLeft -= dt;
    this.setUiText('timer', this.formatTime(this.timeLeft));
    if (this.timeLeft <= 0) {
        this.playSound('finish');
        this.finishGame(false);
    }
};

RobotControl.prototype.updateWaterSound = function () {
    var inWater = this.isPlayerInWater();
    if (inWater && !this.waterPlaying) {
        this.waterPlaying = this.playSound('water');
    } else if (!inWater && this.waterPlaying) {
        this.stopSound('water');
        this.waterPlaying = false;
    }
};

RobotControl.prototype.isPlayerInWater = function () {
    if (!this.player) return false;
    var player = this.player.getPosition();
    return this.landmarks.some(function (landmark) {
        if (landmark.kind !== 'lake') return false;
        var radiusX = Math.max((landmark.width || landmark.radius) * .5, 1);
        var radiusZ = Math.max((landmark.depth || landmark.radius) * .5, 1);
        var dx = (player.x - landmark.x) / radiusX;
        var dz = (player.z - landmark.z) / radiusZ;
        return dx * dx + dz * dz <= 1.04;
    });
};

RobotControl.prototype.revealMap = function () {
    var player = this.player.getPosition();
    var p = this.worldToMap(player.x, player.z);
    var cellSize = this.WORLD_SIZE / this.MAP_CELLS;
    var cellX = this.clamp(Math.floor((player.x + this.HALF_WORLD) / cellSize), 0, this.MAP_CELLS - 1);
    var cellY = this.clamp(Math.floor((player.z + this.HALF_WORLD) / cellSize), 0, this.MAP_CELLS - 1);
    var key = cellX + ':' + cellY;
    for (var y = -3; y <= 3; y++) {
        for (var x = -3; x <= 3; x++) {
            var cx = cellX + x;
            var cy = cellY + y;
            if (cx < 0 || cy < 0 || cx >= this.MAP_CELLS || cy >= this.MAP_CELLS) continue;
            if (Math.hypot(x, y) <= 3) this.revealedCells.add(cx + ':' + cy);
        }
    }
    var revealGradient = this.mapMemoryCtx.createRadialGradient(p.x, p.y, 1, p.x, p.y, this.REVEAL_RADIUS);
    revealGradient.addColorStop(0, 'rgba(106, 177, 161, .38)');
    revealGradient.addColorStop(.62, 'rgba(106, 177, 161, .16)');
    revealGradient.addColorStop(1, 'rgba(106, 177, 161, 0)');
    this.mapMemoryCtx.fillStyle = revealGradient;
    this.mapMemoryCtx.beginPath();
    this.mapMemoryCtx.arc(p.x, p.y, this.REVEAL_RADIUS, 0, Math.PI * 2);
    this.mapMemoryCtx.fill();
    if (this.lastMapPoint) {
        this.mapMemoryCtx.strokeStyle = 'rgba(255, 209, 92, .55)';
        this.mapMemoryCtx.lineWidth = 2.2;
        this.mapMemoryCtx.lineCap = 'round';
        this.mapMemoryCtx.beginPath();
        this.mapMemoryCtx.moveTo(this.lastMapPoint.x, this.lastMapPoint.y);
        this.mapMemoryCtx.lineTo(p.x, p.y);
        this.mapMemoryCtx.stroke();
    }
    this.lastMapPoint = p;
    if (this.lastMapCell !== key || this.frame % 42 === 0) {
        this.drawDiscoveredDetails();
        this.lastMapCell = key;
    }
    this.setUiText('mapped', Math.round((this.revealedCells.size / (this.MAP_CELLS * this.MAP_CELLS)) * 100) + '%');
};

RobotControl.prototype.drawDiscoveredDetails = function () {
    var player = this.player.getPosition();
    this.landmarks.forEach(function (landmark) {
        var distance = Math.hypot(landmark.x - player.x, landmark.z - player.z);
        if (distance > this.REVEAL_RADIUS * 3.4 + landmark.radius) return;
        var p = this.worldToMap(landmark.x, landmark.z);
        this.mapMemoryCtx.save();
        if (landmark.kind === 'lake') {
            this.mapMemoryCtx.fillStyle = 'rgba(91, 179, 183, .42)';
            this.mapMemoryCtx.beginPath();
            this.mapMemoryCtx.ellipse(p.x, p.y, landmark.radius * .4, landmark.radius * .25, .25, 0, Math.PI * 2);
            this.mapMemoryCtx.fill();
        } else if (landmark.kind === 'crystal') {
            this.mapMemoryCtx.fillStyle = 'rgba(157, 225, 255, .68)';
            this.mapMemoryCtx.beginPath();
            this.mapMemoryCtx.moveTo(p.x, p.y - 5);
            this.mapMemoryCtx.lineTo(p.x + 5, p.y + 4);
            this.mapMemoryCtx.lineTo(p.x - 5, p.y + 4);
            this.mapMemoryCtx.closePath();
            this.mapMemoryCtx.fill();
        } else if (landmark.kind === 'arch') {
            this.mapMemoryCtx.strokeStyle = 'rgba(255, 209, 92, .65)';
            this.mapMemoryCtx.lineWidth = 2;
            this.mapMemoryCtx.beginPath();
            this.mapMemoryCtx.arc(p.x, p.y, 8, Math.PI, 0);
            this.mapMemoryCtx.stroke();
        } else if (landmark.kind === 'tree') {
            this.mapMemoryCtx.fillStyle = 'rgba(103, 157, 107, .32)';
            this.mapMemoryCtx.beginPath();
            this.mapMemoryCtx.arc(p.x, p.y, this.clamp(landmark.radius * .18, 1.4, 4.6), 0, Math.PI * 2);
            this.mapMemoryCtx.fill();
        }
        this.mapMemoryCtx.restore();
    }, this);
};

RobotControl.prototype.drawMiniMap = function () {
    if (!this.mapCtx || !this.mapMemory) return;
    this.mapCtx.clearRect(0, 0, this.MAP_SIZE, this.MAP_SIZE);
    this.mapCtx.drawImage(this.mapMemory, 0, 0);
    var player = this.player ? this.player.getPosition() : { x: 0, z: 0 };
    var p = this.worldToMap(player.x, player.z);
    this.coins.forEach(function (coin) {
        if (Math.hypot(coin.x - player.x, coin.z - player.z) > 76) return;
        var coinPos = this.worldToMap(coin.x, coin.z);
        this.mapCtx.fillStyle = 'rgba(255, 209, 92, .78)';
        this.mapCtx.beginPath();
        this.mapCtx.arc(coinPos.x, coinPos.y, 2.7, 0, Math.PI * 2);
        this.mapCtx.fill();
    }, this);
    var headingRad = this.heading * pc.math.DEG_TO_RAD;
    this.mapCtx.save();
    this.mapCtx.translate(p.x, p.y);
    this.mapCtx.rotate(-headingRad);
    this.mapCtx.fillStyle = '#ecf8f3';
    this.mapCtx.strokeStyle = 'rgba(8, 16, 19, .9)';
    this.mapCtx.lineWidth = 2;
    this.mapCtx.beginPath();
    this.mapCtx.moveTo(0, 9);
    this.mapCtx.lineTo(6, -8);
    this.mapCtx.lineTo(0, -5);
    this.mapCtx.lineTo(-6, -8);
    this.mapCtx.closePath();
    this.mapCtx.fill();
    this.mapCtx.stroke();
    this.mapCtx.restore();
    if (this.mapTexture) this.mapTexture.upload();
};

RobotControl.prototype.finishGame = function (completed) {
    if (this.finished) return;
    this.finished = true;
    this.speed = 0;
    this.stopSound('water');
    this.waterPlaying = false;
    this.setUiText('resultTitle', completed ? '全コイン回収' : '探索終了');
    var mapped = Math.round((this.revealedCells.size / (this.MAP_CELLS * this.MAP_CELLS)) * 100);
    this.setUiText('resultCopy', 'コイン ' + this.collected + '/' + this.COIN_TOTAL + '  スコア ' + this.score + '  探索率 ' + mapped + '%');
    this.ui.result.enabled = true;
};

RobotControl.prototype.showMessage = function (text) {
    this.setUiText('message', text);
    this.ui.messagePanel.enabled = true;
    this.messageTtl = 1.3;
};

RobotControl.prototype.updateMessage = function (dt) {
    if (this.messageTtl <= 0) return;
    this.messageTtl -= dt;
    if (this.messageTtl <= 0 && this.ui.messagePanel) this.ui.messagePanel.enabled = false;
};

RobotControl.prototype.addCollider = function (x, z, radius) {
    this.colliders.push({ x: x, z: z, radius: radius });
};

RobotControl.prototype.touchesCollider = function (x, z, padding) {
    return this.colliders.some(function (collider) {
        return Math.hypot(x - collider.x, z - collider.z) < collider.radius + padding;
    });
};

RobotControl.prototype.isObstacleContactClear = function (x, z) {
    return !this.colliders.some(function (collider) {
        return Math.hypot(x - collider.x, z - collider.z) < this.PLAYER_RADIUS + collider.radius + .65;
    }, this);
};

RobotControl.prototype.resolveCollisions = function (x, z) {
    var hit = false;
    var resolvedX = x;
    var resolvedZ = z;
    for (var pass = 0; pass < 3; pass++) {
        this.colliders.forEach(function (collider) {
            var dx = resolvedX - collider.x;
            var dz = resolvedZ - collider.z;
            var minDistance = this.PLAYER_RADIUS + collider.radius;
            var distanceSq = dx * dx + dz * dz;
            if (distanceSq >= minDistance * minDistance) return;
            var distance = Math.sqrt(distanceSq);
            if (distance < .001) {
                var headingRad = this.heading * pc.math.DEG_TO_RAD;
                dx = Math.sin(headingRad);
                dz = Math.cos(headingRad);
                distance = 1;
            }
            var push = minDistance - distance + .015;
            resolvedX += (dx / distance) * push;
            resolvedZ += (dz / distance) * push;
            hit = true;
        }, this);
        resolvedX = this.clamp(resolvedX, -this.HALF_WORLD + 8, this.HALF_WORLD - 8);
        resolvedZ = this.clamp(resolvedZ, -this.HALF_WORLD + 8, this.HALF_WORLD - 8);
    }
    return { x: resolvedX, z: resolvedZ, hit: hit };
};

RobotControl.prototype.isKeyPressed = function (key) {
    return !!(this.keyboard && key !== undefined && this.keyboard.isPressed(key));
};

RobotControl.prototype.wasKeyPressed = function (key) {
    return !!(this.keyboard && key !== undefined && this.keyboard.wasPressed(key));
};

RobotControl.prototype.restartGame = function () {
    this.stopSound('bgm');
    this.stopSound('water');
    this.bgmStarted = false;
    this.waterPlaying = false;
    if (this.uiFont) {
        this.uiFont.destroy();
        this.uiFont = null;
    }
    this.initialize();
};

RobotControl.prototype.clamp = function (value, min, max) {
    return Math.max(min, Math.min(max, value));
};

RobotControl.prototype.randomRange = function (min, max) {
    return min + Math.random() * (max - min);
};

RobotControl.prototype.formatTime = function (seconds) {
    var whole = Math.max(0, Math.ceil(seconds));
    var min = String(Math.floor(whole / 60)).padStart(2, '0');
    var sec = String(whole % 60).padStart(2, '0');
    return min + ':' + sec;
};

RobotControl.prototype.worldToMap = function (x, z) {
    return {
        x: ((x + this.HALF_WORLD) / this.WORLD_SIZE) * this.MAP_SIZE,
        y: ((z + this.HALF_WORLD) / this.WORLD_SIZE) * this.MAP_SIZE
    };
};

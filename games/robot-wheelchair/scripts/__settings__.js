const ROBOT_WHEELCHAIR_BASE = window.ROBOT_WHEELCHAIR_BASE || "";
window.ASSET_PREFIX = ROBOT_WHEELCHAIR_BASE;
window.SCRIPT_PREFIX = ROBOT_WHEELCHAIR_BASE;
window.SCENE_PATH = "2485607.json";
window.CONTEXT_OPTIONS = {
    'antialias': true,
    'alpha': false,
    'preserveDrawingBuffer': false,
    'deviceTypes': [`webgl2`, `webgl1`],
    'powerPreference': "high-performance"
};
window.SCRIPTS = [ 900000001 ];
window.CONFIG_FILENAME = `${ROBOT_WHEELCHAIR_BASE}config.json`;
window.INPUT_SETTINGS = {
    useKeyboard: true,
    useMouse: true,
    useGamepads: false,
    useTouch: true
};
pc.script.legacy = false;
window.PRELOAD_MODULES = [
];

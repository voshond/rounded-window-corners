import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

const UUID = 'rounded-window-corners@fxgn';
let loaded = false;

export async function run() {
    await Scripting.sleep(1_000);

    const extension = Main.extensionManager.lookup(UUID);
    if (!extension)
        throw new Error('Rounded Window Corners was not found');
    if (extension.state !== 1)
        throw new Error(`Rounded Window Corners state is ${extension.state}`);

    const root = extension.dir.get_uri();
    const {ClipShadowEffect} = await import(`${root}/effect/clip_shadow_effect.js`);
    const {LinearFilterEffect} = await import(`${root}/effect/linear_filter_effect.js`);
    const {RoundedCornersEffect} = await import(`${root}/effect/rounded_corners_effect.js`);

    const effects = [
        new ClipShadowEffect(),
        new LinearFilterEffect(),
        new RoundedCornersEffect(),
    ];
    for (const index of [0, 2]) {
        const snippet = effects[index].vfunc_get_static_snippet();
        if (!snippet.get_post()?.includes('cogl_color_out') || snippet.get_replace())
            throw new Error(`Shader effect ${index} must preserve the sampled window color`);
    }
    const actors = effects.map((effect, index) => {
        const actor = new St.Widget({
            style: 'background-color: white;',
            width: 100,
            height: 100,
            x: 40 + index * 120,
            y: 100,
        });
        actor.add_effect(effect);
        Main.uiGroup.add_child(actor);
        return actor;
    });
    effects[2].updateUniforms({
        borderRadius: 12,
        smoothing: 0.3,
        padding: {left: 0, right: 0, top: 0, bottom: 0},
        borderColor: [1, 1, 1, 1],
    }, {x1: 0, y1: 0, x2: 100, y2: 100});
    await Scripting.sleep(300);
    for (const [index, effect] of effects.entries()) {
        if (!effect.get_pipeline())
            throw new Error(`Shader effect ${index} did not create a pipeline`);
    }
    for (const actor of actors)
        actor.destroy();

    loaded = true;
    console.log('Rounded Window Corners and all shader effects loaded in GNOME Shell 51');
}

export function finish() {
    if (!loaded)
        throw new Error('Rounded Window Corners did not load');
}

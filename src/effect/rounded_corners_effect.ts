/** @file Binds the actual corner rounding shader to the windows. */

import type {Bounds, RoundedCornerSettings} from '../utils/types.js';

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';

import {readShader} from '../utils/file.js';
import {getPref} from '../utils/settings.js';

const [declarations, code] = await readShader(
    import.meta.url,
    'shader/rounded_corners.frag',
);

export const RoundedCornersEffect = GObject.registerClass(
    {},
    class Effect extends Clutter.ShaderEffect {
        // The published GNOME Shell typings are still on 50 and do not expose
        // the GNOME 51 uniform API yet.
        setUniform(name: string, values: number[]) {
            const shader = this as unknown as Clutter.ShaderEffect & {
                set_uniform_float: (
                    name: string,
                    components: number,
                    values: number[],
                ) => void;
            };
            shader.set_uniform_float(name, values.length, values);
        }

        vfunc_get_static_snippet() {
            const snippet = Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, declarations, null);
            snippet.set_replace(code);
            return snippet;
        }

        /**
         * Update uniforms of the shader.
         * For more information, see the comments in the shader file.
         *
         * @param config - Rounded corners configuration
         * @param windowBounds - Bounds of the window without padding
         */
        updateUniforms(config: RoundedCornerSettings, windowBounds: Bounds) {
            const borderWidth = getPref('border-width');
            const borderColor = config.borderColor;

            const outerRadius = config.borderRadius;
            const {padding, smoothing} = config;

            const bounds = [
                windowBounds.x1 + padding.left,
                windowBounds.y1 + padding.top,
                windowBounds.x2 - padding.right,
                windowBounds.y2 - padding.bottom,
            ];

            const borderedAreaBounds = [
                bounds[0] + borderWidth,
                bounds[1] + borderWidth,
                bounds[2] - borderWidth,
                bounds[3] - borderWidth,
            ];

            let borderedAreaRadius = outerRadius - borderWidth;
            if (borderedAreaRadius < 0.001) {
                borderedAreaRadius = 0.0;
            }

            const pixelStep = [
                1 / this.actor.get_width(),
                1 / this.actor.get_height(),
            ];

            // This is needed for squircle corners
            let exponent = smoothing * 10 + 2;
            let radius = outerRadius * 0.5 * exponent;
            const maxRadius = Math.min(
                bounds[3] - bounds[0],
                bounds[4] - bounds[1],
            );
            if (radius > maxRadius) {
                exponent *= maxRadius / radius;
                radius = maxRadius;
            }
            borderedAreaRadius *= radius / outerRadius;

            this.#setUniforms(
                bounds,
                radius,
                borderWidth,
                borderColor,
                borderedAreaBounds,
                borderedAreaRadius,
                pixelStep,
                exponent,
            );
        }

        #setUniforms(
            bounds: number[],
            radius: number,
            borderWidth: number,
            borderColor: [number, number, number, number],
            borderedAreaBounds: number[],
            borderedAreaRadius: number,
            pixelStep: number[],
            exponent: number,
        ) {
            this.setUniform('bounds', bounds);
            this.setUniform('clipRadius', [radius]);
            this.setUniform('borderWidth', [borderWidth]);
            this.setUniform('borderColor', borderColor);
            this.setUniform('borderedAreaBounds', borderedAreaBounds);
            this.setUniform('borderedAreaClipRadius', [borderedAreaRadius]);
            this.setUniform('pixelStep', pixelStep);
            this.setUniform('exponent', [exponent]);
            this.queue_repaint();
        }
    },
);

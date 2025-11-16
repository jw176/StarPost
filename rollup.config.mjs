import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default {
    input: 'src/extension.js',
    output: [
        {
            file: 'dist/bundle.js',
            format: 'esm',
            plugins: [terser()],
            sourcemap: true
        }
    ],
    external: ['vscode'],
    plugins: [
        nodeResolve(),
        commonjs()
    ]
};

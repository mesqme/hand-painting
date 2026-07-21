import react from '@vitejs/plugin-react'
import glsl from 'vite-plugin-glsl'

export default {
    root: 'src/',
    publicDir: '../public/',
    plugins: [
        react(),
        glsl({
            include: ['**/*.glsl', '**/*.vert', '**/*.frag'],
        }),
    ],
    base: './',
    server: {
        host: true,
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        sourcemap: false,
    },
}

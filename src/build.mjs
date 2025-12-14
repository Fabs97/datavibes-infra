import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const HANDLERS_DIR = './handlers';
const DIST_DIR = './dist';

// Find all handler directories (format: METHOD_path)
function discoverHandlers() {
    const handlers = [];
    const entries = fs.readdirSync(HANDLERS_DIR, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            const indexPath = path.join(HANDLERS_DIR, entry.name, 'index.ts');
            if (fs.existsSync(indexPath)) {
                handlers.push({
                    name: entry.name,
                    entryPoint: indexPath,
                    outdir: path.join(DIST_DIR, entry.name),
                });
            }
        }
    }

    return handlers;
}

async function build() {
    const handlers = discoverHandlers();

    if (handlers.length === 0) {
        console.log('No handlers found in', HANDLERS_DIR);
        return;
    }

    // Clean dist directory
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true });
    }

    console.log(`Building ${handlers.length} handler(s)...`);

    for (const handler of handlers) {
        await esbuild.build({
            entryPoints: [handler.entryPoint],
            bundle: true,
            platform: 'node',
            target: 'node20',
            format: 'cjs',
            outfile: path.join(handler.outdir, 'index.js'),
            sourcemap: true,
            minify: process.env.NODE_ENV === 'production',
            external: ['@aws-sdk/*'], // AWS SDK v3 is included in Lambda runtime
        });

        console.log(`  ✓ Built ${handler.name}`);
    }

    console.log('Build complete!');
}

build().catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
});

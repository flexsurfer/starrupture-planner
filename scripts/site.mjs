import { existsSync } from 'node:fs';

const commands = new URL('../website/scripts/commands.mjs', import.meta.url);
if (!existsSync(commands)) {
    console.error('Site commands require the local website/ directory, which is not included in the public repository. Use npm start or npm run build for the standalone tool.');
    process.exitCode = 1;
} else {
    const { run } = await import(commands.href);
    await run(process.argv[2], process.argv.slice(3));
}

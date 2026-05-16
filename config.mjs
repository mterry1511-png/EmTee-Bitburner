import { context } from 'esbuild';
import { BitburnerPlugin } from 'esbuild-bitburner-plugin';

const createContext = async () => await context({
  entryPoints: [
    'servers/**/*.js',
    'servers/**/*.jsx',
    'servers/**/*.ts',
    'servers/**/*.tsx',
    'servers/**/*.json',
  ],
  outbase: "./servers",
  outdir: "./build",
  loader: {
    '.json': 'copy'
  },
  plugins: [
    BitburnerPlugin({
      port: 12525,
      types: 'NetscriptDefinitions.d.ts',
      mirror: {
        // remove the comment to mirror the home server, bi-directional sync - WARNING game can overwrite code
        //'servers/home': ['home']
      },
      distribute: {
      },
    })
  ],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  logLevel: 'debug',
});

const ctx = await createContext();
ctx.watch();
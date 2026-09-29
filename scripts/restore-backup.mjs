import { resolve } from 'node:path';
import { createConnection } from 'node:net';
import { restoreBackup } from '../server/restore.mjs';

const source = process.argv[2];
if (!source || process.argv[3] !== '--confirm') {
  console.log('Uso: node scripts/restore-backup.mjs "ruta/al/archivo.c4f.gz" --confirm\nDetén primero el servidor de edición. Se guardará una copia del contenido actual antes de restaurar.');
  process.exit(1);
}
const running = await new Promise(resolve => {
  const socket = createConnection({ host: '127.0.0.1', port: 5184 });
  socket.once('connect', () => { socket.destroy(); resolve(true); }); socket.once('error', () => resolve(false));
  socket.setTimeout(2000, () => { socket.destroy(); resolve(true); });
});
if (running) throw new Error('Detén el servidor local del puerto 5184 antes de restaurar.');
const root = resolve(import.meta.dirname, '..');
const result = restoreBackup(resolve(source), { directory: resolve(root, '.private'), snapshot: resolve(root, 'src/data/published.json'), publicDirectory: resolve(root, 'public') });
console.log(`Restaurados ${result.articles} artículos. ${result.safetyCopy ? `Copia anterior: ${result.safetyCopy}` : ''}\nPuedes reiniciar el servidor local. Para actualizar la web compartida, vuelve a compilar.`);

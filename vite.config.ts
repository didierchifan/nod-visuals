import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const SAVED_DIR = 'src/visuals/contours/saved'

// Dev only: lets /lab/contours write configs into the project and list them back.
function contourLabSaves(): Plugin {
  const dir = fileURLToPath(new URL(`./${SAVED_DIR}/`, import.meta.url))

  return {
    name: 'contour-lab-saves',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__lab/contours', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        try {
          if (req.method === 'POST') {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            const config = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            const mode = String(config.mode).replace(/[^a-z]/g, '') || 'contours'
            const seed = (Number(config.seed) >>> 0).toString(16).toUpperCase().padStart(8, '0')
            await mkdir(dir, { recursive: true })
            const taken = new Set(await readdir(dir))
            let name = `${mode}-${seed}.json`
            for (let n = 2; taken.has(name); n++) name = `${mode}-${seed}-${n}.json`
            await writeFile(dir + name, `${JSON.stringify(config, null, 2)}\n`)
            res.end(JSON.stringify({ path: `${SAVED_DIR}/${name}` }))
            return
          }

          const names = (await readdir(dir).catch(() => [])).filter((name) => name.endsWith('.json'))
          const entries = await Promise.all(
            names.map(async (name) => ({
              path: `${SAVED_DIR}/${name}`,
              modified: (await stat(dir + name)).mtimeMs,
              config: JSON.parse(await readFile(dir + name, 'utf8')),
            })),
          )
          entries.sort((a, b) => b.modified - a.modified)
          res.end(JSON.stringify(entries.map(({ path, config }) => ({ path, config }))))
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(error) }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), contourLabSaves()],
  build: {
    rolldownOptions: {
      // The contour lab at /, the fluid lab at /fluid.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        fluid: fileURLToPath(new URL('./fluid.html', import.meta.url)),
      },
    },
  },
})

import { mkdir, symlink, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const packageRoot = join(process.cwd(), 'node_modules', '@prisma', 'client')
const linkPath = join(packageRoot, '.prisma', 'client')
const target = '../../../.prisma/client'

await mkdir(dirname(linkPath), { recursive: true })
try {
  await unlink(linkPath)
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
await symlink(target, linkPath, 'dir')
console.log('Linked generated Prisma client for npm module resolution.')

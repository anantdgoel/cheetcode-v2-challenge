import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const SRC_ROOT = path.join(ROOT, 'src')

function resolveAliasTarget (specifier) {
  const relativePath = specifier.slice(2)
  const basePath = path.join(SRC_ROOT, relativePath)
  return resolveBasePath(basePath)
}

function resolveBasePath (basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.js')
  ]

  return candidates.find((candidate) => fs.existsSync(candidate))
}

export async function resolve (specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const target = resolveAliasTarget(specifier)
    if (!target) {
      throw new Error(`Unable to resolve alias import: ${specifier}`)
    }
    return nextResolve(pathToFileURL(target).href, context)
  }

  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !path.extname(specifier)) {
    const parentPath = context.parentURL ? new URL(context.parentURL) : pathToFileURL(ROOT)
    const basePath = path.resolve(path.dirname(parentPath.pathname), specifier)
    const target = resolveBasePath(basePath)
    if (target) {
      return nextResolve(pathToFileURL(target).href, context)
    }
  }

  return nextResolve(specifier, context)
}

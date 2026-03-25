import type { ExtensionFactory } from '@mariozechner/pi-coding-agent'
import loadSkillExtension from './load-skill'
import planModeExtension from './plan-mode'

// Inline extension factories (imported directly, bundled by Vite)
const inlineExtensionFactories: ExtensionFactory[] = [planModeExtension, loadSkillExtension]

export function getBuiltinExtensionFactories(): ExtensionFactory[] {
  return inlineExtensionFactories
}

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { Type } from '@sinclair/typebox'

const FILE_LIST_LIMIT = 15

async function listSkillFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(current: string, depth: number): Promise<void> {
    if (depth > 3 || files.length >= FILE_LIST_LIMIT) return

    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (files.length >= FILE_LIST_LIMIT) break
      const full = path.join(current, entry.name)

      if (entry.name === 'node_modules' || entry.name === '.git') continue

      if (entry.isFile()) {
        if (entry.name === 'SKILL.md') continue
        files.push(path.relative(dir, full))
      } else if (entry.isDirectory()) {
        await walk(full, depth + 1)
      }
    }
  }

  await walk(dir, 0)
  return files.sort()
}

export default function loadSkillExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'load_skill',
    label: 'Load Skill',
    description:
      'Load a specialized skill that provides domain-specific instructions and workflows.',
    promptSnippet: 'Load a skill by name to get specialized instructions for a task.',
    promptGuidelines: [
      'When a task matches an available skill, load it with this tool before starting work.',
      'Prefer loading skills over ad-hoc approaches when a relevant skill exists.'
    ],
    parameters: Type.Object({
      name: Type.String({
        description:
          'The name of the skill to load from the available skills listed in the system prompt.'
      })
    }),
    async execute(_toolCallId, params) {
      const name = params.name.trim()
      if (!name) throw new Error('Skill name cannot be empty.')

      const commands = pi.getCommands()
      const skillCommand = commands.find(
        (cmd) => cmd.source === 'skill' && (cmd.name === `skill:${name}` || cmd.name === name)
      )

      if (!skillCommand?.path) {
        const available = commands
          .filter((cmd) => cmd.source === 'skill')
          .map((cmd) => cmd.name.replace(/^skill:/, ''))

        throw new Error(
          available.length > 0
            ? `Skill "${name}" not found. Available: ${available.join(', ')}`
            : `Skill "${name}" not found. No skills are currently available.`
        )
      }

      const filePath = skillCommand.path
      let content: string
      try {
        content = await readFile(filePath, 'utf-8')
      } catch {
        throw new Error(`Failed to read skill file: ${filePath}`)
      }

      const dir = path.dirname(filePath)
      const bundledFiles = await listSkillFiles(dir)

      const filesSection =
        bundledFiles.length > 0
          ? `\n\nBundled files in ${dir}:\n${bundledFiles.map((f) => `- ${f}`).join('\n')}${bundledFiles.length >= FILE_LIST_LIMIT ? '\n(list truncated)' : ''}`
          : ''

      const description = skillCommand.description ? `\n${skillCommand.description}\n` : ''

      return {
        content: [
          {
            type: 'text',
            text: `# Skill: ${name}\n${description}\n${content.trim()}\n\nBase directory: ${dir}\nRelative paths in this skill are relative to the base directory.${filesSection}`
          }
        ],
        details: {
          skill: {
            name,
            description: skillCommand.description ?? null,
            dir,
            filePath,
            files: bundledFiles
          }
        }
      }
    }
  })
}

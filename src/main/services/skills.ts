import { readFile, readdir } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { homedir } from 'node:os'

export type SkillInfo = {
  name: string
  description: string
  source: 'project' | 'personal'
}

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Looks for --- delimited block at the start and extracts name/description.
 */
function parseSkillFrontmatter(content: string): { name?: string; description?: string } {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!frontmatterMatch) return {}

  const frontmatter = frontmatterMatch[1]!
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
  const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m)

  return {
    name: nameMatch?.[1]?.trim(),
    description: descriptionMatch?.[1]?.trim()
  }
}

/**
 * Read a single skill from a directory containing SKILL.md.
 */
async function readSkillFromDir(dirPath: string, source: 'project' | 'personal'): Promise<SkillInfo | null> {
  const skillPath = join(dirPath, 'SKILL.md')
  try {
    const content = await readFile(skillPath, 'utf-8')
    const frontmatter = parseSkillFrontmatter(content)
    
    // Use directory name as fallback for skill name
    const name = frontmatter.name ?? basename(dirPath)
    if (!name) return null

    return {
      name,
      description: frontmatter.description ?? '',
      source
    }
  } catch {
    // SKILL.md doesn't exist or can't be read
    return null
  }
}

/**
 * List all skills from a base skills directory.
 */
async function listSkillsFromDir(baseDir: string, source: 'project' | 'personal'): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = []
  
  try {
    const entries = await readdir(baseDir, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillDir = join(baseDir, entry.name)
        const skill = await readSkillFromDir(skillDir, source)
        if (skill) {
          skills.push(skill)
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  
  return skills
}

/**
 * List all available skills for a repository.
 * Searches both project-specific (.agents/skills/) and personal (~/.agents/skills/) directories.
 */
export async function listSkills(repoPath: string): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = []
  
  // Project skills: <repoPath>/.agents/skills/
  const projectSkillsDir = join(repoPath, '.agents', 'skills')
  const projectSkills = await listSkillsFromDir(projectSkillsDir, 'project')
  skills.push(...projectSkills)
  
  // Personal skills: ~/.agents/skills/
  const personalSkillsDir = join(homedir(), '.agents', 'skills')
  const personalSkills = await listSkillsFromDir(personalSkillsDir, 'personal')
  skills.push(...personalSkills)
  
  // Deduplicate by name (project skills take precedence)
  const seen = new Set<string>()
  const deduped: SkillInfo[] = []
  
  // Process project skills first so they take precedence
  for (const skill of skills) {
    if (!seen.has(skill.name)) {
      seen.add(skill.name)
      deduped.push(skill)
    }
  }
  
  return deduped
}

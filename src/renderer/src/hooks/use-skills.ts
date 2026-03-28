import { useCallback, useEffect, useState } from 'react'
import type { SkillInfo } from '@/lib/sessions'
import { getSessionSkills } from '@/lib/sessions'

const skillCache = new Map<string, SkillInfo[]>()

export function useSkills(sessionId: string | null): {
  skills: SkillInfo[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
} {
  const [skills, setSkills] = useState<SkillInfo[]>(() =>
    sessionId ? skillCache.get(sessionId) ?? [] : []
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchSkills = useCallback(async () => {
    if (!sessionId) {
      setSkills([])
      return
    }

    const cached = skillCache.get(sessionId)
    if (cached) {
      setSkills(cached)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await getSessionSkills(sessionId)
      console.log('[useSkills] fetched skills for', sessionId, result)
      skillCache.set(sessionId, result)
      setSkills(result)
    } catch (err) {
      console.error('[useSkills] error fetching skills', err)
      setError(err instanceof Error ? err : new Error(String(err)))
      setSkills([])
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void fetchSkills()
  }, [fetchSkills])

  const refetch = useCallback(async () => {
    if (!sessionId) return
    skillCache.delete(sessionId)
    await fetchSkills()
  }, [sessionId, fetchSkills])

  return { skills, isLoading, error, refetch }
}

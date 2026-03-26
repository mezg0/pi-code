import { useEffect, useMemo } from 'react'
import {
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

import { sessionKeys } from './query-keys'
import {
  getAgentState,
  getAvailableModels,
  getPermissionMode,
  getSessionPlanMode,
  onPermissionModeEvent,
  onPlanModeEvent,
  setPermissionMode,
  setSessionModel,
  setSessionPlanMode,
  setSessionThinking,
  type ModelInfo,
  type PermissionMode,
  type RpcState
} from './sessions'

export function invalidateSessionRuntime(
  queryClient: QueryClient,
  sessionId: string
): Promise<unknown[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: sessionKeys.runtimeState(sessionId) }),
    queryClient.invalidateQueries({ queryKey: sessionKeys.availableModels(sessionId) })
  ])
}

export function useSessionRuntimeState(sessionId: string | undefined): UseQueryResult<RpcState> {
  return useQuery<RpcState>({
    queryKey: sessionId ? sessionKeys.runtimeState(sessionId) : ['session', 'runtimeState', 'none'],
    queryFn: () => getAgentState(sessionId!),
    enabled: Boolean(sessionId)
  })
}

export function useSessionAvailableModels(
  sessionId: string | undefined
): UseQueryResult<ModelInfo[]> {
  return useQuery<ModelInfo[]>({
    queryKey: sessionId
      ? sessionKeys.availableModels(sessionId)
      : ['session', 'availableModels', 'none'],
    queryFn: () => getAvailableModels(sessionId!),
    enabled: Boolean(sessionId),
    staleTime: 30_000
  })
}

export function useSessionPlanMode(sessionId: string | undefined): UseQueryResult<boolean> {
  const queryClient = useQueryClient()
  const query = useQuery<boolean>({
    queryKey: sessionId ? sessionKeys.planMode(sessionId) : ['session', 'planMode', 'none'],
    queryFn: () => getSessionPlanMode(sessionId!),
    enabled: Boolean(sessionId)
  })

  useEffect(() => {
    if (!sessionId) return
    return onPlanModeEvent((payload) => {
      if (payload.sessionId !== sessionId) return
      queryClient.setQueryData(sessionKeys.planMode(sessionId), payload.enabled)
    })
  }, [queryClient, sessionId])

  return query
}

export function useSessionPermissionMode(
  sessionId: string | undefined
): UseQueryResult<PermissionMode> {
  const queryClient = useQueryClient()
  const query = useQuery<PermissionMode>({
    queryKey: sessionId
      ? sessionKeys.permissionMode(sessionId)
      : ['session', 'permissionMode', 'none'],
    queryFn: () => getPermissionMode(sessionId!),
    enabled: Boolean(sessionId)
  })

  useEffect(() => {
    if (!sessionId) return
    return onPermissionModeEvent((payload) => {
      if (payload.sessionId !== sessionId) return
      queryClient.setQueryData(sessionKeys.permissionMode(sessionId), payload.mode)
    })
  }, [queryClient, sessionId])

  return query
}

export function useSessionRuntimeMutations(sessionId: string | undefined): {
  setModel: UseMutationResult<boolean, Error, { provider: string; modelId: string }, unknown>
  setThinking: UseMutationResult<boolean, Error, string, unknown>
  setPlanMode: UseMutationResult<boolean, Error, boolean, unknown>
  setPermissionMode: UseMutationResult<boolean, Error, PermissionMode, unknown>
} {
  const queryClient = useQueryClient()

  const modelMutation = useMutation({
    mutationFn: async ({ provider, modelId }: { provider: string; modelId: string }) => {
      if (!sessionId) return false
      return setSessionModel(sessionId, provider, modelId)
    },
    onSuccess: async () => {
      if (!sessionId) return
      await invalidateSessionRuntime(queryClient, sessionId)
    }
  })

  const thinkingMutation = useMutation({
    mutationFn: async (level: string) => {
      if (!sessionId) return false
      return setSessionThinking(sessionId, level)
    },
    onSuccess: async () => {
      if (!sessionId) return
      await queryClient.invalidateQueries({ queryKey: sessionKeys.runtimeState(sessionId) })
    }
  })

  const planModeMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!sessionId) return false
      return setSessionPlanMode(sessionId, enabled)
    },
    onMutate: async (enabled) => {
      if (!sessionId) return
      queryClient.setQueryData(sessionKeys.planMode(sessionId), enabled)
    },
    onError: async () => {
      if (!sessionId) return
      await queryClient.invalidateQueries({ queryKey: sessionKeys.planMode(sessionId) })
    },
    onSuccess: async (success) => {
      if (!sessionId) return
      if (!success) {
        await queryClient.invalidateQueries({ queryKey: sessionKeys.planMode(sessionId) })
      }
    }
  })

  const permissionModeMutation = useMutation({
    mutationFn: async (mode: PermissionMode) => {
      if (!sessionId) return false
      return setPermissionMode(sessionId, mode)
    },
    onMutate: async (mode) => {
      if (!sessionId) return
      queryClient.setQueryData(sessionKeys.permissionMode(sessionId), mode)
    },
    onError: async () => {
      if (!sessionId) return
      await queryClient.invalidateQueries({ queryKey: sessionKeys.permissionMode(sessionId) })
    },
    onSuccess: async (success) => {
      if (!sessionId) return
      if (!success) {
        await queryClient.invalidateQueries({ queryKey: sessionKeys.permissionMode(sessionId) })
      }
    }
  })

  return useMemo(
    () => ({
      setModel: modelMutation,
      setThinking: thinkingMutation,
      setPlanMode: planModeMutation,
      setPermissionMode: permissionModeMutation
    }),
    [modelMutation, permissionModeMutation, planModeMutation, thinkingMutation]
  )
}

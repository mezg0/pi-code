import { createFileRoute } from '@tanstack/react-router'

import { SettingsView } from '@/components/shell/settings-view'

export const Route = createFileRoute('/settings')({
  component: SettingsView
})

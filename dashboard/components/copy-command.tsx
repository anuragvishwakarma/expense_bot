'use client'

import { useState } from 'react'

export default function CopyCommand({ text }: { text: string }): React.ReactElement {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked (e.g. insecure context); the command stays selectable
    }
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-md bg-muted px-2 py-1">
      <code className="text-foreground select-all">{text}</code>
      <button type="button" onClick={copy} className="text-xs text-primary hover:underline">
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  )
}

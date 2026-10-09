import { useState } from 'preact/hooks'
import type { ConnState, Platform } from '../../../shared/types'
import { PlatformTag } from './PlatformTag'
import { STATE_LABEL, isBusy } from '../utils'

interface Props {
  platform: Platform
  initial: string
  placeholder: string
  state: ConnState
  message?: string
  /** nama yang ditampilkan saat terhubung (mis. @user atau nama channel) */
  name: string
  autoFocus?: boolean
  onConnect(value: string): void
  onDisconnect(): void
}

export function ConnectForm({ platform, initial, placeholder, state, message, name, autoFocus, onConnect, onDisconnect }: Props) {
  const [value, setValue] = useState(initial)
  const submit = () => onConnect(value)

  if (isBusy(state)) {
    return (
      <div class="connect-live">
        <div class="connect-live-row">
          <PlatformTag platform={platform} />
          <span class={`dot dot-${state}`} aria-hidden="true" />
          <span class="connect-live-name">{state === 'connected' && name ? name : STATE_LABEL[state]}</span>
          <span class="spacer" />
          <button class="btn-text" onClick={onDisconnect}>
            {state === 'connected' ? 'Putus' : 'Batal'}
          </button>
        </div>
        {message ? <p class="notice">{message}</p> : null}
      </div>
    )
  }

  return (
    <div class="connect">
      <div class="connect-row">
        <PlatformTag platform={platform} />
        <input
          class="input"
          type="text"
          value={value}
          placeholder={placeholder}
          spellcheck={false}
          autoFocus={autoFocus}
          onInput={(e) => setValue((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button class="btn-primary" onClick={submit}>
          Connect
        </button>
      </div>
      {message ? <p class="connect-msg">{message}</p> : null}
    </div>
  )
}

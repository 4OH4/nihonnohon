// Copyright (c) 2026 Rupert Thomas
// SPDX-License-Identifier: MIT

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { usePwaStore } from '@/stores/pwaStore'

afterEach(() => {
  vi.unstubAllGlobals()
  usePwaStore.getState()._reset()
})

describe('UpdatePrompt', () => {
  it('renders an empty polite live region when no update is waiting', () => {
    render(<UpdatePrompt />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toBeEmptyDOMElement()
    expect(screen.queryByText('New version available')).not.toBeInTheDocument()
  })

  it('shows the toast inside the live region when needRefresh is set', () => {
    usePwaStore.setState({ needRefresh: true })
    render(<UpdatePrompt />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('New version available')
    expect(screen.getByRole('button', { name: 'Reload' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveTextContent('×')
  })

  it('appears when needRefresh becomes true after mount', () => {
    render(<UpdatePrompt />)
    act(() => usePwaStore.getState().setNeedRefresh(true))
    expect(screen.getByRole('status')).toHaveTextContent('New version available')
  })

  it('never takes focus when it appears', () => {
    render(<UpdatePrompt />)
    act(() => usePwaStore.getState().setNeedRefresh(true))
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(document.body).toHaveFocus()
  })

  it('hides after Dismiss, keeping the live region mounted', () => {
    usePwaStore.setState({ needRefresh: true })
    render(<UpdatePrompt />)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(usePwaStore.getState().updateDismissed).toBe(true)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('shows again when a newer worker arrives after a dismiss', () => {
    usePwaStore.setState({ needRefresh: true })
    render(<UpdatePrompt />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    act(() => usePwaStore.getState().setNeedRefresh(true))

    expect(screen.getByRole('status')).toHaveTextContent('New version available')
  })

  it('Reload calls the update handle once and then disables itself', () => {
    const updateSW = vi.fn(async () => {})
    usePwaStore.setState({ needRefresh: true, updateServiceWorker: updateSW })
    render(<UpdatePrompt />)
    const reload = screen.getByRole('button', { name: 'Reload' })

    fireEvent.click(reload)
    fireEvent.click(reload)

    expect(updateSW).toHaveBeenCalledTimes(1)
    expect(reload).toBeDisabled()
  })

  it('re-enables Reload when a newer worker re-shows the toast after a dismiss', () => {
    usePwaStore.setState({ needRefresh: true, updateServiceWorker: vi.fn(async () => {}) })
    render(<UpdatePrompt />)
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(screen.getByRole('button', { name: 'Reload' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    act(() => usePwaStore.getState().setNeedRefresh(true))

    expect(screen.getByRole('button', { name: 'Reload' })).toBeEnabled()
  })

  it('Reload falls back to location.reload when the update handle rejects', async () => {
    const reloadPage = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload: reloadPage })
    usePwaStore.setState({ needRefresh: true, updateServiceWorker: vi.fn(async () => Promise.reject(new Error('x'))) })
    render(<UpdatePrompt />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    })

    expect(reloadPage).toHaveBeenCalledTimes(1)
  })

  it('Reload falls back to location.reload when the handle is null', () => {
    const reloadPage = vi.fn()
    // jsdom's location.reload is not configurable, so swap the whole location object.
    vi.stubGlobal('location', { ...window.location, reload: reloadPage })
    usePwaStore.setState({ needRefresh: true, updateServiceWorker: null })
    render(<UpdatePrompt />)

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))

    expect(reloadPage).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Reload' })).toBeDisabled()
  })
})

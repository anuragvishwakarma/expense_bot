/** @jest-environment node */
import fs from 'fs'
import path from 'path'
import { renderToStaticMarkup } from 'react-dom/server'
import PrivacyPage from '../app/privacy/page'
import TermsPage from '../app/terms/page'
import { PROCESSORS } from '@/lib/legal'

const botServices = path.join(__dirname, '../../src/services')
const botSource = fs.readdirSync(botServices).filter(f => f.endsWith('.ts')).map(f => fs.readFileSync(path.join(botServices, f), 'utf8')).join('\n')
const listed = (name: string) => PROCESSORS.some(p => p.name.toLowerCase().includes(name.toLowerCase()))

describe('legal pages', () => {
  // If the bot starts sending user data to a new outside service, this fails until the policy names it.
  it('the processor list covers every outside service the bot code calls', () => {
    if (botSource.includes('openrouter.ai')) expect(listed('openrouter')).toBe(true)
    if (botSource.includes('api.ocr.space')) expect(listed('ocr.space')).toBe(true)
    if (botSource.includes('@google-cloud/speech')) expect(listed('google')).toBe(true)
    expect(listed('supabase')).toBe(true)
    expect(listed('railway')).toBe(true)
    expect(listed('telegram')).toBe(true)
  })

  it('the privacy page names every processor and explains export and deletion', () => {
    const html = renderToStaticMarkup(<PrivacyPage />)
    for (const p of PROCESSORS) expect(html).toContain(p.name.replace(/&/g, '&amp;'))
    for (const cmd of ['/export', '/deletemydata', '/unlink']) expect(html).toContain(cmd)
    expect(html).toContain('Delete account')
  })

  it('the terms page covers the essentials', () => {
    const html = renderToStaticMarkup(<TermsPage />)
    for (const phrase of ['Not financial advice', 'Your account', 'Limits on our responsibility', 'Privacy Policy']) expect(html).toContain(phrase)
  })
})

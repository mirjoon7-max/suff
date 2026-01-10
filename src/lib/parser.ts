import { NutrientKey, Unit, keyFromText, convertToBase } from './nutrients'

export type ParsedNutrient = { key: NutrientKey, amount: number, unit: Unit, raw: string }

export function parseLabelText(text: string): ParsedNutrient[] {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  const out: ParsedNutrient[] = []
  for(const line of lines){
    // common patterns:
    // "비타민 D 50 mcg", "Vitamin D3 2000 IU", "아연 8.5mg"
    const m = line.match(/(.{2,40}?)[\s:：]*([0-9]+(?:\.[0-9]+)?)\s*(mg|mcg|ug|μg|IU|iu)\b/)
    if(!m) continue
    const name = m[1].trim()
    const amount = Number(m[2])
    const unitRaw = m[3].toLowerCase()
    let unit: Unit = 'mg'
    if(unitRaw === 'mg') unit = 'mg'
    else if(unitRaw === 'mcg' || unitRaw === 'ug' || unitRaw === 'μg') unit = 'mcg'
    else unit = 'IU'

    const key = keyFromText(name)
    if(!key) continue

    const conv = convertToBase(key, amount, unit)
    out.push({ key, amount: round(conv.amount), unit: conv.unit, raw: line })
  }

  // Merge duplicates by key
  const merged = new Map<NutrientKey, ParsedNutrient>()
  for(const p of out){
    const cur = merged.get(p.key)
    if(!cur) merged.set(p.key, { ...p })
    else merged.set(p.key, { ...cur, amount: round(cur.amount + p.amount), raw: cur.raw + ' | ' + p.raw })
  }
  return Array.from(merged.values())
}

function round(n: number){
  return Math.round(n*1000)/1000
}

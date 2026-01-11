export type Unit = 'mg' | 'mcg' | 'IU'

export type NutrientKey =
  | 'vitA' | 'vitD' | 'vitE' | 'vitC'
  | 'b6' | 'niacin' | 'folicAcid'
  | 'calcium' | 'magnesium' | 'iron' | 'zinc' | 'selenium' | 'iodine' | 'vitK'

export type NutrientDef = {
  key: NutrientKey
  label: string
  // default display unit for UI
  unit: Unit
  // Upper limit (UL) for adults (19+) in that unit, with special notes if applicable
  ulAdult?: number
  ulNote?: string
  // some nutrients (like magnesium) have UL only for supplements, keep note
  caution?: string
  // synonyms for text parsing (Korean/English)
  synonyms: string[]
}

// UL values are conservative defaults for typical adults (19+).
// NOTE: These are NOT medical instructions; they are reference points for “주의/경고” UI.
// Sources are shown inside the app in “출처” section.
export const NUTRIENTS: NutrientDef[] = [
  { key:'vitA', label:'비타민 A(레티놀 기준)', unit:'mcg', ulAdult: 3000, ulNote:'UL 3,000 mcg RAE/일(성인). 임신 중 과량은 특히 주의.', synonyms:['비타민a','vitamin a','retinol','레티놀','레티닐','rae'] },
  { key:'vitD', label:'비타민 D', unit:'mcg', ulAdult: 100, ulNote:'UL 100 mcg(=4,000 IU)/일(성인).', synonyms:['비타민d','vitamin d','d3','d2','cholecalciferol','calciferol'] },
  { key:'vitE', label:'비타민 E(α-토코페롤)', unit:'mg', ulAdult: 1000, ulNote:'UL 1,000 mg/일(성인). 항응고제 복용 시 주의.', synonyms:['비타민e','vitamin e','tocopherol','토코페롤','alpha-tocopherol','알파토코페롤'] },
  { key:'vitC', label:'비타민 C', unit:'mg', ulAdult: 2000, ulNote:'UL 2,000 mg/일(성인).', synonyms:['비타민c','vitamin c','ascorbic','아스코르빈','ascorbic acid'] },
  { key:'b6', label:'비타민 B6', unit:'mg', ulAdult: 100, ulNote:'UL 100 mg/일(미국 기준). 유럽(2023) 기준은 더 낮음(12 mg/일).', synonyms:['비타민b6','vitamin b6','pyridoxine','피리독신'] },
  { key:'niacin', label:'나이아신(B3)', unit:'mg', ulAdult: 35, ulNote:'UL 35 mg NE/일(성인, 보충제/강화식품 중심).', synonyms:['나이아신','niacin','nicotinic','니코틴산','nicotinamide','니코틴아마이드','b3'] },
  { key:'folicAcid', label:'엽산(폴릭애씨드)', unit:'mcg', ulAdult: 1000, ulNote:'폴릭애씨드 UL 1,000 mcg/일(성인).', synonyms:['엽산','folate','folic acid','폴릭','b9','methylfolate','5-mthf','5mthf'] },
  { key:'calcium', label:'칼슘', unit:'mg', ulAdult: 2500, ulNote:'19–50세 UL 2,500 mg/일, 51+ UL 2,000 mg/일(일반 가이드).', synonyms:['칼슘','calcium','ca'] },
  { key:'magnesium', label:'마그네슘', unit:'mg', ulAdult: 350, ulNote:'보충제/제산제 등 “비식품” 마그네슘 UL 350 mg/일.', caution:'식품(음식)에서의 Mg는 UL 개념이 다르고, 보충제만 따로 보는 경우가 많아요.', synonyms:['마그네슘','magnesium','mg'] },
  { key:'iron', label:'철', unit:'mg', ulAdult: 45, ulNote:'UL 45 mg/일(성인). 빈혈 치료 목적으로는 의사 지시가 우선.', synonyms:['철','iron','fe','ferrous','ferric','푸마레이트','글루콘산','황산철'] },
  { key:'zinc', label:'아연', unit:'mg', ulAdult: 40, ulNote:'UL 40 mg/일(성인). 장기 과량은 구리 결핍 위험.', synonyms:['아연','zinc','zn'] },
  { key:'selenium', label:'셀레늄', unit:'mcg', ulAdult: 400, ulNote:'UL 400 mcg/일(성인).', synonyms:['셀레늄','selenium','se'] },
  { key:'iodine', label:'요오드', unit:'mcg', ulAdult: 1100, ulNote:'UL 1,100 mcg/일(성인). 갑상선 질환/임신은 특히 주의.', synonyms:['요오드','iodine','i'] },
  { key:'vitK', label:'비타민 K', unit:'mcg', ulAdult: undefined, ulNote:'비타민 K는 UL이 명확히 설정되지 않은 경우가 많지만, 와파린(쿠마딘)과 상호작용이 중요.', synonyms:['비타민k','vitamin k','phylloquinone','menaquinone','k2','k1'] },
]

export function normalizeName(s: string){
  return s.toLowerCase().replace(/\s+/g,'').replace(/[()\[\]·•,]/g,'')
}

export function keyFromText(name: string): NutrientKey | null {
  const n = normalizeName(name)
  for(const d of NUTRIENTS){
    if(d.synonyms.some(a => n.includes(normalizeName(a)))) return d.key
  }
  return null
}

export function convertToBase(key: NutrientKey, amount: number, unit: Unit): { amount: number, unit: Unit } {
  // Base units follow NUTRIENTS[key].unit, convert if needed
  const def = NUTRIENTS.find(d=>d.key===key)!
  const target = def.unit

  if(unit === target) return { amount, unit }

  // IU conversions (very common on labels)
  // Vitamin D: 1 mcg = 40 IU
  if(key === 'vitD'){
    if(unit === 'IU' && target === 'mcg') return { amount: amount/40, unit:'mcg' }
    if(unit === 'mcg' && target === 'IU') return { amount: amount*40, unit:'IU' }
  }
  // Vitamin A is messy (retinol vs beta-carotene). Many KR labels show IU.
  // Here we provide a conservative conversion for "preformed retinol":
  // 1 mcg RAE ≈ 3.33 IU (retinol)  -> 1 IU ≈ 0.3 mcg RAE
  if(key === 'vitA'){
    if(unit === 'IU' && target === 'mcg') return { amount: amount*0.3, unit:'mcg' }
    if(unit === 'mcg' && target === 'IU') return { amount: amount/0.3, unit:'IU' }
  }

  // mg <-> mcg
  if(unit === 'mg' && target === 'mcg') return { amount: amount*1000, unit:'mcg' }
  if(unit === 'mcg' && target === 'mg') return { amount: amount/1000, unit:'mg' }

  // Fallback: return as-is
  return { amount, unit: target }
}

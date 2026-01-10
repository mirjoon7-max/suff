import { NutrientKey, NUTRIENTS } from './nutrients'

export type SupplementItem = {
  id: string
  name: string
  servingsPerDay: number
  nutrients: { key: NutrientKey, amount: number }[] // amounts are in base units per serving
  notes?: string
}

export type UserContext = {
  ageGroup: '18-' | '19-50' | '51+'
  sex: 'male' | 'female' | 'other'
  pregnantOrTrying?: boolean
  meds: {
    levothyroxine?: boolean
    warfarin?: boolean
    antibiotics?: boolean
    bisphosphonate?: boolean
    diabetesMeds?: boolean
    bpMeds?: boolean
  }
  routine: {
    wake: string // "07:00"
    breakfast: string
    lunch: string
    dinner: string
    bed: string
  }
}

export type NutrientTotal = {
  key: NutrientKey
  label: string
  unit: string
  total: number
  ul?: number
  status: 'ok' | 'high' | 'exceed' | 'na'
  message?: string
}

export function computeTotals(items: SupplementItem[], ctx: UserContext): NutrientTotal[] {
  const sums = new Map<NutrientKey, number>()
  for(const it of items){
    for(const n of it.nutrients){
      const add = n.amount * (it.servingsPerDay || 1)
      sums.set(n.key, (sums.get(n.key)||0) + add)
    }
  }

  return NUTRIENTS.map(def => {
    const total = round(sums.get(def.key) || 0)
    let ul = def.ulAdult

    // age-dependent calcium UL rough handling
    if(def.key === 'calcium'){
      ul = ctx.ageGroup === '51+' ? 2000 : 2500
    }

    let status: NutrientTotal['status'] = 'na'
    let message = def.ulNote

    if(ul == null){
      status = 'na'
    } else if(total === 0){
      status = 'ok'
    } else if(total > ul){
      status = 'exceed'
    } else if(total >= ul * 0.5){
      status = 'high'
    } else {
      status = 'ok'
    }

    // contextual warnings
    if(def.key === 'vitK' && ctx.meds.warfarin){
      message = '와파린(쿠마딘) 복용 중이면 비타민 K “추가 복용”은 의료진과 꼭 상의하세요. (섭취량의 “일관성”이 중요)'
    }
    if(def.key === 'vitE' && (ctx.meds.warfarin)){
      message = '항응고제/항혈소판제 복용 중이면 비타민 E 고용량은 출혈 위험을 높일 수 있어 의료진과 상의 권장'
    }
    if(def.key === 'iodine' && ctx.meds.levothyroxine){
      message = '갑상선 약 복용 중이라면 요오드 과량은 피하고, 변동이 크지 않게 관리하는 것이 중요할 수 있어요.'
    }
    if(def.key === 'magnesium'){
      message = '마그네슘 UL(350mg)은 “보충제/제산제 등 비식품”에서만 적용되는 경우가 많아요.'
    }

    return { key: def.key, label: def.label, unit: def.unit, total, ul, status, message }
  }).filter(x => x.total > 0 || x.ul != null)
}

function round(n: number){
  return Math.round(n*1000)/1000
}

export type Warning = { level: 'info'|'warn'|'danger', title: string, detail: string }

export function computeWarnings(items: SupplementItem[], totals: NutrientTotal[], ctx: UserContext): Warning[] {
  const warns: Warning[] = []

  // UL exceed / high
  for(const t of totals){
    if(t.status === 'exceed'){
      warns.push({ level:'danger', title:`${t.label} 과용 가능성`, detail:`현재 합계 ${t.total} ${t.unit} (UL ${t.ul} ${t.unit} 초과). 라벨/복용량을 다시 확인하고 의료진/약사와 상의 권장.` })
    } else if(t.status === 'high'){
      warns.push({ level:'warn', title:`${t.label} 높음`, detail:`현재 합계 ${t.total} ${t.unit} (UL ${t.ul} ${t.unit}의 50% 이상). 다른 제품(멀티비타민/부스터/샷)까지 포함해 합계를 관리하세요.` })
    }
  }

  // duplicated nutrients across multiple items
  const nutrientToItems = new Map<NutrientKey, string[]>()
  for(const it of items){
    for(const n of it.nutrients){
      const arr = nutrientToItems.get(n.key) || []
      arr.push(it.name)
      nutrientToItems.set(n.key, arr)
    }
  }
  for(const [k, arr] of nutrientToItems.entries()){
    const uniq = Array.from(new Set(arr))
    if(uniq.length >= 2){
      warns.push({ level:'info', title:'중복 성분', detail:`${labelOf(k)} 성분이 ${uniq.length}개 제품에 겹쳐요: ${uniq.join(', ')}` })
    }
  }

  // Medication interaction “flags” (not exhaustive)
  if(ctx.meds.warfarin){
    warns.push({ level:'warn', title:'와파린(쿠마딘) 복용 중', detail:'비타민 K(특히 K1/K2), 고용량 비타민 E, 오메가3(고용량) 등은 출혈/약효에 영향을 줄 수 있어 “새로 추가/중단”은 의료진과 상의가 안전합니다.' })
  }
  if(ctx.meds.levothyroxine){
    warns.push({ level:'warn', title:'갑상선 약(레보티록신) 복용 중', detail:'칼슘/철/마그네슘/아연(미네랄)은 약 흡수를 떨어뜨릴 수 있어 보통 4시간 이상 간격을 권장해요.' })
  }
  if(ctx.meds.antibiotics){
    warns.push({ level:'warn', title:'일부 항생제 복용 중', detail:'테트라사이클린/퀴놀론 계열 등은 칼슘/철/마그네슘/아연과 같이 복용 시 흡수가 떨어질 수 있어 간격 복용이 필요할 수 있어요.' })
  }
  if(ctx.meds.bisphosphonate){
    warns.push({ level:'warn', title:'골다공증 약(비스포스포네이트) 복용 중', detail:'공복 복용/자세 유지 등 복용법이 엄격한 편이라, 다른 영양제와 “시간을 확실히 분리”하는 것이 중요해요.' })
  }

  return warns
}

function labelOf(k: NutrientKey){
  return (NUTRIENTS.find(d=>d.key===k)?.label) ?? k
}

export type Slot = '기상 직후(공복)'|'아침(식사와 함께)'|'점심(식사와 함께)'|'저녁(식사와 함께)'|'취침 전'

export type ScheduleLine = { slot: Slot, items: string[], rationale: string[] }

export function buildSchedule(items: SupplementItem[], ctx: UserContext): ScheduleLine[] {
  const slots: Record<Slot, { items: string[], rationale: string[] }> = {
    '기상 직후(공복)': { items: [], rationale: [] },
    '아침(식사와 함께)': { items: [], rationale: [] },
    '점심(식사와 함께)': { items: [], rationale: [] },
    '저녁(식사와 함께)': { items: [], rationale: [] },
    '취침 전': { items: [], rationale: [] },
  }

  // Helper: detect minerals & fat-soluble
  const hasAny = (it: SupplementItem, keys: NutrientKey[]) => it.nutrients.some(n => keys.includes(n.key))
  const isMineralHeavy = (it: SupplementItem) => hasAny(it, ['calcium','iron','magnesium','zinc'])
  const isFatSoluble = (it: SupplementItem) => hasAny(it, ['vitA','vitD','vitE','vitK'])

  for(const it of items){
    // Default placement
    let target: Slot = '아침(식사와 함께)'
    const why: string[] = []

    if(ctx.meds.levothyroxine && isMineralHeavy(it)){
      target = '저녁(식사와 함께)'
      why.push('갑상선 약과 미네랄은 간격(예: 4시간 이상)을 두는 것이 일반적으로 권장')
    }

    if(isFatSoluble(it)){
      // take with meal that includes fat
      why.push('지용성(A/D/E/K)은 식사(지방 포함)와 함께가 흡수에 유리할 수 있음')
    }

    if(hasAny(it, ['iron'])){
      // Iron often better away from calcium
      if(ctx.meds.levothyroxine){
        target = '점심(식사와 함께)'
        why.push('철은 칼슘과 같이 복용하면 흡수가 떨어질 수 있어 분리하는 편이 안전')
      } else {
        target = '기상 직후(공복)'
        why.push('철은 공복이 흡수에 유리하지만 속이 불편하면 식사와 함께로 조정')
      }
    }

    if(hasAny(it, ['magnesium'])){
      target = ctx.meds.levothyroxine ? '취침 전' : '취침 전'
      why.push('마그네슘은 저녁/취침 전 선호하는 사람이 많고, 다른 미네랄/약과 분리하기 쉬움')
    }

    if(ctx.meds.antibiotics && isMineralHeavy(it)){
      // extra separation to be safe
      if(target === '아침(식사와 함께)') target = '저녁(식사와 함께)'
      why.push('일부 항생제는 미네랄과 함께 복용 시 흡수가 저하될 수 있어 시간 분리 권장')
    }

    slots[target].items.push(it.name + (it.servingsPerDay>1 ? ` (x${it.servingsPerDay})` : ''))
    slots[target].rationale.push(...why)
  }

  return (Object.entries(slots) as [Slot, {items:string[], rationale:string[]}][])
    .filter(([_, v]) => v.items.length > 0)
    .map(([slot, v]) => ({
      slot,
      items: v.items,
      rationale: Array.from(new Set(v.rationale)).slice(0,4),
    }))
}

export type AgeSuggestion = { title: string, items: {name: string, why: string}[], cautions: string[] }

export function ageBasedSuggestions(ctx: UserContext): AgeSuggestion[] {
  const blocks: AgeSuggestion[] = []

  blocks.push({
    title: '공통(대부분 성인에게 “검토해볼 만한” 후보)',
    items: [
      { name:'비타민 D', why:'실내 생활/자외선 차단 등으로 부족할 수 있어 혈중 수치 확인 후 결정하는 경우가 많아요.' },
      { name:'오메가-3(EPA/DHA)', why:'생선 섭취가 적다면 고려 대상이 될 수 있어요(혈액응고 약 복용 시 주의).' },
      { name:'마그네슘/식이섬유', why:'식사 패턴에 따라 부족하기 쉬운 편이라 “식단 우선, 필요 시 보충” 접근이 안전해요.' },
    ],
    cautions: [
      '영양제는 “필수”라기보다, 식단/검사/개인상황에 따라 달라요.',
      '질환/약 복용 중이면 (특히 항응고제·갑상선약 등) 추가 전 약사/의료진과 상담 권장.',
    ],
  })

  if(ctx.ageGroup === '51+'){
    blocks.push({
      title: '51세 이상에서 자주 나오는 포인트',
      items: [
        { name:'비타민 B12', why:'나이가 들수록 위산/흡수 문제로 결핍 위험이 올라갈 수 있어요(검사 기반 추천).' },
        { name:'칼슘 + 비타민 D(뼈 건강 관점)', why:'식단에서 칼슘이 부족한 경우가 많아 식단+필요 시 보충으로 접근해요.' },
      ],
      cautions: [
        '칼슘은 한 번에 많이보다, 필요량을 나눠 먹는 방식이 선호됩니다(개인차).',
        '신장질환/결석 병력은 칼슘·비타민D·마그네슘 과량에 더 취약할 수 있어요.',
      ],
    })
  }

  if(ctx.sex === 'female' && ctx.pregnantOrTrying){
    blocks.push({
      title: '임신 준비/가능성이 있는 경우(일반 가이드)',
      items: [
        { name:'엽산(폴릭애씨드) 400–800 mcg/일', why:'신경관 결손 예방을 위해 임신 전부터 권고되는 범위가 있어요.' },
        { name:'철(필요 시)', why:'검사(페리틴 등) 결과에 따라 의사가 권할 수 있어요.' },
      ],
      cautions: [
        '엽산을 고용량(>1,000 mcg)으로 장기 복용하는 것은 피하는 편이 안전합니다.',
        '임신 관련 영양제는 개인 상태(갑상선/빈혈/약물)에 따라 완전히 달라질 수 있어요.',
      ],
    })
  }

  return blocks
}

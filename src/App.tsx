import React, { useMemo, useState } from 'react'
import { parseLabelText } from './lib/parser'
import { NUTRIENTS, NutrientKey } from './lib/nutrients'
import { ageBasedSuggestions, buildSchedule, computeTotals, computeWarnings, SupplementItem, UserContext } from './lib/rules'
import { load, save } from './lib/storage'
import { ocrImage } from './lib/ocr'
import { supabase } from './lib/supabase'

const LS_KEY = 'suppguard_v1'

type Persisted = { items: SupplementItem[], ctx: UserContext }

const defaultCtx: UserContext = {
  ageGroup: '19-50',
  sex: 'other',
  pregnantOrTrying: false,
  meds: {},
  routine: { wake:'07:00', breakfast:'08:00', lunch:'12:30', dinner:'18:30', bed:'23:30' }
}

type TabKey = '입력' | '분석' | '시간표' | '추천/구매'

function TabBar({ tab, setTab }: { tab: TabKey, setTab: (t: TabKey)=>void }){
  const tabs: TabKey[] = ['입력','분석','시간표','추천/구매']
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button
          key={t}
          className={"tab" + (tab===t ? ' active' : '')}
          onClick={()=>setTab(t)}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

function AuthScreen({ onDemo }: { onDemo: ()=>void }){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login'|'signup'>('login')
  const [busy, setBusy] = useState(false)
  const configured = !!supabase

  async function submit(){
    if(!configured) return
    setBusy(true)
    try{
      if(mode==='login'){
        const { error } = await supabase!.auth.signInWithPassword({ email, password })
        if(error) throw error
      }else{
        const { error } = await supabase!.auth.signUp({ email, password })
        if(error) throw error
        alert('✅ 가입 요청 완료! 이메일 인증이 필요할 수 있어요. (Supabase 설정에 따라 다름)')
      }
    }catch(e:any){
      alert(e?.message || '로그인/가입에 실패했어요.')
    }finally{
      setBusy(false)
    }
  }

  return (
    <div className="container" style={{maxWidth: 520}}>
      <div className="h1">🔐 SuppGuard <small>로그인</small></div>

      {!configured && (
        <div className="notice small" style={{marginTop: 12}}>
          아직 <b>Supabase 환경변수</b>가 설정되지 않았어요.
          <div style={{height: 8}} />
          👉 Netlify(또는 로컬)에서 <b>VITE_SUPABASE_URL</b>, <b>VITE_SUPABASE_ANON_KEY</b>를 설정하면 이메일/비밀번호 로그인이 활성화됩니다.
        </div>
      )}

      <div className="card" style={{marginTop: 12}}>
        <div className="row" style={{justifyContent:'space-between'}}>
          <div style={{fontWeight: 900}}>{mode==='login' ? '로그인' : '회원가입'}</div>
          <button className="btn" onClick={()=>setMode(mode==='login'?'signup':'login')}>↔︎ 전환</button>
        </div>
        <div style={{height: 10}} />
        <input className="input" placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)} />
        <div style={{height: 8}} />
        <input className="input" type="password" placeholder="비밀번호" value={password} onChange={e=>setPassword(e.target.value)} />
        <div style={{height: 10}} />
        <button className="btn primary" onClick={submit} disabled={!configured || busy || !email || !password} style={{width:'100%'}}>
          {busy ? '처리 중…' : (mode==='login' ? '로그인' : '회원가입')}
        </button>
        <div className="small" style={{marginTop: 10}}>
          ⚠️ 비밀번호는 8자 이상을 권장해요. (Supabase 정책에 따름)
        </div>
      </div>

      <button className="btn" onClick={onDemo} style={{width:'100%', marginTop: 10}}>
        👀 데모로 먼저 보기
      </button>
    </div>
  )
}

function PurchaseCard(){
  const [keyword, setKeyword] = useState('')
  const [busy, setBusy] = useState(false)
  const [products, setProducts] = useState<any[]>([])
  const [linkBusy, setLinkBusy] = useState<string | null>(null)
  const [deepLink, setDeepLink] = useState<string>('')
  const [error, setError] = useState<string>('')

  async function search(){
    setError('')
    setDeepLink('')
    setBusy(true)
    try{
      const r = await fetch(`/.netlify/functions/coupangSearch?keyword=${encodeURIComponent(keyword)}&limit=10`)
      const j = await r.json()
      if(!j.ok) throw new Error(j.error || '검색 실패')
      setProducts(j.products || [])
      if((j.products||[]).length===0) setError('검색 결과가 없어요. 키워드를 바꿔보세요 🙂')
    }catch(e:any){
      setError(e?.message || '검색 실패')
    }finally{
      setBusy(false)
    }
  }

  async function makeLink(url: string){
    setError('')
    setDeepLink('')
    setLinkBusy(url)
    try{
      const r = await fetch('/.netlify/functions/coupangDeeplink', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ coupangUrl: url })
      })
      const j = await r.json()
      if(!j.ok) throw new Error(j.error || '링크 생성 실패')
      setDeepLink(j.deepLink || '')
      if(j.deepLink){
        try{ await navigator.clipboard.writeText(j.deepLink) }catch{}
      }
    }catch(e:any){
      setError(e?.message || '링크 생성 실패')
    }finally{
      setLinkBusy(null)
    }
  }

  return (
    <div className="card">
      <h2>🛒 쿠팡 제품 검색 → 파트너스 구매링크</h2>
      <div className="small">* 이 기능은 <b>Netlify Functions</b>에 쿠팡 파트너스 API 키(Access/Secret)가 설정되어 있어야 작동해요.</div>
      <div className="hr" />
      <div className="row">
        <input className="input" placeholder="예: 오메가3, 멀티비타민, 마그네슘" value={keyword} onChange={e=>setKeyword(e.target.value)} />
        <button className="btn primary" onClick={search} disabled={!keyword.trim() || busy} style={{maxWidth: 180}}>
          {busy ? '검색 중…' : '검색'}
        </button>
      </div>

      {error && <div className="notice small" style={{marginTop: 10}}>⚠️ {error}</div>}

      {deepLink && (
        <div className="card" style={{marginTop: 10, background:'rgba(0,0,0,0.18)'}}>
          <div style={{fontWeight: 900}}>✅ 생성된 파트너스 링크 (복사됨)</div>
          <div style={{height: 8}} />
          <a href={deepLink} target="_blank" rel="noreferrer">{deepLink}</a>
          <div className="small" style={{marginTop: 8}}>블로그/앱에 이 링크를 넣으면 트래킹이 됩니다.</div>
        </div>
      )}

      {products.length>0 && (
        <div style={{marginTop: 10, display:'grid', gap: 10}}>
          {products.map((p, idx) => (
            <div key={idx} className="card" style={{background:'rgba(0,0,0,0.15)'}}>
              <div className="row" style={{justifyContent:'space-between'}}>
                <div style={{fontWeight: 900, lineHeight: 1.25}}>{p.productName}</div>
                <button className="btn" onClick={()=>makeLink(p.productUrl)} disabled={!!linkBusy}>
                  {linkBusy===p.productUrl ? '생성 중…' : '구매링크 생성'}
                </button>
              </div>
              <div className="small" style={{marginTop: 6}}>
                {p.productPrice ? `가격: ${p.productPrice}` : ''}
                {p.isRocket ? ' · 🚀 로켓' : ''}
              </div>
              <div className="small" style={{marginTop: 6}}>
                <a href={p.productUrl} target="_blank" rel="noreferrer">원문 상품 페이지 열기</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


function InstallBar(){
  const [deferred, setDeferred] = React.useState<any>(null)
  const [canInstall, setCanInstall] = React.useState(false)

  React.useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferred(e)
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler as any)
    return () => window.removeEventListener('beforeinstallprompt', handler as any)
  }, [])

  async function install(){
    if(!deferred) return
    deferred.prompt()
    try { await deferred.userChoice } catch {}
    setDeferred(null)
    setCanInstall(false)
  }

  // iOS Safari doesn't fire beforeinstallprompt reliably; show hint there
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone

  if(isStandalone) return null

  if(isIOS){
    return (
      <div className="installBar">
        📌 iPhone/iPad에서는 Safari에서 <b>공유</b> → <b>홈 화면에 추가</b>로 설치할 수 있어요.
      </div>
    )
  }

  if(!canInstall) return null
  return (
    <div className="installBar">
      📲 홈 화면에 설치하면 “앱처럼” 쓸 수 있어요!
      <button className="btn primary" onClick={install} style={{marginLeft: 10}}>설치</button>
    </div>
  )
}

function uid(){
  return Math.random().toString(36).slice(2,10)
}

export default function App(){
  const persisted = load<Persisted>(LS_KEY, { items: [], ctx: defaultCtx })
  const [items, setItems] = useState<SupplementItem[]>(persisted.items)
  const [ctx, setCtx] = useState<UserContext>(persisted.ctx)

  const [tab, setTab] = useState<TabKey>('입력')

  // Auth: if Supabase is configured, show login gate (with optional demo mode)
  const [demoMode, setDemoMode] = useState(false)
  const [session, setSession] = useState<any>(null)

  React.useEffect(() => {
    if(!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => { sub.subscription.unsubscribe() }
  }, [])

  const [draftName, setDraftName] = useState('')
  const [draftServings, setDraftServings] = useState(1)
  const [draftText, setDraftText] = useState('')
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)

  // persist
  React.useEffect(() => { save(LS_KEY, { items, ctx }) }, [items, ctx])

  const totals = useMemo(() => computeTotals(items, ctx), [items, ctx])
  const warnings = useMemo(() => computeWarnings(items, totals, ctx), [items, totals, ctx])
  const schedule = useMemo(() => buildSchedule(items, ctx), [items, ctx])
  const suggestions = useMemo(() => ageBasedSuggestions(ctx), [ctx])

  function addFromText(){
    const parsed = parseLabelText(draftText)
    if(!draftName.trim()) return alert('제품 이름을 입력해줘요 🙂')
    if(parsed.length === 0) return alert('라벨 텍스트에서 인식된 성분이 없어요. (예: “비타민 D 50 mcg”처럼 줄 단위로 붙여넣기 추천)')
    const nutrients = parsed.map(p => ({ key: p.key, amount: p.amount }))
    const it: SupplementItem = {
      id: uid(),
      name: draftName.trim(),
      servingsPerDay: Math.max(1, Number(draftServings||1)),
      nutrients,
      notes: '라벨 텍스트 자동 파싱'
    }
    setItems(prev => [it, ...prev])
    setDraftName('')
    setDraftServings(1)
    setDraftText('')
  }

  async function handleOCR(file: File){
    try{
      setOcrBusy(true)
      setOcrProgress(0)
      const text = await ocrImage(file, p => setOcrProgress(p))
      setDraftText(prev => (prev ? prev + '\n' : '') + text)
    }catch(e){
      alert('OCR에 실패했어요. 다른 사진(밝고 선명한 라벨)으로 다시 시도해 주세요.')
    }finally{
      setOcrBusy(false)
    }
  }

  function removeItem(id: string){
    setItems(prev => prev.filter(x => x.id !== id))
  }

  function updateItemNutrient(id: string, key: NutrientKey, amount: number){
    setItems(prev => prev.map(it => {
      if(it.id !== id) return it
      const next = it.nutrients.map(n => n.key===key ? { ...n, amount } : n)
      return { ...it, nutrients: next }
    }))
  }

  function addManualNutrient(id: string){
    const key = prompt('추가할 성분 키워드(예: 비타민 D, 칼슘, 아연)') || ''
    const amountStr = prompt('1회분 기준 함량 숫자(예: 50)') || ''
    const amount = Number(amountStr)
    if(!Number.isFinite(amount) || amount<=0) return
    const k = findKeyFromUserText(key)
    if(!k) return alert('성분을 인식하지 못했어요. (예: 비타민 D / 비타민 B6 / 엽산 / 칼슘 / 마그네슘 / 철 / 아연 / 셀레늄 / 요오드 등)')
    setItems(prev => prev.map(it => it.id===id ? { ...it, nutrients: [...it.nutrients, { key: k, amount }] } : it))
  }

  function findKeyFromUserText(t: string): NutrientKey | null {
    const low = t.toLowerCase()
    const match = NUTRIENTS.find(n => n.synonyms.some(s => low.includes(s.toLowerCase())))
    return match?.key ?? null
  }

  // If Supabase is configured, require login unless user opted into demo mode.
  if(supabase && !session && !demoMode){
    return <AuthScreen onDemo={()=>setDemoMode(true)} />
  }

  return (
    <div className="container">
      <div className="h1">
        🧠💊 SuppGuard
        <small>영양제 성분 중복/과용 체크 & 복용 타이밍 “가이드”</small>
      </div>

      <InstallBar />

      <div className="notice small" style={{marginTop: 10}}>
        ⚠️ 이 앱은 <b>의료행위가 아닌 참고용</b>이에요. 질환/임신/수유/만성질환, 특히 <b>와파린·갑상선약·항생제</b> 등 복용 중이면,
        새 영양제 추가·중단·고용량 복용은 <b>의사/약사와 상의</b>가 안전합니다.
      </div>

      <div className="row" style={{justifyContent:'space-between', marginTop: 12}}>
        <TabBar tab={tab} setTab={setTab} />
        <div className="row">
          {demoMode && <span className="badge warn">데모 모드</span>}
          {supabase && session && (
            <button className="btn" onClick={()=>supabase!.auth.signOut()}>로그아웃</button>
          )}
        </div>
      </div>

      {tab==='입력' && (
      <div className="grid" style={{marginTop: 14}}>
        <div className="card">
          <h2>1) 영양제 추가 (글 입력 / 사진 OCR)</h2>
          <div className="row">
            <input className="input" placeholder="제품 이름 (예: 이뮨 올인원 멀티비타민)" value={draftName} onChange={e=>setDraftName(e.target.value)} />
            <select value={draftServings} onChange={e=>setDraftServings(Number(e.target.value))} style={{maxWidth: 180}}>
              {[1,2,3,4].map(n => <option key={n} value={n}>하루 {n}회</option>)}
            </select>
          </div>
          <div style={{height: 8}} />
          <textarea
            placeholder={'라벨(성분표) 텍스트를 붙여넣어 주세요.\n예) 비타민 D 50 mcg\n아연 8.5 mg\n셀레늄 55 mcg\n(줄 단위가 정확도가 좋아요)'}
            value={draftText}
            onChange={e=>setDraftText(e.target.value)}
          />
          <div className="row" style={{marginTop: 10, justifyContent:'space-between'}}>
            <div className="row">
              <label className="btn">
                📷 라벨 사진 OCR
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{display:'none'}}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if(f) handleOCR(f)
                    e.currentTarget.value = ''
                  }}
                />
              </label>
              <button className="btn primary" onClick={addFromText} disabled={ocrBusy}>➕ 추가</button>
            </div>
            <div className="small">
              {ocrBusy ? `OCR 중… ${Math.round(ocrProgress*100)}%` : '팁: 사진은 밝게, 글자가 수평으로 나오게!'}
            </div>
          </div>

          <div className="hr" />

          <h2>2) 내 영양제 목록</h2>
          {items.length === 0 ? (
            <div className="small">아직 추가된 제품이 없어요. 위에 텍스트/사진으로 먼저 추가해보자 🙂</div>
          ) : (
            <div style={{display:'grid', gap: 10}}>
              {items.map(it => (
                <div key={it.id} className="card" style={{background:'rgba(0,0,0,0.15)'}}>
                  <div className="row" style={{justifyContent:'space-between'}}>
                    <div style={{fontWeight: 800}}>{it.name} <span className="badge good">하루 {it.servingsPerDay}회</span></div>
                    <div className="row">
                      <button className="btn" onClick={()=>addManualNutrient(it.id)}>➕ 성분 수동추가</button>
                      <button className="btn danger" onClick={()=>removeItem(it.id)}>삭제</button>
                    </div>
                  </div>

                  <table className="table" style={{marginTop: 8}}>
                    <thead>
                      <tr><th style={{width: 220}}>성분</th><th>1회분 함량(기준 단위)</th><th>수정</th></tr>
                    </thead>
                    <tbody>
                      {it.nutrients.map(n => {
                        const def = NUTRIENTS.find(d=>d.key===n.key)!
                        return (
                          <tr key={n.key}>
                            <td>{def.label}</td>
                            <td><b>{n.amount}</b> {def.unit}</td>
                            <td style={{maxWidth: 220}}>
                              <input
                                className="input"
                                value={n.amount}
                                onChange={e=>updateItemNutrient(it.id, n.key, Number(e.target.value))}
                                type="number"
                                min={0}
                                step="0.1"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  <div className="small">* 자동 파싱은 틀릴 수 있어요. 라벨을 보고 숫자를 꼭 확인해 주세요.</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2>설정 (약/상황 · 나이대 · 생활 패턴)</h2>

          <div className="kv" style={{marginTop: 8}}>
            <div className="small">나이대</div>
            <select value={ctx.ageGroup} onChange={e=>setCtx({...ctx, ageGroup: e.target.value as any})}>
              <option value="19-50">19–50</option>
              <option value="51+">51+</option>
              <option value="18-">18 이하(참고용)</option>
            </select>

            <div className="small">성별</div>
            <select value={ctx.sex} onChange={e=>setCtx({...ctx, sex: e.target.value as any})}>
              <option value="other">선택 안함</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>

            <div className="small">임신 준비/가능성</div>
            <select value={ctx.pregnantOrTrying ? 'yes':'no'} onChange={e=>setCtx({...ctx, pregnantOrTrying: e.target.value==='yes'})}>
              <option value="no">아니오</option>
              <option value="yes">예</option>
            </select>
          </div>

          <div className="hr" />
          <div className="small" style={{fontWeight: 800, marginBottom: 6}}>복용 중인 약/상황(있다면 체크)</div>
          <div className="chips">
            {[
              ['levothyroxine','갑상선 약(레보티록신)'],
              ['warfarin','와파린(쿠마딘)'],
              ['antibiotics','항생제(특정 계열)'],
              ['bisphosphonate','골다공증 약(비스포스포네이트)'],
              ['diabetesMeds','당뇨약(일부)'],
              ['bpMeds','혈압약(일부)'],
            ].map(([k, label]) => (
              <label key={k} className="chip" style={{cursor:'pointer'}}>
                <input
                  type="checkbox"
                  checked={(ctx.meds as any)[k] || false}
                  onChange={e=>setCtx({...ctx, meds: {...ctx.meds, [k]: e.target.checked}})}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="hr" />
          <div className="small" style={{fontWeight: 800, marginBottom: 6}}>생활 패턴(스케줄 제안에 사용)</div>
          <div className="kv">
            <div className="small">기상</div>
            <input className="input" value={ctx.routine.wake} onChange={e=>setCtx({...ctx, routine: {...ctx.routine, wake: e.target.value}})} />
            <div className="small">아침</div>
            <input className="input" value={ctx.routine.breakfast} onChange={e=>setCtx({...ctx, routine: {...ctx.routine, breakfast: e.target.value}})} />
            <div className="small">점심</div>
            <input className="input" value={ctx.routine.lunch} onChange={e=>setCtx({...ctx, routine: {...ctx.routine, lunch: e.target.value}})} />
            <div className="small">저녁</div>
            <input className="input" value={ctx.routine.dinner} onChange={e=>setCtx({...ctx, routine: {...ctx.routine, dinner: e.target.value}})} />
            <div className="small">취침</div>
            <input className="input" value={ctx.routine.bed} onChange={e=>setCtx({...ctx, routine: {...ctx.routine, bed: e.target.value}})} />
          </div>

          <div className="hr" />
          <button className="btn" onClick={()=>{
            if(confirm('저장된 데이터(영양제 목록/설정)를 초기화할까요?')){
              setItems([])
              setCtx(defaultCtx)
              save(LS_KEY, { items: [], ctx: defaultCtx })
            }
          }}>🧹 초기화</button>
        </div>

      </div>
      )}

      {tab==='분석' && (
      <div className="grid" style={{marginTop: 14, gridTemplateColumns:'1fr'}}>
        <div className="card">
          <h2>3) 중복/과용 체크 결과</h2>
          {items.length === 0 ? <div className="small">영양제를 추가하면 분석이 나타나요.</div> : (
            <>
              <div className="row" style={{gap: 8, flexWrap:'wrap'}}>
                {warnings.length === 0 ? (
                  <span className="badge good">특이 경고 없음</span>
                ) : (
                  warnings.slice(0,12).map((w, idx) => (
                    <span key={idx} className={'badge ' + (w.level==='danger'?'bad': w.level==='warn'?'warn':'good')}>
                      {w.level==='danger'?'🚨':w.level==='warn'?'⚠️':'ℹ️'} {w.title}
                    </span>
                  ))
                )}
              </div>

              <div className="hr" />

              <table className="table">
                <thead>
                  <tr>
                    <th style={{width: 240}}>성분 합계(하루)</th>
                    <th style={{width: 160}}>합계</th>
                    <th style={{width: 220}}>UL(성인 기준)</th>
                    <th>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {totals.filter(t=>t.total>0).map(t => (
                    <tr key={t.key}>
                      <td>
                        <b>{t.label}</b>{' '}
                        {t.status==='exceed' && <span className="badge bad">초과</span>}
                        {t.status==='high' && <span className="badge warn">높음</span>}
                        {t.status==='ok' && <span className="badge good">OK</span>}
                        {t.status==='na' && <span className="badge">UL 없음/비교불가</span>}
                      </td>
                      <td><b>{t.total}</b> {t.unit}</td>
                      <td>{t.ul ? `${t.ul} ${t.unit}` : '—'}</td>
                      <td className="small">{t.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="hr" />
              <div className="small">
                🔎 참고: UL은 “부작용 위험이 커지기 시작하는 경계”로 쓰이는 값이에요. 개인의 체중/질환/검사수치/약물에 따라 안전범위는 달라질 수 있어요.
              </div>
            </>
          )}
      </div>

      </div>
      )}

      {tab==='시간표' && (
        <div className="grid" style={{marginTop: 14, gridTemplateColumns:'1fr'}}>
          <div className="card">
            <h2>4) 복용 타이밍/시간 제안(가이드)</h2>
            {items.length === 0 ? <div className="small">영양제를 추가하면 스케줄이 생성돼요.</div> : (
              <>
                <table className="table">
                  <thead>
                    <tr><th style={{width: 220}}>권장 슬롯</th><th>제품</th><th>이유(요약)</th></tr>
                  </thead>
                  <tbody>
                    {schedule.map((s, idx) => (
                      <tr key={idx}>
                        <td><b>{s.slot}</b></td>
                        <td>{s.items.join(', ')}</td>
                        <td className="small">{s.rationale.length ? s.rationale.join(' · ') : '일반적인 편의 기준으로 배치'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="hr" />
                <div className="small">
                  ⏱️ “시간”은 생활패턴에 맞게 조정 가능해요. 특히 약(갑상선약/항생제/골다공증약 등)과는
                  제품 라벨/처방지시를 우선으로 보고, 미네랄(칼슘·철·마그네슘·아연)은 분리 복용이 안전한 경우가 많아요.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab==='추천/구매' && (
        <div className="grid" style={{marginTop: 14}}>
          <div className="card">
            <h2>5) 나이대별 “추천 후보” (참고용)</h2>
            <div className="small">⚠️ ‘필수’가 아니라, 부족하기 쉬워서 “검토할 만한 후보” 리스트예요.</div>
            <div className="hr" />
            {suggestions.map((b, idx) => (
              <div key={idx} style={{marginBottom: 14}}>
                <div style={{fontWeight: 900}}>{b.title}</div>
                <ul className="small">
                  {b.items.map((x,i)=>(<li key={i}><b>{x.name}</b> — {x.why}</li>))}
                </ul>
                <div className="chips">
                  {b.cautions.map((c,i)=>(<span key={i} className="chip">⚠️ {c}</span>))}
                </div>
              </div>
            ))}

            <details className="small">
              <summary style={{cursor:'pointer'}}>근거 출처 링크</summary>
              <ul>
                <li><a href="https://ods.od.nih.gov/factsheets/VitaminD-Consumer/" target="_blank" rel="noreferrer">NIH ODS: Vitamin D (UL 등)</a></li>
                <li><a href="https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/" target="_blank" rel="noreferrer">NIH ODS: Zinc (UL 등)</a></li>
                <li><a href="https://www.fda.gov/consumers/consumer-updates/mixing-medications-and-dietary-supplements-can-endanger-your-health" target="_blank" rel="noreferrer">FDA: 약+영양제 혼용 위험</a></li>
                <li><a href="https://www.cdc.gov/folic-acid/about/index.html" target="_blank" rel="noreferrer">CDC: Folic acid</a></li>
              </ul>
            </details>
          </div>

          <PurchaseCard />
        </div>
      )}

      <div className="small" style={{marginTop: 14, opacity: 0.9}}>
        Made for safe-ish decisions ❤️ — 라벨/복용량/약물은 케이스가 다양하니, “경고가 뜨면” 약사에게 라벨 사진을 보여주고 상담하는 게 제일 확실해요.
      </div>
    </div>
  )
}

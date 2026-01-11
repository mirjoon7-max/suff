export function load<T>(key: string, fallback: T): T {
  try{
    const raw = localStorage.getItem(key)
    if(!raw) return fallback
    return JSON.parse(raw) as T
  }catch{
    return fallback
  }
}

export function save<T>(key: string, value: T){
  try{
    localStorage.setItem(key, JSON.stringify(value))
  }catch{}
}

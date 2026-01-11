import Tesseract from 'tesseract.js'

export async function ocrImage(file: File, onProgress?: (p:number)=>void): Promise<string> {
  const { data } = await Tesseract.recognize(file, 'kor+eng', {
    logger: (m:any) => {
      if(m?.status === 'recognizing text' && typeof m?.progress === 'number'){
        onProgress?.(m.progress)
      }
    }
  })
  return (data?.text ?? '').trim()
}

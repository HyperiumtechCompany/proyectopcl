import { usePage } from '@inertiajs/react'
import React, { useState, useEffect, useRef } from 'react'
import AppLayout from '@/layouts/app-layout'
import type { BreadcrumbItem } from '@/types'
import Luckysheet from '@/components/costos/tablas/Luckysheet'

declare global {
  interface Window {
    luckysheet: any
  }
}

interface PageProps {
  spreadsheet: {
    id: number
    name: string
    sheet_data: any[][]
  }
  [key: string]: any
}

/* COLUMNAS */

const COLS = {
  ITEM: 0,
  DES: 1,
  UND: 2,
  ELEM: 3,
  L: 4,
  ANC: 5,
  ALT: 6,
  NVEC: 7,
  LON: 8,
  AREA: 9,
  VOL: 10,
  KG: 11,
  UNDC: 12,
  TOTAL: 13,
  OBS: 14
}

const HEADERS = [
  'ITEM','DESCRIPCIÓN','Und','Elem','Largo','Ancho','Alto','N° Vec',
  'Lon.','Área','Vol.','Kg','UndC','Total','Observaciones'
]

const UNIDADES = ["ml","m","m2","m3","kg","und"]

/* ================= CALCULO ================= */

const calculateRow = (row:any[])=>{
  const r=[...row]

  const unidad=(r[COLS.UND]||'').toLowerCase()

  const num=(i:number)=>{
    const v=parseFloat(r[i])
    return isNaN(v)?0:v
  }

  const elem=num(COLS.ELEM)
  const l=num(COLS.L)
  const anc=num(COLS.ANC)
  const alt=num(COLS.ALT)
  const n=num(COLS.NVEC)||1

  let lon=0,area=0,vol=0,kg=0,undc=0
  const densidad=7850

  switch(unidad){

    case 'ml':
    case 'm':
      lon=l*elem*n
      undc=lon
    break

    case 'm2':
      area=l*anc*elem*n
      undc=area
    break

    case 'm3':
      vol=l*anc*alt*elem*n
      undc=vol
    break

    case 'kg':
      vol=l*anc*alt*elem*n
      kg=vol*densidad
      undc=kg
    break

    case 'und':
      undc=elem*n
    break
  }

  r[COLS.LON]=lon?lon.toFixed(2):''
  r[COLS.AREA]=area?area.toFixed(2):''
  r[COLS.VOL]=vol?vol.toFixed(2):''
  r[COLS.KG]=kg?kg.toFixed(2):''
  r[COLS.UNDC]=undc?undc.toFixed(2):''
  r[COLS.TOTAL]=undc?undc.toFixed(2):''

  return r
}

/* ================= RESUMEN ================= */

interface ResumenItem{
  item:string
  desc?:string
  und?:string
  total:number
}

const generateResumenData = ():ResumenItem[]=>{

  const ls = window.luckysheet
  if(!ls) return []

  const files = ls.getLuckysheetfile()
  const sheet = files[0]

  const rows = sheet.data?.length || 0

  const map:Record<string,ResumenItem>={}

  for(let r=1;r<rows;r++){

    let item:any = ls.getCellValue(r,COLS.ITEM) ?? ''
    let desc:any = ls.getCellValue(r,COLS.DES) ?? ''
    let und:any = ls.getCellValue(r,COLS.UND) ?? ''
    let undc:any = ls.getCellValue(r,COLS.UNDC) ?? ''

    if(!item) continue

    if(item && typeof item==='object') item=item.v ?? item.m ?? ''
    if(desc && typeof desc==='object') desc=desc.v ?? desc.m ?? ''
    if(und && typeof und==='object') und=und.v ?? und.m ?? ''

    if(undc && typeof undc === 'object')
      undc = undc.v ?? 0

    undc = parseFloat(undc) || 0

    const parts=String(item).split('.')

    if(parts.length===1){

      map[item] ??= {item,desc:desc || "",und:und || "",total:0}

    }

    if(parts.length===2){

      map[item] ??= {item,desc,total:0}

    }

    if(parts.length===3){

      const titulo=parts[0]
      const subtitulo=parts[0]+"."+parts[1]

      map[titulo] ??= {item:titulo,desc:'',total:0}
      map[subtitulo] ??= {item:subtitulo,desc:'',und,total:0}

      map[titulo].total+=undc
      map[subtitulo].total+=undc
      map[subtitulo].und=und

    }

  }

  return Object.values(map)
}

/* ================= HOJA RESUMEN ================= */

const updateResumenSheet = ()=>{

  const ls = window.luckysheet
  if(!ls) return

  const resumen = generateResumenData()

  const files = ls.getLuckysheetfile()

  const index = files.findIndex((s:any)=>s.name==="Resumen")

  if(index === -1) return

  ls.setSheetActive(index)

  /* limpiar */

  for(let r=1;r<200;r++){
    for(let c=0;c<4;c++){
      ls.setCellValue(r,c,"")
    }
  }

  /* insertar resumen */

  resumen.forEach((r,i)=>{

    const row=i+1

    ls.setCellValue(row,0,r.item || "")
    ls.setCellValue(row,1,r.desc || "")
    ls.setCellValue(row,2,r.und || "")
    ls.setCellValue(row,3,r.total || 0)

  })

}

/* ================= NUMERACION ================= */

const getHierarchy=(ls:any)=>{

  const rows=ls.getSheet()?.data?.length||0

  let titulo=0,subtitulo=0,partida=0

  for(let i=1;i<rows;i++){

    let item:any=ls.getCellValue(i,COLS.ITEM)

    if(!item) continue

    if(typeof item==='object') item=item?.v??item?.m

    const parts=String(item).split('.')

    if(parts.length===1){titulo=parseInt(parts[0]);subtitulo=0;partida=0}
    if(parts.length===2){titulo=parseInt(parts[0]);subtitulo=parseInt(parts[1]);partida=0}
    if(parts.length===3){titulo=parseInt(parts[0]);subtitulo=parseInt(parts[1]);partida=parseInt(parts[2])}

  }

  return{titulo,subtitulo,partida}
}

const getCurrentRow=()=>{
  const ls=window.luckysheet
  const range=ls.getRange()
  if(!range?.[0]?.row) return 1
  return range[0].row[0]+1
}

/* ================= DATA ================= */

const toLuckysheetData = (rows:any[][])=>{

  const celldata:any[]=[]

  HEADERS.forEach((h,c)=>{
    celldata.push({
      r:0,
      c,
      v:{v:h,m:h,bl:1}
    })
  })

  rows.forEach((row,r)=>{
    row.forEach((value,c)=>{

      if(value!==''){

        const cell:any={
          r:r+1,
          c,
          v:{v:value,m:String(value)}
        }

        if(c===COLS.UND){
          cell.v={
            ...cell.v,
            type:'dropdown',
            value1:UNIDADES.join(',')
          }
        }

        celldata.push(cell)

      }

    })
  })

  return [

    /* SHEET 1 METRADO */

    {
      name:'Metrado Eléctricas',
      celldata,
      column:15,
      row:200
    },

    /* SHEET 2 RESUMEN */

    {
      name:'Resumen',
      celldata:[
        {r:0,c:0,v:{v:'ITEM',m:'ITEM',bl:1}},
        {r:0,c:1,v:{v:'DESCRIPCIÓN',m:'DESCRIPCIÓN',bl:1}},
        {r:0,c:2,v:{v:'UND',m:'UND',bl:1}},
        {r:0,c:3,v:{v:'TOTAL',m:'TOTAL',bl:1}},
      ],
      column:4,
      row:200
    }

  ]

}


/* ================= COMPONENTE ================= */

export default function Show(){

  const{spreadsheet}=usePage<PageProps>().props
  const[sheetData,setSheetData]=useState<any[]>([])
  const calculatingRef=useRef(false)

  useEffect(()=>{

    const initial=spreadsheet.sheet_data?.length
    ?spreadsheet.sheet_data
    :[
      ['01','INSTALACIONES ELÉCTRICAS','','','','','','','','','','','',''],
      ['01.01','ALUMBRADO','','','','','','','','','','','',''],
      ['01.01.01','Cableado iluminación','ml','1','20','','','1','','','','','','']
    ]

    setSheetData(toLuckysheetData(initial))

  },[spreadsheet.sheet_data])

  const calculateRowRealtime = (rowIndex:number)=>{

    const ls = window.luckysheet
    if(!ls) return

    const row:any[] = []

    for(let c=0;c<=COLS.TOTAL;c++){
      row[c] = ls.getCellValue(rowIndex,c) || ''
    }

    const result = calculateRow(row)

    const cols=[COLS.LON,COLS.AREA,COLS.VOL,COLS.KG,COLS.UNDC,COLS.TOTAL]

    cols.forEach(col=>{
      ls.setCellValue(rowIndex,col,result[col])
    })

  }

  const handleCellUpdated=(r:number)=>{

    if(calculatingRef.current) return

    calculatingRef.current=true

    setTimeout(()=>{
      calculateRowRealtime(r)
      calculatingRef.current=false
    },50)
  }

  /* BOTONES */

  const addTitulo=()=>{
    const ls=window.luckysheet
    const row=getCurrentRow()
    const{titulo}=getHierarchy(ls)

    const nuevo=String(titulo+1).padStart(2,'0')

    ls.insertRow(row,1)
    ls.setCellValue(row,COLS.ITEM,nuevo)
    ls.setCellValue(row,COLS.DES,'Nuevo Título')
  }

  const addSubtitulo=()=>{
    const ls=window.luckysheet
    const row=getCurrentRow()

    const{titulo,subtitulo}=getHierarchy(ls)

    const nuevo = `${String(titulo).padStart(2,'0')}.${String(subtitulo+1).padStart(2,'0')}`

    ls.insertRow(row,1)
    ls.setCellValue(row,COLS.ITEM,nuevo)
    ls.setCellValue(row,COLS.DES,'Nuevo Subtítulo')
  }

  const addPartida=()=>{
    const ls=window.luckysheet
    const row=getCurrentRow()

    const{titulo,subtitulo,partida}=getHierarchy(ls)

    const nuevo= `${String(titulo).padStart(2,'0')}.${String(subtitulo).padStart(2,'0')}.${String(partida+1).padStart(2,'0')}`

    ls.insertRow(row,1)

    ls.setCellValue(row,COLS.ITEM,nuevo)
    ls.setCellValue(row,COLS.DES,'Nueva partida')
    ls.setCellValue(row,COLS.UND,'ml')
    ls.setCellValue(row,COLS.ELEM,'1')
    ls.setCellValue(row,COLS.NVEC,'1')
  }

  const generarResumen=()=>{
    updateResumenSheet()
  }

  const irResumen = ()=>{

    updateResumenSheet()

    const ls = window.luckysheet
    const files = ls.getLuckysheetfile()

    const index = files.findIndex((s:any)=>s.name==="Resumen")

    if(index !== -1){
      ls.setSheetActive(index)
    }

  }

  const breadcrumbs:BreadcrumbItem[]=[
    {title:'Metrados',href:'#'},
    {title:'Eléctricas',href:'#'},
    {title:spreadsheet.name,href:'#'}
  ]

  return(

    <AppLayout breadcrumbs={breadcrumbs}>

      <div className="flex h-[calc(100vh-64px)] flex-col">

        <div className="border-b bg-white px-4 py-2 flex justify-between items-center">
          <h1 className="text-sm font-bold">{spreadsheet.name}</h1>
        </div>

        <div className="bg-gray-50 border-b px-4 py-2 flex gap-2">

          <button onClick={addTitulo} className="px-3 py-1 bg-blue-600 text-white rounded text-xs">
            + Título
          </button>

          <button onClick={addSubtitulo} className="px-3 py-1 bg-green-600 text-white rounded text-xs">
            + Subtítulo
          </button>

          <button onClick={addPartida} className="px-3 py-1 bg-red-600 text-white rounded text-xs">
            + Partida
          </button>

          <button onClick={generarResumen} className="px-3 py-1 bg-purple-600 text-white rounded text-xs">
            📊 Actualizar Resumen
          </button>

        </div>

        <div className="flex-1 overflow-hidden">

          <Luckysheet
            data={sheetData}
            height="100%"
            options={{
              showinfobar:false,
              showstatisticBar:true,
              toolbar:false,
              hook:{
                cellUpdated:handleCellUpdated
              }
            }}
          />

        </div>

      </div>

    </AppLayout>
  )
}
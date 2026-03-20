import { router, usePage } from '@inertiajs/react'
import React, { useState, useEffect, useRef } from 'react'
import AppLayout from '@/layouts/app-layout'
import type { BreadcrumbItem } from '@/types'
import Luckysheet from '@/components/costos/tablas/Luckysheet'

interface PageProps{
 spreadsheet:{
  id:number
  name:string
  sheet_data:any[][]
 }
 [key:string]:any
}

const COLS={
 ITEM:0,
 DES:1,
 UND:2,
 ELEM:3,
 L:4,
 ANC:5,
 ALT:6,
 NVEC:7,
 LON:8,
 AREA:9,
 VOL:10,
 KG:11,
 UNDC:12,
 TOTAL:13
}

const HEADERS=[
'ITEM','DESCRIPCIÓN','Und','Elem','Largo','Ancho','Alto','N° Vec',
'Lon.','Área','Vol.','Kg','UndC','Total'
]

/* CALCULO FILA */
const calculateRow = (row:any[]) => {
 const r=[...row]
 const unidad=(r[COLS.UND]||'').toLowerCase().trim()
 const num=(i:number)=>{
  const v=parseFloat(r[i])
  return isNaN(v)?0:v
 }

 const elem=num(COLS.ELEM)
 const l=num(COLS.L)
 const anc=num(COLS.ANC)
 const alt=num(COLS.ALT)
 const n=num(COLS.NVEC)||1

 let lon=0, area=0, vol=0, kg=0, undc=0
 const densidad=7850

 switch(unidad){
  case 'ml': case 'm':
   lon=(l+anc+alt)*elem*n
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

/* NUMERACION AUTOMATICA */
const applyAutoNumbering=(rows:any[][])=>{
 let cap=''
 let index=0

 return rows.map(row=>{
  const r=[...row]
  // Detecta si es un capítulo (ej. "01", "02")
  if(r[COLS.ITEM] && /^\d{2}$/.test(r[COLS.ITEM])){
   cap=r[COLS.ITEM]
   index=0
  }else if(cap && r[COLS.DES]){
   index++
   r[COLS.ITEM]=`${cap}.${String(index).padStart(2,'0')}`
  }
  return r
 })
}

/* CONVERTIR A LUCKYSHEET */
const toLuckysheetData=(rows:any[][])=>{
 const celldata:any[]=[]

 // Headers
 HEADERS.forEach((h,c)=>{
  celldata.push({
   r:0, c,
   v:{ v:h, m:h, bl:1, ht:1, vt:1, bg:"#e5e7eb", ff:"Arial", fs:10 }
  })
 })

 // Data
 rows.forEach((row,r)=>{
  row.forEach((value,c)=>{
   if(value!=='' && value!==undefined){
    const text=String(value)
    const subtotal=text.includes("SUBTOTAL")
    const total=text.includes("TOTAL GENERAL")
    const isChapter = /^\d{2}$/.test(text) && c === COLS.ITEM

    celldata.push({
     r:r+1, c,
     v:{
      v:value, m:text,
      ht:1,
      bl: subtotal||total||isChapter ? 1 : 0,
      bg: subtotal?"#f3f4f6" : total?"#fde68a" : isChapter ? "#dbeafe" : undefined,
      ff:"Arial", fs: isChapter ? 11 : 10,
      cl: isChapter ? 1 : 0 
     }
    })
   }
  })
 })

 return [{
  name:'Metrado Comunicaciones',
  celldata,
  // CONFIGURACIÓN DE COLUMNAS (Anchos)
  columnlen:{
   0:60, 1:250, 2:50, 3:50, 4:70, 5:70, 6:70, 7:70,
   8:80, 9:80, 10:80, 11:80, 12:80, 13:100
  },
  column: 14, 
  row: 100 // Límite de filas 
 }]
}

export default function Show(){
 const { spreadsheet } = usePage<PageProps>().props
 const [sheetData,setSheetData]=useState<any[]>([])
 const calculatingRef=useRef(false)

 useEffect(()=>{
  const initial=spreadsheet.sheet_data?.length
  ? spreadsheet.sheet_data
  :[
   ['01','CABLEADO','','','','','','','','','','','',''],
   ['','Cable UTP','ml','1','22','2','15','18','','','','','',''],
   ['','Cable Fibra','ml','','10','1','10','10','','','','','',''],
   ['02','CANALIZACIÓN','','','','','','','','','','','',''],
   ['','Tubo PVC','ml','1','30','1','10','10','','','','','',''],
   ['','Canaleta met','ml','1','15','1','10','10','','','','','','']
  ]

  const numbered=applyAutoNumbering(initial)
  setSheetData(toLuckysheetData(numbered))
 },[])

 // --- FUNCIONES DE LOS BOTONES ---

 const handleAddChapter = () => {
    const ls:any = (window as any).luckysheet;
    if(!ls) return;

    const lastRow = ls.getLastRow();
    const newRowIndex = lastRow + 1;
    
    // Generar nuevo número de capítulo
    let newChapterNum = "03";
    // Lógica simple para encontrar el último capítulo y sumar 1
    // (En producción podrías buscar en el estado real)
    
    ls.insertRow(newRowIndex, 1);
    ls.setCellValue(newRowIndex, COLS.ITEM, newChapterNum);
    ls.setCellValue(newRowIndex, COLS.DES, "NUEVO CAPÍTULO");
    
    // Estilo para que parezca cabecera
    ls.setCellFormat(newRowIndex, COLS.ITEM, { bg: "#dbeafe", cl: 1 });
    ls.setCellFormat(newRowIndex, COLS.DES, { bg: "#dbeafe", cl: 1 });
 }

 const handleAddItem = () => {
    const ls:any = (window as any).luckysheet;
    if(!ls) return;

    const lastRow = ls.getLastRow();
    const newRowIndex = lastRow + 1;

    ls.insertRow(newRowIndex, 1);
    
    // Valores por defecto para un ítem nuevo
    ls.setCellValue(newRowIndex, COLS.UND, "ml");
    ls.setCellValue(newRowIndex, COLS.ELEM, "1");
    ls.setCellValue(newRowIndex, COLS.NVEC, "1");
    ls.setCellValue(newRowIndex, COLS.DES, "Nuevo Ítem");
 }

 // --- FIN FUNCIONES BOTONES ---

 const calculateRowRealtime=(rowIndex:number)=>{
  const ls:any=(window as any).luckysheet
  if(!ls) return
  const sheets=ls.getAllSheets()
  if(!sheets?.[0]?.celldata) return
  const celldata=sheets[0].celldata
  const row:any[]=[]

  celldata.forEach((cell:any)=>{
   if(cell.r===rowIndex){
    row[cell.c]=cell.v?.v??''
   }
  })

  const result=calculateRow(row)
  const cols=[COLS.LON, COLS.AREA, COLS.VOL, COLS.KG, COLS.UNDC, COLS.TOTAL]

  cols.forEach(c=>{
   if(result[c]!==row[c]){
    ls.setCellValue(rowIndex,c,result[c])
   }
  })
 }

 const recalcTotals = () => {
  const ls:any=(window as any).luckysheet
  if(!ls) return
  const sheets=ls.getAllSheets()
  if(!sheets?.length) return
  const celldata=sheets[0].celldata
  const rows:any[]=[]

  celldata.forEach((cell:any)=>{
   if(cell.r===0) return
   const r=cell.r-1
   const c=cell.c
   if(!rows[r]) rows[r]=[]
   rows[r][c]=cell.v?.v ?? ''
  })

  const cleanRows=rows.filter(r=>{
   const d=String(r?.[COLS.DES]||'')
   return !d.includes('SUBTOTAL') && !d.includes('TOTAL GENERAL')
  })

  const recalculated=cleanRows.map(r=>calculateRow(r))
  const numbered=applyAutoNumbering(recalculated)
  setSheetData(toLuckysheetData(numbered))
 }

 const handleCellUpdated=(r:number)=>{
  if(calculatingRef.current) return
  calculatingRef.current=true
  setTimeout(()=>{
   calculateRowRealtime(r)
   setTimeout(()=>{
    recalcTotals()
    calculatingRef.current=false
   },200)
  },30)
 }

 const breadcrumbs:BreadcrumbItem[]=[
  {title:'Metrados',href:'#'},
  {title:'Comunicaciones',href:'#'},
  {title:spreadsheet.name,href:'#'}
 ]

 return(
  <AppLayout breadcrumbs={breadcrumbs}>
   <div className="flex h-[calc(100vh-64px)] flex-col">

    <div className="border-b bg-white px-4 py-2 flex justify-between items-center">
     <h1 className="text-sm font-bold">{spreadsheet.name}</h1>
    </div>

    {/* --- BARRA DE HERRAMIENTAS PERSONALIZADA --- */}
    <div className="bg-gray-50 border-b px-4 py-2 flex gap-2 items-center h-12">
        <button 
            onClick={handleAddChapter}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
        >
            <span>📁</span> Agregar Capítulo
        </button>
        
        <button 
            onClick={handleAddItem}
            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded transition-colors"
        >
            <span>📄</span> Agregar Ítem
        </button>

        <div className="h-4 w-px bg-gray-300 mx-2"></div>
    </div>
    {/* --------------------------------------------- */}

    <div className="flex-1 overflow-hidden relative">
     <Luckysheet
        data={sheetData}
        height="100%"
        options={{
            showinfobar: false,
            showstatisticBar: true,
            toolbar: false, 
            hook:{
                cellUpdated:(r:number)=>{
                    handleCellUpdated(r)
                }
            }
        }}
     />
    </div>

   </div>
  </AppLayout>
 )
}
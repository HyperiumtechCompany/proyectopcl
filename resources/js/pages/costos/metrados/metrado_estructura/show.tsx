import { router, usePage } from '@inertiajs/react'
import React, { useState, useEffect, useRef } from 'react'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import AppLayout from '@/layouts/app-layout'
import type { BreadcrumbItem } from '@/types'
import type { MetradoComunicacionSpreadsheetSummary } from '@/types/metrado-comunicacion'
import * as electricasRoutes from '@/routes/metrados/comunicacion/index'
import metradoRoutes from '@/routes/metrados'
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

 const unidad=(r[COLS.UND]||'')
 .toLowerCase()
 .trim()

 const num=(i:number)=>{
  const v=parseFloat(r[i])
  return isNaN(v)?0:v
 }

 const elem=num(COLS.ELEM)
 const l=num(COLS.L)
 const anc=num(COLS.ANC)
 const alt=num(COLS.ALT)
 const n=num(COLS.NVEC)||1

 let lon=0
 let area=0
 let vol=0
 let kg=0
 let undc=0

 /* densidad estándar */
 const densidad=7850

 switch(unidad){

  /* METRADO LINEAL */

  case 'ml':
  case 'm':

   lon=(l+anc+alt)*elem*n
   undc=lon

  break

  /* METRADO SUPERFICIAL */

  case 'm2':

   area=l*anc*elem*n
   undc=area

  break

  /* METRADO VOLUMÉTRICO */

  case 'm3':

   vol=l*anc*alt*elem*n
   undc=vol

  break

  /* PESO */

  case 'kg':

   vol=l*anc*alt*elem*n
   kg=vol*densidad
   undc=kg

  break

  /* UNIDADES */

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

  if(r[COLS.ITEM] && r[COLS.ITEM].length===2){

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

 HEADERS.forEach((h,c)=>{
  celldata.push({
   r:0,
   c,
   v:{
    v:h,
    m:h,
    bl:1,
    ht:1,
    vt:1,
    bg:"#2563eb",
    ff:14,
    fc:"#ffffff",
    fs:12,
    bl:1
   }
  })
 })

 rows.forEach((row,r)=>{

  row.forEach((value,c)=>{

   if(value!=='' && value!==undefined){

    const text=String(value)

    const subtotal=text.includes("SUBTOTAL")
    const total=text.includes("TOTAL GENERAL")

    celldata.push({
     r:r+1,
     c,
     v:{
      v:value,
      m:text,
      ht:1,
      bl:subtotal||total?1:0,
      bg:subtotal?"#f3f4f6":total?"#fde68a":undefined
     }
    })

   }

  })

 })

 return [{
  name:'Metrado Estructura',
  celldata,
  columnlen:{
   0:70,
   1:260,
   2:70,
   3:70,
   4:80,
   5:80,
   6:80,
   7:80,
   8:90,
   9:90,
   10:90,
   11:90,
   12:90,
   13:110
  }
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
   ['','Cable Fibra','ml','1','10','1','10','10','','','','','',''],

   ['02','CANALIZACIÓN','','','','','','','','','','','',''],
   ['','Tubo PVC','ml','1','30','1','10','10','','','','','',''],
   ['','Canaleta metálica','ml','1','20','1','10','10','','','','','','']

  ]

  const numbered=applyAutoNumbering(initial)
  setSheetData(toLuckysheetData(numbered))

 },[])

 /* FUNCIÓN PARA AGREGAR NUEVA FILA */
 const addNewRow = () => {
  // Obtener los datos actuales
  const currentSheetData = [...sheetData]
  
  if (currentSheetData.length > 0 && currentSheetData[0].celldata) {
    // Encontrar la última fila
    const celldata = currentSheetData[0].celldata
    let maxRow = 0
    
    celldata.forEach((cell: any) => {
      if (cell.r > maxRow) maxRow = cell.r
    })
    
    // Crear nueva fila vacía (14 columnas)
    const newRowIndex = maxRow + 1
    const emptyRow = []
    
    // Crear celdas vacías para cada columna
    for (let c = 0; c < HEADERS.length; c++) {
      emptyRow.push({
        r: newRowIndex,
        c: c,
        v: {
          v: '',
          m: '',
          ht: 1
        }
      })
    }
    
    // Agregar las nuevas celdas
    const updatedCelldata = [...celldata, ...emptyRow]
    
    // Actualizar el sheetData
    const updatedSheetData = [{
      ...currentSheetData[0],
      celldata: updatedCelldata
    }]
    
    setSheetData(updatedSheetData)
  }
 }

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

  const cols=[
   COLS.LON,
   COLS.AREA,
   COLS.VOL,
   COLS.KG,
   COLS.UNDC,
   COLS.TOTAL
  ]

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

 /* limpiar subtotales y total */

 const cleanRows=rows.filter(r=>{

  const d=String(r?.[COLS.DES]||'')

  return !d.includes('SUBTOTAL') && !d.includes('TOTAL GENERAL')

 })

 /* recalcular filas */

 const recalculated=cleanRows.map(r=>calculateRow(r))

 /* numeración */

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
  {title:'Estructura',href:'#'},
  {title:spreadsheet.name,href:'#'}
 ]

 return(

  <AppLayout breadcrumbs={breadcrumbs}>

   <div className="flex h-[calc(100vh-64px)] flex-col">

    <div className="border-b bg-white px-4 py-2 flex justify-between items-center">
     <h1 className="text-sm font-bold">{spreadsheet.name}</h1>
     <button
      onClick={addNewRow}
      className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1.5 px-4 rounded-md flex items-center gap-2 transition-colors"
     >
      <span>+</span>
      Agregar Fila
     </button>
    </div>

    <div className="flex-1 overflow-hidden">

     <Luckysheet
        data={sheetData}
        height="100%"
        options={{
        showinfobar:false,
        showtoolbar:false,
        showstatisticBar:true,
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
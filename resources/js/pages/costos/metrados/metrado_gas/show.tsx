import { router, usePage } from '@inertiajs/react'
import React, { useState, useEffect, useRef } from 'react'
import AppLayout from '@/layouts/app-layout'
import type { BreadcrumbItem } from '@/types'
import type { MetradoGasSpreadsheet } from '@/types/metrado-gas'
import * as gasRoutes from '@/routes/metrados/gas'
import metradoRoutes from '@/routes/metrados'
import Luckysheet from '@/components/costos/tablas/Luckysheet'

interface PageProps {
 spreadsheet: MetradoGasSpreadsheet
 [key: string]: any
}

const COLS = {
 ITEM: 0,
 DES: 1,
 UND: 2,
 ELEM: 3,
 LARGO: 4,
 ANCHO: 5,
 ALTO: 6,
 NVEC: 7,
 LON: 8,
 AREA: 9,
 VOL: 10,
 KG: 11,
 UNDC: 12,
 TOTAL: 13
}

const HEADERS = [
 'ITEM', 'DESCRIPCIÓN', 'Und', 'Elem', 'Largo', 'Ancho', 'Alto', 'N° Vec',
 'Lon.', 'Área', 'Vol.', 'Kg', 'UndC', 'Total'
]

const calculateRow = (row: any[]) => {
 const r = [...row]
 
 const unidad = (r[COLS.UND] || '').toLowerCase().trim()
 
 const num = (i: number) => {
  const v = parseFloat(r[i])
  return isNaN(v) ? 0 : v
 }
 
 const elem = num(COLS.ELEM) || 1
 const largo = num(COLS.LARGO)
 const ancho = num(COLS.ANCHO)
 const alto = num(COLS.ALTO)
 const n = num(COLS.NVEC) || 1
 
 let lon = 0
 let area = 0
 let vol = 0
 let kg = 0
 let undc = 0
 
 switch(unidad) {
  case 'ml':
  case 'm':
   lon = largo * elem * n
   undc = lon
   break
   
  case 'und':
   undc = elem * n
   break
   
  case 'm3/h':
  case 'm3h':
   vol = elem * n
   undc = vol
   break
   
  case 'bar':
  case 'psi':
   kg = elem * n
   undc = kg
   break
   
  case 'm2':
   area = largo * ancho * elem * n
   undc = area
   break
   
  case 'm3':
   vol = largo * ancho * alto * elem * n
   undc = vol
   break
 }
 
 r[COLS.LON] = lon ? lon.toFixed(2) : ''
 r[COLS.AREA] = area ? area.toFixed(2) : ''
 r[COLS.VOL] = vol ? vol.toFixed(2) : ''
 r[COLS.KG] = kg ? kg.toFixed(2) : ''
 r[COLS.UNDC] = undc ? undc.toFixed(2) : ''
 r[COLS.TOTAL] = undc ? undc.toFixed(2) : ''
 
 return r
}

const applyAutoNumbering = (rows: any[][]) => {
 let cap = ''
 let index = 0
 
 return rows.map(row => {
  const r = [...row]
  
  if (r[COLS.ITEM] && typeof r[COLS.ITEM] === 'string' && r[COLS.ITEM].length === 2) {
   cap = r[COLS.ITEM]
   index = 0
  } else if (cap && r[COLS.DES] && r[COLS.DES] !== '') {
   index++
   r[COLS.ITEM] = `${cap}.${String(index).padStart(2, '0')}`
  }
  
  return r
 })
}

const toLuckysheetData = (rows: any[][]) => {
 const celldata: any[] = []
 
 HEADERS.forEach((h, c) => {
  celldata.push({
   r: 0,
   c,
   v: {
    v: h,
    m: h,
    bl: true,
    ht: 1,
    vt: 1,
    bg: "#2563eb",
    fc: "#ffffff",
    fs: 12
   }
  })
 })
 
 rows.forEach((row, r) => {
  if (!row) return
  row.forEach((value, c) => {
   if (value !== '' && value !== undefined && value !== null) {
    const text = String(value)
    const isSubtotal = text.includes("SUBTOTAL")
    const isTotal = text.includes("TOTAL GENERAL")
    
    celldata.push({
     r: r + 1,
     c,
     v: {
      v: value,
      m: text,
      bg: isSubtotal ? "#f3f4f6" : isTotal ? "#fde68a" : undefined
     }
    })
   }
  })
 })
 
 return [{
  name: 'Metrado Gas',
  celldata: celldata,
  columnlen: {
   0: 70, 1: 260, 2: 70, 3: 70, 4: 80, 5: 80, 6: 80,
   7: 80, 8: 90, 9: 90, 10: 90, 11: 90, 12: 90, 13: 110
  }
 }]
}

export default function Show() {
 const { spreadsheet } = usePage<PageProps>().props
 const [sheetData, setSheetData] = useState<any[]>([])
 const calculatingRef = useRef(false)
 
 useEffect(() => {
  console.log('Datos recibidos:', spreadsheet.sheet_data)
  
  const initial = spreadsheet.sheet_data?.length && spreadsheet.sheet_data.length > 0
   ? spreadsheet.sheet_data
   : [
     ['01', 'TUBERÍAS GAS', '', '', '', '', '', '', '', '', '', '', '', ''],
     ['', 'Tubería Cu 1/2"', 'ml', '25', '1000', '0', '0', '1', '', '', '', '', '', ''],
     ['', 'Codo 90° 1/2"', 'und', '12', '0', '0', '0', '1', '', '', '', '', '', ''],
     ['', 'Válvula esfera', 'und', '5', '0', '0', '0', '1', '', '', '', '', '', ''],
     ['02', 'EQUIPOS', '', '', '', '', '', '', '', '', '', '', '', ''],
     ['', 'Calentador GN', 'und', '1', '0', '0', '0', '1', '', '', '1.6', '', '', ''],
     ['', 'Cocina GN', 'und', '1', '0', '0', '0', '1', '', '', '0.8', '', '', '']
   ]
  
  console.log('Initial:', initial)
  const numbered = applyAutoNumbering(initial)
  console.log('Numbered:', numbered)
  const formatted = toLuckysheetData(numbered)
  console.log('Formatted:', formatted)
  
  setSheetData(formatted)
 }, [spreadsheet.sheet_data])
 
 const addNewRow = () => {
  const ls: any = (window as any).luckysheet
  if (!ls) {
   console.error('Luckysheet no está disponible')
   return
  }
  
  try {
   const selected = ls.getRange()
   let insertPosition = 0
   
   if (selected && selected.row && selected.row.length > 0) {
    insertPosition = selected.row[1]
   } else {
    const sheetData = ls.getSheetData()
    insertPosition = sheetData?.[0]?.length ? sheetData[0].length - 1 : 0
   }
   
   ls.insertRows(0, insertPosition, 1, true)
   
   setTimeout(() => {
    ls.setRangeSelect([{
     row: [insertPosition + 1, insertPosition + 1],
     column: [COLS.DES, COLS.DES]
    }])
   }, 100)
  } catch (error) {
   console.error('Error al agregar fila:', error)
  }
 }
 
 const handleCellUpdated = (r: number) => {
  if (calculatingRef.current) return
  
  calculatingRef.current = true
  
  setTimeout(() => {
   const ls: any = (window as any).luckysheet
   if (!ls) return
   
   try {
    const sheets = ls.getAllSheets()
    if (!sheets?.[0]?.celldata) return
    
    const celldata = sheets[0].celldata
    const row: any[] = []
    
    celldata.forEach((cell: any) => {
     if (cell.r === r) {
      row[cell.c] = cell.v?.v ?? ''
     }
    })
    
    const result = calculateRow(row)
    
    const cols = [COLS.LON, COLS.AREA, COLS.VOL, COLS.KG, COLS.UNDC, COLS.TOTAL]
    
    cols.forEach(c => {
     if (result[c] !== row[c]) {
      ls.setCellValue(r, c, result[c])
     }
    })
   } catch (error) {
    console.error('Error en cálculo:', error)
   }
   
   calculatingRef.current = false
  }, 30)
 }
 
 const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Metrados', href: metradoRoutes.index.url() },
  { title: 'Gas', href: gasRoutes.index.url() },
  { title: spreadsheet.name, href: '#' }
 ]
 
 return (
  <AppLayout breadcrumbs={breadcrumbs}>
   <div className="flex h-screen flex-col">
    <div className="border-b bg-white px-4 py-2 flex justify-between items-center shrink-0">
     <h1 className="text-sm font-bold">{spreadsheet.name}</h1>
     <button
      onClick={addNewRow}
      className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1.5 px-4 rounded-md flex items-center gap-2"
     >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
       <path d="M5 12h14"/><path d="M12 5v14"/>
      </svg>
      Agregar Fila
     </button>
    </div>
    
    <div className="flex-1 min-h-0">
     {sheetData.length > 0 ? (
      <Luckysheet
       data={sheetData}
       options={{
        showinfobar: false,
        showtoolbar: false,
        showstatisticBar: true,
        hook: {
         cellUpdated: handleCellUpdated
        }
       }}
      />
     ) : (
      <div className="p-4 text-center">Cargando datos...</div>
     )}
    </div>
   </div>
  </AppLayout>
 )
}